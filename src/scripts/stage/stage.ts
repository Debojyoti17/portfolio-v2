/**
 * Interactive particle stage.
 *
 * A small spring-physics engine on the CPU (a few thousand particles) drawing a GPU point cloud
 * with Three.js. Fingers and cursors part the particles smoothly, taps send a ripple outward, and
 * each scene adds its own meaning (see behaviours.ts).
 *
 * Touch: read through passive touch listeners so page scrolling is never blocked; touchmove keeps
 * firing while the page scrolls, so the field keeps reacting while you scroll.
 *
 * Loaded lazily; falls back to the server-rendered SVG without WebGL or under reduced motion.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { buildScene, isSceneName, type SceneData, type SceneName } from './scenes';
import { makeBehaviour, type Behaviour, type Ptr } from './behaviours';
import { fragmentShader, vertexShader } from './shaders';

const FOV = 38;
const CAM_Z = 10;
const HALF_H = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
const MAX_LIVE = 4;
const SLOTS = 2;

type Mode = 'hero' | 'card' | 'viewport';

const isSmall = () => matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const isCoarse = () => matchMedia('(pointer: coarse)').matches;

const COUNTS: Record<Mode, [number, number]> = {
  hero: [12000, 5500],
  card: [5200, 3400],
  viewport: [8500, 4500],
};

function cssColor(name: string, fallback: string): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return [0.5, 0.5, 0.5];
  c.fillStyle = '#000';
  c.fillStyle = v;
  const m = /^#([0-9a-f]{6})$/i.exec(c.fillStyle as string);
  if (!m) return [0.5, 0.5, 0.5];
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* ------------------------------------------------------------------ input */

interface GPtr {
  id: string;
  x: number;
  y: number;
}
const input = { pointers: [] as GPtr[] };
const upsert = (id: string, x: number, y: number) => {
  const p = input.pointers.find((q) => q.id === id);
  if (p) { p.x = x; p.y = y; } else input.pointers.push({ id, x, y });
};
const remove = (id: string) => {
  input.pointers = input.pointers.filter((q) => q.id !== id);
};

/* ----------------------------------------------------- renderer pool */

/**
 * WebGL contexts are scarce (browsers allow only a handful). The pool keeps at most MAX_LIVE
 * renderers and lends their canvases to whichever stages are on screen.
 */
interface PoolSlot {
  renderer: WebGLRenderer;
  canvas: HTMLCanvasElement;
  busy: boolean;
  dead: boolean;
}
const pool: PoolSlot[] = [];
function acquire(): PoolSlot | null {
  const free = pool.find((p) => !p.busy && !p.dead);
  if (free) {
    free.busy = true;
    return free;
  }
  if (pool.filter((p) => !p.dead).length >= MAX_LIVE) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'stage__canvas';
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const slot: PoolSlot = { renderer, canvas, busy: true, dead: false };
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    slot.dead = true;
  });
  pool.push(slot);
  return slot;
}

/* ------------------------------------------------------------------ stage */

interface Slot {
  x: number;
  y: number;
  tx: number;
  ty: number;
  amt: number;
  on: boolean;
}
interface Ripple {
  x: number;
  y: number;
  t0: number;
}

class Stage {
  mounted = false;
  visible = false;
  disposed = false;
  mode: Mode;
  sceneName: SceneName;
  n: number;

  private data!: SceneData;
  private beh!: Behaviour;
  private renderer!: WebGLRenderer;
  private slot: PoolSlot | null = null;
  canvas!: HTMLCanvasElement;
  private geometry!: BufferGeometry;
  private material!: ShaderMaterial;
  private scene3!: Scene;
  private camera!: PerspectiveCamera;
  private posAttr!: BufferAttribute;
  private lookAttr!: BufferAttribute;
  private pos!: Float32Array;
  private vel!: Float32Array;
  private kArr!: Float32Array;
  private cArr!: Float32Array;
  private uniforms = {
    uSize: { value: 30 },
    uPx: { value: 1 },
    uOpacity: { value: 1 },
    uInk: { value: new Vector3(0.1, 0.1, 0.1) },
    uAccent: { value: new Vector3(0.9, 0.1, 0.1) },
  };

