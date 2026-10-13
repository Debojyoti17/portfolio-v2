/**
 * The particle engine. A `Stage` is one canvas with one point cloud and a small CPU spring-physics
 * engine; the site uses a handful of them (the persistent field, the hover preview, a small pool for
 * specimens and ambient fields) and they all share input, scene data and one animation loop.
 *
 * Physics: each particle springs toward its home position (slightly under-damped). A finger or cursor
 * parts the particles with a smooth falloff and a faint swirl, a tap sends a ripple, and each scene can
 * add one meaningful behaviour (behaviours.ts). Changing scene is a per-particle staggered morph.
 */
import { CAM_Z, CanvasRenderer, FOV, PointRenderer, type Renderer } from './gl';
import { SCENE_NAMES, buildScene, type SceneData, type SceneName } from './scenes';
import { makeBehaviour, type Behaviour, type Ptr } from './behaviours';
import { rng } from '../../lib/hash';

const HALF_H = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
const SLOTS = 2;

/**
 * hero      the home hero (beside the name on desktop, a band above it on phones)
 * viewport  the framed field on a project page
 * spec      a compact specimen (project rows on touch, the next-project link)
 * preview   the floating hover preview (fine pointers)
 * ambient   a quiet backdrop (contact block, menu)
 */
export type Mode = 'hero' | 'viewport' | 'spec' | 'preview' | 'ambient';
export interface Timing {
  /** seconds each particle takes to travel */
  morph: number;
  /** spread of departure times across particles */
  stagger: number;
  /** how far particles lift toward the viewer mid-flight */
  lift: number;
}
export const MORPH: Timing = { morph: 1.1, stagger: 0.6, lift: 1 };

export const isSmall = () => matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
export const isCoarse = () => matchMedia('(pointer: coarse)').matches;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

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

/* ------------------------------------------------------------------ input (shared) */

export const input = { pointers: [] as { id: string; x: number; y: number }[] };
export function upsertPointer(id: string, x: number, y: number) {
  const p = input.pointers.find((q) => q.id === id);
  if (p) {
    p.x = x;
    p.y = y;
  } else input.pointers.push({ id, x, y });
}
export function removePointer(id: string) {
  input.pointers = input.pointers.filter((q) => q.id !== id);
}

/* ------------------------------------------------------------------ scene data (shared) */

const sceneCache = new Map<string, SceneData>();
export function sceneFor(name: SceneName, n: number): SceneData {
  const key = `${name}:${n}`;
  let d = sceneCache.get(key);
  if (!d) {
    d = buildScene(name, n);
    sceneCache.set(key, d);
  }
  return d;
}
/** Build every scene for these particle counts in idle time, so a navigation never has to. */
export function warmScenes(counts: number[]) {
  const queue: [SceneName, number][] = [];
  for (const n of counts) for (const s of SCENE_NAMES) if (!sceneCache.has(`${s}:${n}`)) queue.push([s, n]);
  const ric = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 200));
  const step = () => {
    const job = queue.shift();
    if (!job) return;
    sceneFor(job[0], job[1]);
    ric(step);
  };
  ric(step);
}

/* ------------------------------------------------------------------ one loop for all stages */

const stages = new Set<Stage>();
let raf = 0;
let lastLoop = 0;
export const stats = { frames: 0, sumMs: 0, maxMs: 0, recent: [] as number[], dts: [] as number[], attachMs: 0 };

