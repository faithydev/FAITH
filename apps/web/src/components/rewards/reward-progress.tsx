import { money } from '@/lib/format';
import { getLocale } from 'next-intl/server';

export async function RewardProgress({ accruedMinor, fundedMinor, currency, label }: { accruedMinor: string; fundedMinor: string; currency: string; label: string }) {
  const locale = await getLocale();
  const funded = BigInt(fundedMinor);
  const pct = funded === 0n ? 0 : Number((BigInt(accruedMinor) * 1000n) / funded) / 10;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{money(accruedMinor, currency, locale)} / {money(fundedMinor, currency, locale)}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
