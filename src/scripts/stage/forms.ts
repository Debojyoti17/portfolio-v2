/**
 * Point-cloud "forms" for the 3D stage.
 *
 * Pure functions with no DOM or WebGL: the same generators feed the live
 * Three.js scene (in the browser) and the static SVG fallback (at build time).
 * Every generator returns Float32Array(count * 3) of xyz positions, centred on
 * the origin and fitted to roughly x ∈ [-3.4, 3.4], y ∈ [-2.2, 2.2].
 */
import { rng } from '../../lib/hash';

export const FORM_NAMES = ['noise', 'scene', 'leaf', 'graph', 'erase', 'tree', 'grid'] as const;
export type FormName = (typeof FORM_NAMES)[number];

export const FORM_LABELS: Record<FormName, string> = {
  noise: 'Uninitialised cloud',
  scene: 'Captured scene',
  leaf: 'Leaf specimen',
  graph: 'Agent graph',
  erase: 'Scene with a region removed',
  tree: 'File tree with link loops',
  grid: 'Measurement grid',
};

type R = () => number;
type V3 = [number, number, number];

function gauss(r: R): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

function rotX(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}
function rotY(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotZ(p: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Rodrigues rotation of v about unit axis k by angle a. */
function rotAxis(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}

/* ---------------------------------------------------------------- forms */

function noise(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    o[i * 3] = gauss(r) * 2.3;
    o[i * 3 + 1] = gauss(r) * 1.5;
    o[i * 3 + 2] = gauss(r) * 1.4;
  }
  return o;
}

/** A captured landscape: heightfield plus clumps (rocks / trees). */
function scene(n: number, r: R): Float32Array {
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
    const p = rotX([x, y, z], -0.62);
    o[i * 3] = p[0];
    o[i * 3 + 1] = p[1];
    o[i * 3 + 2] = p[2];
  }
  return o;
}

/** A leaf: surface, midrib, lateral veins and a serrated outline. */
function leaf(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  const L = 6.6, W = 2.9;
  const hw = (u: number) => (W / 2) * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(Math.max(u, 0), 1), 0.78)), 0.85);
  for (let i = 0; i < n; i++) {
    const k = r();
    let u: number, v: number;
    if (k < 0.16) {
      u = r();
      v = gauss(r) * 0.018;
    } else if (k < 0.5) {
      const m = (r() * 7) | 0;
      const s = r() < 0.5 ? -1 : 1;
      const u0 = 0.1 + m * 0.115;
      const t = r();
      u = u0 + t * 0.2;
      v = s * Math.pow(t, 0.9) * 0.97 + gauss(r) * 0.01;
    } else if (k < 0.58) {
      u = r();
      v = (r() < 0.5 ? -1 : 1) * (1 + 0.035 * Math.sin(u * 64));
    } else {
      u = r();
      v = r() * 2 - 1;
    }
    let x = (u - 0.5) * L;
    let y = v * hw(u);
    let z = 0.32 * v * v + 0.16 * Math.sin(u * Math.PI) + gauss(r) * 0.008;
    if (k > 0.985) {
      // petiole
      x = (-0.5 - r() * 0.1) * L;
      y = gauss(r) * 0.02;
      z = 0;
    }
    let p: V3 = rotZ([x, y, z], 0.34);
    p = rotX(p, 0.52);
    p = rotY(p, -0.32);
    o[i * 3] = p[0];
    o[i * 3 + 1] = p[1];
    o[i * 3 + 2] = p[2];
  }
  return o;
}

