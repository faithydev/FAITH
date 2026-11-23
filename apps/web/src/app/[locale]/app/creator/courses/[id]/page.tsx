import { LessonVideoUpload } from '@/components/courses/lesson-video';
import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import { notFound } from 'next/navigation';

type EditorLesson = { id: string; title: string; isPreview: boolean; videoKey: string | null; drmVideoId: string | null; drmVideo: { status: string } | null };
type Course = { id: string; slug: string; title: string; summary: string; status: string; sections: { id: string; title: string; lessons: EditorLesson[] }[] };

export default async function CourseEditor({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, status }] = await Promise.all([params, pageContext()]);
  const [courses, drm] = await Promise.all([api<Course[]>('/creator/courses'), api<{ enabled: boolean }>('/drm/config').catch(() => ({ enabled: false }))]);
  const course = courses.find((c) => c.id === id);
  if (!course) notFound();
  // Videos the provider is still encrypting: ask once per page view how far it got.
  const pending = course.sections.flatMap((s) => s.lessons).filter((l) => l.drmVideoId && l.drmVideo?.status !== 'ready');
  const fresh = new Map(await Promise.all(pending.map(async (l) => {
    const v = await api<{ status: string }>(`/drm/videos/${l.drmVideoId}`).catch(() => null);
    return [l.id, v?.status ?? l.drmVideo?.status ?? 'processing'] as const;
  })));
  const published = course.status === 'PUBLISHED';
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('nav.items.courses'), href: '/app/creator/courses' }, { label: course.title }]} />
      <PageHeader
        title={course.title} description={course.summary}
        actions={
          <>
            <StatusBadge status={course.status} label={status(course.status)} />
            {published && <LinkButton href={`/courses/${course.slug}`} variant="secondary" size="sm">{t('app.seller.viewListing')}</LinkButton>}
            <ActionButton endpoint={`/creator/courses/${course.id}/published`} body={{ published: !published }} label={published ? t('app.creator.unpublish') : t('app.seller.publish')} variant={published ? 'secondary' : 'primary'} />
            <FormDialog
              trigger={t('app.creator.addSection')} title={t('app.creator.addSection')} triggerVariant="secondary" endpoint={`/creator/courses/${course.id}/sections`} submitLabel={t('common.add')}
              fields={[{ name: 'title', label: t('app.seller.productTitle'), required: true }]}
            />
          </>
        }
      />
      {course.sections.length === 0 ? <EmptyState title={t('app.creator.noSections')} /> : (
        <div className="space-y-3">
          {course.sections.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{s.title}</h2>
                <FormDialog
                  trigger={t('app.creator.addLesson')} title={t('app.creator.addLesson')} triggerVariant="secondary" endpoint={`/creator/sections/${s.id}/lessons`} submitLabel={t('common.add')}
                  fields={[
                    { name: 'title', label: t('app.seller.productTitle'), required: true },
                    { name: 'body', label: t('app.creator.lessonBody'), type: 'textarea', rows: 6 },
                    { name: 'isPreview', label: t('app.creator.preview'), hint: t('app.creator.previewHint'), type: 'checkbox' },
                  ]}
                />
              </div>
              <ul className="mt-2 divide-y divide-line text-sm">
                {s.lessons.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0 flex-1">{l.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {l.isPreview ? <Badge tone="accent">{t('app.creator.previewBadge')}</Badge> : <Badge tone="positive">{t('app.creator.protectedBadge')}</Badge>}
                      {l.videoKey && <Badge tone="positive">{t('app.creator.videoBadge')}</Badge>}
                      {l.drmVideoId && <Badge tone="positive">{t('app.creator.drmBadge')}</Badge>}
                      {l.drmVideoId && (fresh.get(l.id) ?? l.drmVideo?.status) !== 'ready' && (
                        <Badge tone={(fresh.get(l.id) ?? l.drmVideo?.status) === 'failed' ? 'negative' : 'warning'}>
                          {(fresh.get(l.id) ?? l.drmVideo?.status) === 'failed' ? t('app.creator.drmFailed') : t('app.creator.drmProcessing')}
                        </Badge>
                      )}
                      <ActionButton
                        endpoint={`/creator/lessons/${l.id}/access`} method="PUT" body={{ access: l.isPreview ? 'paid' : 'free' }} variant="ghost"
                        label={l.isPreview ? t('app.creator.makePaid') : t('app.creator.makeFree')}
                      />
                      <LessonVideoUpload lessonId={l.id} hasVideo={!!l.videoKey || !!l.drmVideoId} isPreview={l.isPreview} drm={drm.enabled} />
                      {(l.videoKey || l.drmVideoId) && <ActionButton endpoint={`/creator/lessons/${l.id}/video`} method="DELETE" variant="ghost" label={t('app.creator.videoRemove')} />}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
