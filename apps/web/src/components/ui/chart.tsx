'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cx } from './primitives';

export type Point = { label: string; value: number; display: string };

const H = 200;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };

/**
 * Single-series area chart: one hue, a 2px line, a recessive baseline and a crosshair tooltip.
 * The same numbers sit in a visually hidden table, so nothing depends on seeing the chart.
 */
export function AreaChart({ data, title, valueHeader, dateHeader }: { data: Point[]; title: string; valueHeader: string; dateHeader: string }) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const frame = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => { if (e) setW(Math.max(240, Math.round(e.contentRect.width))); });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  const max = Math.max(...data.map((d) => d.value), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${PAD.top + innerH} L${x(0).toFixed(1)} ${PAD.top + innerH} Z`;
  const peak = data.reduce((best, d, i) => (d.value > data[best]!.value ? i : best), 0);

  const onMove = (e: React.PointerEvent) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    const ratio = (e.clientX - r.left) / r.width;
    const rtl = document.documentElement.dir === 'rtl';
    setHover(Math.round((rtl ? 1 - ratio : ratio) * (data.length - 1)));
  };
  const active = hover === null ? null : data[hover];

  return (
    <figure ref={frame} className="relative m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <svg
        ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="block h-auto w-full touch-pan-y"
        style={{ direction: 'ltr' }} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="var(--border-strong)" />
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <text x={x(0)} y={H - 6} fontSize={11} fill="var(--text-subtle)">{data[0]?.label}</text>
        <text x={x(data.length - 1)} y={H - 6} fontSize={11} fill="var(--text-subtle)" textAnchor="end">{data.at(-1)?.label}</text>
        {hover === null && data[peak] && (
          <text x={x(peak)} y={Math.max(y(data[peak]!.value) - 8, 10)} fontSize={11} fontWeight={600} fill="var(--text)" textAnchor={peak > data.length * 0.75 ? 'end' : peak < data.length * 0.25 ? 'start' : 'middle'}>{data[peak]!.display}</text>
        )}
        {active && (
          <>
            <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--border-strong)" />
            <circle cx={x(hover!)} cy={y(active.value)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          </>
        )}
      </svg>
      {active && (
        <div role="status" className="pointer-events-none absolute top-1 end-1 rounded-sm border border-line bg-surface px-2 py-1 text-xs shadow-2">
          <span className="text-subtle">{active.label}</span> <span className="font-semibold tabular-nums">{active.display}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th scope="col">{dateHeader}</th><th scope="col">{valueHeader}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{d.display}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Ranked horizontal bars with direct labels. */
export function BarList({ rows, className }: { rows: { label: string; value: number; display: string }[]; className?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className={cx('space-y-2.5', className)}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{r.display}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
