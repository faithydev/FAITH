import Image from 'next/image';
import { cx } from './primitives';

/** The FAITH Verified mark, from the supplied badge artwork in /public/badges. */
export function VerifiedBadge({ kind, label, size = 18, className }: { kind: string; label: string; size?: number; className?: string }) {
  return (
    <Image
      src={`/badges/${kind}.webp`} width={size} height={size} alt={label} title={label} unoptimized
      data-testid={`badge-${kind}`}
      className={cx('inline-block shrink-0 align-middle drop-shadow-[0_0_8px_color-mix(in_srgb,var(--neon)_35%,transparent)]', className)}
    />
  );
}