/** A multi-agent graph: dense node clumps, edge filaments and a faint halo. */
function graph(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  const nodes: V3[] = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.399963 + 0.6;
    nodes.push([Math.cos(th) * rad * 3.1, y * 2.0, Math.sin(th) * rad * 1.9]);
  }
  const edges: [number, number][] = [];
  nodes.forEach((a, i) => {
    const d = nodes
      .map((b, j) => ({ j, d: len(sub(a, b)) }))
      .filter((q) => q.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    d.forEach(({ j }) => {
      if (!edges.some(([p, q]) => (p === i && q === j) || (p === j && q === i))) edges.push([i, j]);
    });
  });
  edges.push([0, 5], [2, 7], [3, 9]);
  const sizes = nodes.map((_, i) => (i % 4 === 0 ? 0.3 : 0.17 + r() * 0.06));
  for (let i = 0; i < n; i++) {
    const k = r();
    let p: V3;
    if (k < 0.4) {
      const ni = (r() * N) | 0;
      const s = sizes[ni];
      p = add(nodes[ni], [gauss(r) * s, gauss(r) * s, gauss(r) * s]);
    } else if (k < 0.86) {
      const [a, b] = edges[(r() * edges.length) | 0];
      const t = r();
      const A = nodes[a], B = nodes[b];
      const dir = norm(sub(B, A));
      const nrm = norm(cross(dir, [0, 1, 0.3]));
      const bow = Math.sin(Math.PI * t) * 0.35;
      p = add(add(add(A, mul(sub(B, A), t)), mul(nrm, bow)), [gauss(r) * 0.025, gauss(r) * 0.025, gauss(r) * 0.025]);
    } else {
      const z = r() * 2 - 1, th = r() * Math.PI * 2, rr = Math.sqrt(1 - z * z);
      p = [Math.cos(th) * rr * 3.5, z * 2.35, Math.sin(th) * rr * 2.2];
    }
    o[i * 3] = p[0];
    o[i * 3 + 1] = p[1];
    o[i * 3 + 2] = p[2];
  }
  return o;
}

/** A dotted globe with a region cut out and debris drifting where it was. */
function erase(n: number, r: R): Float32Array {
  const o = new Float32Array(n * 3);
  const R0 = 2.3;
  const c = norm([0.62, 0.3, 0.72]);
  const cut = 0.66;
  for (let i = 0; i < n; i++) {
    let d: V3;
    const k = r();
    if (k < 0.06) {
      // debris floating where the object used to be
      const q = add(mul(c, R0 * (1.18 + r() * 0.9)), [gauss(r) * 0.32, gauss(r) * 0.32, gauss(r) * 0.32]);
      o[i * 3] = q[0];
      o[i * 3 + 1] = q[1];
      o[i * 3 + 2] = q[2];
      continue;
    }
    let ang = 0;
    do {
      const z = r() * 2 - 1, th = r() * Math.PI * 2, rr = Math.sqrt(1 - z * z);
      d = [Math.cos(th) * rr, z, Math.sin(th) * rr];
      ang = Math.acos(Math.min(1, dot(d, c)));
    } while (ang < cut && !(k < 0.11 && ang > cut - 0.04));
    if (k < 0.5) {
      // snap to a latitude line for a mesh-like read
      const lat = Math.asin(d[1]);
      const step = Math.PI / 14;
      const snapped = Math.round(lat / step) * step;
      const lon = Math.atan2(d[2], d[0]);
      d = [Math.cos(snapped) * Math.cos(lon), Math.sin(snapped), Math.cos(snapped) * Math.sin(lon)];
    }
    const rad = R0 + gauss(r) * 0.012;
    o[i * 3] = d[0] * rad;
    o[i * 3 + 1] = d[1] * rad;
    o[i * 3 + 2] = d[2] * rad;
  }
  return o;
}

/** A directory tree whose branches loop back on themselves (symlink loops). */
function tree(n: number, r: R): Float32Array {
  const segs: { a: V3; b: V3; w: number }[] = [];
  const tips: V3[] = [];
  const rr = rng(7);
  function branch(p: V3, dir: V3, length: number, depth: number) {
    const e = add(p, mul(dir, length));
    segs.push({ a: p, b: e, w: length * (depth + 1) });
    if (depth === 0) {
      tips.push(e);
      return;
    }
    const kids = depth > 3 ? 2 : 3;
    for (let k = 0; k < kids; k++) {
      const axisRand = norm(cross(dir, [rr() - 0.5, rr() - 0.5, rr() - 0.5]));
      let nd = rotAxis(dir, axisRand, 0.5 + rr() * 0.4);
      nd = rotAxis(nd, dir, (k / kids) * Math.PI * 2 + rr());
      branch(e, norm(nd), length * (0.7 + rr() * 0.06), depth - 1);
    }
  }
  branch([0, -3, 0], [0, 1, 0], 1.7, 6);
  const total = segs.reduce((s, q) => s + q.w, 0);
  const cum: number[] = [];
  segs.reduce((s, q, i) => ((cum[i] = s + q.w), s + q.w), 0);
  const arcs = [
    [tips[3], segs[2].b],
    [tips[Math.floor(tips.length / 2)], segs[5].b],
    [tips[tips.length - 4], segs[1].b],
  ];
  const o = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = r();
    let p: V3;
    if (k < 0.07) {
      const [A, B] = arcs[(r() * arcs.length) | 0];
      const t = r();
      const mid = add(mul(add(A, B), 0.5), [0, 1.4, 1.4]);
      const q1 = add(mul(A, (1 - t) * (1 - t)), mul(mid, 2 * (1 - t) * t));
      p = add(add(q1, mul(B, t * t)), [gauss(r) * 0.02, gauss(r) * 0.02, gauss(r) * 0.02]);
    } else if (k < 0.3) {
      const tip = tips[(r() * tips.length) | 0];
      p = add(tip, [gauss(r) * 0.13, gauss(r) * 0.13, gauss(r) * 0.13]);
    } else {
      const pick = r() * total;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < pick) lo = mid + 1;
        else hi = mid;
      }
      const s = segs[lo];
      const t = r();
      const th = Math.min(0.09, 0.012 * s.w);
      p = add(add(s.a, mul(sub(s.b, s.a), t)), [gauss(r) * th, gauss(r) * th, gauss(r) * th]);
    }
    o[i * 3] = p[0];
    o[i * 3 + 1] = p[1];
    o[i * 3 + 2] = p[2];
  }
  return o;
}

