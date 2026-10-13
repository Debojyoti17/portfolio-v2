/**
 * Scenes for the interactive particle stage.
 *
 * Pure functions (no DOM, no WebGL): the same data feeds the live Three.js stage
 * in the browser and the static SVG fallback at build time.
 *
 * Coordinates are "home space": x ∈ [-3.5, 3.5], y ∈ [-2.25, 2.25], z small.
 * `look` = per-particle [alpha, size, accent(0..1 = red), unused].
 */
import { rng } from '../../lib/hash';

export const SCENE_NAMES = ['scene', 'noise', 'leaf', 'ghost', 'graph', 'network', 'tree', 'gather', 'dust'] as const;
export type SceneName = (typeof SCENE_NAMES)[number];

/** Scenes that can represent a project (one per project: its specimen and its page). */
export const PROJECT_SCENES = ['leaf', 'ghost', 'graph', 'network', 'tree'] as const;
export type ProjectScene = (typeof PROJECT_SCENES)[number];

export function isSceneName(x: string | undefined | null): x is SceneName {
  return !!x && (SCENE_NAMES as readonly string[]).includes(x);
}

export interface Node {
  x: number;
  y: number;
  z: number;
}

export interface SceneData {
  name: SceneName;
  n: number;
  /** n*3 rest positions in home space */
  home: Float32Array;
  /** n*4 static random numbers in [0,1) */
  seed: Float32Array;
  /** n*4 initial look */
  look0: Float32Array;
  /** default view angles (radians) for static render and live sway centre */
  view: { yaw: number; pitch: number };
  /** whether the live scene may sway/rotate (flat diagrams must not, so hit-tests stay exact) */
  rotate: boolean;
  /** behaviour-specific data */
  meta: Record<string, any>;
}

type R = () => number;
type V3 = [number, number, number];

export function gauss(r: R): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const smooth = (x: number) => x * x * (3 - 2 * x);

function rotX(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}
function rotZ(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

function makeSeeds(n: number, salt: number): Float32Array {
  const r = rng(9100 + salt);
  const s = new Float32Array(n * 4);
  for (let i = 0; i < s.length; i++) s[i] = r();
  return s;
}

function baseLook(n: number, seed: Float32Array): Float32Array {
  const l = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    l[i * 4] = 0.45 + 0.55 * seed[i * 4 + 2];
    l[i * 4 + 1] = 1;
    l[i * 4 + 2] = seed[i * 4 + 3] < 0.03 ? 1 : 0;
  }
  return l;
}

/** Centre on the origin and fit into the stage box (robust to stragglers). */
function fit(a: Float32Array, hx = 3.5, hy = 2.25): void {
  const n = a.length / 3;
  const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = a[i * 3];
    ys[i] = a[i * 3 + 1];
    zs[i] = a[i * 3 + 2];
  }
  xs.sort(); ys.sort(); zs.sort();
  const lo = Math.floor(n * 0.012), hi = n - 1 - lo;
  const cx = (xs[lo] + xs[hi]) / 2, cy = (ys[lo] + ys[hi]) / 2, cz = (zs[lo] + zs[hi]) / 2;
  const w = (xs[hi] - xs[lo]) / 2 || 1, h = (ys[hi] - ys[lo]) / 2 || 1;
  const s = Math.min(hx / w, hy / h);
  for (let i = 0; i < n; i++) {
    a[i * 3] = (a[i * 3] - cx) * s;
    a[i * 3 + 1] = (a[i * 3 + 1] - cy) * s;
    a[i * 3 + 2] = (a[i * 3 + 2] - cz) * s;
  }
}

function put(a: Float32Array, i: number, p: V3) {
  a[i * 3] = p[0];
  a[i * 3 + 1] = p[1];
  a[i * 3 + 2] = p[2];
}

/* ------------------------------------------------------------ hero scenes */

function noise(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) put(o, i, [gauss(r) * 2.3, gauss(r) * 1.5, gauss(r) * 1.4]);
  return o;
}

