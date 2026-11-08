import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import { notFound } from 'next/navigation';

type Course = { id: string; slug: string; title: string; summary: string; status: string; sections: { id: string; title: string; lessons: { id: string; title: string; isPreview: boolean }[] }[] };

export default async function CourseEditor({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, status }] = await Promise.all([params, pageContext()]);
  const course = (await api<Course[]>('/creator/courses')).find((c) => c.id === id);
  if (!course) notFound();
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
                {s.lessons.map((l) => <li key={l.id} className="flex items-center justify-between gap-2 py-2">{l.title}{l.isPreview && <Badge tone="accent">{t('app.creator.previewBadge')}</Badge>}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
