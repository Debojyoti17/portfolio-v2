/**
 * Motion grammar (see DESIGN.md §7): every entrance is the same rise — content moves up 16px
 * while fading in, 0.9s, expo-out — triggered once as it enters the viewport.
 * Smooth wheel scrolling (Lenis) on desktop. Never loaded under prefers-reduced-motion.
 */
import Lenis from 'lenis';

export function initMotion(): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const root = document.documentElement;

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // in-page anchors are handled once, in ui.ts, so they also work across view transitions
    anchors: false,
  });
  (window as any).__lenis = lenis;
  let raf = 0;
  const tick = (t: number) => {
    lenis.raf(t);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // Entrances. Whatever is already on screen is shown at once (it rose with the page).
  const items = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  const vh = window.innerHeight;
  items.forEach((el) => {
    if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('is-in');
  });
  root.classList.add('motion-ready');
  const io = new IntersectionObserver(
    (entries) => {
      let k = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.style.transitionDelay = `${Math.min(k++, 4) * 70}ms`;
        el.classList.add('is-in');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  items.filter((el) => !el.classList.contains('is-in')).forEach((el) => io.observe(el));

  return () => {
    io.disconnect();
    cancelAnimationFrame(raf);
    lenis.destroy();
    delete (window as any).__lenis;
  };
}