  private w = 1;
  private h = 1;
  private halfW = 5;
  private halfH = HALF_H;
  private portrait = false;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private R = 1;
  private marginPx = 40;
  private baseSize = 30;
  private slots: Slot[] = Array.from({ length: SLOTS }, () => ({ x: 0, y: 0, tx: 0, ty: 0, amt: 0, on: false }));
  private ripples: Ripple[] = [];
  private lastInput = -99;
  private t = 0;
  private skip = false;
  private ro?: ResizeObserver;

  constructor(public root: HTMLElement) {
    this.mode = (['hero', 'card', 'viewport'].includes(root.dataset.stage ?? '') ? root.dataset.stage : 'card') as Mode;
    this.sceneName = isSceneName(root.dataset.scene) ? root.dataset.scene : 'scene';
    const small = isSmall();
    this.n = COUNTS[this.mode][small ? 1 : 0];
  }

  mount(): boolean {
    if (this.mounted || this.disposed) return this.mounted;
    const slot = acquire();
    if (!slot) return false;
    this.slot = slot;
    this.renderer = slot.renderer;
    this.canvas = slot.canvas;
    this.root.appendChild(this.canvas);
    this.data = buildScene(this.sceneName, this.n);
    this.beh = makeBehaviour(this.data);
    const n = this.n;

    this.camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.z = CAM_Z;
    this.scene3 = new Scene();
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.kArr = new Float32Array(n);
    this.cArr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = 26 * (0.75 + 0.5 * this.data.seed[i * 4]);
      this.kArr[i] = k;
      this.cArr[i] = 2 * Math.sqrt(k) * 0.5;
    }
    this.posAttr = new BufferAttribute(this.pos, 3);
    this.posAttr.setUsage(35048);
    this.lookAttr = new BufferAttribute(this.beh.look, 4);
    this.lookAttr.setUsage(35048);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aLook', this.lookAttr);
    this.geometry.setAttribute('aSeed', new BufferAttribute(this.data.seed, 4));
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const points = new Points(this.geometry, this.material);
    points.frustumCulled = false;
    this.scene3.add(points);

