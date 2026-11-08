'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { cx } from '../ui/primitives';
import { useActive, useSceneSupport, type Quality } from './capability';

const EcosystemStoryScene = dynamic(() => import('./ecosystem-story-scene'), { ssr: false });

export type EcosystemNode = { key: string; title: string; body: string };

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The FAITH economy as a scroll story. The section pins to the screen; scrolling walks through
 * every part, and thousands of points rebuild themselves into a form for each one: a play
 * symbol for creators, a bag for customers, </> for developers, rising bars for businesses,
 * a parcel, a circle of people, a stack of coins, a grid of apps.
 *
 * Without WebGL, or with reduced motion, the same content is a plain tab list (below).
 */
export function ThreeDEcosystem({ nodes, label }: { nodes: EcosystemNode[]; label: string }) {
  const support = useSceneSupport();
  if (support.state === 'ready') return <EcosystemStory nodes={nodes} label={label} quality={support.quality} />;
  return <EcosystemTabs nodes={nodes} label={label} showRing={support.state === 'static'} />;
}

function EcosystemStory({ nodes, label, quality }: { nodes: EcosystemNode[]; label: string; quality: Quality }) {
  const [outer, inView] = useActive<HTMLDivElement>();
  const progress = useRef(0);
  const [active, setActive] = useState(0);
  const keys = useRef(nodes.map((n) => n.key)).current;

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = outer.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / span)) * (nodes.length - 1);
      progress.current = p;
      const next = Math.round(p);
      setActive((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [nodes.length, outer]);

  /** The step buttons scroll to their part of the story, so it can be read without scrolling by hand. */
  const jump = (i: number) => {
    const el = outer.current;
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (i / (nodes.length - 1)) * span + 2, behavior: 'smooth' });
  };

  const current = nodes[active]!;
  return (
    <div ref={outer} data-testid="ecosystem-story" className="relative" style={{ height: `${nodes.length * 62 + 38}svh` }}>
      <div className="sticky top-0 h-svh overflow-hidden">
        <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-4 pt-16 pb-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-1 lg:items-center lg:gap-10 lg:py-0">
          <div className="order-2 lg:order-1">
            <div aria-live="polite">
              <p className="font-mono text-sm text-subtle"><span className="text-neon">{pad(active + 1)}</span> / {pad(nodes.length)}</p>
              <h3 key={`t-${active}`} className="animate-rise mt-3 font-display text-[clamp(2.3rem,5.4vw,4.4rem)] leading-[0.95] font-semibold tracking-[-0.045em]">{current.title}</h3>
              <p key={`b-${active}`} className="animate-rise mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg" style={{ '--rise-delay': '90ms' } as React.CSSProperties}>{current.body}</p>
            </div>
            <nav aria-label={label} className="mt-8 grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-8 lg:grid-cols-4">
              {nodes.map((n, i) => (
                <button key={n.key} type="button" onClick={() => jump(i)} aria-current={i === active ? 'step' : undefined} className="group min-w-0 text-start">
                  <span className="block h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_12%,transparent)]">
                    <span className={cx('block h-full rounded-full bg-neon transition-[width,box-shadow] duration-700 ease-[var(--ease-out)]', i === active && 'shadow-[0_0_12px_var(--neon)]')} style={{ width: i <= active ? '100%' : '0%' }} />
                  </span>
                  <span className={cx('mt-2 block truncate text-xs transition-colors', i === active ? 'text-ink' : 'text-subtle group-hover:text-muted')}>{n.title}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="relative order-1 min-h-0 lg:order-2 lg:h-[82svh]">
            <div aria-hidden className="pointer-events-none absolute inset-[12%] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--neon)_14%,transparent),transparent_65%)] blur-2xl" />
            <EcosystemStoryScene keys={keys} quality={quality} active={inView} progress={progress} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The HTML version: every node is a tab, so the section works by keyboard, with a screen reader
 * and without WebGL.
 */
function EcosystemTabs({ nodes, label, showRing }: { nodes: EcosystemNode[]; label: string; showRing: boolean }) {
  const [selected, setSelected] = useState(0);
  const current = nodes[selected]!;
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.25fr]">
      <div>
        <div role="tablist" aria-label={label} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
          {nodes.map((n, i) => (
            <button
              key={n.key} role="tab" id={`eco-tab-${n.key}`} aria-selected={i === selected} aria-controls="eco-panel" onClick={() => setSelected(i)}
              className={cx('rounded-xl border px-3 py-2.5 text-start text-sm font-medium transition-colors', i === selected ? 'border-accent bg-accent-soft text-ink' : 'border-line text-muted hover:border-line-strong hover:text-ink')}
            >
              {n.title}
            </button>
          ))}
        </div>
        <div id="eco-panel" role="tabpanel" aria-labelledby={`eco-tab-${current.key}`} aria-live="polite" className="mt-6 min-h-28">
          <h3 className="text-xl font-semibold">{current.title}</h3>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{current.body}</p>
        </div>
      </div>
      <div className="relative aspect-square max-h-[30rem] w-full sm:aspect-[4/3] lg:aspect-square">
        {showRing && <StaticRing count={nodes.length} selected={selected} />}
      </div>
    </div>
  );
}

function StaticRing({ count, selected }: { count: number; selected: number }) {
  return (
    <svg data-testid="ecosystem-fallback" viewBox="0 0 200 200" aria-hidden className="h-full w-full">
      <circle cx="100" cy="100" r="14" fill="var(--surface-3)" />
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = 100 + Math.cos(a) * 74;
        const y = 100 + Math.sin(a) * 74;
        const on = i === selected;
        return (
          <g key={i}>
            <line x1="100" y1="100" x2={x} y2={y} stroke={on ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth={on ? 1.2 : 0.6} />
            <circle cx={x} cy={y} r={on ? 7 : 4.5} fill={on ? 'var(--accent)' : 'var(--text-subtle)'} />
          </g>
        );
      })}
    </svg>
  );
}
