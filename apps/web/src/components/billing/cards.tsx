'use client';

import { PaymentMark } from '@/components/payments/marks';
import { Button, cx, fieldClass } from '@/components/ui/primitives';
import { cardExpiryValid, cardMaxLength, cardNumberValid, detectCardBrand, type CardBrand } from '@faith/validators';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type LinkedCard = { id: string; brand: CardBrand; last4: string; expMonth: number; expYear: number; holder: string | null; isDefault: boolean };
export type CardDraft = { brand: CardBrand; last4: string; expMonth: number; expYear: number; holder?: string };

/** Each network's own colours, so the card visibly turns into an UZCARD, HUMO or Visa as the number is typed. */
const SKINS: Record<CardBrand | 'none', string> = {
  none: 'radial-gradient(120% 140% at 100% 0%, rgba(0,255,102,0.32), transparent 55%), radial-gradient(90% 90% at 0% 100%, rgba(0,255,102,0.10), transparent 60%), linear-gradient(135deg,#0d0d0d,#000)',
  uzcard: 'radial-gradient(90% 120% at 100% 100%, rgba(60,203,127,0.55), transparent 60%), linear-gradient(135deg,#082f73 0%,#0B3D91 45%,#0a6fb8 100%)',
  humo: 'radial-gradient(90% 120% at 100% 100%, rgba(255,138,0,0.55), transparent 60%), linear-gradient(135deg,#0b1647 0%,#11205E 50%,#1b2f86 100%)',
  visa: 'radial-gradient(100% 120% at 100% 0%, rgba(120,160,255,0.45), transparent 60%), linear-gradient(135deg,#0b1f7a 0%,#1434CB 60%,#2a5cff 100%)',
  mastercard: 'radial-gradient(80% 110% at 0% 100%, rgba(235,0,27,0.5), transparent 60%), radial-gradient(80% 110% at 100% 0%, rgba(247,158,27,0.45), transparent 60%), linear-gradient(135deg,#121214,#1e1e22)',
  unionpay: 'linear-gradient(115deg,#9c0f25 0%,#E21836 32%,#00447C 32.4%,#00447C 64%,#007B84 64.4%,#00a3a8 100%)',
  mir: 'radial-gradient(100% 120% at 100% 0%, rgba(0,161,224,0.55), transparent 60%), linear-gradient(135deg,#0b5a3c 0%,#0F754E 50%,#1aa36b 100%)',
};

/** "8600123412341234" → "8600 1234 1234 1234"; 19-digit numbers end with a group of three. Works for "•" too. */
export const groupDigits = (digits: string) => digits.replace(/(.{4})(?=.)/gu, '$1 ');

function Chip() {
  return (
    <svg viewBox="0 0 40 30" aria-hidden className="h-7 w-auto">
      <defs>
        <linearGradient id="chip-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a1" /><stop offset="0.5" stopColor="#c9a24b" /><stop offset="1" stopColor="#f0d58a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="28" rx="5" fill="url(#chip-gold)" />
      <path d="M1 10h12M1 20h12M27 10h12M27 20h12M13 1v28M27 1v28M13 15h14" stroke="#8a6a24" strokeWidth="1" fill="none" opacity="0.7" />
    </svg>
  );
}

function Contactless() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-auto opacity-80">
      {[5, 9, 13].map((r, i) => <path key={r} d={`M${8 + i * 2.6} ${12 - r / 2}a${r} ${r} 0 0 1 0 ${r}`} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />)}
    </svg>
  );
}

/**
 * The card face. Every skin is painted at once and crossfades, so switching networks is smooth;
 * the card tilts toward the pointer unless the visitor reduces motion.
 */