    this.baseSize = this.mode === 'hero' ? (isSmall() ? 40 : 32) : isSmall() ? 38 : 34;
    this.resize(true);
    // start as uninitialised noise; the springs pull the particles into form
    const r = this.data.seed;
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = (r[i * 4 + 1] - 0.5) * this.halfW * 1.7;
      this.pos[i * 3 + 1] = (r[i * 4 + 2] - 0.5) * this.halfH * 1.7;
      this.pos[i * 3 + 2] = (r[i * 4 + 3] - 0.5) * 3;
    }
    this.applyTheme();
    this.t = 0;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.root);
    this.root.classList.add('is-live');
    this.mounted = true;
    this.lastInput = -99;
    return true;
  }

  applyTheme() {
    if (!this.mounted && !this.uniforms) return;
    const ink = cssColor('--stage-ink', '#141416');
    const acc = cssColor('--accent', '#e4161f');
    this.uniforms.uInk.value.set(...ink);
    this.uniforms.uAccent.value.set(...acc);
    const dark = ink[0] + ink[1] + ink[2] > 1.5;
    if (this.material) this.material.blending = dark ? AdditiveBlending : NormalBlending;
    this.uniforms.uSize.value = this.baseSize * (dark ? 1 : 1.08);
  }

  resize(force = false) {
    if (!this.renderer) return;
    const rect = this.root.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (!force && w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.uniforms.uPx.value = dpr * (h / 900) * (this.mode === 'hero' ? 1 : 1.35);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.halfH = HALF_H;
    this.halfW = HALF_H * this.camera.aspect;
    this.portrait = this.camera.aspect < 0.9;
    if (this.mode === 'hero') {
      const occ = this.portrait ? 1.0 : 0.56;
      this.scale = Math.min((occ * this.halfW) / 3.5, (0.86 * this.halfH) / 2.25);
      this.offX = this.portrait ? 0 : 0.2 * this.halfW;
      this.offY = this.portrait ? this.halfH * 0.34 : 0;
    } else {
      this.scale = Math.min((0.82 * this.halfW) / 3.5, (0.8 * this.halfH) / 2.25);
      this.offX = 0;
      this.offY = 0;
    }
    const rPx = Math.min(115, Math.max(46, 0.13 * Math.min(w, h))) * (isCoarse() ? 1.15 : 1);
    this.marginPx = rPx;
    this.R = rPx * ((2 * this.halfH) / h);
  }

  /** Tap / click: ripple + scene-specific action. Coordinates are client pixels. */
  tap(cx: number, cy: number) {
    if (!this.mounted || !this.visible) return;
    const rect = this.root.getBoundingClientRect();
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return;
    const wx = ((cx - rect.left) / rect.width * 2 - 1) * this.halfW;
    const wy = -(((cy - rect.top) / rect.height) * 2 - 1) * this.halfH;
    this.ripples.push({ x: wx, y: wy, t0: this.t });
    if (this.ripples.length > 4) this.ripples.shift();
    this.beh.tap((wx - this.offX) / this.scale, (wy - this.offY) / this.scale);
    this.lastInput = this.t;
  }

  step(dt: number, time: number) {
    if (!this.mounted) return;
    this.t += dt;
    const t = this.t;
    const rect = this.root.getBoundingClientRect();
    if (rect.width > 0 && (Math.abs(rect.width - this.w) > 1.5 || Math.abs(rect.height - this.h) > 1.5)) this.resize();

    // pointers → smoothed slots
    const gp = input.pointers;
    let any = false;
    for (let j = 0; j < SLOTS; j++) {
      const s = this.slots[j], g = gp[j];
      let on = false;
      if (g) {
        const m = this.marginPx;
        on = g.x >= rect.left - m && g.x <= rect.right + m && g.y >= rect.top - m && g.y <= rect.bottom + m;
        if (on) {
          const wx = ((g.x - rect.left) / rect.width * 2 - 1) * this.halfW;
          const wy = -(((g.y - rect.top) / rect.height) * 2 - 1) * this.halfH;
          if (!s.on && s.amt < 0.05) { s.x = wx; s.y = wy; }
          s.tx = wx;
          s.ty = wy;
        }
      }
      s.on = on;
      s.amt += ((on ? 1 : 0) - s.amt) * (1 - Math.exp(-dt * (on ? 14 : 5)));
      if (on) {
        s.x += (s.tx - s.x) * (1 - Math.exp(-dt * 22));
        s.y += (s.ty - s.y) * (1 - Math.exp(-dt * 22));
        any = true;
      }
    }
    if (any) this.lastInput = t;

    const ptrWorld: Ptr[] = [];
    const ptrHome: Ptr[] = [];
    for (const s of this.slots) {
      if (s.amt < 0.02) continue;
      ptrWorld.push({ x: s.x, y: s.y, amt: s.amt });
      ptrHome.push({ x: (s.x - this.offX) / this.scale, y: (s.y - this.offY) / this.scale, amt: s.amt });
    }
    this.ripples = this.ripples.filter((r) => t - r.t0 < 1.2);

    this.beh.update({
      t,
      dt,
      worldR: this.R,
      scale: this.scale,
      origin: { x: this.offX, y: this.offY },
      ptrHome,
      ptrWorld,
      pos: this.pos,
      idle: t - this.lastInput,
    });

    /* ---- physics ---- */
    const { pos, vel, kArr, cArr } = this;
    const home = this.data.home, seed = this.data.seed, hd = this.beh.hdyn, look = this.beh.look;
    const n = this.n;
    const swayOn = this.data.rotate;
    const mx = ptrWorld.length ? ptrWorld[0].x / this.halfW : 0;
    const yaw = this.data.view.yaw + (swayOn ? Math.sin(t * 0.18) * 0.16 + mx * 0.08 : 0);
    const pitch = this.data.view.pitch;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = this.scale, offX = this.offX, offY = this.offY;
    const R = this.R, R2 = R * R;
    const breath = 0.028;
    const np = ptrWorld.length, nr = this.ripples.length;
    const ringSpeed = R * 5.5;
    const rx: number[] = [], ry: number[] = [], rrad: number[] = [], ramp: number[] = [];
    for (const r of this.ripples) {
      const age = t - r.t0;
      rx.push(r.x);
      ry.push(r.y);
      rrad.push(age * ringSpeed);
      ramp.push(Math.exp(-age * 1.9));
    }
    const bandW = 0.5 * R;
    for (let i = 0, i3 = 0, i4 = 0; i < n; i++, i3 += 3, i4 += 4) {
      const hx = home[i3] + hd[i3], hy = home[i3 + 1] + hd[i3 + 1], hz = home[i3 + 2] + hd[i3 + 2];
      const x1 = hx * cy + hz * sy;
      const z1 = -hx * sy + hz * cy;
      const y1 = hy * cp - z1 * sp;
      const z2 = hy * sp + z1 * cp;
      const tx = x1 * scale + offX + Math.sin(time * 0.55 + seed[i4] * 60) * breath;
      const ty = y1 * scale + offY + Math.cos(time * 0.43 + seed[i4 + 1] * 50) * breath;
      const tz = z2 * scale;
      const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
      const k = kArr[i], c = cArr[i];
      let ax = k * (tx - px) - c * vel[i3];
      let ay = k * (ty - py) - c * vel[i3 + 1];
      let az = k * (tz - pz) - c * vel[i3 + 2];
      let prox = 0;
      for (let j = 0; j < np; j++) {
        const p = ptrWorld[j];
        const dx = px - p.x, dy = py - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) + 1e-4;
          let w = 1 - d / R;
          w = w * w * (3 - 2 * w);
          const f = k * R * 1.05 * w * p.amt;
          const ux = dx / d, uy = dy / d;
          ax += ux * f - uy * f * 0.3;
          ay += uy * f + ux * f * 0.3;
          az += f * 0.5;
          if (w * p.amt > prox) prox = w * p.amt;
        }
      }
      for (let j = 0; j < nr; j++) {
        const dx = px - rx[j], dy = py - ry[j];
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
        const q = (d - rrad[j]) / bandW;
        if (q > -3 && q < 3) {
          const band = Math.exp(-q * q) * ramp[j];
          const f = k * R * 1.5 * band;
          ax += (dx / d) * f;
          ay += (dy / d) * f;
          az += f * 0.4;
          if (band * 0.7 > prox) prox = band * 0.7;
        }
      }
      const vx = vel[i3] + ax * dt, vy = vel[i3 + 1] + ay * dt, vz = vel[i3 + 2] + az * dt;
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      pos[i3] = px + vx * dt;
      pos[i3 + 1] = py + vy * dt;
      pos[i3 + 2] = pz + vz * dt;
      look[i4 + 3] = prox;
    }
    this.posAttr.needsUpdate = true;
    this.lookAttr.needsUpdate = true;
    this.renderer.render(this.scene3, this.camera);
  }

  dispose() {
    if (!this.mounted) return;
    this.mounted = false;
    this.ro?.disconnect();
    this.geometry.dispose();
    this.material.dispose();
    this.canvas.remove();
    if (this.slot) this.slot.busy = false;
    this.slot = null;
    this.root.classList.remove('is-live');
  }

  /** distance of the stage centre from the viewport centre, for eviction decisions */
  distance(): number {
    const r = this.root.getBoundingClientRect();
    return Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
  }
}

