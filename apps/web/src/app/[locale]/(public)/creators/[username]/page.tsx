import { Badge, Card, SectionTitle } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { publicApi, tryPublicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type View = {
  displayName: string; username: string; bio: string | null; country: string | null;
  creator: { headline: string; niches: string[] };
  courses: { slug: string; title: string; summary: string }[];
  communities: { slug: string; name: string; description: string }[];
  stores: { slug: string; name: string; tagline: string | null }[];
};
type Trust = { verifiedSales: number; verifiedPurchases: number; reviewsReceived: number; averageRating: number | null; verifications: { kind: string }[]; confirmedViolations: number };

export default async function CreatorPage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, t] = await Promise.all([params, getTranslations()]);
  const c = await publicApi<View>(`/creators/${username}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const trust = await tryPublicApi<Trust>(`/trust/${username}`);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="tracking-display text-4xl font-semibold">{c.displayName}</h1>
      <p className="mt-1.5 text-lg text-muted">{c.creator.headline}</p>
      {c.bio && <p className="mt-3 max-w-2xl text-sm text-muted">{c.bio}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">{c.creator.niches.map((n) => <Badge key={n}>{n}</Badge>)}</div>
      {trust && (
        <section className="mt-8">
          <SectionTitle title={t('creators.trust')} />
          <Card className="p-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-subtle">{t('creators.verifiedSales')}</dt><dd className="font-semibold">{trust.verifiedSales}</dd></div>
              <div><dt className="text-subtle">{t('creators.reviews')}</dt><dd className="font-semibold">{trust.reviewsReceived}{trust.averageRating ? ` · ${trust.averageRating.toFixed(1)}` : ''}</dd></div>
              <div><dt className="text-subtle">{t('creators.violations')}</dt><dd className="font-semibold">{trust.confirmedViolations}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-subtle">{t('creators.trustNote')}</p>
          </Card>
        </section>
      )}
      {c.courses.length > 0 && (
        <section className="mt-8">
          <SectionTitle title={t('courses.title')} />
          <div className="grid gap-3 sm:grid-cols-2">{c.courses.map((x) => <Link key={x.slug} href={`/courses/${x.slug}`} className="card hover-depth p-4"><p className="font-medium">{x.title}</p><p className="mt-1 text-sm text-muted">{x.summary}</p></Link>)}</div>
        </section>
      )}
      {c.stores.length > 0 && (
        <section className="mt-8">
          <SectionTitle title={t('nav.items.store')} />
          <div className="grid gap-3 sm:grid-cols-2">{c.stores.map((x) => <Link key={x.slug} href={`/stores/${x.slug}`} className="card hover-depth p-4"><p className="font-medium">{x.name}</p><p className="mt-1 text-sm text-muted">{x.tagline}</p></Link>)}</div>
        </section>
      )}
      {c.communities.length > 0 && (
        <section className="mt-8">
          <SectionTitle title={t('communities.title')} />
          <div className="grid gap-3 sm:grid-cols-2">{c.communities.map((x) => <Link key={x.slug} href={`/communities/${x.slug}`} className="card hover-depth p-4"><p className="font-medium">{x.name}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{x.description}</p></Link>)}</div>
        </section>
      )}
    </div>
  );
}
