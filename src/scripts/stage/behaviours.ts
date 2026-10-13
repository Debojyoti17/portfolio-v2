/**
 * Per-scene behaviour for the particle stage: what the particles *mean* when you touch them.
 *
 *  leaf / scene / noise  generic spring physics only
 *  ghost                 touching dissolves the object, leaving a faint residue that slowly heals
 *  graph                 touching an agent lights it and a pulse travels along its edges
 *  network               one node has failed (red); messages try it, bounce and reroute. Tap a node to fail it
 *  tree                  broken symlinks dangle in red; touching them reconnects the link
 *
 * Behaviours work in "home space" (the scene's own coordinates) except `pos`/`ptrWorld`.
 */
import type { Node, SceneData } from './scenes';

export interface Ptr {
  x: number;
  y: number;
  amt: number;
}

export interface BehaviourCtx {
  t: number;
  dt: number;
  /** pointer radius in world units */
  worldR: number;
  scale: number;
  /** world-space centre of the scene */
  origin: { x: number; y: number };
  ptrHome: Ptr[];
  ptrWorld: Ptr[];
  /** current world positions (n*3) */
  pos: Float32Array;
  /** seconds since any input on this stage */
  idle: number;
}

export interface Behaviour {
  /** n*4 [alpha,size,accent,_] written every frame */
  look: Float32Array;
  /** n*3 home-space displacement added to the rest position */
  hdyn: Float32Array;
  update(c: BehaviourCtx): void;
  tap(x: number, y: number): void;
}

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

