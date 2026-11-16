'use client';

import { CardEntry, LinkedCardFace, type CardDraft, type LinkedCard } from '@/components/billing/cards';
import { ActionButton, Modal, toast, useErrorMessage } from '@/components/ui/client';
import { Badge, Button } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** The member's linked cards: add one, pick the default, remove one. Nothing here charges a card. */
export function CardWallet({ cards }: { cards: LinkedCard[] }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);

  async function add(draft: CardDraft) {
    try {
      await clientApi('/billing/cards', { body: draft });
      toast.success(t('app.cards.linked'));
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  }

  return (
    <div>
      {cards.length === 0 ? <p className="text-sm text-muted">{t('app.cards.empty')}</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="card-wallet">
          {cards.map((c) => (
            <li key={c.id} className="card flex flex-col gap-3 p-3">
              <LinkedCardFace card={c} />
              <div className="flex flex-wrap items-center gap-2">
                {c.isDefault
                  ? <Badge tone="positive">{t('app.cards.default')}</Badge>
                  : <ActionButton endpoint={`/billing/cards/${c.id}/default`} label={t('app.cards.makeDefault')} />}
                <ActionButton
                  endpoint={`/billing/cards/${c.id}`} method="DELETE" variant="ghost" label={t('app.cards.remove')}
                  confirm={{ title: t('app.cards.removeConfirm', { last4: c.last4 }), danger: true, confirmLabel: t('app.cards.remove') }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)} data-testid="wallet-add"><Plus size={15} />{t('app.cards.add')}</Button>
      <Modal open={open} onOpenChange={setOpen} title={t('app.cards.add')} description={t('app.cards.noCharge')}>
        <CardEntry onSubmit={add} submitLabel={t('app.cards.link')} />
      </Modal>
    </div>
  );
}
