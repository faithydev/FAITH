import type { CardBrand } from '@faith/validators';
import type { ReactNode } from 'react';
import { cx } from '@/components/ui/primitives';

/**
 * Acceptance marks for the payment methods FAITH shows: the two Uzbek wallets, the two national
 * card schemes and the international networks. Drawn as simple marks in each brand's colours, sized
 * like a card chip (48×30). Brand names stay as they are in every language.
 */
export const PAYMENT_METHODS = ['click', 'payme', 'uzcard', 'humo', 'visa', 'mastercard', 'unionpay', 'mir'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const METHOD_NAMES: Record<PaymentMethod, string> = {
  click: 'Click', payme: 'Payme', uzcard: 'UZCARD', humo: 'HUMO', visa: 'Visa', mastercard: 'Mastercard', unionpay: 'UnionPay', mir: 'Mir',
};

const FONT = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

function Frame({ fill, children, stroke }: { fill: string; children: ReactNode; stroke?: string }) {
  return (
    <>
      <rect x="0.5" y="0.5" width="47" height="29" rx="5.5" fill={fill} stroke={stroke ?? 'rgba(255,255,255,0.14)'} />
      {children}
    </>
  );
}

const DRAW: Record<PaymentMethod, ReactNode> = {
  click: (
    <Frame fill="#0A64FF">
      <circle cx="12.5" cy="15" r="5.6" fill="none" stroke="#fff" strokeWidth="2.4" />
      <circle cx="12.5" cy="15" r="1.9" fill="#fff" />
      <text x="20.5" y="19" fill="#fff" fontFamily={FONT} fontSize="10.5" fontWeight="700" letterSpacing="-0.3">click</text>
    </Frame>
  ),
  payme: (
    <Frame fill="#ffffff" stroke="rgba(0,0,0,0.08)">
      <text x="24" y="19.2" textAnchor="middle" fontFamily={FONT} fontSize="11.5" fontWeight="800" letterSpacing="-0.4">
        <tspan fill="#0B2A3A">pay</tspan><tspan fill="#33CCCC">me</tspan>
      </text>
    </Frame>
  ),
  uzcard: (
    <Frame fill="#0B3D91">
      <path d="M7 9.5h5.2v6.2a2.6 2.6 0 0 0 5.2 0V9.5" fill="none" stroke="#3CCB7F" strokeWidth="2.2" strokeLinecap="round" />
      <text x="31" y="18.6" textAnchor="middle" fill="#fff" fontFamily={FONT} fontSize="8" fontWeight="800" letterSpacing="0.2">UZCARD</text>
    </Frame>
  ),
  humo: (
    <Frame fill="#11205E">
      <path d="M8 18.5c2.6-6.2 7.1-8.4 12-7.2-3 .6-5 2.4-6.2 4.8 2-.9 3.8-.9 5.4 0-3.6.2-6.9 1-11.2 2.4Z" fill="#FF8A00" />
      <text x="33" y="18.6" textAnchor="middle" fill="#fff" fontFamily={FONT} fontSize="9" fontWeight="800" letterSpacing="0.6">HUMO</text>
    </Frame>
  ),
  visa: (
    <Frame fill="#1434CB">
      <text x="24" y="19.6" textAnchor="middle" fill="#fff" fontFamily={FONT} fontSize="12.5" fontWeight="900" fontStyle="italic" letterSpacing="0.4">VISA</text>
    </Frame>
  ),
  mastercard: (
    <Frame fill="#16161A">
      <circle cx="19.5" cy="15" r="7.4" fill="#EB001B" />
      <circle cx="28.5" cy="15" r="7.4" fill="#F79E1B" />
      <path d="M24 9.1a7.4 7.4 0 0 1 0 11.8 7.4 7.4 0 0 1 0-11.8Z" fill="#FF5F00" />
    </Frame>
  ),
  unionpay: (
    <Frame fill="#ffffff" stroke="rgba(0,0,0,0.08)">
      <path d="M9.6 6.5h8.6l-3.4 17H6.2Z" fill="#E21836" />
      <path d="M17.2 6.5h8.6l-3.4 17h-8.6Z" fill="#00447C" />
      <path d="M24.8 6.5h8.6l-3.4 17h-8.6Z" fill="#007B84" />
      <text x="20.3" y="18.4" textAnchor="middle" fill="#fff" fontFamily={FONT} fontSize="5.6" fontWeight="800" fontStyle="italic">UnionPay</text>
    </Frame>
  ),
  mir: (
    <Frame fill="#ffffff" stroke="rgba(0,0,0,0.08)">
      <text x="24" y="19.4" textAnchor="middle" fill="#0F754E" fontFamily={FONT} fontSize="12" fontWeight="900" letterSpacing="0.5">МИР</text>
      <path d="M12 22.4h24" stroke="#00A1E0" strokeWidth="1.4" strokeLinecap="round" />
    </Frame>
  ),
};

/** One mark. `title` is read aloud; pass `decorative` when the brand name is already written next to it. */
export function PaymentMark({ method, className, decorative }: { method: PaymentMethod | CardBrand; className?: string; decorative?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 30" className={cx('w-auto shrink-0', className ?? 'h-6')}
      role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : METHOD_NAMES[method]}
    >
      {DRAW[method]}
    </svg>
  );
}

/** The row of accepted methods: under prices, at checkout and in the footer. */
export function PaymentMarks({ label, methods = PAYMENT_METHODS, className, size = 'md' }: {
  label?: string; methods?: readonly PaymentMethod[]; className?: string; size?: 'sm' | 'md';
}) {
  return (
    <div className={cx('flex flex-col gap-2', className)} data-testid="payment-marks">
      {label && <p className="text-xs text-subtle">{label}</p>}
      <ul className="flex flex-wrap items-center gap-1.5" aria-label={label}>
        {methods.map((m) => (
          <li key={m} title={METHOD_NAMES[m]}>
            <PaymentMark method={m} className={size === 'sm' ? 'h-5' : 'h-7'} />
          </li>
        ))}
      </ul>
    </div>
  );
}