export function CardFace({ brand, number, holder, expiry, focus, size = 'lg', placeholderName, className }: {
  brand: CardBrand | null; number: string; holder: string; expiry: string; focus?: 'number' | 'expiry' | 'holder' | null;
  size?: 'lg' | 'sm'; placeholderName?: string; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, sx: 50, sy: 0 });
  // Sixteen slots until the number runs longer; only then the network's longest length.
  const max = number.length <= 16 ? 16 : cardMaxLength(brand);
  const shown = size === 'lg' ? groupDigits((number + '•'.repeat(max)).slice(0, max)) : number;

  function onMove(e: React.PointerEvent) {
    if (size !== 'lg' || document.documentElement.dataset.reduced === 'true' || e.pointerType !== 'mouse') return;
    const r = ref.current!.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ x: (0.5 - py) * 10, y: (px - 0.5) * 14, sx: px * 100, sy: py * 100 });
  }

  const ring = (on: boolean) => cx('rounded-md transition-[box-shadow,background-color] duration-300', on && 'bg-white/10 shadow-[0_0_0_1.5px_rgba(255,255,255,0.55)]');
  return (
    <div
      ref={ref} onPointerMove={onMove} onPointerLeave={() => setTilt({ x: 0, y: 0, sx: 50, sy: 0 })}
      data-testid="card-face" data-brand={brand ?? 'none'}
      className={cx('relative aspect-[1.586] w-full select-none [perspective:900px]', size === 'lg' ? 'max-w-[23rem]' : 'max-w-[15rem]', className)}
    >
      <div
        className={cx(
          'relative h-full w-full overflow-hidden text-white shadow-[0_30px_60px_-24px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.10)] transition-transform duration-300 ease-out',
          size === 'lg' ? 'rounded-[1.15rem]' : 'rounded-[0.8rem]',
        )}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` } as CSSProperties}
      >
        {(Object.keys(SKINS) as (CardBrand | 'none')[]).map((k) => (
          <div key={k} aria-hidden className="absolute inset-0 transition-opacity duration-500 ease-out" style={{ background: SKINS[k], opacity: (brand ?? 'none') === k ? 1 : 0 }} />
        ))}
        <div aria-hidden className="absolute inset-0 opacity-60 mix-blend-soft-light" style={{ background: `radial-gradient(60% 80% at ${tilt.sx}% ${tilt.sy}%, rgba(255,255,255,0.55), transparent 60%)` }} />
        <div aria-hidden className="dot-grid absolute inset-0 opacity-[0.12]" />

        <div className={cx('relative flex h-full flex-col justify-between', size === 'lg' ? 'px-[6.5%] py-[5.5%]' : 'p-[7%]')}>
          <div className="flex items-start justify-between">
            <span className={cx('font-display font-semibold tracking-[0.18em]', size === 'lg' ? 'text-sm' : 'text-[0.6rem]')}>FAITH</span>
            {brand
              ? <PaymentMark key={brand} method={brand} decorative className={cx('animate-rise rounded-[0.3rem] shadow-[0_0_0_1px_rgba(255,255,255,0.5),0_4px_10px_rgba(0,0,0,0.35)]', size === 'lg' ? 'h-7' : 'h-5')} />
              : <span className={cx('rounded-full border border-white/25 px-2 py-0.5 font-mono text-white/60', size === 'lg' ? 'text-[0.62rem]' : 'text-[0.5rem]')}>CARD</span>}
          </div>
          {size === 'lg' && <div className="flex items-center gap-3"><Chip /><Contactless /></div>}
          <p dir="ltr" className={cx('font-mono tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]', size === 'lg' ? 'px-1 text-[clamp(0.95rem,4.2vw,1.3rem)] leading-tight tracking-[0.06em] whitespace-nowrap' : 'text-sm tracking-[0.12em]', size === 'lg' && ring(focus === 'number'))} data-testid="card-face-number">
            {shown}
          </p>
          <div className="flex items-end justify-between gap-3">
            <span className={cx('min-w-0 truncate px-1 font-mono uppercase', size === 'lg' ? 'text-[0.78rem] tracking-[0.12em]' : 'text-[0.55rem] tracking-[0.1em]', size === 'lg' && ring(focus === 'holder'))}>
              {holder || placeholderName || ''}
            </span>
            <span dir="ltr" className={cx('shrink-0 px-1 font-mono tabular-nums', size === 'lg' ? 'text-[0.85rem]' : 'text-[0.6rem]', size === 'lg' && ring(focus === 'expiry'))}>
              {expiry || 'MM/YY'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A linked card, small: the brand's skin, the last four digits and the expiry. */
export function LinkedCardFace({ card, className }: { card: LinkedCard; className?: string }) {
  return <CardFace size="sm" brand={card.brand} number={`•••• ${card.last4}`} holder={card.holder ?? ''} expiry={`${pad(card.expMonth)}/${String(card.expYear).slice(-2)}`} className={className} />;
}

/**
 * Card entry with the live card above it. The full number never leaves this component: on
 * submit it hands over only the brand, the last four digits, the expiry and the name.
 */
export function CardEntry({ onSubmit, submitLabel, disabled, footer, layout = 'stack' }: {
  onSubmit: (card: CardDraft) => Promise<void>; submitLabel: string; disabled?: boolean; footer?: ReactNode; layout?: 'stack' | 'split';
}) {
  const t = useTranslations();
  const id = useId();
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [holder, setHolder] = useState('');
  const [focus, setFocus] = useState<'number' | 'expiry' | 'holder' | null>(null);
  const [error, setError] = useState<{ field: 'number' | 'expiry'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const brand = detectCardBrand(number);

  function onNumber(v: string) {
    const digits = v.replace(/\D/g, '');
    setNumber(digits.slice(0, cardMaxLength(detectCardBrand(digits))));
    setError(null);
  }
  function onExpiry(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    // "1" stays "1"; "13" is not a month, so it becomes "01/3".
    const fixed = digits.length >= 2 && Number(digits.slice(0, 2)) > 12 ? `0${digits}`.slice(0, 4) : digits;
    setExpiry(fixed.length > 2 ? `${fixed.slice(0, 2)}/${fixed.slice(2)}` : fixed);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand) return setError({ field: 'number', message: t('app.cards.unknownBrand') });
    if (!cardNumberValid(number)) return setError({ field: 'number', message: t('app.cards.invalidNumber') });
    const [mm, yy] = expiry.split('/');
    const month = Number(mm);
    const year = 2000 + Number(yy);
    if (!mm || !yy || yy.length !== 2 || !cardExpiryValid(month, year)) return setError({ field: 'expiry', message: t('app.cards.invalidExpiry') });
    setBusy(true);
    try {
      await onSubmit({ brand, last4: number.slice(-4), expMonth: month, expYear: year, holder: holder.trim() || undefined });
      setNumber('');
      setExpiry('');
    } catch {
      // The caller has already said what went wrong; the typed card stays so it can be retried.
    } finally {
      setBusy(false);
    }
  }

  const face = <CardFace brand={brand} number={number} holder={holder} expiry={expiry} focus={focus} placeholderName={t('app.cards.holderPlaceholder')} />;
  return (
    <form onSubmit={submit} noValidate className={cx('grid gap-6', layout === 'split' && 'lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:items-center')}>
      <div className="flex justify-center">{face}</div>
      <div className="grid gap-3.5">
        <div>
          <label htmlFor={`${id}-n`} className={fieldClass.label}>{t('app.cards.number')}</label>
          <div className="relative">
            <input
              id={`${id}-n`} name="cc-number" data-testid="card-number" dir="ltr"
              inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
              value={groupDigits(number)} onChange={(e) => onNumber(e.target.value)} onFocus={() => setFocus('number')} onBlur={() => setFocus(null)}
              aria-invalid={error?.field === 'number' || undefined} aria-describedby={error?.field === 'number' ? `${id}-err` : undefined}
              className={cx(fieldClass.input, 'has-trailing font-mono tracking-wider')}
            />
            <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center" aria-live="polite">
              {brand ? <PaymentMark key={brand} method={brand} className="animate-rise h-6" /> : null}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <div>
            <label htmlFor={`${id}-e`} className={fieldClass.label}>{t('app.cards.expiry')}</label>
            <input
              id={`${id}-e`} name="cc-exp" data-testid="card-expiry" dir="ltr"
              inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY"
              value={expiry} onChange={(e) => onExpiry(e.target.value)} onFocus={() => setFocus('expiry')} onBlur={() => setFocus(null)}
              aria-invalid={error?.field === 'expiry' || undefined} aria-describedby={error?.field === 'expiry' ? `${id}-err` : undefined}
              className={cx(fieldClass.input, 'font-mono')}
            />
          </div>
          <div>
            <label htmlFor={`${id}-h`} className={fieldClass.label}>{t('app.cards.holder')}</label>
            <input
              id={`${id}-h`} name="cc-name" data-testid="card-holder" autoComplete="cc-name" placeholder={t('app.cards.holderPlaceholder')}
              value={holder} onChange={(e) => setHolder(e.target.value.replace(/[^\p{L} .'-]/gu, '').slice(0, 60).toUpperCase())}
              onFocus={() => setFocus('holder')} onBlur={() => setFocus(null)}
              className={cx(fieldClass.input, 'uppercase')}
            />
          </div>
        </div>
        {error && <p id={`${id}-err`} role="alert" className="text-sm text-negative">{error.message}</p>}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted"><ShieldCheck size={15} className="mt-px shrink-0 text-neon" />{t('app.cards.safeNote')}</p>
        {footer}
        <Button type="submit" size="lg" disabled={disabled || busy} data-testid="card-submit" className="w-full">
          {busy && <Loader2 size={15} className="animate-spin" />}{submitLabel}
        </Button>
      </div>
    </form>
  );
}
