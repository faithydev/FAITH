import { ActionButton, AutoForm } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, LinkButton, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api, getMe, publicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { money } from '@/lib/format';
import type { Job } from '@/lib/types';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Detail = Job & { description: string; application: { status: string } | null; saved: boolean; languages: string[]; org: Job['org'] & { about: string | null; website: string | null } };

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, locale, me] = await Promise.all([params, getTranslations(), getLocale(), getMe()]);
  const j = await (me ? api<Detail>(`/jobs/${slug}`) : publicApi<Detail>(`/jobs/${slug}`, 30)).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const statusLabel = (s: string) => (t.has(`status.${s}`) ? t(`status.${s}`) : s);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('jobs.title'), href: '/jobs' }, { label: j.title }]} />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="min-w-0">
          <p className="text-sm text-muted">{j.org.name}</p>
          <h1 className="tracking-display mt-1 text-3xl font-semibold">{j.title}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{t(`jobs.workplace.${j.workplace}`)}</Badge><Badge>{t(`jobs.types.${j.employmentType}`)}</Badge><Badge>{t(`jobs.experience.${j.experience}`)}</Badge>
          </div>
          <p className="mt-6 leading-relaxed whitespace-pre-wrap text-muted">{j.description}</p>
          {j.skills.length > 0 && <section className="mt-8"><SectionTitle title={t('jobs.skills')} /><div className="flex flex-wrap gap-1.5">{j.skills.map((s) => <Badge key={s}>{s}</Badge>)}</div></section>}
          {j.org.about && <section className="mt-8"><SectionTitle title={t('jobs.aboutCompany')} /><p className="text-sm text-muted">{j.org.about}</p></section>}
        </div>
        <aside className="lg:sticky lg:top-20">
          <Card className="p-5">
            {j.salaryMinMinor && j.salaryMaxMinor && <p className="mb-3 font-display text-lg font-semibold tabular-nums">{money(j.salaryMinMinor, j.currency, locale)} – {money(j.salaryMaxMinor, j.currency, locale)}</p>}
            {!me ? (
              <LinkButton href={`/login?next=/jobs/${j.slug}`} className="w-full">{t('jobs.loginToApply')}</LinkButton>
            ) : j.application ? (
              <p className="flex items-center justify-between gap-2 text-sm"><span>{t('jobs.applied')}</span><StatusBadge status={j.application.status} label={statusLabel(j.application.status)} /></p>
            ) : me.permissions.includes('job.apply') ? (
              <AutoForm endpoint={`/jobs/${j.slug}/apply`} submitLabel={t('jobs.apply')} success={t('jobs.applied')} fields={[{ name: 'coverLetter', label: t('jobs.coverLetter'), type: 'textarea', rows: 6, required: true, minLength: 10 }]} />
            ) : <ActionButton endpoint="/me/roles" body={{ persona: 'job' }} label={t('jobs.enableApply')} variant="primary" size="md" />}
            {me && !j.application && <div className="mt-3"><ActionButton endpoint={`/work/saved/${j.id}`} method={j.saved ? 'DELETE' : 'PUT'} label={j.saved ? t('jobs.unsave') : t('jobs.save')} /></div>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
