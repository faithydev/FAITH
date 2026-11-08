'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { cx } from '../ui/primitives';
import { useActive, useSceneSupport } from './capability';

const EcosystemScene = dynamic(() => import('./ecosystem-scene'), { ssr: false });

export type EcosystemNode = { key: string; title: string; body: string };

/**
 * The HTML list is the real interface: every node is a button, so the section works by keyboard,
 * with a screen reader and without WebGL. The 3D ring is an enhancement driven by the same state.
 */
export function ThreeDEcosystem({ nodes, label }: { nodes: EcosystemNode[]; label: string }) {
  const [selected, setSelected] = useState(0);
  const support = useSceneSupport();
  const [ref, active] = useActive<HTMLDivElement>();
  const current = nodes[selected]!;

  return (
    <div ref={ref} className="grid items-center gap-8 lg:grid-cols-[1fr_1.25fr]">
      <div>
        <div role="tablist" aria-label={label} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
          {nodes.map((n, i) => (
            <button
              key={n.key} role="tab" id={`eco-tab-${n.key}`} aria-selected={i === selected} aria-controls="eco-panel" onClick={() => setSelected(i)}
              className={cx('rounded-md border px-3 py-2.5 text-start text-sm font-medium transition-colors', i === selected ? 'border-accent bg-accent-soft text-ink' : 'border-line text-muted hover:border-line-strong hover:text-ink')}
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
        {support.state === 'ready' && (
          <EcosystemScene count={nodes.length} selected={selected} onSelect={setSelected} quality={support.quality} active={active} />
        )}
        {support.state === 'static' && <StaticRing count={nodes.length} selected={selected} />}
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
