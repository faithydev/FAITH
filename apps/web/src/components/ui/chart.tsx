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

/** Measures its frame, so SVG text stays at real pixel size at any width. */
function useWidth(initial = 640) {
  const frame = useRef<HTMLElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => { if (e) setW(Math.max(220, Math.round(e.contentRect.width))); });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [frame, w] as const;
}

/**
 * Single-series columns: thin bars rounded at the data end and anchored to the baseline, a 2px
 * gap between them, one hue. Bars grow in once when the chart appears; hovering a bar shows its
 * value. The numbers are also in a visually hidden table.
 */
export function BarChart({ data, title, valueHeader, dateHeader, height = 220 }: { data: Point[]; title: string; valueHeader: string; dateHeader: string; height?: number }) {
  const id = useId();
  const [frame, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 22, right: 4, bottom: 22, left: 4 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = innerW / Math.max(1, data.length);
  const bar = Math.max(3, Math.min(26, slot - 4));
  const peak = data.reduce((best, d, i) => (d.value > data[best]!.value ? i : best), 0);
  const active = hover === null ? null : data[hover];
  const path = (x: number, top: number, w: number, bottom: number) => {
    const r = Math.min(4, w / 2, bottom - top);
    return `M${x} ${bottom} L${x} ${top + r} Q${x} ${top} ${x + r} ${top} L${x + w - r} ${top} Q${x + w} ${top} ${x + w} ${top + r} L${x + w} ${bottom} Z`;
  };
  return (
    <figure ref={frame} className="relative m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title} className="block h-auto w-full" style={{ direction: 'ltr' }} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--neon)" />
            <stop offset="1" stopColor="var(--neon)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad.left} x2={W - pad.right} y1={pad.top + innerH * g} y2={pad.top + innerH * g} stroke="var(--border)" strokeDasharray="2 4" />
        ))}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="var(--border-strong)" />
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * innerH);
          const x = pad.left + i * slot + (slot - bar) / 2;
          const top = pad.top + innerH - h;
          const dim = hover !== null && hover !== i;
          return (
            <g key={`${d.label}-${i}`} onPointerEnter={() => setHover(i)}>
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="transparent" />
              <path
                d={path(x, top, bar, pad.top + innerH)} fill={`url(#${id})`} opacity={dim ? 0.35 : 1}
                className="origin-bottom animate-[bar-rise_0.9s_var(--ease-out)_both] transition-opacity duration-200"
                style={{ transformBox: 'fill-box', animationDelay: `${Math.min(i * 22, 600)}ms` }}
              />
            </g>
          );
        })}
        <text x={pad.left} y={height - 6} fontSize={11} fill="var(--text-subtle)">{data[0]?.label}</text>
        <text x={W - pad.right} y={height - 6} fontSize={11} fill="var(--text-subtle)" textAnchor="end">{data.at(-1)?.label}</text>
        {hover === null && data[peak] && (
          <text x={pad.left + peak * slot + slot / 2} y={Math.max(pad.top + innerH - (data[peak]!.value / max) * innerH - 7, 11)} fontSize={11} fontWeight={600} fill="var(--text)" textAnchor={peak > data.length * 0.8 ? 'end' : peak < data.length * 0.2 ? 'start' : 'middle'}>{data[peak]!.display}</text>
        )}
      </svg>
      {active && (
        <div role="status" className="pointer-events-none absolute top-0 end-0 rounded-lg border border-line bg-surface/90 px-2.5 py-1 text-xs shadow-2 backdrop-blur-md">
          <span className="text-subtle">{active.label}</span> <span className="font-semibold tabular-nums">{active.display}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th scope="col">{dateHeader}</th><th scope="col">{valueHeader}</th></tr></thead>
        <tbody>{data.map((d, i) => <tr key={`${d.label}-${i}`}><td>{d.label}</td><td>{d.display}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Brand greens only, ordered for separation on black; identity never rests on colour alone. */
const DONUT = ['var(--neon)', '#7DFFB2', '#00A844', '#D9FFE8', '#007A32'];

/**
 * Share of a whole. Each segment is labelled in the legend with its value and percentage, so the
 * colours are a convenience, not the only key. Segments draw themselves in once.
 */
export function Donut({ rows, title, total, totalLabel }: { rows: { label: string; value: number; display: string }[]; title: string; total: string; totalLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const sum = rows.reduce((a, r) => a + r.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  const gap = rows.length > 1 ? 2.5 : 0;
  let offset = 0;
  const segments = rows.map((r, i) => {
    const len = (r.value / sum) * C;
    const seg = { i, start: offset, len: Math.max(0, len - gap) };
    offset += len;
    return seg;
  });
  const shown = hover === null ? null : rows[hover];
  return (
    <figure className="m-0 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="relative mx-auto size-40">
        <svg viewBox="0 0 140 140" className="size-40 -rotate-90" aria-hidden>
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--border)" strokeWidth="14" />
          {segments.map((s) => (
            <circle
              key={s.i} cx="70" cy="70" r={R} fill="none" stroke={DONUT[s.i % DONUT.length]} strokeWidth={hover === s.i ? 17 : 14} strokeLinecap="butt"
              strokeDasharray={`${s.len} ${C - s.len}`} strokeDashoffset={-s.start}
              opacity={hover !== null && hover !== s.i ? 0.35 : 1}
              className="animate-[donut-draw_1.1s_var(--ease-out)_both] transition-[opacity,stroke-width] duration-200"
              style={{ animationDelay: `${s.i * 120}ms`, '--len': s.len, '--circ': C } as React.CSSProperties}
              onPointerEnter={() => setHover(s.i)} onPointerLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="max-w-[6.2rem] truncate font-display text-[0.95rem] font-semibold tabular-nums">{shown ? shown.display : total}</p>
            <p className="max-w-24 truncate text-[0.68rem] text-subtle">{shown ? shown.label : totalLabel}</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((r, i) => (
          <li key={r.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT[i % DONUT.length] }} /><span className="truncate">{r.label}</span></span>
            <span className="shrink-0 tabular-nums"><span className="font-medium">{r.display}</span> <span className="text-subtle">{Math.round((r.value / sum) * 100)}%</span></span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