function loop(now: number) {
  raf = 0;
  if (document.hidden) return;
  if (lastLoop) {
    stats.dts.push(now - lastLoop);
    if (stats.dts.length > 900) stats.dts.shift();
  }
  lastLoop = now;
  const t0 = performance.now();
  let more = false;
  let worked = false;
  for (const s of stages) {
    const r = s.step(now);
    if (r) more = true;
    if (r === 2) worked = true;
  }
  if (worked) {
    const ms = performance.now() - t0;
    stats.frames++;
    stats.sumMs += ms;
    if (ms > stats.maxMs) stats.maxMs = ms;
    stats.recent.push(ms);
    if (stats.recent.length > 600) stats.recent.shift();
  }
  if (more) raf = requestAnimationFrame(loop);
  else lastLoop = 0;
}
export function wake() {
  if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
}
export function allStages(): Iterable<Stage> {
  return stages;
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
interface Built {
  data: SceneData;
  beh: Behaviour;
}
export interface AttachOptions {
  scene?: SceneName | SceneData;
  /** start in the final form (a specimen appearing where its still was) */
  snap?: boolean;
  /** start as scattered noise and flow in */
  fromNoise?: boolean;
  timing?: Timing;
  opacity?: number;
}

export class Stage {
  readonly n: number;
  canvas: HTMLCanvasElement;
  private r: Renderer;
  private pos: Float32Array;
  private vel: Float32Array;
  private lookBuf: Float32Array;
  private fromPos: Float32Array;
  private fromLook: Float32Array;
  private seed: Float32Array;
  private kArr: Float32Array;
  private cArr: Float32Array;
  private behs = new Map<SceneData, Behaviour>();
  private cur: Built | null = null;
  scene: SceneName | 'custom' | null = null;
  mode: Mode = 'hero';
  slot: HTMLElement | null = null;
  private side = false;
  private baseSize: number;

  private w = 1;
  private h = 1;
  private halfW = 5;
  private halfH = HALF_H;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private R = 1;
  private marginPx = 40;
  private slots: Slot[] = Array.from({ length: SLOTS }, () => ({ x: 0, y: 0, tx: 0, ty: 0, amt: 0, on: false }));
  private ripples: { x: number; y: number; t0: number }[] = [];
  private lastInput = -99;
  t = 0;
  private morphT0 = -99;
  private timing: Timing = MORPH;
  morphing = false;
  disperse = 0;
  /** spring stiffness multiplier (the name intro pulls particles tight onto the letters) */
  stiffness = 1;
  /** damping multiplier (1 = slightly under-damped) */
  damping = 1;
  private opacity = 1;
  private opacityTarget = 1;
  private timeline: { at: number; fn: () => void }[] = [];

  visible = true;
  private last = 0;
  private skip = false;
  private ro = new ResizeObserver(() => this.resize());
  private io = new IntersectionObserver(
    (e) => {
      this.visible = e[e.length - 1]?.isIntersecting ?? true;
      if (this.visible) wake();
    },
    { rootMargin: '60px' },
  );

  /** `lite`: start on a 2D canvas and move to WebGL later (see gl.ts and upgrade()) */
  constructor(n: number, lite = false) {
    this.n = n;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'field__canvas';
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.lookBuf = new Float32Array(n * 4);
    this.fromPos = new Float32Array(n * 3);
    this.fromLook = new Float32Array(n * 4);
    this.seed = new Float32Array(n * 4);
    const r = rng(424242 + n);
    for (let i = 0; i < this.seed.length; i++) this.seed[i] = r();
    this.kArr = new Float32Array(n);
    this.cArr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = 26 * (0.75 + 0.5 * this.seed[i * 4]);
      this.kArr[i] = k;
      this.cArr[i] = 2 * Math.sqrt(k) * 0.5;
    }
    this.r = lite ? new CanvasRenderer(this.canvas, n, this.seed) : new PointRenderer(this.canvas, n, this.seed);
    this.baseSize = isSmall() ? 40 : 32;
    this.applyTheme();
    stages.add(this);
  }

  get lite() {
    return this.r instanceof CanvasRenderer;
  }

  /** Move from the 2D canvas to WebGL, in place: same particles, same frame. False if WebGL fails. */
  upgrade(): boolean {
    if (!this.lite) return true;
    const canvas = document.createElement('canvas');
    canvas.className = this.canvas.className;
    let r: Renderer;
    try {
      r = new PointRenderer(canvas, this.n, this.seed);
    } catch {
      return false;
    }
    const old = this.canvas;
    this.r = r;
    this.canvas = canvas;
    this.applyTheme();
    this.resize(true, false);
    this.draw();
    old.replaceWith(canvas);
    return true;
  }

  applyTheme() {
    const ink = cssColor('--stage-ink', '#141416');
    this.r.ink = ink;
    this.r.accent = cssColor('--accent', '#e4161f');
    const dark = ink[0] + ink[1] + ink[2] > 1.5;
    this.r.additive = dark;
    this.r.size = this.baseSize * (dark ? 1 : 1.08);
    if (this.slot) this.draw();
  }

  private built(scene: SceneName | SceneData): Built {
    const data = typeof scene === 'string' ? sceneFor(scene, this.n) : scene;
    let beh = this.behs.get(data);
    if (!beh) {
      beh = makeBehaviour(data);
      this.behs.set(data, beh);
    }
    return { data, beh };
  }

  /** Move the canvas into a slot (without changing form). Returns false if it was already there. */
  mount(slot: HTMLElement): boolean {
    if (slot === this.slot) return false;
    this.slot?.classList.remove('is-live');
    this.ro.disconnect();
    this.io.disconnect();
    slot.appendChild(this.canvas);
    this.slot = slot;
    this.mode = (slot.dataset.mode as Mode) || 'hero';
    this.ro.observe(slot);
    this.io.observe(slot);
    this.visible = true;
    this.resize(true);
    return true;
  }

  /** Move the canvas into a slot and take on its form. */
  attach(slot: HTMLElement, o: AttachOptions = {}) {
    const scene = o.scene ?? ((slot.dataset.scene as SceneName) || 'scene');
    this.mount(slot);
    this.opacityTarget = o.opacity ?? 1;
    if (o.fromNoise) {
      this.scatter();
      this.opacity = this.opacityTarget;
      this.setScene(scene, o.timing ?? MORPH);
    } else if (o.snap) {
      this.cur = this.built(scene);
      this.scene = typeof scene === 'string' ? scene : 'custom';
      this.placeAtHome();
      this.opacity = this.opacityTarget;
    } else if (!this.cur || this.cur.data !== this.built(scene).data) {
      this.setScene(scene, o.timing ?? MORPH);
    }
    slot.classList.toggle('is-instant', !!o.snap);
    slot.classList.add('is-live');
    // draw now, so a view-transition snapshot of the page already shows the field
    this.draw();
    wake();
  }

  park() {
    this.slot?.classList.remove('is-live');
    this.ro.disconnect();
    this.io.disconnect();
    this.canvas.remove();
    this.slot = null;
  }

  setScene(scene: SceneName | SceneData, timing: Timing = MORPH) {
    this.fromPos.set(this.pos);
    this.fromLook.set(this.lookBuf);
    this.cur = this.built(scene);
    this.scene = typeof scene === 'string' ? scene : 'custom';
    this.timing = timing;
    this.morphT0 = this.t;
    this.morphing = true;
    wake();
  }

  /** Run `fn` after `delay` seconds of this stage's time. */
  after(delay: number, fn: () => void) {
    this.timeline.push({ at: this.t + delay, fn });
  }

  /** Uninitialised noise across the frame, invisible (it fades in as it flows into a form). */
  scatter() {
    const s = this.seed;
    for (let i = 0; i < this.n; i++) {
      this.pos[i * 3] = (s[i * 4 + 1] - 0.5) * this.halfW * 1.9;
      this.pos[i * 3 + 1] = (s[i * 4 + 2] - 0.5) * this.halfH * 1.9;
      this.pos[i * 3 + 2] = (s[i * 4 + 3] - 0.5) * 3;
      this.vel[i * 3] = (s[i * 4] - 0.5) * 0.6;
      this.vel[i * 3 + 1] = (s[i * 4 + 3] - 0.5) * 0.6;
      this.lookBuf[i * 4] = 0;
    }
  }

  /** Put every particle at rest in the current form. */
  private placeAtHome() {
    if (!this.cur) return;
    const { data, beh } = this.cur;
    const home = data.home, hd = beh.hdyn;
    const { yaw, pitch } = data.view;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let i = 0, i3 = 0, i4 = 0; i < this.n; i++, i3 += 3, i4 += 4) {
      const hx = home[i3] + hd[i3], hy = home[i3 + 1] + hd[i3 + 1], hz = home[i3 + 2] + hd[i3 + 2];
      const x1 = hx * cy + hz * sy;
      const z1 = -hx * sy + hz * cy;
      this.pos[i3] = x1 * this.scale + this.offX;
      this.pos[i3 + 1] = (hy * cp - z1 * sp) * this.scale + this.offY;
      this.pos[i3 + 2] = (hy * sp + z1 * cp) * this.scale;
      this.vel[i3] = this.vel[i3 + 1] = this.vel[i3 + 2] = 0;
      this.lookBuf[i4] = beh.look[i4];
      this.lookBuf[i4 + 1] = beh.look[i4 + 1];
      this.lookBuf[i4 + 2] = beh.look[i4 + 2];
      this.lookBuf[i4 + 3] = 0;
    }
    this.morphing = false;
  }

  /** Map client coordinates to world space; null when outside the slot. */
  worldAt(cx: number, cy: number, rect = this.slot?.getBoundingClientRect()) {
    if (!rect) return null;
    return {
      x: (((cx - rect.left) / rect.width) * 2 - 1) * this.halfW,
      y: -(((cy - rect.top) / rect.height) * 2 - 1) * this.halfH,
    };
  }
  /** Map a client-space point to home space (for building scenes that line up with the page). */
  homeAt(cx: number, cy: number) {
    const w = this.worldAt(cx, cy);
    return w ? { x: (w.x - this.offX) / this.scale, y: (w.y - this.offY) / this.scale } : null;
  }
  get unitsPerPx() {
    return (2 * this.halfH) / this.h / this.scale;
  }

  resize(force = false, settle = true) {
    if (!this.slot) return;
    const rect = this.slot.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (!force && w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 1.75);
    const mode = this.mode;
    const sizeMul = mode === 'hero' ? 1 : mode === 'viewport' ? 1.3 : mode === 'ambient' ? 1.1 : 1.2;
    this.r.setSize(w, h, dpr);
    this.r.px = dpr * clamp(h / 900, mode === 'spec' || mode === 'preview' ? 0.42 : 0.6, 1.2) * sizeMul;
    this.halfH = HALF_H;
    this.halfW = HALF_H * (w / h);
    // the desktop hero lays the field beside the name; everywhere else it is centred in its frame
    this.side = mode === 'hero' && window.innerWidth >= 900;
    if (this.side) {
      this.scale = Math.min((0.56 * this.halfW) / 3.5, (0.86 * this.halfH) / 2.25);
      this.offX = 0.2 * this.halfW;
      this.offY = 0;
    } else if (mode === 'ambient') {
      this.scale = Math.min(this.halfW / 3.5, this.halfH / 2.25) * 0.95;
      this.offX = parseFloat(this.slot.dataset.anchor ?? '0') * this.halfW;
      this.offY = parseFloat(this.slot.dataset.anchorY ?? '0') * this.halfH;
    } else {
      const fx = mode === 'hero' ? 0.94 : mode === 'viewport' ? 0.82 : 0.86;
      const fy = mode === 'hero' ? 0.9 : mode === 'viewport' ? 0.8 : 0.82;
      this.scale = Math.min((fx * this.halfW) / 3.5, (fy * this.halfH) / 2.25);
      this.offX = 0;
      // the landscape sits high in its own bounds; on phones lower it so it meets the name below
      this.offY = mode === 'hero' ? -0.04 * this.halfH : 0;
    }
    const rPx = Math.min(115, Math.max(mode === 'spec' || mode === 'preview' ? 30 : 46, 0.13 * Math.min(w, h))) * (isCoarse() ? 1.15 : 1);
    this.marginPx = rPx;
    this.R = rPx * ((2 * this.halfH) / h);
    if (this.cur && !this.morphing && force && settle) this.placeAtHome();
  }

  tap(cx: number, cy: number) {
    if (!this.slot || !this.cur) return;
    const rect = this.slot.getBoundingClientRect();
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return;
    const wp = this.worldAt(cx, cy, rect)!;
    this.ripples.push({ x: wp.x, y: wp.y, t0: this.t });
    if (this.ripples.length > 4) this.ripples.shift();
    this.cur.beh.tap((wp.x - this.offX) / this.scale, (wp.y - this.offY) / this.scale);
    this.lastInput = this.t;
    wake();
  }

  /** One loop tick. 0: idle (needs no frames), 1: skipped a half-rate frame, 2: simulated and drew. */
  step(now: number): 0 | 1 | 2 {
    if (!this.slot || !this.visible || !this.cur) {
      this.last = 0;
      return 0;
    }
    const dt = this.last ? Math.min(0.04, (now - this.last) / 1000) : 0.016;
    // half rate while nobody interacts and nothing is changing
    if (!this.morphing && this.t - this.lastInput > 3 && !this.timeline.length) {
      this.skip = !this.skip;
      if (this.skip) return 1;
    }
    this.last = now;
    this.render(Math.min(0.033, dt));
    return 2;
  }

  draw() {
    this.render(0);
  }

  /** advance the simulation by dt and draw */
  render(dt: number) {
    if (!this.slot || !this.cur) return;
    this.t += dt;
    const t = this.t;
    if (this.timeline.length) {
      const due = this.timeline.filter((e) => e.at <= t);
      if (due.length) {
        this.timeline = this.timeline.filter((e) => e.at > t);
        due.forEach((e) => e.fn());
      }
    }
    const rect = this.slot.getBoundingClientRect();
    if (rect.width > 0 && (Math.abs(rect.width - this.w) > 1.5 || Math.abs(rect.height - this.h) > 1.5)) this.resize();
    this.opacity += (this.opacityTarget - this.opacity) * (1 - Math.exp(-dt * 4));
    this.r.opacity = this.opacity;

    // the hero disperses as it scrolls away
    let disp = 0;
    if (this.mode === 'hero') {
      disp = clamp(-rect.top / (rect.height * (this.side ? 0.75 : 0.9)), 0, 1);
      if (Math.abs(disp - this.disperse) > 0.002) this.lastInput = t;
      this.disperse = disp;
    }

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
          const wp = this.worldAt(g.x, g.y, rect)!;
          if (!s.on && s.amt < 0.05) {
            s.x = wp.x;
            s.y = wp.y;
          }
          s.tx = wp.x;
          s.ty = wp.y;
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
    const { morph: M, stagger: ST, lift: LIFT } = this.timing;
    const morphing = this.morphing;
    const mt = t - this.morphT0;
    if (morphing && mt > M + ST) this.morphing = false;
    const de = disp * disp * (3 - 2 * disp);
    const km = this.stiffness, cm = Math.sqrt(km) * this.damping;
    const spreadX = this.halfW * 1.1, spreadY = this.halfH * 0.9;

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
        const tm = (mt - seed[i4 + 2] * ST) / M;
        if (tm < 1) {
          const e = tm <= 0 ? 0 : easeInOut(tm);
          const lift = Math.sin(Math.PI * e) * LIFT;
          tx = fromPos[i3] + (tx - fromPos[i3]) * e + (seed[i4 + 1] - 0.5) * lift * 1.4;
          ty = fromPos[i3 + 1] + (ty - fromPos[i3 + 1]) * e + (seed[i4 + 3] - 0.5) * lift * 1.0;
          tz = fromPos[i3 + 2] + (tz - fromPos[i3 + 2]) * e + lift * 1.2;
          la = fromLook[i4] + (la - fromLook[i4]) * e;
          ls = fromLook[i4 + 1] + (ls - fromLook[i4 + 1]) * e;
          lc = fromLook[i4 + 2] + (lc - fromLook[i4 + 2]) * e;
        }
      }
      if (de > 0) {
        tx += (seed[i4 + 1] - 0.5) * spreadX * de;
        ty += ((seed[i4 + 3] - 0.5) * spreadY + spreadY * 0.35) * de;
        tz += (seed[i4] - 0.5) * 3 * de;
        la *= 1 - 0.85 * de;
      }
      lookBuf[i4] = la;
      lookBuf[i4 + 1] = ls;
      lookBuf[i4 + 2] = lc;
      if (dt === 0) continue;
      const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
      const k = kArr[i] * km, c = cArr[i] * cm;
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
      vel[i3] = vx;
      vel[i3 + 1] = vy;
      vel[i3 + 2] = vz;
      pos[i3] = px + vx * dt;
      pos[i3 + 1] = py + vy * dt;
      pos[i3 + 2] = pz + vz * dt;
      lookBuf[i4 + 3] = prox;
    }
    this.r.draw(pos, lookBuf);
  }

  destroy() {
    this.park();
    stages.delete(this);
    this.r.dispose();
  }
}
