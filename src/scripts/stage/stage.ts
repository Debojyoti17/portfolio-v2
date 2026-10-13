/**
 * The particle field: ONE persistent WebGL canvas shared by the whole site.
 *
 * Each page may contain a slot (`[data-field-slot]`): the home hero, a project page, the 404 page.
 * On every Astro view transition the same canvas is moved into the new page's slot and the particles
 * flow from the form they last held into the new page's form, so the field reads as one continuous
 * material. Pages without a slot simply park it.
 *
 * Physics: a small CPU spring engine (a few thousand particles). A finger or cursor parts the
 * particles, a tap sends a ripple, and each scene can add one meaningful behaviour (behaviours.ts).
 * Touch is read through passive listeners, so page scrolling is never blocked.
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
import { SCENE_NAMES, buildScene, isSceneName, type SceneData, type SceneName } from './scenes';
import { makeBehaviour, type Behaviour, type Ptr } from './behaviours';
import { fragmentShader, vertexShader } from './shaders';
import { rng } from '../../lib/hash';

const FOV = 38;
const CAM_Z = 10;
const HALF_H = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
const SLOTS = 2;
/** seconds each particle takes to travel to its new form */
const MORPH = 1.1;
/** spread of departure times across particles */
const STAGGER = 0.6;

type Mode = 'hero' | 'viewport';

const isSmall = () => matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const isCoarse = () => matchMedia('(pointer: coarse)').matches;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

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
interface Built {
  data: SceneData;
  beh: Behaviour;
}

/* ------------------------------------------------------------------ field */

class Field {
  readonly n: number;
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private material: ShaderMaterial;
  private scene3 = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  private posAttr: BufferAttribute;
  private lookAttr: BufferAttribute;
  private pos: Float32Array;
  private vel: Float32Array;
  private lookBuf: Float32Array;
  private fromPos: Float32Array;
  private fromLook: Float32Array;
  private seed: Float32Array;
  private kArr: Float32Array;
  private cArr: Float32Array;
  private uniforms = {
    uSize: { value: 30 },
    uPx: { value: 1 },
    uOpacity: { value: 1 },
    uInk: { value: new Vector3(0.1, 0.1, 0.1) },
    uAccent: { value: new Vector3(0.9, 0.1, 0.1) },
  };

  private cache = new Map<SceneName, Built>();
  private cur: Built | null = null;
  sceneName: SceneName | null = null;
  private mode: Mode = 'hero';
  private side = false;
  slot: HTMLElement | null = null;
  private attachedOnce = false;

  private w = 1;
  private h = 1;
  private halfW = 5;
  private halfH = HALF_H;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private R = 1;
  private marginPx = 40;
  private baseSize = 32;
  private slots: Slot[] = Array.from({ length: SLOTS }, () => ({ x: 0, y: 0, tx: 0, ty: 0, amt: 0, on: false }));
  private ripples: Ripple[] = [];
  private lastInput = -99;
  t = 0;
  private morphT0 = -99;
  morphing = false;

  visible = true;
  private raf = 0;
  private last = 0;
  private lastStep = 0;
  private skip = false;
  private ro = new ResizeObserver(() => this.resize());
  private io = new IntersectionObserver((e) => {
    this.visible = e[e.length - 1]?.isIntersecting ?? true;
    if (this.visible) this.start();
  }, { rootMargin: '80px' });

