import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Row = { id: string; subject: string; updatedAt: string; unread: boolean; last?: { body: string }; others: { profile: { displayName: string } | null }[] };

export default async function MessagesPage() {
  const { t, d } = await pageContext();
  const rows = await api<Row[]>('/conversations');
  return (
    <>
      <PageHeader title={t('app.messages.title')} />
      {rows.length === 0 ? <EmptyState title={t('app.messages.emptyTitle')} description={t('app.messages.emptyBody')} /> : (
        <ul className="card divide-y divide-line">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/app/messages/${c.id}`} className="flex items-start gap-3 p-4 hover:bg-surface-2/50">
                {c.unread && <span aria-label={t('app.messages.unread')} className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3"><span className="truncate text-sm font-medium">{c.others.map((o) => o.profile?.displayName).join(', ')}</span><span className="shrink-0 text-xs text-subtle">{d(c.updatedAt)}</span></span>
                  <span className="block truncate text-sm">{c.subject}</span>
                  <span className="block truncate text-xs text-muted">{c.last?.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
