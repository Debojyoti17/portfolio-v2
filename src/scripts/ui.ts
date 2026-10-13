/** Small, dependency-free UI behaviour: theme, nav, menu, clock, hints, filters, forms. */

type Cleanup = () => void;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function applyStoredTheme(): void {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch {
    /* storage unavailable: follow the system */
  }
  const d = document.documentElement;
  d.classList.add('js');
  if (!reduced()) d.classList.add('motion');
}

function effectiveTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function initUI(): Cleanup {
  const cleanups: Cleanup[] = [];
  const on = (el: EventTarget | null, ev: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    if (!el) return;
    el.addEventListener(ev, fn, opts);
    cleanups.push(() => el.removeEventListener(ev, fn, opts));
  };

  /* theme */
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((btn) =>
    on(btn, 'click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
      } catch {
        /* ignore */
      }
    }),
  );

  /* nav: hide on scroll down, show on scroll up */
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (nav) {
    let last = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      nav.classList.toggle('nav--top', y < 24);
      const menuOpen = document.querySelector('[data-menu]')?.classList.contains('is-open');
      if (!menuOpen) {
        if (y > last + 6 && y > 200) nav.classList.add('nav--hidden');
        else if (y < last - 6 || y < 200) nav.classList.remove('nav--hidden');
      }
      last = y;
      ticking = false;
    };
    on(window, 'scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* mobile menu */
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
  if (menu && menuBtn) {
    const label = menuBtn.querySelector('[data-menu-label]');
    const inertTargets = () => [document.querySelector('main'), document.querySelector('[data-footer]')].filter(Boolean) as HTMLElement[];
    const setOpen = (open: boolean) => {
      menu.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Close' : 'Menu';
      inertTargets().forEach((el) => (el.inert = open));
      document.documentElement.style.overflow = open ? 'hidden' : '';
      (window as any).__lenis?.[open ? 'stop' : 'start']();
      if (open) {
        nav?.classList.remove('nav--hidden');
        menu.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
      }
    };
    on(menuBtn, 'click', () => setOpen(!menu.classList.contains('is-open')));
    on(menu, 'click', (e) => {
      if ((e.target as HTMLElement).closest('a')) setOpen(false);
    });
    on(document, 'keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape' && menu.classList.contains('is-open')) {
        setOpen(false);
        menuBtn.focus();
      }
    });
    on(window, 'resize', () => {
      if (window.innerWidth >= 900 && menu.classList.contains('is-open')) setOpen(false);
    });
    cleanups.push(() => {
      inertTargets().forEach((el) => (el.inert = false));
      document.documentElement.style.overflow = '';
    });
  }

  /* back to top */
  document.querySelectorAll<HTMLElement>('[data-top]').forEach((a) =>
    on(a, 'click', (e) => {
      e.preventDefault();
      const l = (window as any).__lenis;
      if (l) l.scrollTo(0);
      else window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    }),
  );

  /* local-time readout */
  const clocks = document.querySelectorAll<HTMLElement>('[data-clock]');
  if (clocks.length) {
    const draw = () =>
      clocks.forEach((el) => {
        try {
          const tz = el.dataset.tz || 'UTC';
          const t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date());
          const off = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
          el.textContent = `${t} ${off}`.trim();
        } catch {
          el.textContent = '';
        }
      });
    draw();
    const id = window.setInterval(draw, 30000);
    cleanups.push(() => clearInterval(id));
  }

  /* contact form: no provider → open the visitor's mail app */
  document.querySelectorAll<HTMLFormElement>('[data-contact-form]').forEach((form) => {
    if (form.getAttribute('action')) return;
    on(form, 'submit', (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const body = `${d.get('message') ?? ''}\n\n— ${d.get('name') ?? ''} (${d.get('email') ?? ''})`;
      window.location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent('Message from your portfolio')}&body=${encodeURIComponent(body)}`;
    });
  });

  /* device-aware hint on interactive visuals */
  const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
  if (coarse) document.querySelectorAll<HTMLElement>('[data-hint]').forEach((el) => (el.textContent = 'Drag across the field'));

  /* work filters (optional module: features.workFilters) */
  const filters = document.querySelector<HTMLElement>('[data-filters]');
  const grid = document.querySelector<HTMLElement>('[data-plates]');
  if (filters && grid) {
    const items = [...grid.querySelectorAll<HTMLElement>('[data-card]')];
    const kinds = ['tag', 'type', 'stage'] as const;
    const state: Record<string, string> = { tag: '', type: '', stage: '' };
    const count = filters.querySelector('[data-filter-count]');
    const params = new URLSearchParams(location.search);
    const known = (kind: string, v: string) =>
      [...filters.querySelectorAll<HTMLElement>(`[data-filter="${kind}"]`)].some((b) => b.dataset.value === v);
    kinds.forEach((k) => {
      const v = params.get(k) ?? '';
      state[k] = known(k, v) ? v : '';
    });
    const attr = (it: HTMLElement, kind: string) =>
      kind === 'tag' ? (it.dataset.tags ?? '').split('|') : [kind === 'type' ? it.dataset.type ?? '' : it.dataset.stageLabel ?? ''];
    const apply = (push = true) => {
      let shown = 0;
      items.forEach((it) => {
        const ok = kinds.every((k) => !state[k] || attr(it, k).includes(state[k]));
        it.hidden = !ok;
        if (ok) shown++;
      });
      filters.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => {
        b.setAttribute('aria-pressed', String((b.dataset.value ?? '') === state[b.dataset.filter as string]));
      });
      if (count) count.textContent = `${shown} ${shown === 1 ? 'project' : 'projects'}`;
      if (push) {
        const q = new URLSearchParams();
        kinds.forEach((k) => state[k] && q.set(k, state[k]));
        const qs = q.toString();
        history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : ''));
      }
    };
    filters.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) =>
      on(b, 'click', () => {
        state[b.dataset.filter as string] = b.dataset.value ?? '';
        apply();
      }),
    );
    apply(false);
  }

  return () => cleanups.forEach((c) => c());
}