/** A captured landscape: heightfield plus clumps (rocks, trees). */
function terrain(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  const H = (x: number, z: number) =>
    0.5 * Math.sin(x * 0.9 + 0.5) * Math.cos(z * 1.2) +
    0.26 * Math.sin(x * 2.1 - z * 1.6 + 1.2) +
    0.1 * Math.sin(x * 4.3 + z * 3.1) +
    1.0 * Math.exp(-((x - 0.5) ** 2 + (z + 0.2) ** 2) / 1.0);
  const clumps = Array.from({ length: 10 }, () => ({
    x: (r() * 2 - 1) * 3.4,
    z: (r() * 2 - 1) * 2.1,
    rad: 0.16 + r() * 0.3,
    h: 0.3 + r() * 0.9,
  }));
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (r() < 0.74) {
      x = (r() * 2 - 1) * 3.9;
      z = (r() * 2 - 1) * 2.5;
      y = H(x, z) + gauss(r) * 0.012;
    } else {
      const c = clumps[(r() * clumps.length) | 0];
      x = c.x + gauss(r) * c.rad * 0.55;
      z = c.z + gauss(r) * c.rad * 0.55;
      y = H(x, z) + Math.abs(gauss(r)) * c.h * 0.55;
    }
    put(o, i, rotX([x, y, z], -0.62));
  }
  fit(o);
  return o;
}

/* ------------------------------------------------------------------- leaf */

/** A whole leaf, upright on a diagonal: surface, midrib, lateral veins, serrated outline, petiole. */
function leaf(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  const L = 6.4, W = 2.9;
  const hw = (u: number) => (W / 2) * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(Math.max(u, 0), 1), 0.8)), 0.85);
  for (let i = 0; i < n; i++) {
    const k = r();
    let u: number, v: number;
    let petiole = false;
    if (k < 0.15) {
      u = r();
      v = gauss(r) * 0.016;
    } else if (k < 0.55) {
      const m = (r() * 7) | 0;
      const s = r() < 0.5 ? -1 : 1;
      const u0 = 0.1 + m * 0.115;
      const t = r();
      u = u0 + t * 0.2;
      v = s * Math.pow(t, 0.9) * 0.97 + gauss(r) * 0.01;
    } else if (k < 0.67) {
      u = r();
      v = (r() < 0.5 ? -1 : 1) * (1 + 0.035 * Math.sin(u * 64));
    } else if (k > 0.985) {
      u = -0.1 * r();
      v = gauss(r) * 0.01;
      petiole = true;
    } else {
      u = r();
      v = r() * 2 - 1;
    }
    const x = (u - 0.5) * L;
    const y = petiole ? gauss(r) * 0.02 : v * hw(u);
    const z = petiole ? 0 : 0.28 * v * v + 0.14 * Math.sin(u * Math.PI) + gauss(r) * 0.008;
    let p: V3 = rotZ([x, y, z], 0.5);
    p = rotX(p, 0.28);
    put(o, i, p);
  }
  fit(o, 3.1, 1.95);
  return o;
}

/* ------------------------------------------------------------------ ghost */

