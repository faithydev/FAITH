'use client';

import { motion } from 'motion/react';
import { Children, ComponentProps, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { cx } from '../ui/primitives';

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function useInView<T extends Element>(once = true) {
  const ref = useRef<T>(null);
  const [inView, set] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') return set(true);
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        set(true);
        if (once) io.disconnect();
      } else if (!once) set(false);
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, [once]);
  return [ref, inView] as const;
}

export function RevealOnScroll({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return <div ref={ref} data-shown={inView} style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties} className={cx('reveal', className)}>{children}</div>;
}

export function StaggeredReveal({ children, className, step = 70 }: { children: ReactNode; className?: string; step?: number }) {
  return (
    <div className={className}>
      {Children.toArray(children).map((child, i) => <RevealOnScroll key={i} delay={i * step}>{child}</RevealOnScroll>)}
    </div>
  );
}

export function AnimatedCounter({ value, format }: { value: number; format?: (n: number) => string }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) return setShown(value);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);
  return <span ref={ref} className="tabular-nums">{format ? format(shown) : shown}</span>;
}

/** Pulls gently toward the pointer. Inert on touch and with reduced motion. */
export function MagneticButton({ children, className, strength = 0.18 }: { children: ReactNode; className?: string; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const move = (e: React.PointerEvent) => {
    const node = ref.current;
    if (!node || e.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const r = node.getBoundingClientRect();
    node.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  return <span ref={ref} onPointerMove={move} onPointerLeave={leave} className={cx('inline-block transition-transform duration-300 ease-out', className)}>{children}</span>;
}

export function HoverDepth({ className, ...p }: ComponentProps<'div'>) {
  return <div {...p} className={cx('hover-depth', className)} />;
}

export function ParallaxSection({ children, className, speed = 0.08 }: { children: ReactNode; className?: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      node.style.transform = `translateY(${(r.top + r.height / 2 - innerHeight / 2) * -speed}px)`;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [speed]);
  return <div ref={ref} className={className}>{children}</div>;
}

/** A soft light that follows the pointer across a surface. */
export function InteractiveSpotlight({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    const r = node.getBoundingClientRect();
    node.style.setProperty('--sx', `${e.clientX - r.left}px`);
    node.style.setProperty('--sy', `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onPointerMove={move} className={cx('group relative overflow-hidden', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: 'radial-gradient(420px circle at var(--sx, 50%) var(--sy, 50%), var(--accent-soft), transparent 70%)' }} />
      {children}
    </div>
  );
}

export function AnimatedTabs({ tabs, active, onChange, label }: { tabs: { value: string; label: string }[]; active: string; onChange: (v: string) => void; label: string }) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <button key={tab.value} role="tab" aria-selected={active === tab.value} onClick={() => onChange(tab.value)} className={cx('relative shrink-0 px-3 py-2 text-sm transition-colors', active === tab.value ? 'text-ink' : 'text-muted hover:text-ink')}>
          {tab.label}
          {active === tab.value && <motion.span layoutId={id} className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
        </button>
      ))}
    </div>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="animate-rise">{children}</div>;
}

export function LoadingTransition({ loading, skeleton, children }: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  return loading ? <>{skeleton}</> : <div className="animate-rise">{children}</div>;
}
