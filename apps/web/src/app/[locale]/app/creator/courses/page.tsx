import { NoRole } from '@/components/seller/shared';
import { FormDialog } from '@/components/ui/client';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Course = { id: string; slug: string; title: string; status: string; sections: { lessons: unknown[] }[]; _count: { enrollments: number } };

export default async function CreatorCoursesPage() {
  const { t, status, me } = await pageContext();
  if (!me.permissions.includes('course.manage')) return <NoRole persona="create" />;
  const courses = await api<Course[]>('/creator/courses');
  const create = (
    <FormDialog
      trigger={t('app.creator.newCourse')} title={t('app.creator.newCourse')} endpoint="/creator/courses" submitLabel={t('common.create')} redirectTo="/app/creator/courses/{id}"
      fields={[
        { name: 'title', label: t('app.seller.productTitle'), required: true },
        { name: 'summary', label: t('app.seller.summary'), type: 'textarea', rows: 2, required: true },
        { name: 'level', label: t('app.creator.level'), type: 'select', required: true, defaultValue: 'beginner', options: ['beginner', 'intermediate', 'advanced'].map((l) => ({ value: l, label: t(`courses.levels.${l}`) })) },
      ]}
    />
  );
  return (
    <>
      <PageHeader title={t('nav.items.courses')} description={t('app.creator.coursesBody')} actions={create} />
      {courses.length === 0 ? <EmptyState title={t('app.creator.noCourses')} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => (
            <Link key={c.id} href={`/app/creator/courses/${c.id}`} className="card hover-depth p-5">
              <div className="flex items-start justify-between gap-2"><p className="font-medium">{c.title}</p><StatusBadge status={c.status} label={status(c.status)} /></div>
              <p className="mt-2 text-sm text-muted">{t('app.creator.courseStats', { lessons: c.sections.reduce((n, s) => n + s.lessons.length, 0), students: c._count.enrollments })}</p>
            </Link>
          ))}
        </div>
      )}
      <Card className="mt-6 p-5 text-sm text-muted">{t('app.creator.streamingNote')}</Card>
    </>
  );
}
