import { AutoForm } from '@/components/ui/client';
import { Breadcrumbs, PageHeader, cx } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { date } from '@/lib/format';
import { pageContext } from '@/lib/page';
import { notFound } from 'next/navigation';

type Thread = { id: string; subject: string; messages: { id: string; body: string; createdAt: string; senderId: string; sender: { profile: { displayName: string } | null } }[] };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, me, locale }] = await Promise.all([params, pageContext()]);
  const thread = await api<Thread>(`/conversations/${id}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('app.messages.title'), href: '/app/messages' }, { label: thread.subject }]} />
      <PageHeader title={thread.subject} />
      <ol className="mb-6 space-y-2.5">
        {thread.messages.map((msg) => {
          const mine = msg.senderId === me.id;
          return (
            <li key={msg.id} className={cx('max-w-[85%] rounded-lg p-3 text-sm sm:max-w-[70%]', mine ? 'ms-auto bg-primary text-on-primary' : 'bg-surface-2')}>
              <p className={cx('mb-0.5 text-xs', mine ? 'opacity-70' : 'text-muted')}>{msg.sender.profile?.displayName} · {date(msg.createdAt, locale)}</p>
              <p className="whitespace-pre-wrap">{msg.body}</p>
            </li>
          );
        })}
      </ol>
      <AutoForm endpoint={`/conversations/${id}/messages`} resetOnSuccess submitLabel={t('app.messages.send')} fields={[{ name: 'body', label: t('app.messages.reply'), type: 'textarea', rows: 3, required: true }]} />
    </>
  );
}
