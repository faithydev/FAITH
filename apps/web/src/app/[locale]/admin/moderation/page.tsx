import { ActionButton } from '@/components/ui/client';
import { DataTable, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Job = { id: string; title: string; status: string; org: { name: string } };
type Ad = { id: string; title: string; status: string; placement: string; currency: string; budgetMinor: string };
type Content = {
  posts: { id: string; title: string; status: string; community: { name: string } }[];
  reviews: { id: string; rating: number; body: string; status: string; product: { title: string } }[];
};

export default async function AdminModeration() {
  const { t, m, status, me } = await pageContext();
  const canAds = me.permissions.includes('admin.ads.moderate');
  const canContent = me.permissions.includes('admin.marketplace.moderate');
  const [jobs, ads, content] = await Promise.all([
    api<Job[]>('/admin/jobs'), canAds ? api<Ad[]>('/admin/ads') : Promise.resolve([]),
    canContent ? api<Content>('/admin/content') : Promise.resolve({ posts: [], reviews: [] } as Content),
  ]);
  return (
    <>
      <PageHeader title={t('admin.nav.moderation')} />
      <section className="mb-8">
        <SectionTitle title={t('nav.jobs')} />
        <DataTable
          caption={t('nav.jobs')} rows={jobs} rowKey={(j) => j.id}
          columns={[
            { header: t('app.seller.productTitle'), cell: (j) => <span className="font-medium">{j.title}</span> },
            { header: t('app.brand.organization'), cell: (j) => j.org.name },
            { header: t('app.orders.status'), cell: (j) => <StatusBadge status={j.status} label={status(j.status)} /> },
            {
              header: '', align: 'end',
              cell: (j) => (j.status === 'PENDING_REVIEW' ? (
                <span className="flex justify-end gap-1.5">
                  <ActionButton endpoint={`/admin/jobs/${j.id}/moderate`} body={{ approve: false }} label={t('common.reject')} />
                  <ActionButton endpoint={`/admin/jobs/${j.id}/moderate`} body={{ approve: true }} label={t('common.approve')} variant="primary" />
                </span>
              ) : null),
            },
          ]}
        />
      </section>
      {canAds && (
        <section className="mb-8">
          <SectionTitle title={t('app.growth.ads')} />
          <DataTable
            caption={t('app.growth.ads')} rows={ads} rowKey={(a) => a.id}
            columns={[
              { header: t('app.growth.adTitle'), cell: (a) => a.title },
              { header: t('app.growth.placement'), cell: (a) => t(`app.growth.placements.${a.placement}`) },
              { header: t('app.orders.status'), cell: (a) => <StatusBadge status={a.status} label={status(a.status)} /> },
              { header: t('app.growth.budget'), align: 'end', cell: (a) => <span className="tabular-nums">{m(a.budgetMinor, a.currency)}</span> },
              {
                header: '', align: 'end',
                cell: (a) => (a.status === 'PENDING_REVIEW' ? (
                  <span className="flex justify-end gap-1.5">
                    <ActionButton endpoint={`/admin/ads/${a.id}/moderate`} body={{ approve: false }} label={t('common.reject')} />
                    <ActionButton endpoint={`/admin/ads/${a.id}/moderate`} body={{ approve: true }} label={t('common.approve')} variant="primary" />
                  </span>
                ) : null),
              },
            ]}
          />
        </section>
      )}
      {canContent && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionTitle title={t('admin.posts')} />
            <ul className="card divide-y divide-line">
              {content.posts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{p.title}</span><span className="text-xs text-muted">{p.community.name}</span></span>
                  <ActionButton endpoint={`/admin/posts/${p.id}/status`} body={{ status: p.status === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE' }} label={p.status === 'VISIBLE' ? t('admin.hide') : t('admin.show')} />
                </li>
              ))}
            </ul>
          </section>
          <section>
            <SectionTitle title={t('market.reviews')} />
            <ul className="card divide-y divide-line">
              {content.reviews.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{r.product.title} · {r.rating}/5</span><span className="block truncate text-xs text-muted">{r.body}</span></span>
                  <ActionButton endpoint={`/admin/reviews/${r.id}/status`} body={{ status: r.status === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE' }} label={r.status === 'VISIBLE' ? t('admin.hide') : t('admin.show')} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
