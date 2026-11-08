import { NoRole } from '@/components/seller/shared';
import { FormDialog } from '@/components/ui/client';
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { number } from '@/lib/format';
import { pageContext } from '@/lib/page';

type Row = {
  id: string; url: string; platform: string; status: string; rejectionReason: string | null; verification: string; createdAt: string;
  campaign: { slug: string; title: string; currency: string };
  metrics: { metric: string; value: string; source: string }[];
  accruals: { amountMinor: string; status: string }[];
  appeals: { status: string; resolution: string | null }[];
};

export default async function SubmissionsPage() {
  const { t, m, d, status, me, locale } = await pageContext();
  if (!me.permissions.includes('campaign.participate')) return <NoRole persona="create" />;
  const rows = await api<Row[]>('/rewards/creator/submissions');
  return (
    <>
      <PageHeader title={t('nav.items.submissions')} description={t('app.creator.submissionsBody')} />
      {rows.length === 0 ? <EmptyState title={t('app.creator.noSubmissions')} action={<LinkButton href="/rewards">{t('app.creator.browse')}</LinkButton>} /> : (
        <div className="space-y-3">
          {rows.map((s) => {
            const latest = new Map<string, Row['metrics'][number]>();
            for (const x of s.metrics) if (!latest.has(x.metric)) latest.set(x.metric, x);
            const earned = s.accruals.filter((a) => a.status !== 'REVERSED').reduce((sum, a) => sum + BigInt(a.amountMinor), 0n);
            return (
              <Card key={s.id} className="p-4" data-testid="submission">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/rewards/${s.campaign.slug}`} className="font-medium hover:underline">{s.campaign.title}</Link>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs text-muted hover:text-ink">{s.url}</a>
                  </div>
                  <StatusBadge status={s.status} label={status(s.status)} />
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {[...latest.values()].map((x) => (
                    <div key={x.metric} className="flex items-center gap-1.5">
                      <dt className="text-muted">{t(`rewards.metrics.${x.metric}`)}</dt>
                      <dd className="font-medium tabular-nums">{number(x.value, locale)}</dd>
                      <Badge>{t(`rewards.sources.${x.source}`)}</Badge>
                    </div>
                  ))}
                  <div className="flex gap-1.5"><dt className="text-muted">{t('app.creator.earned')}</dt><dd className="font-medium tabular-nums">{m(earned, s.campaign.currency)}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-subtle">{t(`rewards.verification.${s.verification}`)} · {d(s.createdAt)}</p>
                {s.rejectionReason && <p className="mt-2 rounded-sm bg-surface-2 p-2 text-sm"><span className="font-medium">{t('app.creator.rejectionReason')}:</span> {s.rejectionReason}</p>}
                {s.status === 'REJECTED' && s.appeals.length === 0 && (
                  <div className="mt-3">
                    <FormDialog
                      trigger={t('app.creator.appeal')} title={t('app.creator.appeal')} description={t('app.creator.appealBody')} triggerVariant="secondary"
                      endpoint={`/rewards/submissions/${s.id}/appeal`} submitLabel={t('app.creator.appeal')} success={t('app.creator.appealSent')}
                      fields={[{ name: 'reason', label: t('app.creator.appealReason'), type: 'textarea', required: true, minLength: 10 }]}
                    />
                  </div>
                )}
                {s.appeals[0] && <p className="mt-2 text-xs text-muted">{t('app.creator.appealStatus', { status: status(s.appeals[0].status) })}{s.appeals[0].resolution ? `: ${s.appeals[0].resolution}` : ''}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
