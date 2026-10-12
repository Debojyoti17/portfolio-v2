/**
 * Single client entry. Re-initialises on every Astro view transition and
 * lazily pulls in the heavy modules (motion, three.js) only when needed.
 */
import { applyStoredTheme, initUI } from './ui';

let cleanups: (() => void)[] = [];
let generation = 0;

const idle = (fn: () => void, timeout = 1200) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 150);

function boot() {
  const gen = ++generation;
  cleanups.push(initUI());
  document.documentElement.classList.remove('motion-failed');

  const needsStage = !!document.querySelector('[data-stage]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let motionOk = reduce; // nothing to wait for under reduced motion

  idle(async () => {
    if (gen !== generation || reduce) return;
    try {
      const { initMotion } = await import('./motion');
      const stop = await initMotion();
      if (gen !== generation) return stop();
      cleanups.push(stop);
      motionOk = true;
    } catch (err) {
      console.warn('[motion] disabled:', err);
    }
  });

  if (needsStage && !reduce) {
    idle(async () => {
      if (gen !== generation) return;
      try {
        const { mountStages } = await import('./stage/stage');
        const stop = await mountStages();
        if (gen !== generation) return stop();
        cleanups.push(stop);
      } catch (err) {
        console.warn('[stage] static fallback in use:', err);
      }
    }, 2000);
  }

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

document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:after-swap', applyStoredTheme);
document.addEventListener('astro:page-load', boot);
