'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useRef, ViewTransition } from 'react';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One listener for the whole document. It tells every `.fx-btn` where the pointer is, so its
 * light can follow, and gives `.hover-depth` cards the position of their neon rim. Mouse only:
 * touch has no hover, and the CSS resting state already looks finished.
 */
export function PointerFx() {
  useEffect(() => {
    if (reduced()) return;
    let last: HTMLElement | null = null;
    const reset = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };
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
      document.documentElement.removeEventListener('pointerleave', out);
    };
  }, []);
  return null;
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
