import { Badge, Button, EmptyState, fieldClass, Pagination } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { publicApi } from '@/lib/api';
import { money } from '@/lib/format';
import type { Job, Paged } from '@/lib/types';
import { getLocale, getTranslations } from 'next-intl/server';

type Search = { q?: string; workplace?: string; employmentType?: string; experience?: string; page?: string };

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('jobs.title') };
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [t, locale, s] = await Promise.all([getTranslations(), getLocale(), searchParams]);
  const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v));
  const jobs = await publicApi<Paged<Job>>(`/jobs?${new URLSearchParams({ pageSize: '25', ...clean })}`);
  const select = 'rounded-md border border-line-strong bg-surface px-2.5 py-2 text-sm';
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="tracking-display text-4xl font-semibold">{t('jobs.title')}</h1>
      <p className="mt-2 mb-8 text-muted">{t('jobs.body')}</p>
      <form role="search" className="mb-6 flex flex-wrap items-center gap-2">
        <input type="search" name="q" aria-label={t('nav.search')} defaultValue={s.q} placeholder={t('jobs.search')} className={`${fieldClass.input} min-w-48 flex-1`} />
        <select name="workplace" aria-label={t('jobs.workplaceLabel')} defaultValue={s.workplace ?? ''} className={select}>
          <option value="">{t('jobs.anyWorkplace')}</option>
          {['REMOTE', 'ONSITE', 'HYBRID'].map((v) => <option key={v} value={v}>{t(`jobs.workplace.${v}`)}</option>)}
        </select>
        <select name="experience" aria-label={t('jobs.experienceLabel')} defaultValue={s.experience ?? ''} className={select}>
          <option value="">{t('jobs.anyExperience')}</option>
          {['ENTRY', 'MID', 'SENIOR', 'LEAD'].map((v) => <option key={v} value={v}>{t(`jobs.experience.${v}`)}</option>)}
        </select>
        <Button type="submit">{t('common.apply')}</Button>
      </form>
      {jobs.items.length === 0 ? <EmptyState title={t('jobs.empty')} /> : (
        <ul className="space-y-2.5">
          {jobs.items.map((j) => (
            <li key={j.id}>
              <Link href={`/jobs/${j.slug}`} className="card hover-depth flex flex-wrap items-center justify-between gap-3 p-4" data-testid="job-card">
                <span className="min-w-0">
                  <span className="block font-semibold">{j.title}</span>
                  <span className="text-sm text-muted">{j.org.name}{j.location ? ` · ${j.location}` : ''}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge>{t(`jobs.workplace.${j.workplace}`)}</Badge>
                  <Badge>{t(`jobs.types.${j.employmentType}`)}</Badge>
                  {j.salaryMinMinor && j.salaryMaxMinor && <span className="ms-1 text-sm font-medium tabular-nums">{money(j.salaryMinMinor, j.currency, locale)} – {money(j.salaryMaxMinor, j.currency, locale)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={jobs.page} pages={jobs.pages} hrefFor={(p) => `/jobs?${new URLSearchParams({ ...clean, page: String(p) })}`} labels={{ previous: t('common.previous'), next: t('common.next'), page: t('common.pagination') }} />
    </div>
  );
}
