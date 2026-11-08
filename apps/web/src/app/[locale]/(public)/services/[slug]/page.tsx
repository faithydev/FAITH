import { FormDialog } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, LinkButton, SectionTitle, SimulatedNotice } from '@/components/ui/primitives';
import { getMe, publicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { money } from '@/lib/format';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Detail = {
  id: string; slug: string; title: string; summary: string; description: string; currency: string; tags: string[];
  packages: { id: string; name: string; description: string; priceMinor: string; deliveryDays: number; revisions: number }[];
  freelancer: { id: string; profile: { displayName: string } | null; freelancerProfile: { headline: string; bio: string | null } | null };
};

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, locale, me] = await Promise.all([params, getTranslations(), getLocale(), getMe()]);
  const s = await publicApi<Detail>(`/services/${slug}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('services.title'), href: '/services' }, { label: s.title }]} />
      <h1 className="tracking-display text-3xl font-semibold">{s.title}</h1>
      <p className="mt-2 text-muted">{s.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{s.tags.map((x) => <Badge key={x}>{x}</Badge>)}</div>
      <p className="mt-6 leading-relaxed text-muted">{s.description}</p>
      <section className="mt-8">
        <SectionTitle title={t('services.packages')} />
        <div className="grid gap-3 sm:grid-cols-2">
          {s.packages.map((p) => (
            <Card key={p.id} className="flex flex-col p-5">
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{money(p.priceMinor, s.currency, locale)}</p>
              <p className="mt-2 text-sm text-muted">{p.description}</p>
              <p className="mt-2 text-xs text-subtle">{t('services.delivery', { days: p.deliveryDays, revisions: p.revisions })}</p>
              <div className="mt-auto pt-4">
                {me ? (
                  me.id !== s.freelancer.id && (
                    <FormDialog
                      trigger={t('services.request')} title={t('services.request')} description={t('services.requestBody')} triggerSize="md"
                      endpoint={`/services/${s.slug}/projects`} extra={{ packageId: p.id }} submitLabel={t('services.request')} redirectTo="/app/freelance/projects/{id}"
                      fields={[{ name: 'requirements', label: t('app.freelance.requirements'), type: 'textarea', required: true, minLength: 10 }]}
                    />
                  )
                ) : <LinkButton href={`/login?next=/services/${s.slug}`} variant="secondary">{t('nav.login')}</LinkButton>}
              </div>
            </Card>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <SectionTitle title={t('services.about')} />
        <p className="font-medium">{s.freelancer.profile?.displayName}</p>
        <p className="text-sm text-muted">{s.freelancer.freelancerProfile?.headline}</p>
        {s.freelancer.freelancerProfile?.bio && <p className="mt-1 text-sm text-muted">{s.freelancer.freelancerProfile.bio}</p>}
      </section>
      <div className="mt-8"><SimulatedNotice>{t('app.freelance.noEscrow')}</SimulatedNotice></div>
    </div>
  );
}
