'use client';

import { ActionButton } from '@/components/ui/client';
import { Button, cx } from '@/components/ui/primitives';
import Image from 'next/image';
import { useState } from 'react';

type Offer = { interval: 'MONTHLY' | 'YEARLY'; label: string; primary?: boolean };

/**
 * Pro checkout. The subscriber must pick exactly one role first: it is the role Pro unlocks and
 * the FAITH Verified badge their profile carries. No role, no checkout button.
 */
export function ProCheckout({ kinds, offers, title, body, chooseFirst }: {
  kinds: { kind: string; label: string }[]; offers: Offer[]; title: string; body: string; chooseFirst: string;
}) {
  const [kind, setKind] = useState<string | null>(null);
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted">{body}</p>
      <div role="radiogroup" aria-label={title} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kinds.map((k) => (
          <button
            key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} data-testid={`pick-${k.kind}`}
            onClick={() => setKind(k.kind)}
            className={cx(
              'flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center text-xs transition-colors',
              kind === k.kind
                ? 'border-[color-mix(in_srgb,var(--neon)_60%,transparent)] bg-[color-mix(in_srgb,var(--neon)_9%,transparent)] text-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--neon)_12%,transparent)]'
                : 'border-line text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            <Image src={`/badges/${k.kind}.webp`} width={44} height={44} alt="" unoptimized />
            {k.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {offers.map((o) => kind
          ? <ActionButton key={o.interval} endpoint="/billing/upgrade" body={{ interval: o.interval, badgeKind: kind }} idempotent followPayment variant={o.primary ? 'primary' : 'secondary'} size="md" label={o.label} />
          : <Button key={o.interval} variant={o.primary ? 'primary' : 'secondary'} size="md" disabled title={chooseFirst}>{o.label}</Button>)}
      </div>
      {!kind && <p className="mt-2 text-xs text-subtle">{chooseFirst}</p>}
    </div>
  );
}