/** A vase-like object made of large soft splats. */
function ghostObject(n: number, r: R) {
  const ctrl: [number, number][] = [
    [-2.1, 0.9], [-1.7, 1.2], [-0.9, 1.42], [0.1, 1.05], [0.9, 0.52], [1.4, 0.44], [1.8, 0.7], [2.1, 0.86],
  ];
  const prof = (y: number) => {
    for (let i = 0; i < ctrl.length - 1; i++) {
      const [y0, r0] = ctrl[i], [y1, r1] = ctrl[i + 1];
      if (y >= y0 && y <= y1) return r0 + (r1 - r0) * smooth((y - y0) / (y1 - y0));
    }
    return ctrl[ctrl.length - 1][1];
  };
  const o = new Float32Array(n * 3);
  const dir = new Float32Array(n * 3); // outward drift direction for dissolving
  const bands = [-1.6, -0.9, -0.2, 0.5, 1.2, 1.9];
  for (let i = 0; i < n; i++) {
    const k = r();
    let p: V3;
    if (k < 0.07) {
      // ground shadow
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 1.9;
      p = [Math.cos(a) * rr, -2.16 + gauss(r) * 0.01, Math.sin(a) * rr * 0.9];
    } else if (k < 0.12) {
      // sparse interior
      const y = (r() * 2 - 1) * 2;
      const a = r() * Math.PI * 2, rr = prof(y) * Math.sqrt(r()) * 0.8;
      p = [Math.cos(a) * rr, y, Math.sin(a) * rr];
    } else {
      const y = k < 0.34 ? bands[(r() * bands.length) | 0] + gauss(r) * 0.04 : (r() * 2 - 1) * 2.1;
      const a = r() * Math.PI * 2;
      const rr = prof(Math.min(2.1, Math.max(-2.1, y))) + gauss(r) * 0.025;
      p = [Math.cos(a) * rr, y, Math.sin(a) * rr];
    }
    put(o, i, rotX(p, 0.2));
    const d = norm([p[0], 0.25, p[2]]);
    dir[i * 3] = d[0];
    dir[i * 3 + 1] = d[1];
    dir[i * 3 + 2] = d[2];
  }
  fit(o, 3.2, 2.2);
  return { home: o, dir };
}

/* ------------------------------------------------------- graph primitives */

interface Edge {
  a: number;
  b: number;
  /** perpendicular bow, in home units */
  bow: number;
}

function edgePoint(nodes: Node[], e: Edge, t: number): V3 {
  const A = nodes[e.a], B = nodes[e.b];
  const dx = B.x - A.x, dy = B.y - A.y;
  const l = Math.hypot(dx, dy) || 1;
  const bow = Math.sin(Math.PI * t) * e.bow;
  return [A.x + dx * t + (-dy / l) * bow, A.y + dy * t + (dx / l) * bow, A.z + (B.z - A.z) * t];
}

/* ----------------------------------------------------------------- agents */

/** Roles: 0 node, 1 edge, 2 dust */
function agentGraph(n: number, r: R) {
  const nodes: Node[] = [{ x: 0, y: 0, z: 0 }];
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5 + 0.3;
    nodes.push({ x: Math.cos(a) * 2.7, y: Math.sin(a) * 1.65, z: (k % 2 ? 0.3 : -0.3) });
  }
  const edges: Edge[] = [
    ...[1, 2, 3, 4, 5].map((b) => ({ a: 0, b, bow: 0.12 })),
    { a: 1, b: 2, bow: 0.3 }, { a: 3, b: 4, bow: 0.3 }, { a: 4, b: 5, bow: 0.3 }, { a: 5, b: 1, bow: 0.3 },
  ];
  const radius = nodes.map((_, i) => (i === 0 ? 0.22 : 0.14));
  const o = new Float32Array(n * 3);
  const role = new Uint8Array(n), id = new Uint16Array(n), tt = new Float32Array(n);
  const nodeShare = 0.22, edgeShare = 0.93;
  for (let i = 0; i < n; i++) {
    const k = r();
    let p: V3;
    if (k < nodeShare) {
      const ni = r() < 0.28 ? 0 : 1 + ((r() * 5) | 0);
      const s = radius[ni];
      p = [nodes[ni].x + gauss(r) * s, nodes[ni].y + gauss(r) * s, nodes[ni].z + gauss(r) * s * 0.6];
      role[i] = 0; id[i] = ni;
    } else if (k < edgeShare) {
      const ei = (r() * edges.length) | 0;
      const t = r();
      const q = edgePoint(nodes, edges[ei], t);
      p = [q[0] + gauss(r) * 0.022, q[1] + gauss(r) * 0.022, q[2] + gauss(r) * 0.022];
      role[i] = 1; id[i] = ei; tt[i] = t;
    } else {
      p = [gauss(r) * 2.2, gauss(r) * 1.4, gauss(r) * 0.8];
      role[i] = 2;
    }
    put(o, i, p);
  }
  return { home: o, nodes, edges, role, id, tt };
}

