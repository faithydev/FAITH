import { RewardProgress } from '@/components/rewards/reward-progress';
import { Badge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { date, money } from '@/lib/format';
import type { Campaign, RewardRule } from '@/lib/types';
import { getLocale, getTranslations } from 'next-intl/server';

/** One line stating what a rule pays, for example "$1.50 per 1,000 views". */
export async function ruleText(r: RewardRule, currency: string) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const rate = money(r.rateMinor, currency, locale);
  return r.metric === 'APPROVED_SUBMISSION'
    ? t('rewards.rulePerSubmission', { rate })
    : Number(r.unitSize) === 1
      ? t('rewards.rulePerOne', { rate, metric: t(`rewards.unitMetricsOne.${r.metric}`) })
      : t('rewards.rulePerUnit', { rate, unit: Number(r.unitSize).toLocaleString(locale), metric: t(`rewards.unitMetrics.${r.metric}`) });
}

export async function CampaignCard({ c }: { c: Campaign }) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const lines = await Promise.all(c.rules.map((r) => ruleText(r, c.currency)));
  return (
    <Link href={`/rewards/${c.slug}`} className="card hover-depth flex flex-col p-5" data-testid="campaign-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-subtle">{c.org.name}</p>
        <Badge>{t(`rewards.types.${c.type}`)}</Badge>
      </div>
      <h3 className="mt-2 font-sans text-[1.05rem] font-semibold">{c.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{c.summary}</p>
      <ul className="mt-3 space-y-0.5 text-sm">{lines.map((l) => <li key={l} className="font-medium">{l}</li>)}</ul>
      <div className="mt-auto pt-4">
        <RewardProgress accruedMinor={c.accruedMinor} fundedMinor={c.fundedMinor} currency={c.currency} label={t('rewards.budgetUsed')} />
        <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-subtle">
          <span>{c.platforms.map((p) => t(`rewards.platforms.${p}`)).join(' · ')}</span>
          <span>{t('rewards.closes', { date: date(c.submissionDeadline, locale) })}</span>
        </p>
      </div>
    </Link>
  );
}
