/**
 * Single client entry. Re-initialises page behaviour on every Astro view transition, keeps the
 * particle fields alive across pages (stage/stage.ts) and the continuity between them (continuity.ts).
 */
import { applyStoredTheme, initUI, settleHash } from './ui';
import { arrived, leaving } from './continuity';

type FieldModule = typeof import('./stage/stage');

let cleanups: (() => void)[] = [];
let generation = 0;
let field: FieldModule | null = null;
let fieldLoading: Promise<void> | null = null;
let gateArmed = false;

const root = document.documentElement;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const constrained = () => matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const idle = (fn: () => void, timeout = 1200) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 150);

/** Resolves once the page has loaded and the main thread has a quiet moment (the GPU process is
 *  still starting up during load, and creating a WebGL context then blocks for a long time). */
const settled = () =>
  new Promise<void>((resolve) => {
    const go = () => idle(() => resolve(), 1000);
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  });

function loadField(): Promise<void> {
  if (!fieldLoading) {
    fieldLoading = Promise.all([import('./stage/stage'), settled(), document.fonts?.ready])
      .then(([m]) => {
        if (m.initField()) {
          field = m;
          m.attachField();
          m.pageReady();
        } else root.classList.remove('intro');
      })
      .catch((err) => {
        root.classList.remove('intro');
        console.warn('[field] static fallback in use:', err);
      });
  }
  return fieldLoading;
}

/** Bring the fields in. The first visit to the home page starts at once (the name assembles);
 *  otherwise desktops start when idle and phones on the first touch or scroll. */
function startField() {
  if (reduce()) return;
  if (field) {
    field.pageReady();
    return;
  }
  if (root.classList.contains('intro')) {
    void loadField();
    return;
  }
  const needed = document.querySelector('[data-field-slot], [data-spec-slot]') || matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!needed) return;
  if (!constrained()) {
    idle(() => void loadField(), 2000);
    return;
  }
  if (gateArmed) return;
  gateArmed = true;
  const events = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'];
  let fired = false;
  const go = () => {
    if (fired) return;
    fired = true;
    events.forEach((e) => window.removeEventListener(e, go));
    setTimeout(() => void loadField(), 0);
  };
  events.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
  window.setTimeout(go, 9000);
}

function boot() {
  const gen = ++generation;
  cleanups.push(initUI());
  settleHash();
  root.classList.remove('motion-failed');
  let motionOk = reduce();
  idle(async () => {
    if (gen !== generation || reduce()) return;
    try {
      const { initMotion } = await import('./motion');
      const stop = initMotion();
      if (gen !== generation) return stop();
      cleanups.push(stop);
      motionOk = true;
    } catch (err) {
      console.warn('[motion] disabled:', err);
    }
  });
  if (!reduce() && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    import('./cursor').then(({ initCursor }) => {
      if (gen === generation) cleanups.push(initCursor());
    });
  }
  startField();
  // Safety net: never leave content hidden if motion could not start.
  window.setTimeout(() => {
    if (gen === generation && !motionOk) root.classList.add('motion-failed');
  }, 6000);
}

function teardown() {
  generation++;
  field?.pageLeave();
  cleanups.forEach((c) => {
    try {
      c();
    } catch {
      /* ignore */
    }
  });
  cleanups = [];
}

document.addEventListener('astro:before-preparation', (e) => leaving(e, field));
document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:after-swap', () => {
  applyStoredTheme();
  // synchronous: the new page's view-transition snapshot must already contain the field
  arrived(field);
});
document.addEventListener('menu:toggle', (e) => field?.menuToggled((e as CustomEvent<boolean>).detail));
document.addEventListener('astro:page-load', boot);
