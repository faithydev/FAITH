import { ActionButton, AutoForm } from '@/components/ui/client';
import { Card, EmptyState, PageHeader, cx } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import type { Store } from '@/lib/types';
import { getTranslations } from 'next-intl/server';

export type Analytics = {
  currency: string; grossMinor: string; refundedMinor: string; commissionMinor: string; netEarningsMinor: string;
  orders: number; customers: number; repeatCustomers: number; refundRateBps: number; conversionBps: number; views: number;
  series: { day: string; revenue: string; orders: string }[];
  products: { id: string; title: string; salesCount: number; viewCount: number; ratingCount: number; ratingSum: number }[];
};

/** Shown when someone opens a workspace they have no role for. Adding the role is one click. */
export async function NoRole({ persona }: { persona: string }) {
  const t = await getTranslations();
  return (
    <EmptyState
      title={t('app.noRole.title', { role: t(`onboarding.personas.${persona}.title`) })} description={t('app.noRole.body')}
      action={<ActionButton endpoint="/me/roles" body={{ persona }} label={t('app.noRole.add')} variant="primary" size="md" />}
    />
  );
}

export async function CreateStore() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t('app.seller.createTitle')} description={t('app.seller.createBody')} />
      <Card className="max-w-lg p-5">
        <AutoForm
          endpoint="/seller/stores" submitLabel={t('app.seller.createCta')} success={t('common.saved')}
          fields={[
            { name: 'name', label: t('app.seller.storeName'), required: true },
            { name: 'tagline', label: t('app.seller.tagline') },
            { name: 'currency', label: t('app.seller.currency'), type: 'select', required: true, defaultValue: 'USD', options: ['USD', 'EUR', 'UZS'].map((c) => ({ value: c, label: c })) },
          ]}
        />
      </Card>
    </>
  );
}

export function StoreTabs({ stores, active, path }: { stores: Store[]; active: string; path: string }) {
  if (stores.length < 2) return null;
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {stores.map((s) => (
        <Link key={s.id} href={`${path}?store=${s.id}`} className={cx('rounded-md border px-2.5 py-1 text-sm', s.id === active ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted hover:text-ink')}>{s.name}</Link>
      ))}
    </div>
  );
}
