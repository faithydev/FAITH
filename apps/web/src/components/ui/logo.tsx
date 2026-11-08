import Image from 'next/image';
import { cx } from './primitives';

type Tone = 'auto' | 'light' | 'dark';

/**
 * The official FAITH artwork, derived from the supplied originals. `light` is for dark
 * backgrounds. `auto` follows the theme. Swap the files in /public/brand to change it everywhere.
 */
function Art({ base, tone, width, height, alt, className, priority }: { base: string; tone: Tone; width: number; height: number; alt: string; className?: string; priority?: boolean }) {
  const img = (color: 'black' | 'white', extra?: string) => (
    <Image src={`/brand/${base}-${color}.webp`} width={width} height={height} alt={alt} priority={priority} unoptimized className={cx(extra, className)} />
  );
  if (tone === 'light') return img('white');
  if (tone === 'dark') return img('black');
  return (
    <>
      {img('black', 'dark:hidden')}
      {img('white', 'hidden dark:block')}
    </>
  );
}

const ratio = { mark: 612 / 554, wordmark: 909 / 161, lockup: 909 / 250 };

export function FaithMark({ size = 28, tone = 'auto', className }: { size?: number; tone?: Tone; className?: string }) {
  return <Art base="faith-mark" tone={tone} width={Math.round(size * ratio.mark)} height={size} alt="FAITH" className={className} priority />;
}

export function FaithWordmark({ height = 16, tone = 'auto', className }: { height?: number; tone?: Tone; className?: string }) {
  return <Art base="faith-wordmark" tone={tone} width={Math.round(height * ratio.wordmark)} height={height} alt="FAITH" className={className} priority />;
}

export function FaithLockup({ height = 48, tone = 'auto', className }: { height?: number; tone?: Tone; className?: string }) {
  return <Art base="faith-lockup" tone={tone} width={Math.round(height * ratio.lockup)} height={height} alt="FAITH Agency Group" className={className} />;
}

/** `compact` drops the wordmark on the narrowest phones, where the mark alone identifies FAITH. */
export function FaithLogo({ tone = 'auto', className, compact }: { tone?: Tone; className?: string; compact?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <FaithMark size={24} tone={tone} />
      <span className={compact ? 'hidden min-[26rem]:inline' : undefined}><FaithWordmark height={13} tone={tone} /></span>
    </span>
  );
}
