import { IntlScope } from '@/components/auth/scope';
import { PostComposer } from '@/components/communities/post-composer';
import { ProtectedVideo } from '@/components/courses/protected-video';
import { ActionButton, AutoForm } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, EmptyState, LinkButton } from '@/components/ui/primitives';
import { api, getMe, publicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { date } from '@/lib/format';
import { Lock } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Author = { profile: { displayName: string } | null };
type View = {
  slug: string; name: string; description: string; visibility: string; canRead: boolean;
  member: { status: string; role: string } | null;
  product: { slug: string } | null;
  _count: { members: number };
  posts: { id: string; title: string; body: string; createdAt: string; hasVideo: boolean; author: Author; comments: { id: string; body: string; author: Author }[] }[];
};

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, locale, me] = await Promise.all([params, getTranslations(), getLocale(), getMe()]);
  const c = await (me ? api<View>(`/communities/${slug}`) : publicApi<View>(`/communities/${slug}`, 15)).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const member = c.member?.status === 'ACTIVE';
  const viewer = me ? `${me.email} · ${me.id.slice(-6)}` : t('courses.video.guest');
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('communities.title'), href: '/communities' }, { label: c.name }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="tracking-display text-3xl font-semibold">{c.name}</h1>
          <p className="mt-1.5 text-muted">{c.description}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-subtle"><Badge>{t(`communities.${c.visibility}`)}</Badge>{t('communities.memberCount', { count: c._count.members })}</p>
        </div>
        <div className="flex gap-2">
          {member && <IntlScope ns={['communities']}><PostComposer slug={c.slug} canVideo={c.member?.role !== 'MEMBER'} /></IntlScope>}
          {!member && me && c.visibility === 'PUBLIC' && <ActionButton endpoint={`/communities/${c.slug}/join`} label={t('communities.join')} variant="primary" size="md" />}
          {!me && <LinkButton href={`/login?next=/communities/${c.slug}`}>{t('communities.join')}</LinkButton>}
        </div>
      </div>
      <div className="mt-8">
        {!c.canRead ? (
          <EmptyState
            icon={<Lock size={20} strokeWidth={1.5} />} title={t('communities.privateTitle')} description={t('communities.privateBody')}
            action={c.product && <LinkButton href={`/marketplace/${c.product.slug}`}>{t('communities.getAccess')}</LinkButton>}
          />
        ) : c.posts.length === 0 ? <EmptyState title={t('communities.noPosts')} /> : (
          <div className="space-y-3">
            {c.posts.map((p) => (
              <Card key={p.id} className="p-5">
                <p className="text-xs text-subtle">{p.author.profile?.displayName} · {date(p.createdAt, locale)}</p>
                <h2 className="mt-1 font-sans font-semibold">{p.title}</h2>
                <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted">{p.body}</p>
                {p.hasVideo && (
                  <IntlScope ns={['courses', 'protect']}>
                    {/* A private (VIP) community's video is paid content and fully protected. */}
                    <ProtectedVideo src={`/api/v1/posts/${p.id}/stream`} contentId={p.id} viewer={viewer} protect={c.visibility === 'PRIVATE'} />
                  </IntlScope>
                )}
                {p.comments.length > 0 && <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">{p.comments.map((x) => <li key={x.id}><span className="font-medium">{x.author.profile?.displayName}</span> <span className="text-muted">{x.body}</span></li>)}</ul>}
                {member && <div className="mt-3"><AutoForm endpoint={`/posts/${p.id}/comments`} resetOnSuccess submitLabel={t('communities.comment')} fields={[{ name: 'body', label: t('communities.yourComment'), required: true }]} /></div>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
