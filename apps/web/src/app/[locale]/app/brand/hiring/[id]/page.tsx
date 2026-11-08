import { ActionButton } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { pageContext } from '@/lib/page';
import { notFound } from 'next/navigation';

type Row = { id: string; coverLetter: string; status: string; createdAt: string; applicant: { profile: { displayName: string } | null; candidateProfile: { headline: string; skills: string[] } | null } };
const NEXT = ['REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

export default async function JobApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, d, status }] = await Promise.all([params, pageContext()]);
  const rows = await api<Row[]>(`/employer/jobs/${id}/applications`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.hiring'), href: '/app/brand/hiring' }, { label: t('nav.items.applications') }]} />
      <PageHeader title={t('nav.items.applications')} />
      {rows.length === 0 ? <EmptyState title={t('app.hiring.noApplications')} /> : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.applicant.profile?.displayName}</p>
                  {a.applicant.candidateProfile && <p className="text-sm text-muted">{a.applicant.candidateProfile.headline}</p>}
                </div>
                <StatusBadge status={a.status} label={status(a.status)} />
              </div>
              <p className="mt-2 text-sm text-muted">{a.coverLetter}</p>
              {a.applicant.candidateProfile && <div className="mt-2 flex flex-wrap gap-1">{a.applicant.candidateProfile.skills.map((s) => <Badge key={s}>{s}</Badge>)}</div>}
              <p className="mt-2 text-xs text-subtle">{d(a.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {NEXT.filter((n) => n !== a.status).map((n) => <ActionButton key={n} endpoint={`/employer/applications/${a.id}`} method="PATCH" body={{ status: n }} label={status(n)} />)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