/* ---------------------------------------------------------------- network */

/** Roles: 0 node, 1 edge, 2 dust, 3 packet */
function networkGraph(n: number, r: R, packetParticles: number) {
  const nodes: Node[] = [
    { x: -3.1, y: 0, z: 0 }, // 0 S
    { x: -1.6, y: 1.25, z: 0 }, // 1 A
    { x: -1.6, y: -1.25, z: 0 }, // 2 B
    { x: 0, y: 1.5, z: 0 }, // 3 C
    { x: 0, y: 0, z: 0 }, // 4 D
    { x: 0, y: -1.5, z: 0 }, // 5 E
    { x: 1.6, y: 0.8, z: 0 }, // 6 F
    { x: 1.6, y: -0.8, z: 0 }, // 7 G
    { x: 3.1, y: 0, z: 0 }, // 8 T
  ];
  const pairs: [number, number][] = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [3, 6], [4, 6], [4, 7], [5, 7], [6, 8], [7, 8]];
  const edges: Edge[] = pairs.map(([a, b]) => ({ a, b, bow: 0 }));
  const radius = nodes.map((_, i) => (i === 0 || i === 8 ? 0.2 : 0.15));
  const o = new Float32Array(n * 3);
  const role = new Uint8Array(n), id = new Uint16Array(n), tt = new Float32Array(n);
  const body = n - packetParticles;
  for (let i = 0; i < n; i++) {
    if (i >= body) {
      role[i] = 3;
      id[i] = Math.floor((i - body) / 5);
      put(o, i, [0, 0, 0]);
      continue;
    }
    const k = r();
    let p: V3;
    if (k < 0.3) {
      const ni = (r() * nodes.length) | 0;
      const s = radius[ni];
      p = [nodes[ni].x + gauss(r) * s, nodes[ni].y + gauss(r) * s, gauss(r) * s * 0.5];
      role[i] = 0; id[i] = ni;
    } else if (k < 0.94) {
      const ei = (r() * edges.length) | 0;
      const t = r();
      const q = edgePoint(nodes, edges[ei], t);
      p = [q[0] + gauss(r) * 0.02, q[1] + gauss(r) * 0.02, gauss(r) * 0.02];
      role[i] = 1; id[i] = ei; tt[i] = t;
    } else {
      p = [gauss(r) * 2.4, gauss(r) * 1.4, gauss(r) * 0.6];
      role[i] = 2;
    }
    put(o, i, p);
  }
  return { home: o, nodes, edges, role, id, tt, packetStart: body };
}

/* ------------------------------------------------------------------- tree */

