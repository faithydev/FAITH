import { ActionButton } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, LinkButton, SectionTitle, cx } from '@/components/ui/primitives';
import { api, getMe, publicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { money } from '@/lib/format';
import { CheckCircle2, Lock } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Lesson = { id: string; title: string; durationSec: number | null; isPreview: boolean; completed: boolean; locked: boolean; body: string | null };
type Course = {
  slug: string; title: string; summary: string; level: string; access: boolean; enrolled: boolean; completedAt: string | null;
  creator: { profile: { displayName: string } | null };
  product: { slug: string; priceFromMinor: string; currency: string } | null;
  sections: { id: string; title: string; lessons: Lesson[] }[];
};

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, locale, me] = await Promise.all([params, getTranslations(), getLocale(), getMe()]);
  const c = await (me ? api<Course>(`/courses/${slug}`) : publicApi<Course>(`/courses/${slug}`, 30)).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const lessons = c.sections.flatMap((s) => s.lessons);
  const done = lessons.filter((l) => l.completed).length;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('courses.title'), href: '/courses' }, { label: c.title }]} />
      <p className="text-sm text-muted">{c.creator.profile?.displayName}</p>
      <h1 className="tracking-display mt-1 text-3xl font-semibold sm:text-4xl">{c.title}</h1>
      <p className="mt-2 text-muted">{c.summary}</p>
      <div className="mt-3 flex items-center gap-2"><Badge>{t(`courses.levels.${c.level}`)}</Badge>{c.completedAt && <Badge tone="positive">{t('courses.completed')}</Badge>}</div>
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
        {c.access ? (
          <p className="text-sm" data-testid="course-progress">{t('courses.progress', { done, total: lessons.length })}</p>
        ) : c.product ? (
          <>
            <span className="font-display text-xl font-semibold tabular-nums">{money(c.product.priceFromMinor, c.product.currency, locale)}</span>
            <LinkButton href={`/marketplace/${c.product.slug}`}>{t('courses.buy')}</LinkButton>
          </>
        ) : me ? (
          <ActionButton endpoint={`/courses/${c.slug}/enroll`} label={t('courses.enroll')} variant="primary" size="md" />
        ) : <LinkButton href={`/login?next=/courses/${c.slug}`}>{t('courses.enroll')}</LinkButton>}
      </Card>
      <div className="mt-8 space-y-6">
        {c.sections.map((s) => (
          <section key={s.id}>
            <SectionTitle title={s.title} />
            <ul className="card divide-y divide-line">
              {s.lessons.map((l) => (
                <li key={l.id} className="p-4">
                  <details open={!l.locked && !l.completed}>
                    <summary className={cx('flex cursor-pointer items-center gap-2 text-sm font-medium', l.locked && 'cursor-default text-muted')}>
                      {l.completed ? <CheckCircle2 size={16} className="text-positive" /> : l.locked ? <Lock size={14} /> : null}
                      <span className="flex-1">{l.title}</span>
                      {l.isPreview && <Badge tone="accent">{t('app.creator.previewBadge')}</Badge>}
                    </summary>
                    {l.body && <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted">{l.body}</p>}
                    {!l.locked && c.access && !l.completed && me && <div className="mt-3"><ActionButton endpoint={`/lessons/${l.id}/complete`} label={t('courses.markDone')} /></div>}
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
