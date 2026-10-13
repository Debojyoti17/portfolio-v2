/**
 * Single client entry. Re-initialises page behaviour on every Astro view transition, and keeps
 * ONE particle field alive across pages (see stage/stage.ts).
 */
import { applyStoredTheme, initUI, settleHash } from './ui';

type FieldModule = typeof import('./stage/stage');

let cleanups: (() => void)[] = [];
let generation = 0;
let field: FieldModule | null = null;
let fieldLoading: Promise<void> | null = null;
let gateArmed = false;

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const constrained = () => matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const idle = (fn: () => void, timeout = 1200) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 150);

function loadField(): Promise<void> {
  if (!fieldLoading) {
    fieldLoading = import('./stage/stage')
      .then((m) => {
        if (m.initField()) {
          field = m;
          m.attachField();
        }
      })
      .catch((err) => console.warn('[field] static fallback in use:', err));
  }
  return fieldLoading;
}

/** Bring the field in when a page needs it. Phones wait for the first touch or scroll. */
function startField() {
  if (reduce()) return;
  if (field) {
    field.attachField();
    return;
  }
  if (!document.querySelector('[data-field-slot]')) return;
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
  document.documentElement.classList.remove('motion-failed');
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
  startField();
  // Safety net: never leave content hidden if motion could not start.
  window.setTimeout(() => {
    if (gen === generation && !motionOk) document.documentElement.classList.add('motion-failed');
  }, 6000);
}

function teardown() {
  generation++;
  cleanups.forEach((c) => {
    try {
      c();
    } catch {
      /* ignore */
    }
  });
  cleanups = [];
}

document.addEventListener('astro:before-preparation', () => field?.prepareLeave());
document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:after-swap', () => {
  applyStoredTheme();
  // synchronous: the new page's view-transition snapshot must already contain the field
  field?.attachField();
});
document.addEventListener('astro:page-load', boot);