/* -------------------------------------------------------------- manager */

export async function mountStages(): Promise<() => void> {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const stages: Stage[] = [];
  document.querySelectorAll<HTMLElement>('[data-stage]').forEach((root) => {
    stages.push(new Stage(root));
  });
  if (!stages.length) return () => {};

  let raf = 0;
  let last = 0;
  let toggle = false;
  const stats = { frames: 0, sumMs: 0, maxMs: 0, recent: [] as number[] };
  const live = () => stages.filter((s) => s.mounted);

  const ensureMounted = (s: Stage) => {
    if (s.mounted || s.disposed) return;
    if (!s.mount()) {
      const far = live().filter((o) => !o.visible).sort((a, b) => b.distance() - a.distance())[0];
      if (!far) return;
      far.dispose();
      s.mount();
    }
  };

  const loop = (now: number) => {
    raf = 0;
    const active = stages.filter((s) => s.mounted && s.visible);
    if (!active.length || document.hidden) return;
    raf = requestAnimationFrame(loop);
    const dtRaw = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    // idle: half rate when nobody is interacting
    const idle = active.every((s) => s['t'] - s['lastInput'] > 3);
    if (idle) {
      toggle = !toggle;
      if (toggle) return;
    }
    const dt = Math.min(0.033, dtRaw);
    const t0 = performance.now();
    for (const s of active) s.step(dt, now / 1000);
    const ms = performance.now() - t0;
    stats.frames++;
    stats.sumMs += ms;
    if (ms > stats.maxMs) stats.maxMs = ms;
    stats.recent.push(ms);
    if (stats.recent.length > 240) stats.recent.shift();
  };
  const start = () => {
    if (!raf && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const s = stages.find((x) => x.root === e.target);
        if (!s) continue;
        s.visible = e.isIntersecting;
        if (s.visible) ensureMounted(s);
      }
      start();
    },
    { rootMargin: '120px' },
  );
  stages.forEach((s) => io.observe(s.root));

  /* input: pointer events for mouse/pen, passive touch events for fingers */
  const opts: AddEventListenerOptions = { passive: true };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    upsert('mouse', e.clientX, e.clientY);
    start();
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    stages.forEach((s) => s.tap(e.clientX, e.clientY));
  };
  const onMouseLeave = () => remove('mouse');
  const onTouchStart = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      upsert('t' + t.identifier, t.clientX, t.clientY);
      stages.forEach((s) => s.tap(t.clientX, t.clientY));
    }
    start();
  };
  const onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.touches)) upsert('t' + t.identifier, t.clientX, t.clientY);
    start();
  };
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) remove('t' + t.identifier);
  };
  window.addEventListener('pointermove', onPointer, opts);
  window.addEventListener('pointerdown', onPointerDown, opts);
  document.documentElement.addEventListener('pointerleave', onMouseLeave, opts);
  window.addEventListener('touchstart', onTouchStart, opts);
  window.addEventListener('touchmove', onTouchMove, opts);
  window.addEventListener('touchend', onTouchEnd, opts);
  window.addEventListener('touchcancel', onTouchEnd, opts);
  const onVis = () => (document.hidden ? undefined : start());
  document.addEventListener('visibilitychange', onVis);

  const theme = () => stages.forEach((s) => s.mounted && s.applyTheme());
  const themeObserver = new MutationObserver(theme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', theme);

  (window as any).__stage = {
    stats,
    live: () => live().map((s) => ({ scene: s.sceneName, mode: s.mode, n: s.n })),
    summary: () => {
      const r = [...stats.recent].sort((a, b) => a - b);
      return { frames: stats.frames, avgMs: stats.sumMs / Math.max(1, stats.frames), p95Ms: r[Math.floor(r.length * 0.95)] ?? 0, maxMs: stats.maxMs };
    },
  };

  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerdown', onPointerDown);
    document.documentElement.removeEventListener('pointerleave', onMouseLeave);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    document.removeEventListener('visibilitychange', onVis);
    themeObserver.disconnect();
    mq.removeEventListener('change', theme);
    input.pointers = [];
    stages.forEach((s) => {
      s.disposed = true;
      s.dispose();
    });
    // free the GPU contexts when leaving the page
    while (pool.length) {
      const p = pool.pop()!;
      p.renderer.dispose();
      p.renderer.forceContextLoss();
    }
    delete (window as any).__stage;
  };
}
