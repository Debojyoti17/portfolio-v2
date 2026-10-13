/**
 * Smooth scroll (Lenis) and scroll-linked motion (GSAP + ScrollTrigger).
 * Loaded after the page is idle; never loaded under prefers-reduced-motion.
 */
export async function initMotion(): Promise<() => void> {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
    import('lenis'),
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]);
  gsap.registerPlugin(ScrollTrigger);

  const root = document.documentElement;
  const vh = window.innerHeight;
  const triggers: ScrollTrigger[] = [];

  /* ---- smooth scroll ---- */
  const lenis = new Lenis({
    duration: 1.1,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    anchors: true,
  });
  (window as any).__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  /* ---- decide what is already on screen (it must not flash) ---- */
  const inFirstView = (el: Element) => el.getBoundingClientRect().top < vh * 0.92;
  const revealed = (el: Element) => el.classList.add('is-revealed');

  // split headings into masked words (below the fold only)
  const splitTargets = [...document.querySelectorAll<HTMLElement>('[data-split]')].filter((el) => !inFirstView(el));
  const wordSets: { el: HTMLElement; words: HTMLElement[] }[] = [];
  for (const el of splitTargets) {
    const text = el.textContent ?? '';
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const words: HTMLElement[] = [];
    text.split(/\s+/).filter(Boolean).forEach((w, i, arr) => {
      const outer = document.createElement('span');
      outer.className = 'w';
      outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'wi';
      inner.textContent = w;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
      words.push(inner);
    });
    wordSets.push({ el, words });
  }

  const wipes = [...document.querySelectorAll<HTMLElement>('[data-reveal="wipe"]')];
  const fades = [...document.querySelectorAll<HTMLElement>('[data-reveal="fade"]')];
  const rules = [...document.querySelectorAll<HTMLElement>('[data-reveal="rule"]')];
  [...wipes, ...fades, ...rules].forEach((el) => inFirstView(el) && revealed(el));

  root.classList.add('motion-ready');

  /* ---- reveals ---- */
  const once = (el: Element, fn: () => void, start = 'top 90%') =>
    triggers.push(ScrollTrigger.create({ trigger: el, start, once: true, onEnter: fn }));

  rules.filter((el) => !el.classList.contains('is-revealed')).forEach((el) =>
    once(el, () =>
      gsap.to(el, { '--rule-draw': 1, duration: 1.3, ease: 'expo.out', onComplete: () => revealed(el) }),
    ),
  );
  wipes.filter((el) => !el.classList.contains('is-revealed')).forEach((el) =>
    once(el, () =>
      gsap.fromTo(
        el,
        { clipPath: 'inset(0% 0% 100% 0%)', y: 24 },
        { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.1, ease: 'expo.out', onComplete: () => revealed(el) },
      ),
    ),
  );
  fades.filter((el) => !el.classList.contains('is-revealed')).forEach((el) =>
    once(el, () =>
      gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', onComplete: () => revealed(el) }),
    ),
  );
  wordSets.forEach(({ el, words }) =>
    once(el, () =>
      gsap.fromTo(
        words,
        { yPercent: 108 },
        { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.05, onComplete: () => words.forEach(revealed) },
      ),
    ),
  );

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  return () => {
    triggers.forEach((t) => t.kill());
    ScrollTrigger.getAll().forEach((t) => t.kill());
    gsap.ticker.remove(tick);
    lenis.destroy();
    delete (window as any).__lenis;
  };
}
