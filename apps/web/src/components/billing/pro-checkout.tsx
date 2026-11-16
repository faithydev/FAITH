'use client';

import { CardEntry, LinkedCardFace, type CardDraft, type LinkedCard } from '@/components/billing/cards';
import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, cx } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi, newKey } from '@/lib/client';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRef, useState } from 'react';

type Offer = { interval: 'MONTHLY' | 'YEARLY'; label: string; primary?: boolean };
type Started = { status: string; redirectUrl: string | null };

const pick = (on: boolean) => cx(
  'rounded-xl border text-start transition-colors',
  on
    ? 'border-[color-mix(in_srgb,var(--neon)_60%,transparent)] bg-[color-mix(in_srgb,var(--neon)_9%,transparent)] text-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--neon)_12%,transparent)]'
    : 'border-line text-muted hover:border-line-strong hover:text-ink',
);

/**
 * Pro checkout in three steps: the role Pro unlocks (and the badge it shows), monthly or yearly,
 * then a card. The card is only linked: in the simulator nothing is charged to it and Pro turns
 * on at once. No role, no checkout.
 */
export function ProCheckout({ kinds, offers, title, body, chooseFirst, cards }: {
  kinds: { kind: string; label: string }[]; offers: Offer[]; title: string; body: string; chooseFirst: string; cards: LinkedCard[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [kind, setKind] = useState<string | null>(null);
  const [interval, setPeriod] = useState<Offer['interval']>(offers.find((o) => o.primary)?.interval ?? offers[0]!.interval);
  const [cardId, setCardId] = useState<string | 'new'>(cards.find((c) => c.isDefault)?.id ?? cards[0]?.id ?? 'new');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // One key per attempt: a double click or a retry after a network error cannot start Pro twice.
  const attempt = useRef(newKey());

  async function upgrade(id: string) {
    const r = await clientApi<Started>('/billing/upgrade', { body: { interval, badgeKind: kind, idempotencyKey: attempt.current, cardId: id } });
    if (r.status === 'SUCCEEDED') {
      setDone(true);
      toast.success(t('app.cards.proOn'));
      router.refresh();
    } else if (r.redirectUrl) {
      router.push(r.redirectUrl);
    } else {
      attempt.current = newKey();
      toast.error(t('checkout.failed'));
    }
  }

  async function withNewCard(draft: CardDraft) {
    try {
      const card = await clientApi<LinkedCard>('/billing/cards', { body: draft });
      await upgrade(card.id);
    } catch (e) {
      attempt.current = newKey();
      toast.error(errorMessage(e));
      throw e;
    }
  }

  async function withSavedCard() {
    setBusy(true);
    try {
      await upgrade(cardId);
    } catch (e) {
      attempt.current = newKey();
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p role="status" className="flex items-center gap-2 text-sm font-medium text-positive"><CheckCircle2 size={18} />{t('app.cards.proOn')}</p>;
  }

  const price = offers.find((o) => o.interval === interval)!.label;
  return (
    <div className="grid gap-7">
      <section>
        <p className="text-sm font-medium"><span className="me-2 font-mono text-xs text-neon">01</span>{title}</p>
        <p className="mt-1 text-xs text-muted">{body}</p>
        <div role="radiogroup" aria-label={title} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kinds.map((k) => (
            <button
              key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} data-testid={`pick-${k.kind}`}
              onClick={() => setKind(k.kind)}
              className={cx(pick(kind === k.kind), 'flex flex-col items-center gap-1.5 p-2.5 text-center text-xs')}
            >
              <Image src={`/badges/${k.kind}.webp`} width={44} height={44} alt="" unoptimized />
              {k.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-sm font-medium"><span className="me-2 font-mono text-xs text-neon">02</span>{t('app.cards.period')}</p>
        <div role="radiogroup" aria-label={t('app.cards.period')} className="mt-3 grid gap-2 sm:grid-cols-2">
          {offers.map((o) => (
            <button key={o.interval} type="button" role="radio" aria-checked={interval === o.interval} data-testid={`interval-${o.interval}`} onClick={() => setPeriod(o.interval)} className={cx(pick(interval === o.interval), 'px-4 py-3 text-sm font-medium')}>
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-sm font-medium"><span className="me-2 font-mono text-xs text-neon">03</span>{t('app.cards.cardStep')}</p>
        <p className="mt-1 text-xs text-muted">{t('app.cards.noCharge')}</p>
        {cards.length > 0 && (
          <div role="radiogroup" aria-label={t('app.cards.cardStep')} className="mt-3 flex flex-wrap gap-3">
            {cards.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={cardId === c.id} aria-label={`${c.brand} •••• ${c.last4}`} onClick={() => setCardId(c.id)} className={cx(pick(cardId === c.id), 'w-[13.5rem] p-1.5')}>
                <LinkedCardFace card={c} />
              </button>
            ))}
            <button type="button" role="radio" aria-checked={cardId === 'new'} onClick={() => setCardId('new')} data-testid="card-new" className={cx(pick(cardId === 'new'), 'flex w-[13.5rem] flex-col items-center justify-center gap-1.5 p-3 text-sm')}>
              <Plus size={18} />{t('app.cards.add')}
            </button>
          </div>
        )}
        <div className="mt-4">
          {cardId === 'new' ? (
            <CardEntry
              layout="split" disabled={!kind} onSubmit={withNewCard}
              submitLabel={kind ? t('app.cards.linkAndStart', { price }) : chooseFirst}
            />
          ) : (
            <Button size="lg" className="w-full sm:w-auto" disabled={!kind || busy} onClick={withSavedCard} data-testid="pro-with-card">
              {busy && <Loader2 size={15} className="animate-spin" />}{kind ? t('app.cards.startWithCard', { price }) : chooseFirst}
            </Button>
          )}
        </div>
        {!kind && <p className="mt-2 text-xs text-subtle">{chooseFirst}</p>}
      </section>
    </div>
  );
}
