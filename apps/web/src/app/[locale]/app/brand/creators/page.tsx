import { CreatorCard, CreatorRow } from '@/components/rewards/creator-card';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { publicApi } from '@/lib/api';
import { pageContext } from '@/lib/page';

export default async function BrandCreatorsPage() {
  const { t } = await pageContext();
  const creators = await publicApi<CreatorRow[]>('/creators');
  return (
    <>
      <PageHeader title={t('nav.items.creators')} description={t('app.brand.creatorsBody')} />
      {creators.length === 0 ? <EmptyState title={t('creators.empty')} /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{creators.map((c) => <CreatorCard key={c.userId} c={c} />)}</div>}
    </>
  );
}
