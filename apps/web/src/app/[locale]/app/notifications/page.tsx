import { ActionButton } from '@/components/ui/client';
import { EmptyState, PageHeader, cx } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { NotificationRow } from '@/lib/types';

export default async function NotificationsPage() {
  const { t, d, m } = await pageContext();
  const rows = await api<NotificationRow[]>('/notifications');
  const message = (n: NotificationRow) => {
    const key = `app.notifications.kinds.${n.kind.replace('.', '_')}`;
    const amount = n.params.amountMinor && n.params.currency ? m(n.params.amountMinor, n.params.currency) : n.params.totalMinor && n.params.currency ? m(n.params.totalMinor, n.params.currency) : '';
    return t.has(key) ? t(key, { title: n.params.title ?? '', number: n.params.number ?? '', amount }) : n.kind;
  };
  return (
    <>
      <PageHeader title={t('app.notifications.title')} actions={rows.some((n) => !n.readAt) && <ActionButton endpoint="/notifications/read-all" label={t('app.notifications.markAll')} />} />
      {rows.length === 0 ? <EmptyState title={t('app.notifications.emptyTitle')} /> : (
        <ul className="card divide-y divide-line">
          {rows.map((n) => (
            <li key={n.id} className={cx('flex items-start gap-3 p-3.5 text-sm', !n.readAt && 'bg-surface-2/40')}>
              <span aria-hidden className={cx('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent')} />
              <span className="min-w-0 flex-1">
                {n.href ? <Link href={n.href} className="hover:underline">{message(n)}</Link> : message(n)}
                <span className="mt-0.5 block text-xs text-subtle">{d(n.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