function nearest(nodes: Node[], x: number, y: number, maxD: number, skip?: (i: number) => boolean): number {
  let best = -1, bd = maxD * maxD;
  for (let i = 0; i < nodes.length; i++) {
    if (skip?.(i)) continue;
    const d = (nodes[i].x - x) ** 2 + (nodes[i].y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/* ---------------------------------------------------------------- generic */

function generic(d: SceneData): Behaviour {
  return { look: d.look0.slice(), hdyn: new Float32Array(d.n * 3), update() {}, tap() {} };
}

/* ------------------------------------------------------------------ ghost */

function ghost(d: SceneData): Behaviour {
  const n = d.n;
  const look = d.look0.slice();
  const hdyn = new Float32Array(n * 3);
  const dir: Float32Array = d.meta.dir;
  const presence = new Float32Array(n).fill(1);
  let boost = 0;
  return {
    look,
    hdyn,
    tap() {
      boost = 1;
    },
    update(c) {
      boost = Math.max(0, boost - c.dt * 2.2);
      const ptrs: Ptr[] = c.ptrWorld.filter((p) => p.amt > 0.2);
      // while nobody touches it, a slow sweep shows what the object does
      if (c.idle > 4 && ptrs.length === 0) {
        ptrs.push({
          x: c.origin.x + Math.sin(c.t * 0.4) * 1.3 * c.scale,
          y: c.origin.y + Math.sin(c.t * 0.29 + 1) * 1.0 * c.scale,
          amt: 0.8,
        });
      }
      const idleSweep = c.idle > 4 && c.ptrWorld.every((p) => p.amt <= 0.2);
      const R = c.worldR * (idleSweep ? 0.6 : 0.95) * (1 + boost * 1.1);
      const R2 = R * R;
      const pos = c.pos;
      const heal = c.dt * 0.22;
      const melt = c.dt * 7;
      for (let i = 0, i3 = 0, i4 = 0; i < n; i++, i3 += 3, i4 += 4) {
        let hit = 0;
        for (let j = 0; j < ptrs.length; j++) {
          const dx = pos[i3] - ptrs[j].x, dy = pos[i3 + 1] - ptrs[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const h = 1 - Math.sqrt(d2) / R;
            if (h > hit) hit = h;
          }
        }
        let p = presence[i];
        p = hit > 0.1 ? Math.max(0, p - melt * hit) : Math.min(1, p + heal);
        presence[i] = p;
        const base = d.look0[i4];
        look[i4] = 0.07 + (base - 0.07) * Math.pow(p, 1.4);
        look[i4 + 1] = 1.6 * (0.6 + 0.4 * p);
        const k = (1 - p) * 0.4;
        hdyn[i3] = dir[i3] * k;
        hdyn[i3 + 1] = dir[i3 + 1] * k;
        hdyn[i3 + 2] = dir[i3 + 2] * k;
      }
    },
  };
}

/* ----------------------------------------------------------------- agents */

interface Pulse {
  node: number;
  t0: number;
  gain: number;
  hop: number;
  fromEdge: number;
  spawned: boolean;
}

function agents(d: SceneData): Behaviour {
  const { nodes, edges, role, id, tt } = d.meta as {
    nodes: Node[];
    edges: { a: number; b: number }[];
    role: Uint8Array;
    id: Uint16Array;
    tt: Float32Array;
  };
  const n = d.n;
  const look = d.look0.slice();
  const hdyn = new Float32Array(n * 3);
  const glow = new Float32Array(nodes.length);
  const adj: number[][] = nodes.map(() => []);
  edges.forEach((e, i) => {
    adj[e.a].push(i);
    adj[e.b].push(i);
  });
  const pulses: Pulse[] = [];
  let active = -1;
  let lastFire = -10;
  let T = 0;
  const SPEED = 1.5;
  const fire = (node: number, gain: number, hop = 0, fromEdge = -1) => {
    pulses.push({ node, t0: T, gain, hop, fromEdge, spawned: false });
    glow[node] = Math.max(glow[node], gain);
  };
  return {
    look,
    hdyn,
    tap(x, y) {
      const k = nearest(nodes, x, y, 2.2);
      if (k >= 0) {
        fire(k, 1);
        lastFire = T;
      }
    },
    update(c) {
      T = c.t;
      let hov = -1;
      for (const p of c.ptrHome) {
        if (p.amt > 0.3) {
          const k = nearest(nodes, p.x, p.y, 1.1);
          if (k >= 0) { hov = k; break; }
        }
      }
      if (hov !== active) {
        active = hov;
        if (hov >= 0) { fire(hov, 1); lastFire = T; }
      }
      if (active < 0 && c.idle > 3 && T - lastFire > 3.4) {
        fire(1 + Math.floor(Math.random() * (nodes.length - 1)), 0.85);
        lastFire = T;
      }
      for (let k = 0; k < glow.length; k++) {
        glow[k] *= Math.exp(-c.dt * 3);
        if (k === active) glow[k] = Math.max(glow[k], 0.8);
      }
      for (let pi = pulses.length - 1; pi >= 0; pi--) {
        const pl = pulses[pi];
        const front = (T - pl.t0) * SPEED;
        if (front >= 1 && !pl.spawned) {
          pl.spawned = true;
          if (pl.hop < 1) {
            for (const ei of adj[pl.node]) {
              if (ei === pl.fromEdge) continue;
              const e = edges[ei];
              fire(e.a === pl.node ? e.b : e.a, pl.gain * 0.6, pl.hop + 1, ei);
            }
          }
        }
        if (front > 1.9) pulses.splice(pi, 1);
      }
      for (let i = 0, i4 = 0; i < n; i++, i4 += 4) {
        const r = role[i];
        if (r === 0) {
          const g = glow[id[i]];
          look[i4] = Math.min(1, 0.75 + 0.25 * g);
          look[i4 + 1] = 1 + 0.9 * g;
          look[i4 + 2] = Math.min(1, g * 1.4);
        } else if (r === 1) {
          const ei = id[i];
          const e = edges[ei];
          let b = 0;
          for (let q = 0; q < pulses.length; q++) {
            const pl = pulses[q];
            if (pl.fromEdge === ei) continue;
            if (e.a !== pl.node && e.b !== pl.node) continue;
            const s = e.a === pl.node ? tt[i] : 1 - tt[i];
            const front = (T - pl.t0) * SPEED;
            if (front > 1.25) continue;
            const dd = s - front;
            const v = Math.exp((-dd * dd) / 0.014) * pl.gain;
            if (v > b) b = v;
          }
          look[i4] = 0.75 + 0.25 * b;
          look[i4 + 1] = 1 + 1.3 * b;
          look[i4 + 2] = Math.min(1, b * 1.3);
        }
      }
    },
  };
}

/* ---------------------------------------------------------------- network */

type P2 = [number, number];
interface Packet {
  active: boolean;
  pts: P2[];
  cum: number[];
  s: number;
  tip: number;
  hold: number;
  flashed: boolean;
}

function network(d: SceneData): Behaviour {
  const { nodes, edges, role, id, packetStart } = d.meta as {
    nodes: Node[];
    edges: { a: number; b: number }[];
    role: Uint8Array;
    id: Uint16Array;
    packetStart: number;
  };
  const n = d.n;
  const look = d.look0.slice();
  const hdyn = new Float32Array(n * 3);
  const SRC = 0, DST = nodes.length - 1;
  const adj: number[][] = nodes.map(() => []);
  edges.forEach((e) => {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  });
  let failed: number = d.meta.failed;
  let T = 0, lastTap = -99, lastSwitch = 0, flash = 0, nextSpawn = 0.3;
  const glow = new Float32Array(nodes.length);
  const PCOUNT = 7, TRAIL = 5, SPEED = 1.9;
  const packets: Packet[] = Array.from({ length: PCOUNT }, () => ({ active: false, pts: [], cum: [], s: 0, tip: -1, hold: 0, flashed: false }));

  const paths = (from: number, to: number, avoid: number): number[][] => {
    const out: number[][] = [];
    const walk = (cur: number, path: number[]) => {
      if (cur === to) { out.push(path.slice()); return; }
      for (const nx of adj[cur]) {
        if (nx === avoid || path.includes(nx)) continue;
        path.push(nx);
        walk(nx, path);
        path.pop();
      }
    };
    walk(from, [from]);
    return out;
  };
  const shortest = (from: number, to: number, avoid: number): number[] | null => {
    const all = paths(from, to, avoid);
    if (!all.length) return null;
    const m = Math.min(...all.map((p) => p.length));
    const best = all.filter((p) => p.length === m);
    return best[Math.floor(Math.random() * best.length)];
  };
  const xy = (i: number): P2 => [nodes[i].x, nodes[i].y];

  const plan = (): P2[] | null => {
    const through = paths(SRC, DST, -1).filter((p) => p.includes(failed));
    if (through.length && Math.random() < 0.65) {
      const p = through[Math.floor(Math.random() * through.length)];
      const k = p.indexOf(failed);
      const pre = p[k - 1];
      const rest = shortest(pre, DST, failed);
      if (rest) {
        const pts: P2[] = p.slice(0, k).map(xy);
        const A = nodes[pre], F = nodes[failed];
        pts.push([A.x + (F.x - A.x) * 0.78, A.y + (F.y - A.y) * 0.78]);
        pts.push(xy(pre));
        rest.slice(1).forEach((q) => pts.push(xy(q)));
        return pts;
      }
    }
    const direct = shortest(SRC, DST, failed);
    return direct ? direct.map(xy) : null;
  };
  const start = (pk: Packet) => {
    const pts = plan();
    if (!pts) return;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // distance of the "attempt tip": the point just before the path turns back on itself
    let tip = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
      const b = [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]];
      if (a[0] * b[0] + a[1] * b[1] < -0.01) { tip = cum[i]; break; }
    }
    Object.assign(pk, { active: true, pts, cum, s: 0, tip, hold: 0, flashed: false });
  };
  const sample = (pk: Packet, s: number): P2 => {
    const total = pk.cum[pk.cum.length - 1];
    const q = Math.max(0, Math.min(total, s));
    let i = 1;
    while (i < pk.cum.length - 1 && pk.cum[i] < q) i++;
    const seg = pk.cum[i] - pk.cum[i - 1] || 1;
    const t = (q - pk.cum[i - 1]) / seg;
    return [pk.pts[i - 1][0] + (pk.pts[i][0] - pk.pts[i - 1][0]) * t, pk.pts[i - 1][1] + (pk.pts[i][1] - pk.pts[i - 1][1]) * t];
  };
  const failTo = (k: number) => {
    failed = k;
    flash = 1;
    lastSwitch = T;
    packets.forEach((p) => (p.active = false));
    nextSpawn = T + 0.25;
  };
  const failable = (i: number) => i === SRC || i === DST;

  return {
    look,
    hdyn,
    tap(x, y) {
      lastTap = T;
      const k = nearest(nodes, x, y, 1.5, failable);
      if (k >= 0 && k !== failed) failTo(k);
    },
    update(c) {
      T = c.t;
      if (T - lastTap > 10 && T - lastSwitch > 7.5) {
        let k = failed;
        while (k === failed || failable(k)) k = Math.floor(Math.random() * nodes.length);
        failTo(k);
      }
      flash *= Math.exp(-c.dt * 3);
      for (let k = 0; k < glow.length; k++) glow[k] *= Math.exp(-c.dt * 2.6);

      if (T >= nextSpawn) {
        const free = packets.find((p) => !p.active);
        if (free) start(free);
        nextSpawn = T + 0.8;
      }
      for (let pi = 0; pi < PCOUNT; pi++) {
        const pk = packets[pi];
        if (pk.active) {
          if (pk.hold > 0) pk.hold -= c.dt;
          else {
            pk.s += SPEED * c.dt;
            if (pk.tip >= 0 && !pk.flashed && pk.s >= pk.tip) {
              pk.flashed = true;
              pk.hold = 0.28;
              flash = 1;
              pk.s = pk.tip;
            }
          }
          const total = pk.cum[pk.cum.length - 1];
          const head = sample(pk, pk.s);
          for (let k = 0; k < nodes.length; k++) {
            if (k === failed) continue;
            if ((nodes[k].x - head[0]) ** 2 + (nodes[k].y - head[1]) ** 2 < 0.04) glow[k] = Math.max(glow[k], 0.9);
          }
          if (pk.s >= total) pk.active = false;
        }
        for (let k = 0; k < TRAIL; k++) {
          const i = packetStart + pi * TRAIL + k;
          const i3 = i * 3, i4 = i * 4;
          if (pk.active) {
            const p = sample(pk, pk.s - k * 0.17);
            hdyn[i3] = p[0];
            hdyn[i3 + 1] = p[1];
            look[i4] = 0.98 - 0.17 * k;
            look[i4 + 1] = 1.9 - 0.25 * k;
            look[i4 + 2] = pk.hold > 0 ? 1 : 0;
          } else {
            look[i4] = 0;
          }
        }
      }

      for (let i = 0, i4 = 0; i < packetStart; i++, i4 += 4) {
        const r = role[i];
        if (r === 0) {
          const k = id[i];
          if (k === failed) {
            look[i4] = 0.7 + 0.3 * flash;
            look[i4 + 1] = 0.9 + 0.6 * flash;
            look[i4 + 2] = 1;
          } else {
            const g = glow[k];
            look[i4] = 0.85;
            look[i4 + 1] = 1 + 0.7 * g;
            look[i4 + 2] = 0;
          }
        } else if (r === 1) {
          const e = edges[id[i]];
          look[i4] = e.a === failed || e.b === failed ? 0.2 : 0.72;
        }
      }
    },
  };
}

/* ------------------------------------------------------------------- tree */

function tree(d: SceneData): Behaviour {
  const { nodes, links, role, id, tt, arcPoint } = d.meta as {
    nodes: Node[];
    links: { from: number; to: number; broken: boolean }[];
    role: Uint8Array;
    id: Uint16Array;
    tt: Float32Array;
    arcPoint: (l: any, t: number) => [number, number, number];
  };
  const n = d.n;
  const look = d.look0.slice();
  const hdyn = new Float32Array(n * 3);
  const heal = links.map(() => 0);
  const lastTouch = links.map(() => -99);
  const samples = links.map((l) => Array.from({ length: 30 }, (_, k) => arcPoint(l, k / 29)));
  let T = 0;
  const near = (li: number, x: number, y: number, r: number) => {
    const r2 = r * r;
    for (const s of samples[li]) if ((s[0] - x) ** 2 + (s[1] - y) ** 2 < r2) return true;
    const B = nodes[links[li].to];
    return (B.x - x) ** 2 + (B.y - y) ** 2 < r2;
  };
  return {
    look,
    hdyn,
    tap(x, y) {
      links.forEach((l, li) => {
        if (l.broken && near(li, x, y, 1.3)) {
          heal[li] = Math.min(1, heal[li] + 0.7);
          lastTouch[li] = T;
        }
      });
    },
    update(c) {
      T = c.t;
      links.forEach((l, li) => {
        if (!l.broken) return;
        let touched = false;
        for (const p of c.ptrHome) if (p.amt > 0.2 && near(li, p.x, p.y, 0.9)) touched = true;
        if (touched) {
          heal[li] = Math.min(1, heal[li] + c.dt * 2.4);
          lastTouch[li] = T;
        } else if (T - lastTouch[li] > 2.8) heal[li] = Math.max(0, heal[li] - c.dt * 0.14);
      });
      for (let i = 0, i3 = 0, i4 = 0; i < n; i++, i3 += 3, i4 += 4) {
        if (role[i] !== 3) continue;
        const li = id[i];
        const l = links[li];
        const h = smooth(heal[li]);
        const reach = l.broken ? 0.58 + 0.42 * h : 1;
        const t = tt[i];
        if (t <= reach) {
          look[i4] = 0.85;
          look[i4 + 2] = l.broken ? 1 - h : 0;
          hdyn[i3] = hdyn[i3 + 1] = 0;
        } else if (l.broken && t < reach + 0.07 && d.seed[i4 + 2] > 0.4) {
          const ph = d.seed[i4] * 40;
          look[i4] = 0.5 * (1 - h);
          look[i4 + 2] = 1;
          hdyn[i3] = Math.sin(T * 2.4 + ph) * 0.12 * (1 - h);
          hdyn[i3 + 1] = Math.cos(T * 2.1 + ph) * 0.12 * (1 - h) - 0.05;
        } else look[i4] = 0;
      }
    },
  };
}

export function makeBehaviour(d: SceneData): Behaviour {
  switch (d.name) {
    case 'ghost':
      return ghost(d);
    case 'graph':
      return agents(d);
    case 'network':
      return network(d);
    case 'tree':
      return tree(d);
    default:
      return generic(d);
  }
}
