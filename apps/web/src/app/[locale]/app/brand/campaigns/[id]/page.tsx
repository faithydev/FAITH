import { RewardProgress } from '@/components/rewards/reward-progress';
import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, EmptyState, PageHeader, SectionTitle, StatCard, StatusBadge } from '@/components/ui/primitives';
import { api, getMeta } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { number } from '@/lib/format';
import { pageContext } from '@/lib/page';
import { notFound } from 'next/navigation';

type Person = { profile: { displayName: string; username: string } | null };
type Review = {
  campaign: { id: string; slug: string; title: string; status: string; currency: string; budgetMinor: string; fundedMinor: string; accruedMinor: string; moderationNote: string | null };
  applications: { id: string; pitch: string; status: string; creator: Person }[];
  submissions: { id: string; url: string; platform: string; status: string; verification: string; creator: Person; metrics: { metric: string; value: string; source: string }[]; signals: { id: string; kind: string; severity: string }[]; accruals: { amountMinor: string }[] }[];
  signals: { id: string; kind: string; severity: string; status: string }[];
  accruedMinor: string;
};

export default async function CampaignManagePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, m, status, locale }, meta] = await Promise.all([params, pageContext(), getMeta()]);
  const r = await api<Review>(`/rewards/brand/campaigns/${id}/review`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const c = r.campaign;
  const unfunded = BigInt(c.budgetMinor) - BigInt(c.fundedMinor);
  const openSignals = r.signals.filter((s) => s.status === 'OPEN');
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.campaigns'), href: '/app/brand/campaigns' }, { label: c.title }]} />
      <PageHeader
        title={c.title}
        actions={
          <>
            <span data-testid="campaign-status"><StatusBadge status={c.status} label={status(c.status)} /></span>
            {unfunded > 0n && <ActionButton endpoint={`/rewards/brand/campaigns/${c.id}/fund`} idempotent followPayment variant="primary" label={t('app.brand.fundCta', { amount: m(unfunded, c.currency) })} />}
            {['DRAFT', 'REJECTED'].includes(c.status) && unfunded <= 0n && <ActionButton endpoint={`/rewards/brand/campaigns/${c.id}/submit`} variant="primary" label={t('app.brand.submitReview')} success={t('app.brand.submitted')} />}
            {c.status === 'ACTIVE' && <ActionButton endpoint={`/rewards/brand/campaigns/${c.id}/paused`} body={{ paused: true }} label={t('app.brand.pause')} />}
            {c.status === 'PAUSED' && <ActionButton endpoint={`/rewards/brand/campaigns/${c.id}/paused`} body={{ paused: false }} label={t('app.brand.resume')} />}
          </>
        }
      />
      {c.moderationNote && <p className="mb-5 rounded-md bg-surface-2 p-3 text-sm">{c.moderationNote}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t('app.brand.funded')} value={m(c.fundedMinor, c.currency)} />
        <StatCard label={t('app.brand.spent')} value={m(r.accruedMinor, c.currency)} />
        <StatCard label={t('app.brand.fraudWarnings')} value={openSignals.length} hint={t('app.brand.fraudHint')} />
      </div>
      <Card className="mt-4 p-4"><RewardProgress accruedMinor={c.accruedMinor} fundedMinor={c.fundedMinor} currency={c.currency} label={t('rewards.budgetUsed')} /></Card>

      {r.applications.length > 0 && (
        <section className="mt-8">
          <SectionTitle title={t('app.brand.applicants')} />
          <ul className="card divide-y divide-line">
            {r.applications.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0"><span className="font-medium">{a.creator.profile?.displayName}</span><span className="block text-muted">{a.pitch}</span></span>
                {a.status === 'PENDING' ? (
                  <span className="flex gap-2">
                    <ActionButton endpoint={`/rewards/brand/applications/${a.id}/decide`} body={{ approve: false }} label={t('common.reject')} />
                    <ActionButton endpoint={`/rewards/brand/applications/${a.id}/decide`} body={{ approve: true }} label={t('common.approve')} variant="primary" />
                  </span>
                ) : <StatusBadge status={a.status} label={status(a.status)} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle title={t('app.brand.submissions')} action={<a href={`/api/v1/rewards/brand/campaigns/${c.id}/report`} className="text-sm text-muted hover:text-ink">{t('app.brand.downloadReport')}</a>} />
        {r.submissions.length === 0 ? <EmptyState title={t('app.brand.noSubmissions')} /> : (
          <div className="space-y-3">
            {r.submissions.map((s) => {
              const latest = new Map<string, { value: string; source: string }>();
              for (const x of s.metrics) if (!latest.has(x.metric)) latest.set(x.metric, x);
              return (
                <Card key={s.id} className="p-4" data-testid="review-submission">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{s.creator.profile?.displayName} <Badge>{t(`rewards.platforms.${s.platform}`)}</Badge></p>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-sm text-muted hover:text-ink">{s.url}</a>
                    </div>
                    <StatusBadge status={s.status} label={status(s.status)} />
                  </div>
                  {s.signals.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{s.signals.map((x) => <li key={x.id} className="flex items-center gap-1"><Badge tone={x.severity === 'HIGH' ? 'negative' : 'warning'}>{t(`rewards.fraud.${x.kind}`)}</Badge><ActionButton endpoint={`/rewards/signals/${x.id}/decide`} body={{ status: 'DISMISSED' }} label={t('app.brand.dismiss')} variant="ghost" /></li>)}</ul>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                    {[...latest].map(([metric, x]) => <span key={metric}><span className="text-muted">{t(`rewards.metrics.${metric}`)}</span> <span className="font-medium tabular-nums">{number(x.value, locale)}</span> <Badge>{t(`rewards.sources.${x.source}`)}</Badge></span>)}
                    <span><span className="text-muted">{t('app.creator.earned')}</span> <span className="font-medium tabular-nums">{m(s.accruals.reduce((a, x) => a + BigInt(x.amountMinor), 0n), c.currency)}</span></span>
                  </div>
                  <p className="mt-1.5 text-xs text-subtle">{t(`rewards.verification.${s.verification}`)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['SUBMITTED', 'APPEALED'].includes(s.status) && (
                      <>
                        <ActionButton endpoint={`/rewards/submissions/${s.id}/decide`} body={{ decision: 'approve' }} label={t('common.approve')} variant="primary" confirm={{ title: t('app.brand.approveConfirm'), body: t('app.brand.approveBody') }} />
                        <FormDialog trigger={t('common.reject')} title={t('app.brand.rejectTitle')} triggerVariant="secondary" endpoint={`/rewards/submissions/${s.id}/decide`} extra={{ decision: 'reject' }} submitLabel={t('common.reject')} fields={[{ name: 'reason', label: t('app.creator.rejectionReason'), type: 'textarea', required: true, minLength: 3 }]} />
                      </>
                    )}
                    {s.status !== 'REJECTED' && (
                      <FormDialog
                        trigger={t('app.brand.recordMetric')} title={t('app.brand.recordMetric')} description={t('app.brand.metricBody')} triggerVariant="secondary"
                        endpoint={`/rewards/submissions/${s.id}/${meta?.mockPayments ? 'simulate-metrics' : 'metrics'}`} submitLabel={t('common.save')}
                        fields={[
                          { name: 'metric', label: t('app.brand.metric'), type: 'select', required: true, defaultValue: 'VIEWS', options: ['VIEWS', 'CLICKS', 'LEADS', 'SALES'].map((x) => ({ value: x, label: t(`rewards.metrics.${x}`) })) },
                          { name: 'value', label: t('app.brand.metricValue'), required: true, placeholder: '12500' },
                        ]}
                      />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
