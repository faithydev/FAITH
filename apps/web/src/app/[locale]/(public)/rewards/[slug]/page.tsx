import { ruleText } from '@/components/rewards/campaign-card';
import { RewardProgress } from '@/components/rewards/reward-progress';
import { AutoForm } from '@/components/ui/client';
import { Badge, Breadcrumbs, Card, LinkButton, SectionTitle, SimulatedNotice } from '@/components/ui/primitives';
import { api, getMe, publicApi } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { date } from '@/lib/format';
import type { CampaignDetail } from '@/lib/types';
import { BadgeCheck } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, locale, me] = await Promise.all([params, getTranslations(), getLocale(), getMe()]);
  const c = await (me ? api<CampaignDetail>(`/rewards/campaigns/${slug}`) : publicApi<CampaignDetail>(`/rewards/campaigns/${slug}`, 15)).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const lines = await Promise.all(c.rules.map((r) => ruleText(r, c.currency)));
  const isCreator = me?.permissions.includes('campaign.participate');
  const canSubmit = !c.requiresApplication || c.application?.status === 'APPROVED';
  const rights: [string, string | null][] = [
    [t('rewards.usageRights'), c.usageRights], [t('rewards.creatorPermissions'), c.creatorPermissions], [t('rewards.attribution'), c.attribution],
    [t('rewards.adDisclosure'), c.adDisclosure], [t('rewards.licenseDays'), c.licenseDays ? String(c.licenseDays) : null], [t('rewards.territory'), c.territory], [t('rewards.prohibited'), c.prohibitedContent],
  ];
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('rewards.title'), href: '/rewards' }, { label: c.title }]} />
      <div className="grid gap-8 lg:grid-cols-[1fr_23rem] lg:items-start">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm text-muted">{c.org.name}{c.org.verifiedAt && <BadgeCheck size={15} className="text-accent" aria-label={t('common.verified')} />}</p>
          <h1 className="tracking-display mt-1 text-3xl font-semibold sm:text-4xl">{c.title}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5"><Badge>{t(`rewards.types.${c.type}`)}</Badge>{c.platforms.map((p) => <Badge key={p}>{t(`rewards.platforms.${p}`)}</Badge>)}</div>
          <p className="mt-5 leading-relaxed text-muted">{c.description}</p>
          <section className="mt-8"><SectionTitle title={t('rewards.guidelines')} /><p className="text-sm text-muted">{c.guidelines}</p></section>
          {c.requirements.length > 0 && (
            <section className="mt-8">
              <SectionTitle title={t('rewards.requirements')} />
              <ul className="list-inside list-disc space-y-1 text-sm text-muted">{c.requirements.map((r) => <li key={r.id}>{r.label}</li>)}</ul>
            </section>
          )}
          <section className="mt-8">
            <SectionTitle title={t('rewards.rights')} />
            <dl className="card divide-y divide-line">
              {rights.flatMap(([k, v]) => (v ? [<div key={k} className="grid gap-1 p-3.5 text-sm sm:grid-cols-[11rem_1fr]"><dt className="text-subtle">{k}</dt><dd>{v}</dd></div>] : []))}
            </dl>
          </section>
          <section className="mt-8">
            <SectionTitle title={t('rewards.verificationTitle')} />
            <ul className="space-y-2">
              {c.verification.map((v) => (
                <li key={v.platform} className="card p-3.5 text-sm">
                  <p className="font-medium">{t(`rewards.platforms.${v.platform}`)}: {t(`rewards.verification.${v.availability}`)}</p>
                  <p className="mt-0.5 text-xs text-muted">{t(`rewards.verificationNote.${v.availability}`)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-5">
            <SectionTitle title={t('rewards.rewardsTitle')} />
            <ul className="space-y-1 text-[0.95rem] font-medium">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
            <div className="mt-4"><RewardProgress accruedMinor={c.accruedMinor} fundedMinor={c.fundedMinor} currency={c.currency} label={t('rewards.budgetUsed')} /></div>
            <p className="mt-3 text-sm text-muted">{t('rewards.closes', { date: date(c.submissionDeadline, locale) })}</p>
          </Card>
          <Card className="p-5">
            {!me ? (
              <>
                <p className="mb-3 text-sm text-muted">{t('rewards.loginPrompt')}</p>
                <LinkButton href={`/login?next=/rewards/${c.slug}`} className="w-full">{t('nav.login')}</LinkButton>
              </>
            ) : !isCreator ? (
              <>
                <p className="mb-3 text-sm text-muted">{t('rewards.needCreatorRole')}</p>
                <LinkButton href="/app/settings#roles" variant="secondary" className="w-full">{t('nav.addRole')}</LinkButton>
              </>
            ) : c.requiresApplication && !c.application ? (
              <>
                <SectionTitle title={t('rewards.apply')} />
                <AutoForm endpoint={`/rewards/campaigns/${c.slug}/apply`} submitLabel={t('rewards.apply')} success={t('rewards.applied')} fields={[{ name: 'pitch', label: t('rewards.pitch'), type: 'textarea', required: true, minLength: 10 }]} />
              </>
            ) : !canSubmit ? (
              <p className="text-sm text-muted">{t('rewards.applicationPending')}</p>
            ) : (
              <>
                <SectionTitle title={t('rewards.submit')} />
                <AutoForm
                  endpoint={`/rewards/campaigns/${c.slug}/submissions`} submitLabel={t('rewards.submit')} success={t('rewards.submitted')} redirectTo="/app/creator/submissions" extra={{ evidenceKeys: [] }}
                  fields={[
                    { name: 'platform', label: t('app.brand.platforms'), type: 'select', required: true, defaultValue: c.platforms[0], options: c.platforms.map((p) => ({ value: p, label: t(`rewards.platforms.${p}`) })) },
                    { name: 'url', label: t('rewards.contentUrl'), type: 'url', required: true, placeholder: 'https://' },
                    { name: 'note', label: t('rewards.note'), type: 'textarea', rows: 2 },
                    { name: 'acceptedTerms', label: t('rewards.acceptTerms'), type: 'checkbox', required: true },
                  ]}
                />
              </>
            )}
          </Card>
          <SimulatedNotice>{t('rewards.notFraudProof')}</SimulatedNotice>
        </aside>
      </div>
    </div>
  );
}
