'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useRef, ViewTransition } from 'react';
import { useReducedMotion } from './preference';


/**
 * One listener for the whole document. It tells every `.fx-btn` where the pointer is, so its
 * light can follow, and gives `.hover-depth` cards the position of their neon rim. Mouse only:
 * touch has no hover, and the CSS resting state already looks finished.
 */
export function PointerFx() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    let last: HTMLElement | null = null;
    const reset = (el: HTMLElement | null) => {
      if (!el) return;
      for (const p of ['--mx', '--my', '--tx', '--ty']) el.style.removeProperty(p);
    };
    // A ripple of light from the exact point of the press, on touch as well as mouse.
    const press = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.fx-btn');
      if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
      const r = el.getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'fx-ripple';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      el.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove(), { once: true });
    };
    document.addEventListener('pointerdown', press, { passive: true });
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.fx-btn, .hover-depth') ?? null;
      if (last && last !== el && last.classList.contains('fx-btn')) reset(last);
      last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (el.classList.contains('fx-btn')) {
        el.style.setProperty('--mx', `${((x / r.width) * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${((y / r.height) * 100).toFixed(1)}%`);
        // Larger buttons lean a few pixels toward the pointer, like a magnet.
        if (!el.classList.contains('fx-sm')) {
          el.style.setProperty('--tx', `${((x - r.width / 2) * 0.14).toFixed(1)}px`);
          el.style.setProperty('--ty', `${((y - r.height / 2) * 0.22).toFixed(1)}px`);
        }
      } else {
        el.style.setProperty('--sx', `${x.toFixed(0)}px`);
        el.style.setProperty('--sy', `${y.toFixed(0)}px`);
      }
    };
    const out = () => { if (last?.classList.contains('fx-btn')) reset(last); last = null; };
    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', out);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', press);
      document.documentElement.removeEventListener('pointerleave', out);
    };
  }, [reduced]);
  return null;
}

/**
 * The fixed background layer behind a whole page. Because every section sits on the same layer,
 * there is no edge where one section's background stops and the next begins. The glow eases
 * after the pointer instead of snapping to it; the dot grid drifts slower than the content.
 */
export function AmbientBackground({ strength = 'soft' }: { strength?: 'soft' | 'strong' }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let tx = window.innerWidth * 0.5;
    let ty = window.innerHeight * 0.3;
    let x = tx;
    let y = ty;
    let frame = 0;
    const tick = () => {
      x += (tx - x) * 0.07;
      y += (ty - y) * 0.07;
      el.style.setProperty('--gx', `${x.toFixed(1)}px`);
      el.style.setProperty('--gy', `${y.toFixed(1)}px`);
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX;
      ty = e.clientY;
      el.style.setProperty('--g-on', '1');
      if (!frame) frame = requestAnimationFrame(tick);
    };
    let scrolling = 0;
    const scroll = () => {
      if (scrolling) return;
      scrolling = requestAnimationFrame(() => { scrolling = 0; el.style.setProperty('--scroll', String(window.scrollY)); });
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', scroll);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrolling);
    };
  }, [reduced]);
  return (
    <div ref={ref} aria-hidden className="ambient" data-strength={strength}>
      <i className="a-grid" />
      <i className="a-blob a-1" />
      <i className="a-blob a-2" />
      <i className="a-blob a-3" />
      <i className="a-glow" />
    </div>
  );
}

/**
 * Wraps the part of a layout that changes between pages. A new pathname is a new key, so React
 * runs the exit animation on the old page and the enter animation on the new one through the
 * browser's View Transitions API. Everything outside stays put. Query changes, such as filters,
 * keep the key and do not animate.
 */
export function RouteTransition({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="route-in" exit="route-out" default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}

/** A neon hairline that starts the instant an internal link is clicked and finishes on arrival. */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const bar = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  const running = useRef(false);

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const set = (scale: number, opacity = 1) => {
    if (!bar.current) return;
    bar.current.style.transform = `scaleX(${scale})`;
    bar.current.style.opacity = String(opacity);
  };

  const start = useCallback(() => {
    clear();
    running.current = true;
    if (bar.current) bar.current.style.transition = 'none';
    set(0, 1);
    requestAnimationFrame(() => {
      if (bar.current) bar.current.style.transition = '';
      set(0.22);
      [[180, 0.45], [700, 0.66], [1600, 0.8], [3500, 0.9]].forEach(([ms, s]) => timers.current.push(window.setTimeout(() => set(s!), ms)));
      // A navigation that never commits (an error, a download) must not leave the bar hanging.
      timers.current.push(window.setTimeout(() => finish(), 10_000));
    });
  }, []);

  const finish = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    clear();
    set(1, 1);
    timers.current.push(window.setTimeout(() => set(1, 0), 260));
    timers.current.push(window.setTimeout(() => { if (bar.current) bar.current.style.transition = 'none'; set(0, 0); }, 760));
  }, []);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    document.addEventListener('click', click, true);
    return () => { document.removeEventListener('click', click, true); clear(); };
  }, [start]);

  useEffect(() => { finish(); }, [pathname, search, finish]);

  return <div aria-hidden className="nav-progress"><i ref={bar} style={{ transform: 'scaleX(0)', opacity: 0 }} /></div>;
}