  stats = { frames: 0, sumMs: 0, maxMs: 0, recent: [] as number[], dts: [] as number[], attachMs: 0 };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'field__canvas';
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    const n = (this.n = isSmall() ? 5000 : 10000);
    this.camera.position.z = CAM_Z;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.lookBuf = new Float32Array(n * 4);
    this.fromPos = new Float32Array(n * 3);
    this.fromLook = new Float32Array(n * 4);
    this.seed = new Float32Array(n * 4);
    const r = rng(424242);
    for (let i = 0; i < this.seed.length; i++) this.seed[i] = r();
    this.kArr = new Float32Array(n);
    this.cArr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = 26 * (0.75 + 0.5 * this.seed[i * 4]);
      this.kArr[i] = k;
      this.cArr[i] = 2 * Math.sqrt(k) * 0.5;
    }
    this.posAttr = new BufferAttribute(this.pos, 3);
    this.posAttr.setUsage(35048);
    this.lookAttr = new BufferAttribute(this.lookBuf, 4);
    this.lookAttr.setUsage(35048);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('aLook', this.lookAttr);
    geometry.setAttribute('aSeed', new BufferAttribute(this.seed, 4));
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const points = new Points(geometry, this.material);
    points.frustumCulled = false;
    this.scene3.add(points);
    this.baseSize = isSmall() ? 40 : 32;
    this.applyTheme();
  }

  private build(name: SceneName): Built {
    let b = this.cache.get(name);
    if (!b) {
      const data = buildScene(name, this.n);
      b = { data, beh: makeBehaviour(data) };
      this.cache.set(name, b);
    }
    return b;
  }

  /** Build the remaining scenes in idle time so a navigation never has to. */
  warm() {
    const queue = SCENE_NAMES.filter((s) => !this.cache.has(s));
    const ric = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 200));
    const step = () => {
      const s = queue.shift();
      if (!s) return;
      this.build(s);
      ric(step);
    };
    ric(step);
  }

  applyTheme() {
    const ink = cssColor('--stage-ink', '#141416');
    const acc = cssColor('--accent', '#e4161f');
    this.uniforms.uInk.value.set(...ink);
    this.uniforms.uAccent.value.set(...acc);
    const dark = ink[0] + ink[1] + ink[2] > 1.5;
    this.material.blending = dark ? AdditiveBlending : NormalBlending;
    this.uniforms.uSize.value = this.baseSize * (dark ? 1 : 1.08);
  }

  /** Move the canvas into this page's slot (or park it) and flow into the slot's form. */
  attach(slot: HTMLElement | null) {
    if (!slot) {
      this.park();
      return;
    }
    const scene: SceneName = isSceneName(slot.dataset.scene) ? slot.dataset.scene : 'scene';
    if (slot !== this.slot) {
      this.slot?.classList.remove('is-live');
      this.ro.disconnect();
      this.io.disconnect();
      slot.appendChild(this.canvas);
      this.slot = slot;
      this.mode = slot.dataset.mode === 'viewport' ? 'viewport' : 'hero';
      this.ro.observe(slot);
      this.io.observe(slot);
      this.visible = true;
      this.resize(true);
    }
    if (!this.attachedOnce) {
      setTimeout(() => this.warm(), 2500);
      // very first appearance: the particles start as uninitialised noise and fade in
      for (let i = 0; i < this.n; i++) {
        this.pos[i * 3] = (this.seed[i * 4 + 1] - 0.5) * this.halfW * 1.8;
        this.pos[i * 3 + 1] = (this.seed[i * 4 + 2] - 0.5) * this.halfH * 1.8;
        this.pos[i * 3 + 2] = (this.seed[i * 4 + 3] - 0.5) * 3;
        this.lookBuf[i * 4] = 0;
      }
    }
    if (scene !== this.sceneName) this.setScene(scene);
    slot.classList.toggle('is-instant', this.attachedOnce);
    slot.classList.add('is-live');
    this.attachedOnce = true;
    // draw immediately so the view-transition snapshot of the new page already shows the field
    this.render(0);
    this.start();
  }

  park() {
    this.stop();
    this.slot?.classList.remove('is-live');
    this.ro.disconnect();
    this.io.disconnect();
    this.canvas.remove();
    this.slot = null;
  }

  private setScene(name: SceneName) {
    this.fromPos.set(this.pos);
    this.fromLook.set(this.lookBuf);
    this.cur = this.build(name);
    this.sceneName = name;
    this.morphT0 = this.t;
    this.morphing = true;
  }

  resize(force = false) {
    if (!this.slot) return;
    const rect = this.slot.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (!force && w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.uniforms.uPx.value = dpr * Math.min(1.2, Math.max(0.6, h / 900)) * (this.mode === 'hero' ? 1 : 1.3);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.halfH = HALF_H;
    this.halfW = HALF_H * this.camera.aspect;
    // the desktop hero lays the field beside the name; everywhere else it is centred in its frame
    this.side = this.mode === 'hero' && window.innerWidth >= 900;
    if (this.side) {
      this.scale = Math.min((0.56 * this.halfW) / 3.5, (0.86 * this.halfH) / 2.25);
      this.offX = 0.2 * this.halfW;
    } else {
      const fit = this.mode === 'hero' ? 0.94 : 0.82;
      this.scale = Math.min((fit * this.halfW) / 3.5, ((this.mode === 'hero' ? 0.9 : 0.8) * this.halfH) / 2.25);
      this.offX = 0;
    }
    this.offY = 0;
    const rPx = Math.min(115, Math.max(46, 0.13 * Math.min(w, h))) * (isCoarse() ? 1.15 : 1);
    this.marginPx = rPx;
    this.R = rPx * ((2 * this.halfH) / h);
  }

  tap(cx: number, cy: number) {
    if (!this.slot || !this.cur) return;
    const rect = this.slot.getBoundingClientRect();
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return;
    const wx = ((cx - rect.left) / rect.width * 2 - 1) * this.halfW;
    const wy = -(((cy - rect.top) / rect.height) * 2 - 1) * this.halfH;
    this.ripples.push({ x: wx, y: wy, t0: this.t });
    if (this.ripples.length > 4) this.ripples.shift();
    this.cur.beh.tap((wx - this.offX) / this.scale, (wy - this.offY) / this.scale);
    this.lastInput = this.t;
    this.start();
  }

  /* ---------------------------------------------------------------- loop */

  start() {
    if (this.raf || !this.slot || !this.visible || document.hidden) return;
    this.last = this.lastStep = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  private frame = (now: number) => {
    this.raf = 0;
    if (!this.slot || !this.visible || document.hidden) return;
    this.raf = requestAnimationFrame(this.frame);
    const frameDt = (now - this.last) / 1000 || 0.016;
    this.last = now;
    this.stats.dts.push(frameDt * 1000);
    if (this.stats.dts.length > 600) this.stats.dts.shift();
    // half rate while nobody interacts and nothing is changing
    if (!this.morphing && this.t - this.lastInput > 3) {
      this.skip = !this.skip;
      if (this.skip) return;
    }
    const dt = Math.min(0.04, (now - this.lastStep) / 1000 || 0.016);
    this.lastStep = now;
    const t0 = performance.now();
    this.render(Math.min(0.033, dt));
    const ms = performance.now() - t0;
    this.stats.frames++;
    this.stats.sumMs += ms;
    if (ms > this.stats.maxMs) this.stats.maxMs = ms;
    this.stats.recent.push(ms);
    if (this.stats.recent.length > 240) this.stats.recent.shift();
  };

  /** advance the simulation by dt and draw */
  render(dt: number) {
    if (!this.slot || !this.cur) return;
    this.t += dt;
    const t = this.t;
    const rect = this.slot.getBoundingClientRect();
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

    const { data, beh } = this.cur;
    if (dt > 0) {
      beh.update({
        t, dt, worldR: this.R, scale: this.scale, origin: { x: this.offX, y: this.offY },
        ptrHome, ptrWorld, pos: this.pos, idle: t - this.lastInput,
      });
    }

    /* ---- physics ---- */
    const { pos, vel, kArr, cArr, lookBuf, fromPos, fromLook } = this;
    const home = data.home, hd = beh.hdyn, look = beh.look, seed = this.seed;
    const n = this.n;
    const mx = ptrWorld.length ? ptrWorld[0].x / this.halfW : 0;
    const yaw = data.view.yaw + (data.rotate ? Math.sin(t * 0.18) * 0.16 + mx * 0.08 : 0);
    const pitch = data.view.pitch;
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
    const morphing = this.morphing;
    const mt = t - this.morphT0;
    if (morphing && mt > MORPH + STAGGER) this.morphing = false;

    for (let i = 0, i3 = 0, i4 = 0; i < n; i++, i3 += 3, i4 += 4) {
      const hx = home[i3] + hd[i3], hy = home[i3 + 1] + hd[i3 + 1], hz = home[i3 + 2] + hd[i3 + 2];
      const x1 = hx * cy + hz * sy;
      const z1 = -hx * sy + hz * cy;
      const y1 = hy * cp - z1 * sp;
      const z2 = hy * sp + z1 * cp;
      let tx = x1 * scale + offX + Math.sin(t * 0.55 + seed[i4] * 60) * breath;
      let ty = y1 * scale + offY + Math.cos(t * 0.43 + seed[i4 + 1] * 50) * breath;
      let tz = z2 * scale;
      let la = look[i4], ls = look[i4 + 1], lc = look[i4 + 2];
      if (morphing) {
        const tm = (mt - seed[i4 + 2] * STAGGER) / MORPH;
        if (tm < 1) {
          const e = tm <= 0 ? 0 : easeInOut(tm);
          const lift = Math.sin(Math.PI * e);
          tx = fromPos[i3] + (tx - fromPos[i3]) * e + (seed[i4 + 1] - 0.5) * lift * 1.4;
          ty = fromPos[i3 + 1] + (ty - fromPos[i3 + 1]) * e + (seed[i4 + 3] - 0.5) * lift * 1.0;
          tz = fromPos[i3 + 2] + (tz - fromPos[i3 + 2]) * e + lift * 1.2;
          la = fromLook[i4] + (la - fromLook[i4]) * e;
          ls = fromLook[i4 + 1] + (ls - fromLook[i4 + 1]) * e;
          lc = fromLook[i4 + 2] + (lc - fromLook[i4 + 2]) * e;
        }
      }
      lookBuf[i4] = la;
      lookBuf[i4 + 1] = ls;
      lookBuf[i4 + 2] = lc;
      if (dt === 0) continue;
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
      lookBuf[i4 + 3] = prox;
    }
    this.posAttr.needsUpdate = true;
    this.lookAttr.needsUpdate = true;
    this.renderer.render(this.scene3, this.camera);
  }

  destroy() {
    this.park();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/* --------------------------------------------------------------- module API */

let field: Field | null = null;
let failed = false;

/** Create the shared field (once). Returns false when WebGL is unavailable. */
export function initField(): boolean {
  if (field) return true;
  if (failed || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    field = new Field();
  } catch {
    failed = true;
    return false;
  }
  const f = field;
  f.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    f.destroy();
    document.documentElement.classList.remove('field-live');
    field = null;
    failed = true;
  });

  const opts: AddEventListenerOptions = { passive: true };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    upsert('mouse', e.clientX, e.clientY);
    field?.start();
  }, opts);
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') field?.tap(e.clientX, e.clientY);
  }, opts);
  document.documentElement.addEventListener('pointerleave', () => remove('mouse'), opts);
  window.addEventListener('touchstart', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      upsert('t' + t.identifier, t.clientX, t.clientY);
      field?.tap(t.clientX, t.clientY);
    }
    field?.start();
  }, opts);
  window.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.touches)) upsert('t' + t.identifier, t.clientX, t.clientY);
    field?.start();
  }, opts);
  const end = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) remove('t' + t.identifier);
  };
  window.addEventListener('touchend', end, opts);
  window.addEventListener('touchcancel', end, opts);
  document.addEventListener('visibilitychange', () => (document.hidden ? field?.stop() : field?.start()));
  new MutationObserver(() => field?.applyTheme()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => field?.applyTheme());

  (window as any).__stage = {
    get scene() { return field?.sceneName; },
    get morphing() { return field?.morphing; },
    live: () => (field && field.slot ? [{ scene: field.sceneName, n: field.n }] : []),
    resetStats: () => field && Object.assign(field.stats, { frames: 0, sumMs: 0, maxMs: 0, recent: [], dts: [] }),
    summary: () => {
      if (!field) return null;
      const s = field.stats;
      const r = [...s.recent].sort((a, b) => a - b);
      const d = [...s.dts].sort((a, b) => a - b);
      return {
        frames: s.frames,
        avgMs: s.sumMs / Math.max(1, s.frames),
        p95Ms: r[Math.floor(r.length * 0.95)] ?? 0,
        maxMs: s.maxMs,
        frameP95: d[Math.floor(d.length * 0.95)] ?? 0,
        over33: s.dts.filter((x) => x > 33.4).length,
        attachMs: s.attachMs,
      };
    },
  };
  return true;
}

/** Put the field into the current page's slot (or park it if the page has none). */
export function attachField(): void {
  if (!field) return;
  const t0 = performance.now();
  field.attach(document.querySelector<HTMLElement>('[data-field-slot]'));
  field.stats.attachMs = performance.now() - t0;
  document.documentElement.classList.toggle('field-live', !!field.slot);
}

/**
 * Before a navigation: the slot glides to its new position only if it is actually on screen,
 * otherwise it would fly in from far above.
 */
export function prepareLeave(): void {
  const slot = document.querySelector<HTMLElement>('[data-field-slot]');
  if (!slot) return;
  const r = slot.getBoundingClientRect();
  const onScreen = r.bottom > 0 && r.top < window.innerHeight;
  if (!onScreen) slot.style.viewTransitionName = 'none';
}
