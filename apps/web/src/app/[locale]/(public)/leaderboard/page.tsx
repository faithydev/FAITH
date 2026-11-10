import { EmptyState, LinkButton, cx } from '@/components/ui/primitives';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { Link } from '@/i18n/navigation';
import { publicApi } from '@/lib/api';
import { fileUrl, number } from '@/lib/format';
import { Trophy } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';

type Row = { rank: number; slug: string; name: string; tagline: string | null; logoKey: string | null; country: string | null; badge: string | null; products: number; sales: number };
const PERIODS = ['week', 'month', 'all'] as const;

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('leaderboard.title') };
}

/** Stores ranked by real paid orders. Nothing here is simulated or sponsored. */
export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [{ period: raw }, t, locale] = await Promise.all([searchParams, getTranslations(), getLocale()]);
  const period = PERIODS.find((p) => p === raw) ?? 'month';
  const rows = await publicApi<Row[]>(`/marketplace/leaderboard?period=${period}`, 60);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="mb-3 inline-flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.16em] text-neon uppercase"><Trophy size={14} />{t('leaderboard.eyebrow')}</p>
      <h1 className="tracking-display text-4xl font-semibold sm:text-5xl">{t('leaderboard.title')}</h1>
      <p className="mt-3 max-w-xl text-muted">{t('leaderboard.body')}</p>

      <nav aria-label={t('leaderboard.period')} className="mt-7 mb-6 inline-flex rounded-full border border-line bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-1 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p} href={`/leaderboard?period=${p}`} aria-current={p === period ? 'page' : undefined}
            className={cx('rounded-full px-4 py-1.5 transition-colors', p === period ? 'bg-neon font-medium text-black' : 'text-muted hover:text-ink')}
          >{t(`leaderboard.periods.${p}`)}</Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title={t('leaderboard.emptyTitle')} description={t('leaderboard.emptyBody')} action={<LinkButton href="/pricing" variant="primary" size="md" arrow>{t('leaderboard.emptyCta')}</LinkButton>} />
      ) : (
        <ol className="space-y-2.5" data-testid="leaderboard">
          {rows.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/stores/${r.slug}`}
                className={cx(
                  'glass lift flex items-center gap-4 rounded-2xl p-3.5 sm:p-4',
                  r.rank <= 3 && 'border-[color-mix(in_srgb,var(--neon)_38%,transparent)] shadow-[0_0_32px_-14px_var(--neon)]',
                )}
              >
                <span className={cx('grid size-10 shrink-0 place-items-center rounded-full font-display text-lg font-semibold tabular-nums', r.rank <= 3 ? 'bg-neon text-black' : 'bg-surface-2 text-muted')}>{r.rank}</span>
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  {r.logoKey
                    ? <Image src={fileUrl(r.logoKey)} alt="" fill unoptimized className="object-cover" />
                    : <span className="grid h-full place-items-center font-display text-lg font-semibold text-subtle">{r.name.slice(0, 1).toUpperCase()}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium"><span className="truncate">{r.name}</span>{r.badge && <VerifiedBadge kind={r.badge} label={`${t('badges.verified')} · ${t(`badges.kinds.${r.badge}`)}`} size={18} />}</span>
                  {r.tagline && <span className="block truncate text-sm text-muted">{r.tagline}</span>}
                </span>
                <span className="shrink-0 text-end">
                  <span className="block font-display text-xl font-semibold tabular-nums">{number(r.sales, locale)}</span>
                  <span className="block text-xs text-subtle">{t('leaderboard.sales')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-xs text-subtle">{t('leaderboard.note')}</p>
    </div>
  );
}
