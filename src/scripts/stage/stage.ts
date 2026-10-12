/**
 * The 3D stage: a GPU point cloud ("Gaussian-splat" style) that assembles into
 * different forms as the page scrolls and reacts to the cursor.
 *
 * Loaded lazily (dynamic import) and only on pages that contain [data-stage].
 * Falls back to the server-rendered SVG when WebGL is missing, the context is
 * lost, or the visitor prefers reduced motion.
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
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { FORM_LABELS, generateForm, isFormName, type FormName } from './forms';
import { fragmentShader, vertexShader } from './shaders';
import { rng } from '../../lib/hash';

interface Anchor {
  el: HTMLElement;
  form: FormName;
  top: number;
  height: number;
  sx: number;
  sy: number;
  so: number;
}

const FOV = 38;
const CAM_Z = 10;
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

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

export async function mountStages(): Promise<() => void> {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const roots = [...document.querySelectorAll<HTMLElement>('[data-stage]')];
  const stops = await Promise.all(roots.map((r) => mountStage(r).catch((e) => (console.warn('[stage]', e), () => {}))));
  return () => stops.forEach((s) => s());
}

async function mountStage(root: HTMLElement): Promise<() => void> {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-stage-canvas]');
  if (!canvas) return () => {};
  const fixed = root.dataset.stage === 'fixed';
  const small = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
  const count = fixed ? (small ? 6500 : 16000) : small ? 4500 : 9000;
  const dprCap = small ? 1.25 : 1.75;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return () => {}; // no WebGL: the static SVG stays
  }
  renderer.setClearColor(0x000000, 0);

  /* ---------- forms ---------- */
  const cache = new Map<FormName, Float32Array>();
  const getForm = (n: FormName) => {
    let f = cache.get(n);
    if (!f) cache.set(n, (f = generateForm(n, count)));
    return f;
  };

  /* ---------- anchors (sections that define which form is shown) ---------- */
  let anchors: Anchor[] = [];
  const readAnchors = () => {
    if (!fixed) {
      const form = isFormName(root.dataset.stageForm) ? root.dataset.stageForm : 'scene';
      anchors = [{ el: root, form, top: 0, height: 1, sx: 0, sy: 0, so: 1 }];
      return;
    }
    const sy = window.scrollY;
    anchors = [...document.querySelectorAll<HTMLElement>('main [data-form]')]
      .filter((el) => isFormName(el.dataset.form))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          form: el.dataset.form as FormName,
          top: r.top + sy,
          height: Math.max(1, r.height),
          sx: parseFloat(el.dataset.sx ?? '0.22'),
          sy: parseFloat(el.dataset.sy ?? '0'),
          so: parseFloat(el.dataset.so ?? '1'),
        };
      })
      .sort((a, b) => a.top - b.top);
    if (anchors.length === 0) {
      const form = isFormName(root.dataset.stageForm) ? root.dataset.stageForm : 'scene';
      anchors = [{ el: root, form, top: 0, height: 1, sx: 0.22, sy: 0, so: 1 }];
    }
  };
  readAnchors();

  /* ---------- three.js objects ---------- */
  const geometry = new BufferGeometry();
  const aA = new BufferAttribute(new Float32Array(count * 3), 3);
  const aB = new BufferAttribute(new Float32Array(count * 3), 3);
  const aC = new BufferAttribute(new Float32Array(count * 3), 3);
  for (const a of [aA, aB, aC]) a.setUsage(35048 /* DynamicDrawUsage */);
  const seeds = new Float32Array(count * 4);
  const rnd = rng(20240311);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
  geometry.setAttribute('position', aA);
  geometry.setAttribute('aB', aB);
  geometry.setAttribute('aC', aC);
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));

  const uniforms = {
    uMix: { value: 0 },
    uHover: { value: 0 },
    uIntro: { value: 0 },
    uTime: { value: 0 },
    uPointer: { value: new Vector3(99, 99, 0) },
    uOffset: { value: new Vector2() },
    uScale: { value: 1 },
    uRot: { value: new Vector2() },
    uSize: { value: fixed ? (small ? 44 : 34) : small ? 34 : 30 },
    uPx: { value: 1 },
    uOpacity: { value: 1 },
    uInk: { value: new Vector3(0.1, 0.1, 0.1) },
    uAccent: { value: new Vector3(0.9, 0.1, 0.1) },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  const scene = new Scene();
  scene.add(points);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.z = CAM_Z;

  const applyTheme = () => {
    const ink = cssColor('--stage-ink', '#141416');
    const acc = cssColor('--accent', '#e4161f');
    uniforms.uInk.value.set(...ink);
    uniforms.uAccent.value.set(...acc);
    const dark = ink[0] + ink[1] + ink[2] > 1.5;
    material.blending = dark ? AdditiveBlending : NormalBlending;
    // additive light on dark needs less alpha per splat; ink on paper needs more
    uniforms.uSize.value = (fixed ? (small ? 44 : 34) : small ? 34 : 30) * (dark ? 1 : 1.08);
  };
  applyTheme();
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const schemeMq = matchMedia('(prefers-color-scheme: dark)');
  schemeMq.addEventListener('change', applyTheme);

  /* ---------- state ---------- */
  let curA: FormName | null = null;
  let curB: FormName | null = null;
  let curC: FormName | null = null;
  let hoverTarget: FormName | null = null;
  let hoverValue = 0;
  let width = 1;
  let height = 1;
  let running = false;
  let raf = 0;
  let disposed = false;
  let lastActive = performance.now();
  let frameToggle = false;
  let fSmooth = -1;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, amt: 0, tamt: 0, ndcX: 0, ndcY: 0 };
  let halfW = 5;
  let halfH = 3.4;
  let portrait = false;

  const resize = () => {
    const rect = root.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === width && h === height) return;
    width = w;
    height = h;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    uniforms.uPx.value = dpr * (h / 900) * 1.0;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfH = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
    halfW = halfH * camera.aspect;
    portrait = camera.aspect < 0.9;
  };

  const setBuf = (att: BufferAttribute, form: FormName) => {
    (att.array as Float32Array).set(getForm(form));
    att.needsUpdate = true;
  };

  /** Scroll position → fractional anchor index, with plateaus so each form holds still. */
  const computeF = (y: number): number => {
    const n = anchors.length;
    for (let i = 0; i < n - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      const gs = a.top + a.height * 0.75;
      const ge = b.top + b.height * 0.25;
      if (y < Math.min(gs, ge)) return i;
      if (ge <= gs) {
        const mid = (a.top + a.height / 2 + b.top + b.height / 2) / 2;
        if (y < mid) return i;
        continue;
      }
      if (y <= ge) return i + smoother(clamp01((y - gs) / (ge - gs)));
    }
    return n - 1;
  };

  /* ---------- input ---------- */
  const onPointerMove = (e: PointerEvent) => {
    const rect = fixed ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : root.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.ndcX = nx;
    pointer.ndcY = ny;
    pointer.tx = nx * halfW;
    pointer.ty = ny * halfH;
    const inside = Math.abs(nx) <= 1 && Math.abs(ny) <= 1;
    pointer.tamt = inside ? 1 : 0;
    lastActive = performance.now();
    if (!running) start();
  };
  const onPointerLeave = () => {
    pointer.tamt = 0;
  };
  const target: EventTarget = fixed ? window : root;
  target.addEventListener('pointermove', onPointerMove as EventListener, { passive: true });
  if (fixed) document.documentElement.addEventListener('pointerleave', onPointerLeave);
  else root.addEventListener('pointerleave', onPointerLeave);

  // hover forms: any element with data-hover-form morphs the field while hovered/focused
  const hoverIn = (e: Event) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-hover-form]') as HTMLElement | null;
    if (el && isFormName(el.dataset.hoverForm)) hoverTarget = el.dataset.hoverForm;
  };
  const hoverOut = (e: Event) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-hover-form]');
    if (el) hoverTarget = null;
  };
  if (fixed) {
    document.addEventListener('pointerover', hoverIn);
    document.addEventListener('pointerout', hoverOut);
    document.addEventListener('focusin', hoverIn);
    document.addEventListener('focusout', hoverOut);
  }

  /* ---------- loop ---------- */
  const t0 = performance.now();
  let introStart = -1;
  const frame = (now: number) => {
    raf = 0;
    if (disposed || !running) return;
    raf = requestAnimationFrame(frame);

    // idle throttle: after 2.5 s without input render every other frame
    const idle = now - lastActive > 2500;
    if (idle) {
      frameToggle = !frameToggle;
      if (frameToggle) return;
    }

    const time = (now - t0) / 1000;
    if (introStart < 0) introStart = now;
    const intro = clamp01((now - introStart) / 2800);
    uniforms.uIntro.value = fixed && anchors[0].form === 'noise' ? 1 : smoother(intro);
    uniforms.uTime.value = time;

    // which pair of forms, and how far between them
    const scrollY = window.scrollY;
    const f = fixed ? computeF(scrollY + window.innerHeight * 0.5) : 0;
    fSmooth = fSmooth < 0 ? f : fSmooth + (f - fSmooth) * 0.16;
    if (Math.abs(fSmooth - f) < 0.0005) fSmooth = f;
    const i = Math.min(anchors.length - 1, Math.floor(fSmooth));
    const j = Math.min(anchors.length - 1, i + 1);
    const t = i === j ? 0 : fSmooth - i;
    const A = anchors[i], B = anchors[j];
    if (curA !== A.form) { setBuf(aA, A.form); curA = A.form; }
    if (curB !== B.form) { setBuf(aB, B.form); curB = B.form; }
    uniforms.uMix.value = A.form === B.form ? 0 : t;

    // hover form
    const wantHover = hoverTarget;
    if (wantHover && curC !== wantHover && hoverValue < 0.04) {
      setBuf(aC, wantHover);
      curC = wantHover;
    }
    const goal = wantHover && curC === wantHover ? 1 : 0;
    // if the hover target changed while another is shown, retreat first
    const retreat = wantHover && curC !== wantHover ? 0 : goal;
    hoverValue += (retreat - hoverValue) * 0.07;
    if (Math.abs(hoverValue - retreat) < 0.002) hoverValue = retreat;
    uniforms.uHover.value = hoverValue;

    // placement
    const sx = lerp(A.sx, B.sx, t), sy = lerp(A.sy, B.sy, t), so = lerp(A.so, B.so, t);
    let scale: number;
    if (fixed) {
      const occ = portrait ? 1.0 : 0.56;
      scale = Math.min((occ * halfW) / 3.5, (0.86 * halfH) / 2.25);
      uniforms.uOffset.value.set(portrait ? 0 : sx * halfW, portrait ? halfH * (0.34 + sy) : sy * halfH);
    } else {
      scale = Math.min((0.9 * halfW) / 3.5, (0.86 * halfH) / 2.25);
      uniforms.uOffset.value.set(0, 0);
    }
    uniforms.uScale.value = scale;
    uniforms.uOpacity.value = Math.min(1, so + hoverValue * 0.5) * (portrait && fixed ? 0.75 : 1);

    // pointer smoothing
    pointer.x += (pointer.tx - pointer.x) * 0.14;
    pointer.y += (pointer.ty - pointer.y) * 0.14;
    pointer.amt += (pointer.tamt - pointer.amt) * 0.08;
    uniforms.uPointer.value.set(pointer.x, pointer.y, pointer.amt);

    // slow rotation + parallax
    const yaw = Math.sin(time * 0.12) * 0.16 + pointer.ndcX * 0.14 * pointer.amt + (fixed ? fSmooth * 0.18 : 0);
    const pitch = pointer.ndcY * 0.07 * pointer.amt;
    uniforms.uRot.value.set(yaw, pitch);

    renderer.render(scene, camera);
  };

  const start = () => {
    if (running || disposed) return;
    running = true;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  /* ---------- lifecycle ---------- */
  const ro = new ResizeObserver(() => {
    resize();
    readAnchors();
  });
  ro.observe(root);
  if (fixed) ro.observe(document.body);
  resize();
  const refresh = () => readAnchors();
  window.addEventListener('load', refresh);
  document.fonts?.ready.then(refresh);

  const onVisibility = () => (document.hidden ? stop() : visible && start());
  let visible = true;
  document.addEventListener('visibilitychange', onVisibility);
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (!fixed) visible ? !document.hidden && start() : stop();
    },
    { rootMargin: '80px' },
  );
  io.observe(root);

  const onLost = (e: Event) => {
    e.preventDefault();
    dispose(true);
  };
  canvas.addEventListener('webglcontextlost', onLost);

  // first form up, then warm the rest in idle time
  setBuf(aA, anchors[0].form);
  setBuf(aB, anchors[Math.min(1, anchors.length - 1)].form);
  curA = anchors[0].form;
  curB = anchors[Math.min(1, anchors.length - 1)].form;
  const warm = () => {
    const pending = new Set<FormName>([...anchors.map((a) => a.form), ...[...document.querySelectorAll<HTMLElement>('[data-hover-form]')].map((e) => e.dataset.hoverForm as FormName)]);
    const queue = [...pending].filter((n) => isFormName(n) && !cache.has(n));
    const step = () => {
      const n = queue.shift();
      if (!n || disposed) return;
      getForm(n);
      ('requestIdleCallback' in window ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 60))(step);
    };
    step();
  };
  ('requestIdleCallback' in window ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 300))(warm);

  root.classList.add('is-live');
  if (fixed) document.documentElement.classList.add('stage-live');
  document.querySelectorAll<HTMLElement>('[data-readout-count]').forEach((el) => (el.textContent = `${count.toLocaleString('en-GB')} particles`));
  start();

  function dispose(lost = false) {
    if (disposed) return;
    disposed = true;
    stop();
    target.removeEventListener('pointermove', onPointerMove as EventListener);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    root.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('pointerover', hoverIn);
    document.removeEventListener('pointerout', hoverOut);
    document.removeEventListener('focusin', hoverIn);
    document.removeEventListener('focusout', hoverOut);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onLost);
    window.removeEventListener('load', refresh);
    schemeMq.removeEventListener('change', applyTheme);
    themeObserver.disconnect();
    ro.disconnect();
    io.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    if (!lost) renderer.forceContextLoss();
    root.classList.remove('is-live');
    if (fixed) document.documentElement.classList.remove('stage-live');
  }
  // debugging / test hook
  (window as any).__stage = { count, labels: FORM_LABELS, info: () => ({ f: fSmooth, curA, curB, hoverValue }) };
  return () => dispose();
}