/** Roles: 0 node, 1 tree edge, 2 dust, 3 symlink */
function dirTree(n: number, r: R) {
  const nodes: Node[] = [];
  const parent: number[] = [];
  const add2 = (x: number, y: number, p: number) => {
    nodes.push({ x, y, z: 0 });
    parent.push(p);
    return nodes.length - 1;
  };
  const root = add2(0, 1.9, -1);
  const d0 = add2(-2.4, 0.75, root), d1 = add2(0, 0.75, root), d2 = add2(2.4, 0.75, root);
  const f0 = add2(-3.0, -0.5, d0), f1 = add2(-1.8, -0.5, d0);
  const f2 = add2(-0.8, -0.5, d1), f3 = add2(0.2, -0.5, d1), f4 = add2(1.1, -0.5, d1);
  const f5 = add2(2.0, -0.5, d2), f6 = add2(3.0, -0.5, d2);
  const g0 = add2(-0.3, -1.8, f3), g1 = add2(0.7, -1.8, f3), g2 = add2(-1.8, -1.8, f1);
  const isDir = (i: number) => parent.some((p) => p === i);
  // elbow connectors as polylines
  const segs: [number, number, number, number][] = [];
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[parent[i]], b = nodes[i];
    const my = (a.y + b.y) / 2 + 0.1;
    segs.push([a.x, a.y, a.x, my], [a.x, my, b.x, my], [b.x, my, b.x, b.y]);
  }
  const segLen = segs.map(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0));
  const segTotal = segLen.reduce((s, v) => s + v, 0);
  // symlinks: quadratic arcs; `broken` ones dangle until touched
  const links = [
    { from: f0, to: d2, ctrl: [-0.2, 2.6] as [number, number], broken: true },
    { from: g1, to: f1, ctrl: [-0.6, -2.7] as [number, number], broken: true },
    { from: g0, to: root, ctrl: [3.6, -1.2] as [number, number], broken: false },
  ];
  const arc = (l: (typeof links)[number], t: number): V3 => {
    const A = nodes[l.from], B = nodes[l.to];
    const x = (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * l.ctrl[0] + t * t * B.x;
    const y = (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * l.ctrl[1] + t * t * B.y;
    return [x, y, -0.15];
  };
  const o = new Float32Array(n * 3);
  const role = new Uint8Array(n), id = new Uint16Array(n), tt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = r();
    let p: V3;
    if (k < 0.2) {
      const ni = (r() * nodes.length) | 0;
      const s = isDir(ni) ? 0.17 : 0.1;
      p = [nodes[ni].x + gauss(r) * s, nodes[ni].y + gauss(r) * s, gauss(r) * s * 0.4];
      role[i] = 0; id[i] = ni;
    } else if (k < 0.74) {
      let pick = r() * segTotal, si = 0;
      while (si < segs.length - 1 && pick > segLen[si]) pick -= segLen[si++];
      const [x0, y0, x1, y1] = segs[si];
      const t = pick / (segLen[si] || 1);
      p = [x0 + (x1 - x0) * t + gauss(r) * 0.015, y0 + (y1 - y0) * t + gauss(r) * 0.015, gauss(r) * 0.015];
      role[i] = 1; id[i] = si;
    } else if (k < 0.94) {
      const li = (r() * links.length) | 0;
      const t = r();
      const q = arc(links[li], t);
      p = [q[0] + gauss(r) * 0.02, q[1] + gauss(r) * 0.02, q[2]];
      role[i] = 3; id[i] = li; tt[i] = t;
    } else {
      p = [gauss(r) * 2.4, gauss(r) * 1.3, gauss(r) * 0.4];
      role[i] = 2;
    }
    put(o, i, p);
  }
  return { home: o, nodes, links, role, id, tt, arcPoint: arc };
}

/* ------------------------------------------------------------- ambient */

/** Contact: a quiet, slowly turning cluster with a sparse halo that fills its block. */
function gather(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    if (r() < 0.72) {
      // a soft sphere, denser toward its centre
      const d = norm([gauss(r), gauss(r), gauss(r)]);
      const rad = 1.25 * Math.pow(r(), 0.55);
      put(o, i, mul(d, rad));
    } else {
      put(o, i, [gauss(r) * 2.6 - 0.8, gauss(r) * 1.1, gauss(r) * 0.8]);
    }
  }
  return o;
}

/** Menu: a calm horizon of particles low in the frame. */
function dust(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = (r() * 2 - 1) * 4.2;
    const z = (r() * 2 - 1) * 2.4;
    const y = 0.18 * Math.sin(x * 1.3 + z * 0.9) + 0.1 * Math.sin(x * 3.1 - z * 2.2) + gauss(r) * 0.03;
    put(o, i, rotX([x, y - 1.2, z], -0.45));
  }
  return o;
}

/**
 * A scene from given positions (e.g. the name sampled from rendered text). Positions are already in
 * home space; no sway, generic behaviour.
 */
export function customScene(home: Float32Array, n: number, size = 1): SceneData {
  const seed = makeSeeds(n, 4242);
  const look0 = baseLook(n, seed);
  for (let i = 0; i < n; i++) {
    look0[i * 4] = 0.75 + 0.25 * seed[i * 4 + 2];
    look0[i * 4 + 1] = size;
    look0[i * 4 + 2] = 0;
  }
  return { name: 'noise', n, home, seed, look0, view: { yaw: 0, pitch: 0 }, rotate: false, meta: { custom: true } };
}

