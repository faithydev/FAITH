import { NoRole } from '@/components/seller/shared';
import { FormDialog } from '@/components/ui/client';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Community = { id: string; slug: string; name: string; description: string; visibility: string; _count: { members: number; posts: number } };

export default async function CreatorCommunityPage() {
  const { t, me } = await pageContext();
  if (!me.permissions.includes('community.manage')) return <NoRole persona="create" />;
  const rows = await api<Community[]>('/my/communities');
  return (
    <>
      <PageHeader
        title={t('nav.items.community')} description={t('app.creator.communityBody')}
        actions={
          <FormDialog
            trigger={t('app.creator.newCommunity')} title={t('app.creator.newCommunity')} endpoint="/communities" submitLabel={t('common.create')} success={t('common.saved')}
            fields={[
              { name: 'name', label: t('app.seller.productTitle'), required: true },
              { name: 'description', label: t('app.seller.description'), type: 'textarea', required: true },
              { name: 'visibility', label: t('app.creator.visibility'), type: 'select', required: true, defaultValue: 'PUBLIC', options: ['PUBLIC', 'PRIVATE'].map((v) => ({ value: v, label: t(`communities.${v}`) })) },
            ]}
          />
        }
      />
      {rows.length === 0 ? <EmptyState title={t('app.creator.noCommunities')} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <Link key={c.id} href={`/communities/${c.slug}`} className="card hover-depth p-5">
              <div className="flex items-start justify-between gap-2"><p className="font-medium">{c.name}</p><Badge>{t(`communities.${c.visibility}`)}</Badge></div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>
              <p className="mt-2 text-xs text-subtle">{t('app.creator.communityStats', { members: c._count.members, posts: c._count.posts })}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
