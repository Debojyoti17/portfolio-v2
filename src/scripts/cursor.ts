/**
 * Ring cursor for fine pointers (never on touch, never under reduced motion).
 * A small ring follows the pointer with slight easing; over interactive things it grows and names
 * what a click does: "View" over projects, "Drag" over interactive fields, "Open" over links that
 * leave the site (all set with `data-cursor`, fields are found by their slot). It is purely visual:
 * the native cursor stays (hidden only where the ring carries a label) and keyboard focus outlines
 * are never touched.
 * Also drives the email's magnetic hover (`data-magnetic`).
 */
type State = 'idle' | 'link' | 'label';

let el: HTMLDivElement | null = null;
let label: HTMLSpanElement | null = null;

function ensure() {
  if (!el) {
    el = document.createElement('div');
    el.className = 'cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="cursor__ring"></span><span class="cursor__label"></span>';
    label = el.querySelector('.cursor__label');
  }
  if (!el.isConnected) document.body.appendChild(el);
  return el;
}

function describe(t: Element | null): [State, string] {
  if (!t) return ['idle', ''];
  const tagged = t.closest<HTMLElement>('[data-cursor]');
  if (tagged) return ['label', tagged.dataset.cursor ?? ''];
  if (t.closest('a[href], button, summary, label, [role="button"]')) return ['link', ''];
  if (t.closest('[data-field-slot]')) return ['label', 'Drag'];
  if (t.closest('input, textarea, select, [contenteditable]')) return ['idle', 'hide'];
  return ['idle', ''];
}

export function initCursor(): () => void {
  const root = document.documentElement;
  const c = ensure();
  root.classList.add('has-cursor');
  let x = -100, y = -100, cx = -100, cy = -100;
  let raf = 0;
  let last = 0;
  let shown = false;
  const mags = [...document.querySelectorAll<HTMLElement>('[data-magnetic]')].map((m) => ({ m, ox: 0, oy: 0, tx: 0, ty: 0 }));

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const a = 1 - Math.exp(-dt * 22);
    cx += (x - cx) * a;
    cy += (y - cy) * a;
    c.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    let moving = Math.abs(x - cx) + Math.abs(y - cy) > 0.2;
    const b = 1 - Math.exp(-dt * 10);
    for (const g of mags) {
      g.ox += (g.tx - g.ox) * b;
      g.oy += (g.ty - g.oy) * b;
      g.m.style.transform = Math.abs(g.ox) + Math.abs(g.oy) < 0.05 ? '' : `translate3d(${g.ox.toFixed(2)}px, ${g.oy.toFixed(2)}px, 0)`;
      if (Math.abs(g.tx - g.ox) + Math.abs(g.ty - g.oy) > 0.05) moving = true;
    }
    raf = moving ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  const setState = (t: Element | null) => {
    const [state, text] = describe(t);
    c.classList.toggle('is-link', state === 'link');
    c.classList.toggle('is-label', state === 'label');
    c.classList.toggle('is-hidden', text === 'hide');
    if (label && state === 'label') label.textContent = text;
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    x = e.clientX;
    y = e.clientY;
    if (!shown) {
      shown = true;
      cx = x;
      cy = y;
      c.classList.add('is-on');
    }
    for (const g of mags) {
      const r = g.m.getBoundingClientRect();
      const mx = r.left - g.ox + r.width / 2, my = r.top - g.oy + r.height / 2;
      const near = x > r.left - g.ox - 60 && x < r.right - g.ox + 60 && y > r.top - g.oy - 50 && y < r.bottom - g.oy + 50;
      g.tx = near ? Math.max(-14, Math.min(14, (x - mx) * 0.12)) : 0;
      g.ty = near ? Math.max(-10, Math.min(10, (y - my) * 0.3)) : 0;
    }
    run();
  };
  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') setState(e.target as Element);
  };
  const onLeave = () => {
    shown = false;
    c.classList.remove('is-on');
    for (const g of mags) g.tx = g.ty = 0;
    run();
  };
  const onDown = () => c.classList.add('is-down');
  const onUp = () => c.classList.remove('is-down');

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  root.addEventListener('pointerleave', onLeave, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  // a page swap can leave the pointer over a new element without a pointerover
  const p = (window as any).__lastPointer as { x: number; y: number } | undefined;
  if (p) {
    x = cx = p.x;
    y = cy = p.y;
    shown = true;
    c.classList.add('is-on');
    c.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    setState(document.elementFromPoint(p.x, p.y));
  }

  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    cancelAnimationFrame(raf);
    for (const g of mags) g.m.style.transform = '';
    (window as any).__lastPointer = shown ? { x, y } : undefined;
  };
}
