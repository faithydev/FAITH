import { ActionButton, FormDialog } from '@/components/ui/client';
import { Breadcrumbs, Card, PageHeader, SectionTitle, SimulatedNotice, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { pageContext } from '@/lib/page';
import { notFound } from 'next/navigation';

type Project = {
  id: string; title: string; requirements: string; status: string; currency: string; clientId: string; freelancerId: string;
  milestones: { id: string; title: string; description: string | null; status: string; amountMinor: string; deliveryNote: string | null }[];
  disputes: { id: string; status: string; reason: string; resolution: string | null }[];
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, m, status, me }] = await Promise.all([params, pageContext()]);
  const p = await api<Project>(`/projects/${id}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const isClient = p.clientId === me.id;
  const isFreelancer = p.freelancerId === me.id;
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.projects'), href: '/app/freelance/projects' }, { label: p.title }]} />
      <PageHeader
        title={p.title}
        actions={
          <>
            <StatusBadge status={p.status} label={status(p.status)} />
            {isFreelancer && p.status === 'REQUESTED' && <ActionButton endpoint={`/projects/${p.id}/accept`} variant="primary" label={t('app.freelance.accept')} />}
            {p.status === 'ACTIVE' && (
              <FormDialog
                trigger={t('app.freelance.dispute')} title={t('app.freelance.dispute')} description={t('app.freelance.disputeBody')} triggerVariant="secondary"
                endpoint="/disputes" extra={{ projectId: p.id }} submitLabel={t('app.freelance.dispute')} success={t('common.saved')}
                fields={[{ name: 'reason', label: t('app.orders.refundReason'), type: 'textarea', required: true, minLength: 10 }]}
              />
            )}
          </>
        }
      />
      <Card className="mb-5 p-5"><SectionTitle title={t('app.freelance.requirements')} /><p className="text-sm text-muted">{p.requirements}</p></Card>
      <div className="mb-5"><SimulatedNotice>{t('app.freelance.noEscrow')}</SimulatedNotice></div>
      <SectionTitle title={t('app.freelance.milestones')} />
      <div className="space-y-3">
        {p.milestones.map((x) => (
          <Card key={x.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-medium">{x.title}</p>{x.description && <p className="text-sm text-muted">{x.description}</p>}</div>
              <span className="flex items-center gap-2"><span className="font-medium tabular-nums">{m(x.amountMinor, p.currency)}</span><StatusBadge status={x.status} label={status(x.status)} /></span>
            </div>
            {x.deliveryNote && <p className="mt-2 rounded-sm bg-surface-2 p-2 text-sm">{x.deliveryNote}</p>}
            <div className="mt-3 flex gap-2">
              {isFreelancer && p.status === 'ACTIVE' && ['PENDING', 'CHANGES_REQUESTED'].includes(x.status) && (
                <FormDialog trigger={t('app.freelance.deliver')} title={t('app.freelance.deliver')} endpoint={`/milestones/${x.id}/deliver`} submitLabel={t('app.freelance.deliver')} fields={[{ name: 'deliveryNote', label: t('app.freelance.deliveryNote'), type: 'textarea', required: true }]} />
              )}
              {isClient && x.status === 'SUBMITTED' && (
                <>
                  <ActionButton endpoint={`/milestones/${x.id}/review`} body={{ approve: true }} variant="primary" label={t('common.approve')} />
                  <ActionButton endpoint={`/milestones/${x.id}/review`} body={{ approve: false }} label={t('app.freelance.requestChanges')} />
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
      {p.disputes.length > 0 && (
        <section className="mt-6">
          <SectionTitle title={t('app.freelance.disputes')} />
          <ul className="card divide-y divide-line">{p.disputes.map((x) => <li key={x.id} className="p-3.5 text-sm"><StatusBadge status={x.status} label={status(x.status)} /><p className="mt-1 text-muted">{x.reason}</p>{x.resolution && <p className="mt-1">{x.resolution}</p>}</li>)}</ul>
        </section>
      )}
    </>
  );
}
