/** Small, dependency-free UI behaviour: theme, nav, menu, clock, copy, filters, forms. */

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
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget | null, ev: string, fn: EventListener, opts?: AddEventListenerOptions) => {
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

  /* copy to clipboard */
  document.querySelectorAll<HTMLElement>('[data-copy]').forEach((btn) =>
    on(btn, 'click', async () => {
      const text = btn.dataset.copy ?? '';
      const label = btn.querySelector('[data-copy-label]');
      const status = btn.closest('.contact__block')?.querySelector('[data-copy-status]');
      try {
        await navigator.clipboard.writeText(text);
        if (label) label.textContent = 'Copied';
        if (status) status.textContent = 'Email address copied to clipboard';
      } catch {
        if (label) label.textContent = text;
      }
      window.setTimeout(() => label && (label.textContent = 'Copy address'), 2200);
    }),
  );

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

  /* work filters */
  const filters = document.querySelector<HTMLElement>('[data-filters]');
  const plates = document.querySelector<HTMLElement>('[data-plates]');
  if (filters && plates) {
    const items = [...plates.querySelectorAll<HTMLElement>('.plates__item')];
    const slots = ['a', 'b', 'c', 'd'];
    const state = { tag: '', status: '' };
    const count = filters.querySelector('[data-filter-count]');
    const params = new URLSearchParams(location.search);
    state.tag = params.get('tag') ?? '';
    state.status = params.get('status') ?? '';

    const apply = (push = true) => {
      let shown = 0;
      items.forEach((it) => {
        const tags = (it.dataset.tags ?? '').split('|');
        const ok = (!state.tag || tags.includes(state.tag)) && (!state.status || it.dataset.status === state.status);
        it.hidden = !ok;
        if (ok) {
          it.dataset.slot = slots[shown % 4];
          shown++;
          it.classList.add('is-revealed');
        }
      });
      filters.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => {
        const kind = b.dataset.filter as 'tag' | 'status';
        b.setAttribute('aria-pressed', String((b.dataset.value ?? '') === state[kind]));
      });
      if (count) count.textContent = `${shown} ${shown === 1 ? 'project' : 'projects'}`;
      if (push) {
        const q = new URLSearchParams();
        if (state.tag) q.set('tag', state.tag);
        if (state.status) q.set('status', state.status);
        const qs = q.toString();
        history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : ''));
      }
    };
    // ignore unknown values from the URL
    const known = (kind: 'tag' | 'status', v: string) =>
      [...filters.querySelectorAll<HTMLElement>(`[data-filter="${kind}"]`)].some((b) => b.dataset.value === v);
    if (!known('tag', state.tag)) state.tag = '';
    if (!known('status', state.status)) state.status = '';
    filters.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) =>
      on(b, 'click', () => {
        state[b.dataset.filter as 'tag' | 'status'] = b.dataset.value ?? '';
        apply();
      }),
    );
    apply(false);
  }

  return () => cleanups.forEach((c) => c());
}
