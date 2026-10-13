/**
 * The site's particle fields, built on one engine (engine.ts):
 *
 *  main     ONE persistent field, carried across page transitions: the home hero, a project page,
 *           the 404 page. On the very first visit it assembles the owner's name, then the landscape.
 *  preview  fine pointers only: a floating specimen that follows the cursor over project rows and
 *           morphs from one project's form to the next.
 *  pool     two small stages lent to whichever specimen slots are near the viewport: project rows on
 *           touch screens, the next-project link, the contact block and the menu backdrop.
 *
 * At most four WebGL contexts exist (three on phones), whatever the page holds.
 */
import { Stage, allStages, input, isSmall, removePointer, stats, upsertPointer, wake, warmScenes, type AttachOptions } from './engine';
import { customScene, isSceneName, type SceneName } from './scenes';

const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const N_MAIN = isSmall() ? 5000 : 10000;
const N_SPEC = isSmall() ? 2200 : 3000;
const N_PREVIEW = 4000;
const POOL = 2;
const INTRO_KEY = 'dbm-intro';

let main: Stage | null = null;
let preview: Preview | null = null;
let pool: Pool | null = null;
let failed = false;

const onScreen = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
};

/* ------------------------------------------------------------------ the name, sampled from rendered text */

function sampleName(stage: Stage, slot: HTMLElement): ReturnType<typeof customScene> | null {
  const lines = [...document.querySelectorAll<HTMLElement>('.hero__line')];
  const h1 = document.querySelector<HTMLElement>('.hero__name');
  if (!lines.length || !h1) return null;
  const sr = slot.getBoundingClientRect();
  const cs = getComputedStyle(h1);
  const family = cs.fontFamily;
  const weight = cs.fontWeight;
  const k = 0.5; // sampling resolution (canvas px per CSS px)
  const cw = Math.ceil(sr.width * k), ch = Math.ceil(sr.height * k);
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  const inside = lines.every((l) => {
    const r = l.getBoundingClientRect();
    return r.top >= sr.top && r.bottom <= sr.bottom + 4 && r.left >= sr.left - 4;
  });
  if (inside) {
    // desktop: the particles form the name exactly where the heading will appear
    for (const l of lines) {
      const r = l.getBoundingClientRect();
      const ls = getComputedStyle(l);
      const size = parseFloat(ls.fontSize) * k;
      ctx.font = `${weight} ${size}px ${family}`;
      if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${(parseFloat(ls.letterSpacing) || 0) * k}px`;
      const m = ctx.measureText(l.textContent ?? '');
      const asc = m.fontBoundingBoxAscent ?? size * 0.9, desc = m.fontBoundingBoxDescent ?? size * 0.25;
      const lh = (parseFloat(ls.lineHeight) || parseFloat(ls.fontSize)) * k;
      ctx.fillText(l.textContent ?? '', (r.left - sr.left) * k, (r.top - sr.top) * k + (lh - (asc + desc)) / 2 + asc);
    }
  } else {
    // phones: the name is set inside the field's band, above the heading
    const words = lines.map((l) => l.textContent ?? '');
    ctx.font = `${weight} 100px ${family}`;
    const ls0 = parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) || -0.05;
    if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${ls0 * 100}px`;
    const widest = Math.max(...words.map((w) => ctx.measureText(w).width));
    const size = Math.min((cw * 0.8 * 100) / widest, (ch * 0.8) / (words.length * 0.92));
    ctx.font = `${weight} ${size}px ${family}`;
    if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${ls0 * size}px`;
    const block = words.length * size * 0.92;
    words.forEach((w, i) => {
      const x = (cw - ctx.measureText(w).width) / 2;
      ctx.fillText(w, x, (ch - block) / 2 + (i + 0.8) * size * 0.92);
    });
  }
  const img = ctx.getImageData(0, 0, cw, ch).data;
  const cand: number[] = [];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (img[(y * cw + x) * 4 + 3] > 120) cand.push(x, y);
  if (cand.length < 40) return null;
  const n = stage.n, home = new Float32Array(n * 3), m = cand.length / 2;
  for (let i = 0; i < n; i++) {
    const j = ((Math.random() * m) | 0) * 2;
    const p = stage.homeAt(sr.left + (cand[j] + Math.random()) / k, sr.top + (cand[j + 1] + Math.random()) / k);
    if (!p) continue;
    home[i * 3] = p.x;
    home[i * 3 + 1] = p.y;
    home[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
  }
  return customScene(home, n, inside ? 0.95 : 0.5);
}

/** First visit only: noise → the name → the landscape, about 1.5 s, never blocking anything. */
function runIntro(slot: HTMLElement): boolean {
  const root = document.documentElement;
  if (!main || !root.classList.contains('intro') || root.classList.contains('intro-run')) return false;
  // too late (the safety net already showed the page): skip the moment rather than redo the hero
  if (performance.now() > 3300) return false;
  main.mount(slot);
  const name = sampleName(main, slot);
  if (!name) return false;
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* ignore */
  }
  root.classList.add('intro-run');
  const m = main;
  m.scatter();
  // pull tight and calm onto the letters, hold a moment, then let go into the landscape
  m.stiffness = 4;
  m.damping = 1.5;
  m.setScene(name, { morph: 0.4, stagger: 0.2, lift: 0.2 });
  m.after(1.15, () => {
    m.stiffness = 1.6;
    m.damping = 1;
    m.setScene('scene', { morph: 0.45, stagger: 0.25, lift: 0.7 });
    root.classList.add('intro-reveal');
  });
  m.after(2.2, () => (m.stiffness = 1));
  const ric = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 300));
  m.after(2.4, () => ric(upgradeMain));
  slot.classList.add('is-live');
  main.draw();
  wake();
  return true;
}

/* ------------------------------------------------------------------ hover preview (fine pointers) */

class Preview {
  readonly el: HTMLDivElement;
  private slot: HTMLDivElement;
  private _stage: Stage | null = null;
  project: string | null = null;
  private shown = false;
  private x = 0;
  private y = 0;
  private tx = 0;
  private ty = 0;
  private raf = 0;
  private last = 0;
  private hideTimer = 0;
  private holdUntil = 0;
  private over: HTMLElement | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'preview';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.hidden = true;
    this.slot = document.createElement('div');
    this.slot.className = 'preview__slot';
    this.slot.dataset.mode = 'preview';
    this.el.appendChild(this.slot);
    document.addEventListener('pointerover', this.onOver, { passive: true });
    window.addEventListener('pointermove', this.onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => this.hide(), { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  mount() {
    if (!this.el.isConnected) document.body.appendChild(this.el);
  }

  /** created on first use, once WebGL is warm */
  get stage(): Stage | null {
    if (!this._stage && glReady()) {
      try {
        this._stage = new Stage(N_PREVIEW);
      } catch {
        /* no preview */
      }
    }
    return this._stage;
  }

  private size() {
    return { w: this.el.offsetWidth || 300, h: this.el.offsetHeight || 225 };
  }
  /** cursor at the preview's left edge, vertically centred; flips left near the right edge */
  private target(cx: number, cy: number) {
    const { w, h } = this.size();
    const gap = 28;
    let x = cx + gap;
    if (x + w > window.innerWidth - 16) x = cx - gap - w;
    this.tx = Math.max(16, x);
    this.ty = Math.min(window.innerHeight - h - 16, Math.max(16, cy - h / 2));
  }

  private onOver = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const row = (e.target as Element | null)?.closest?.<HTMLElement>('.entry[data-project]') ?? null;
    if (row === this.over) return;
    this.over = row;
    if (row) this.show(row, e.clientX, e.clientY);
    else if (performance.now() > this.holdUntil) this.hide();
  };
  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !this.shown) return;
    this.target(e.clientX, e.clientY);
    this.loop();
  };
  private onScroll = () => {
    if (!this.shown) return;
    const p = input.pointers.find((q) => q.id === 'mouse');
    const under = p ? document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>('.entry[data-project]') : null;
    if (under !== this.over) {
      this.over = under ?? null;
      if (under && p) this.show(under, p.x, p.y);
      else this.hide();
    }
  };

  show(row: HTMLElement, cx: number, cy: number, instant = false) {
    const stage = this.stage;
    if (!stage) return;
    const id = row.dataset.project ?? null;
    const scene = (isSceneName(row.dataset.scene) ? row.dataset.scene : 'leaf') as SceneName;
    clearTimeout(this.hideTimer);
    this.mount();
    this.target(cx, cy);
    if (!this.shown) {
      this.el.hidden = false;
      this.x = this.tx;
      this.y = this.ty;
      this.place();
      stage.attach(this.slot, { scene, snap: true });
      this.el.classList.toggle('is-instant', instant);
      void this.el.offsetWidth;
      this.el.classList.add('is-shown');
      this.shown = true;
    } else if (id !== this.project) {
      stage.setScene(scene, { morph: 0.7, stagger: 0.25, lift: 0.5 });
    }
    this.project = id;
    this.loop();
  }

  hide() {
    if (!this.shown) return;
    this.shown = false;
    this.over = null;
    this.el.classList.remove('is-shown', 'is-instant');
    this.hideTimer = window.setTimeout(() => {
      if (!this.shown) {
        this.el.hidden = true;
        this.project = null;
      }
    }, 320);
  }

  /** after a page swap the old element is gone from the DOM; start clean */
  reset() {
    clearTimeout(this.hideTimer);
    this.shown = false;
    this.over = null;
    this.project = null;
    this.el.hidden = true;
    this.el.classList.remove('is-shown', 'is-instant');
    this.el.style.viewTransitionName = '';
    this.el.removeAttribute('data-vt');
  }

  /** Coming back from a project page: appear on its row so the field can shrink into it. */
  at(row: HTMLElement): HTMLElement | null {
    if (!this.stage) return null;
    const r = row.getBoundingClientRect();
    const title = row.querySelector('.entry__title')?.getBoundingClientRect();
    const cx = Math.min(r.right - 40, (title ? title.right : r.left + r.width * 0.4) + 8);
    this.show(row, cx, r.top + r.height / 2, true);
    this.over = row;
    this.holdUntil = performance.now() + 1400;
    window.setTimeout(() => {
      const p = input.pointers.find((q) => q.id === 'mouse');
      const under = p ? document.elementFromPoint(p.x, p.y)?.closest('.entry[data-project]') : null;
      if (!under) this.hide();
    }, 1400);
    return this.el;
  }

  private place() {
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
  }
  private loop() {
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      const a = 1 - Math.exp(-dt * 9);
      this.x += (this.tx - this.x) * a;
      this.y += (this.ty - this.y) * a;
      this.place();
      if (Math.abs(this.tx - this.x) + Math.abs(this.ty - this.y) > 0.3) this.raf = requestAnimationFrame(tick);
      else this.raf = 0;
    };
    this.raf = requestAnimationFrame(tick);
  }
}

/* ------------------------------------------------------------------ pool of small stages */

interface Client {
  el: HTMLElement;
  near: boolean;
  menu: boolean;
}

class Pool {
  private stages: Stage[] = [];
  private clients: Client[] = [];
  private menuOpen = false;
  private queued = 0;
  private io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const c = this.clients.find((q) => q.el === e.target);
        if (c) c.near = e.isIntersecting;
      }
      this.update();
    },
    { rootMargin: '30% 0px 30% 0px' },
  );

  constructor() {
    window.addEventListener('scroll', () => this.queue(), { passive: true });
  }

  register() {
    this.release();
    this.clients = [...document.querySelectorAll<HTMLElement>('[data-spec-slot]')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, near: false, menu: el.hasAttribute('data-menu-field') }));
    this.clients.forEach((c) => this.io.observe(c.el));
  }

  release() {
    this.io.disconnect();
    this.stages.forEach((s) => s.park());
    this.clients = [];
  }

  setMenu(open: boolean) {
    this.menuOpen = open;
    this.update();
  }

  queue() {
    if (this.queued) return;
    this.queued = requestAnimationFrame(() => {
      this.queued = 0;
      this.update();
    });
  }

  private update() {
    const mid = window.innerHeight / 2;
    const dist = (c: Client) => {
      const r = c.el.getBoundingClientRect();
      return Math.abs(r.top + r.height / 2 - mid);
    };
    const chosen = this.clients
      .filter((c) => (c.menu ? this.menuOpen : c.near && !this.menuOpen))
      .sort((a, b) => Number(b.menu) - Number(a.menu) || dist(a) - dist(b))
      .slice(0, POOL);
    for (const s of this.stages) if (s.slot && !chosen.some((c) => c.el === s.slot)) s.park();
    for (const c of chosen) {
      if (this.stages.some((s) => s.slot === c.el)) continue;
      let s = this.stages.find((q) => !q.slot);
      if (!s && this.stages.length < POOL && glReady()) {
        try {
          s = new Stage(N_SPEC);
          this.stages.push(s);
        } catch {
          return;
        }
      }
      if (s) s.attach(c.el, clientOptions(c.el));
    }
  }
}

/** How a slot wants its stage: specimens appear exactly as their still; ambient fields gather in. */
function clientOptions(el: HTMLElement): AttachOptions {
  const scene = (isSceneName(el.dataset.scene) ? el.dataset.scene : 'leaf') as SceneName;
  const opacity = el.dataset.opacity ? parseFloat(el.dataset.opacity) : 1;
  const enter = el.dataset.enter;
  if (enter === 'gather') return { scene, fromNoise: true, opacity, timing: { morph: 2.4, stagger: 1.6, lift: 0.4 } };
  if (enter === 'flow') return { scene, fromNoise: true, opacity, timing: { morph: 1.1, stagger: 0.5, lift: 0.3 } };
  return { scene, snap: true, opacity };
}

/* ------------------------------------------------------------------ module API */

/** WebGL contexts may be created (the main field has left its 2D start). */
function glReady() {
  return !!main && !main.lite;
}

function watchLoss(canvas: HTMLCanvasElement) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    for (const s of [...allStages()]) s.destroy();
    document.documentElement.classList.remove('field-live');
    main = null;
    preview = null;
    pool = null;
    failed = true;
  });
}

/** Leave the 2D start: from now on every field draws with WebGL. */
function upgradeMain() {
  if (!main?.lite) return;
  if (!main.upgrade()) {
    failed = true;
    return;
  }
  watchLoss(main.canvas);
  pool?.queue();
}

/** Create the fields (once). Returns false when WebGL is unavailable. */
export function initField(): boolean {
  if (main) return true;
  if (failed || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  // the first visit starts on a 2D canvas (it never stalls the page) and moves to WebGL when idle
  const lite = document.documentElement.classList.contains('intro');
  try {
    main = new Stage(N_MAIN, lite);
  } catch {
    failed = true;
    return false;
  }
  if (!lite) watchLoss(main.canvas);
  try {
    pool = new Pool();
    if (fine()) preview = new Preview();
  } catch {
    /* the main field still works */
  }

  const opts: AddEventListenerOptions = { passive: true };
  const tapAll = (x: number, y: number) => {
    for (const s of allStages()) s.tap(x, y);
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    upsertPointer('mouse', e.clientX, e.clientY);
    wake();
  }, opts);
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') tapAll(e.clientX, e.clientY);
  }, opts);
  document.documentElement.addEventListener('pointerleave', () => removePointer('mouse'), opts);
  window.addEventListener('touchstart', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      upsertPointer('t' + t.identifier, t.clientX, t.clientY);
      tapAll(t.clientX, t.clientY);
    }
    wake();
  }, opts);
  window.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.touches)) upsertPointer('t' + t.identifier, t.clientX, t.clientY);
    wake();
  }, opts);
  const end = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) removePointer('t' + t.identifier);
  };
  window.addEventListener('touchend', end, opts);
  window.addEventListener('touchcancel', end, opts);
  document.addEventListener('visibilitychange', () => wake());
  const retheme = () => {
    for (const s of allStages()) s.applyTheme();
  };
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
  window.setTimeout(() => warmScenes(preview ? [N_MAIN, N_SPEC, N_PREVIEW] : [N_MAIN, N_SPEC]), 6000);

  (window as any).__stage = {
    get scene() {
      return main?.scene;
    },
    get morphing() {
      return main?.morphing;
    },
    get disperse() {
      return main?.disperse;
    },
    get t() {
      return main?.t;
    },
    get lite() {
      return main?.lite;
    },
    get preview() {
      return preview ? { shown: !preview.el.hidden, project: preview.project, scene: preview.stage?.scene ?? null } : null;
    },
    live: () => [...allStages()].filter((s) => s.slot).map((s) => ({ scene: s.scene, n: s.n, mode: s.mode, visible: s.visible })),
    resetStats: () => Object.assign(stats, { frames: 0, sumMs: 0, maxMs: 0, recent: [], dts: [] }),
    summary: () => {
      const r = [...stats.recent].sort((a, b) => a - b);
      const d = [...stats.dts].sort((a, b) => a - b);
      return {
        frames: stats.frames,
        avgMs: stats.sumMs / Math.max(1, stats.frames),
        p95Ms: r[Math.floor(r.length * 0.95)] ?? 0,
        maxMs: stats.maxMs,
        frameP50: d[Math.floor(d.length * 0.5)] ?? 0,
        frameP95: d[Math.floor(d.length * 0.95)] ?? 0,
        over33: stats.dts.filter((x) => x > 33.4).length,
        attachMs: stats.attachMs,
      };
    },
  };
  return true;
}

/**
 * Put the main field into the current page's slot (or park it). Synchronous: it runs during the
 * page swap so the new page's view-transition snapshot already shows the field.
 */
export function attachField(o: { snap?: boolean } = {}): void {
  if (!main) return;
  const t0 = performance.now();
  preview?.reset();
  preview?.mount();
  // a navigation before the 2D start has moved to WebGL: move now
  if (main.lite && main.slot) upgradeMain();
  const slot = document.querySelector<HTMLElement>('[data-field-slot]');
  if (!main) return;
  if (!slot) main.park();
  else if (!runIntro(slot)) {
    const first = !main.slot && main.scene === null;
    main.attach(slot, first ? { fromNoise: true } : { snap: o.snap || !onScreen(slot) });
  }
  stats.attachMs = performance.now() - t0;
  document.documentElement.classList.toggle('field-live', !!main.slot);
}

/** After a page has loaded: lend the pool to its specimen slots. */
export function pageReady(): void {
  pool?.register();
}
/** Before the page is swapped out. */
export function pageLeave(): void {
  pool?.release();
}
export function menuToggled(open: boolean): void {
  pool?.setMenu(open);
}

/* continuity hooks (see ../continuity.ts) */
export function previewFor(project: string): HTMLElement | null {
  return preview && !preview.el.hidden && preview.project === project ? preview.el : null;
}
export function previewAt(row: HTMLElement): HTMLElement | null {
  return preview && fine() ? preview.at(row) : null;
}

