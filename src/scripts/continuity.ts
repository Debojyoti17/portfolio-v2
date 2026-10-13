/**
 * Continuity between pages: exactly one element on each side of a navigation carries the
 * view-transition name "field", so the browser morphs one into the other.
 *
 *  list → project   the specimen you opened (the hover preview, the inline specimen on touch, or the
 *                   next-project specimen) grows into the large field at the top of the project page
 *  project → list   the reverse: the field shrinks back into that project's row (if it is on screen)
 *  otherwise        the field glides between the pages' field slots when one is on screen
 *
 * Works with or without the live field (the static renders carry the same forms).
 */
export interface FieldHooks {
  previewFor(project: string): HTMLElement | null;
  previewAt(row: HTMLElement): HTMLElement | null;
  attachField(o?: { snap?: boolean }): void;
}

const NAME = 'field';
let pending: { from: string | null; via: 'specimen' | 'field' | null } | null = null;

const projectOf = (url: URL | string): string | null => {
  const m = /\/work\/([^/]+)\/?$/.exec(new URL(url, location.href).pathname);
  return m ? decodeURIComponent(m[1]) : null;
};
const onScreen = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
};
const visibleSpec = (holder: Element | null) => {
  const s = holder?.querySelector<HTMLElement>('[data-spec-slot]');
  return s && s.getClientRects().length > 0 && onScreen(s) ? s : null;
};
const clearNames = () =>
  document.querySelectorAll<HTMLElement>('[data-vt]').forEach((el) => {
    el.style.viewTransitionName = '';
    el.removeAttribute('data-vt');
  });
const name = (el: HTMLElement) => {
  el.style.viewTransitionName = NAME;
  el.setAttribute('data-vt', '');
};

/** Old page, before the new one is fetched. */
export function leaving(e: Event, hooks: FieldHooks | null) {
  const ev = e as Event & { to: URL; sourceElement?: Element };
  clearNames();
  const to = projectOf(ev.to);
  let src: HTMLElement | null = null;
  let via: 'specimen' | 'field' | null = null;
  if (to) {
    const holder = ev.sourceElement?.closest?.(`[data-project="${CSS.escape(to)}"]`) ?? null;
    src = hooks?.previewFor(to) ?? visibleSpec(holder);
    if (src) via = 'specimen';
  }
  if (!src) {
    const slot = document.querySelector<HTMLElement>('[data-field-slot]');
    if (slot && onScreen(slot)) {
      src = slot;
      via = 'field';
    }
  }
  if (src) name(src);
  pending = { from: projectOf(location.href), via };
}

/** New page, synchronously during the swap (before the new snapshot is taken). */
export function arrived(hooks: FieldHooks | null) {
  const p = pending;
  pending = null;
  const slot = document.querySelector<HTMLElement>('[data-field-slot]');
  const here = projectOf(location.href);
  // the main field first: it also resets the hover preview for the new page
  hooks?.attachField({ snap: p?.via === 'specimen' && !!here });
  let dest: HTMLElement | null = null;
  if (p?.via) {
    if (here && slot) dest = slot;
    else if (p.from) {
      const row = document.querySelector<HTMLElement>(`.entry[data-project="${CSS.escape(p.from)}"]`);
      if (row && onScreen(row)) dest = visibleSpec(row) ?? hooks?.previewAt(row) ?? null;
    }
    if (!dest && slot && onScreen(slot)) dest = slot;
  }
  if (dest) name(dest);
}