/* ---------------------------------------------------------------- builder */

export function buildScene(name: SceneName, n: number): SceneData {
  const salt = SCENE_NAMES.indexOf(name) * 131 + 7;
  const r = rng(salt);
  const seed = makeSeeds(n, salt);
  let home: Float32Array;
  let look0 = baseLook(n, seed);
  let view = { yaw: 0, pitch: 0 };
  let rotate = false;
  let meta: Record<string, any> = {};

  switch (name) {
    case 'noise':
      home = noise(n, r);
      view = { yaw: -0.2, pitch: 0.1 };
      rotate = true;
      break;
    case 'scene':
      home = terrain(n, r);
      view = { yaw: -0.3, pitch: 0.1 };
      rotate = true;
      break;
    case 'leaf':
      home = leaf(n, r);
      for (let i = 0; i < n; i++) look0[i * 4 + 1] = 0.85;
      view = { yaw: -0.15, pitch: 0.05 };
      rotate = true;
      break;
    case 'ghost': {
      const g = ghostObject(n, r);
      home = g.home;
      meta = { dir: g.dir };
      for (let i = 0; i < n; i++) {
        look0[i * 4] = 0.35 + 0.4 * seed[i * 4 + 2];
        look0[i * 4 + 1] = 1.6;
        look0[i * 4 + 2] = 0;
      }
      view = { yaw: -0.25, pitch: 0.12 };
      rotate = true;
      break;
    }
    case 'graph': {
      const g = agentGraph(n, r);
      home = g.home;
      meta = g;
      for (let i = 0; i < n; i++) look0[i * 4 + 2] = 0;
      for (let i = 0; i < n; i++) {
        if (g.role[i] === 0) look0[i * 4] = 0.8;
        else if (g.role[i] === 1) look0[i * 4] = 0.75;
        else look0[i * 4] = 0.22;
      }
      break;
    }
    case 'network': {
      const g = networkGraph(n, r, 35);
      home = g.home;
      meta = g;
      const failed = 4;
      for (let i = 0; i < n; i++) {
        look0[i * 4 + 2] = 0;
        if (g.role[i] === 3) look0[i * 4] = 0;
        else if (g.role[i] === 0) {
          look0[i * 4] = 0.85;
          if (g.id[i] === failed) look0[i * 4 + 2] = 1;
        } else if (g.role[i] === 1) {
          const e = g.edges[g.id[i]];
          look0[i * 4] = e.a === failed || e.b === failed ? 0.22 : 0.72;
        } else look0[i * 4] = 0.2;
      }
      meta.failed = failed;
      break;
    }
    case 'gather':
      home = gather(n, r);
      for (let i = 0; i < n; i++) look0[i * 4 + 2] = seed[i * 4 + 3] < 0.012 ? 1 : 0;
      view = { yaw: 0, pitch: 0.15 };
      rotate = true;
      break;
    case 'dust':
      home = dust(n, r);
      for (let i = 0; i < n; i++) look0[i * 4 + 2] = 0;
      view = { yaw: 0, pitch: 0 };
      rotate = true;
      break;
    case 'tree': {
      const g = dirTree(n, r);
      home = g.home;
      meta = g;
      for (let i = 0; i < n; i++) {
        look0[i * 4 + 2] = 0;
        if (g.role[i] === 0) look0[i * 4] = 0.85;
        else if (g.role[i] === 1) look0[i * 4] = 0.55;
        else if (g.role[i] === 2) look0[i * 4] = 0.2;
        else {
          const l = g.links[g.id[i]];
          const reach = l.broken ? 0.58 : 1;
          if (g.tt[i] > reach) look0[i * 4] = 0;
          else {
            look0[i * 4] = 0.85;
            look0[i * 4 + 2] = l.broken ? 1 : 0;
          }
        }
      }
      break;
    }
  }
  return { name, n, home, seed, look0, view, rotate, meta };
}
