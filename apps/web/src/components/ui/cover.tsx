import { cx } from './primitives';

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Generative cover for anything without artwork. Rising diagonal bars echo the FAITH mark, and
 * the same slug always draws the same image, so listings stay distinct with no stock photos.
 */
export function Cover({ seed, className, label }: { seed: string; className?: string; label?: string }) {
  const h = hash(seed);
  const n = (i: number, m: number) => (h >>> (i * 3)) % m;
  const count = 3 + n(0, 4);
  const gap = 6 + n(1, 5);
  const width = (320 - (count - 1) * gap - 64) / count;
  const slant = 18 + n(2, 26);
  const start = 60 + n(3, 50);
  const step = 16 + n(4, 22);
  const inverted = n(5, 3) === 0;
  const accent = n(6, count);
  const bars = Array.from({ length: count }, (_, i) => {
    const x = 32 + i * (width + gap);
    const top = 170 - (start + i * step) + 40;
    return { x, top, path: `M${x} 170 L${x} ${top + slant} L${x + width} ${top} L${x + width} 170 Z` };
  });
  const id = `c-${h.toString(36)}`;
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={label ?? ''} aria-hidden={label ? undefined : true} className={cx('block h-full w-full', className)} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={inverted ? '#00331A' : '#161616'} />
          <stop offset="1" stopColor={inverted ? '#000000' : '#000000'} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id})`} />
      {bars.map((b, i) => (
        <path key={b.x} d={b.path} fill={i === accent ? 'var(--accent-cover, #00FF66)' : '#FFFFFF'} opacity={i === accent ? 0.95 : 0.14 + (i / count) * 0.8} />
      ))}
    </svg>
  );
}