/** An orderly lattice, like pixels on a display — the measurement plane. */
function grid(n: number, _r: R): Float32Array {
  const o = new Float32Array(n * 3);
  const cols = Math.round(Math.sqrt(n * 1.75));
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const c = i % cols, w = (i / cols) | 0;
    const x = (c / (cols - 1) - 0.5) * 7.6;
    const z = (w / (rows - 1) - 0.5) * 4.6;
    const y = 0.2 * Math.sin(x * 1.1) * Math.cos(z * 1.4) + 0.08 * Math.sin(x * 3 + z * 2);
    const p = rotX([x, y, z], -0.95);
    o[i * 3] = p[0];
    o[i * 3 + 1] = p[1];
    o[i * 3 + 2] = p[2];
  }
  return o;
}

/* ------------------------------------------------------------- plumbing */

const GEN: Record<FormName, (n: number, r: R) => Float32Array> = {
  noise, scene, leaf, graph, erase, tree, grid,
};

/** Centre on the origin and fit into the stage box. */
function fit(a: Float32Array): void {
  const n = a.length / 3;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  // use robust bounds (ignore the 2 % most distant stragglers such as debris)
  const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = a[i * 3];
    ys[i] = a[i * 3 + 1];
    zs[i] = a[i * 3 + 2];
  }
  xs.sort(); ys.sort(); zs.sort();
  const lo = Math.floor(n * 0.015), hi = n - 1 - lo;
  minX = xs[lo]; maxX = xs[hi]; minY = ys[lo]; maxY = ys[hi]; minZ = zs[lo]; maxZ = zs[hi];
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const hx = (maxX - minX) / 2 || 1, hy = (maxY - minY) / 2 || 1;
  const s = Math.min(3.5 / hx, 2.25 / hy);
  for (let i = 0; i < n; i++) {
    a[i * 3] = (a[i * 3] - cx) * s;
    a[i * 3 + 1] = (a[i * 3 + 1] - cy) * s;
    a[i * 3 + 2] = (a[i * 3 + 2] - cz) * s;
  }
}

/** Reorder points by azimuth so index k lands near index k of other forms. */
function orderByAzimuth(a: Float32Array): Float32Array {
  const n = a.length / 3;
  const idx = new Uint32Array(n);
  const key = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    idx[i] = i;
    key[i] = Math.atan2(a[i * 3 + 2], a[i * 3]);
  }
  const sorted = Array.from(idx).sort((p, q) => key[p] - key[q]);
  const out = new Float32Array(a.length);
  for (let i = 0; i < n; i++) {
    const s = sorted[i];
    out[i * 3] = a[s * 3];
    out[i * 3 + 1] = a[s * 3 + 1];
    out[i * 3 + 2] = a[s * 3 + 2];
  }
  return out;
}

export function isFormName(x: string | undefined | null): x is FormName {
  return !!x && (FORM_NAMES as readonly string[]).includes(x);
}

/** Generate `count` points for a form. Deterministic for a given (form, count). */
export function generateForm(name: FormName, count: number, ordered = true): Float32Array {
  const seedBase = FORM_NAMES.indexOf(name) * 977 + 31;
  const a = GEN[name](count, rng(seedBase));
  if (name !== 'noise') fit(a);
  return ordered ? orderByAzimuth(a) : a;
}
