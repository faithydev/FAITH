import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, DataTable, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Campaign = { id: string; slug: string; title: string; status: string; currency: string; budgetMinor: string; fundedMinor: string; accruedMinor: string; org: { name: string }; _count: { submissions: number; fraudSignals: number } };
type Submission = { id: string; url: string; status: string; campaign: { title: string }; creator: { profile: { displayName: string } | null }; signals: { id: string; kind: string; severity: string }[] };
type Appeal = { id: string; reason: string; submission: { url: string; campaign: { title: string } } };

export default async function AdminRewards() {
  const { t, m, status } = await pageContext();
  const [campaigns, submissions, appeals] = await Promise.all([api<Campaign[]>('/admin/campaigns'), api<Submission[]>('/admin/submissions'), api<Appeal[]>('/admin/appeals')]);
  const pending = campaigns.filter((c) => c.status === 'PENDING_REVIEW');
  return (
    <>
      <PageHeader title={t('admin.nav.rewards')} description={t('admin.rewardsBody')} />
      {pending.length > 0 && (
        <section className="mb-8">
          <SectionTitle title={t('admin.campaignApprovals')} />
          <ul className="card divide-y divide-line">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                <span><span className="font-medium">{c.title}</span><span className="block text-xs text-muted">{c.org.name} · {m(c.fundedMinor, c.currency)}</span></span>
                <span className="flex gap-2">
                  <FormDialog trigger={t('common.reject')} title={t('common.reject')} triggerVariant="secondary" endpoint={`/admin/campaigns/${c.id}/moderate`} extra={{ approve: false }} submitLabel={t('common.reject')} fields={[{ name: 'note', label: t('app.orders.refundReason'), type: 'textarea', required: true }]} />
                  <ActionButton endpoint={`/admin/campaigns/${c.id}/moderate`} body={{ approve: true }} label={t('common.approve')} variant="primary" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {appeals.length > 0 && (
        <section className="mb-8">
          <SectionTitle title={t('admin.appeals')} />
          <ul className="card divide-y divide-line">
            {appeals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                <span className="min-w-0"><span className="font-medium">{a.submission.campaign.title}</span><span className="block text-muted">{a.reason}</span></span>
                <span className="flex gap-2">
                  <FormDialog trigger={t('admin.deny')} title={t('admin.deny')} triggerVariant="secondary" endpoint={`/admin/appeals/${a.id}/resolve`} extra={{ uphold: false }} submitLabel={t('admin.deny')} fields={[{ name: 'resolution', label: t('admin.resolution'), type: 'textarea', required: true }]} />
                  <FormDialog trigger={t('admin.uphold')} title={t('admin.uphold')} endpoint={`/admin/appeals/${a.id}/resolve`} extra={{ uphold: true }} submitLabel={t('admin.uphold')} fields={[{ name: 'resolution', label: t('admin.resolution'), type: 'textarea', required: true }]} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {submissions.length > 0 && (
        <section className="mb-8">
          <SectionTitle title={t('admin.submissionQueue')} />
          <DataTable
            caption={t('admin.submissionQueue')} rows={submissions} rowKey={(s) => s.id}
            columns={[
              { header: t('nav.items.campaigns'), cell: (s) => s.campaign.title },
              { header: t('nav.creators'), cell: (s) => s.creator.profile?.displayName },
              { header: t('app.brand.fraudWarnings'), cell: (s) => <span className="flex flex-wrap gap-1">{s.signals.map((x) => <Badge key={x.id} tone={x.severity === 'HIGH' ? 'negative' : 'warning'}>{t(`rewards.fraud.${x.kind}`)}</Badge>)}</span> },
              { header: '', align: 'end', cell: (s) => <ActionButton endpoint={`/rewards/submissions/${s.id}/decide`} body={{ decision: 'approve' }} label={t('common.approve')} confirm={{ title: t('app.brand.approveConfirm'), body: t('app.brand.approveBody') }} /> },
            ]}
          />
        </section>
      )}
      <SectionTitle title={t('nav.items.campaigns')} />
      <DataTable
        caption={t('nav.items.campaigns')} rows={campaigns} rowKey={(c) => c.id}
        columns={[
          { header: t('app.seller.productTitle'), cell: (c) => <Link href={`/rewards/${c.slug}`} className="font-medium hover:underline">{c.title}</Link> },
          { header: t('app.brand.organization'), cell: (c) => c.org.name },
          { header: t('app.orders.status'), cell: (c) => <StatusBadge status={c.status} label={status(c.status)} /> },
          { header: t('app.brand.funded'), align: 'end', cell: (c) => <span className="tabular-nums">{m(c.fundedMinor, c.currency)}</span> },
          { header: t('app.brand.spent'), align: 'end', cell: (c) => <span className="tabular-nums">{m(c.accruedMinor, c.currency)}</span> },
        ]}
      />
    </>
  );
}
