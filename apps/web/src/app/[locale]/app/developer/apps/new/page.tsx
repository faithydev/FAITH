import { NoRole } from '@/components/seller/shared';
import { AutoForm } from '@/components/ui/client';
import { Breadcrumbs, Card, PageHeader } from '@/components/ui/primitives';
import { pageContext } from '@/lib/page';

const CATEGORIES = ['analytics', 'marketing', 'operations', 'finance', 'communication', 'developer'];

export default async function NewAppPage() {
  const { t, me } = await pageContext();
  if (!me.permissions.includes('app.manage')) return <NoRole persona="build" />;
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.apps'), href: '/app/developer/apps' }, { label: t('app.developer.newApp') }]} />
      <PageHeader title={t('app.developer.newApp')} description={t('app.developer.newBody')} />
      <Card className="max-w-2xl p-5">
        <AutoForm
          endpoint="/developer/apps" submitLabel={t('app.seller.saveDraft')} redirectTo="/app/developer/apps/{id}" success={t('common.saved')}
          extra={{ screenshots: [], currency: 'USD' }}
          fields={[
            { name: 'name', label: t('app.seller.productTitle'), required: true },
            { name: 'tagline', label: t('app.developer.tagline'), required: true },
            { name: 'description', label: t('app.seller.description'), type: 'textarea', rows: 6, required: true },
            { name: 'category', label: t('market.category'), type: 'select', required: true, defaultValue: 'analytics', options: CATEGORIES.map((c) => ({ value: c, label: t(`apps.categories.${c}`) })) },
            { name: 'website', label: t('app.work.link'), type: 'url' },
            { name: 'pricing', label: t('app.developer.pricing'), type: 'select', required: true, defaultValue: 'FREE', options: ['FREE', 'ONE_TIME', 'SUBSCRIPTION'].map((p) => ({ value: p, label: t(`apps.pricing.${p}`) })) },
            { name: 'priceMinor', label: t('app.seller.priceIn', { currency: 'USD' }), type: 'money', currency: 'USD', hint: t('app.developer.priceHint') },
          ]}
        />
      </Card>
    </>
  );
}
