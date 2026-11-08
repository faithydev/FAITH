import { FormDialog } from '@/components/ui/client';
import { DataTable, SectionTitle, SimulatedNotice, StatCard, StatusBadge } from '@/components/ui/primitives';
import { pageContext } from '@/lib/page';
import { toMajorString } from '@faith/money';

export type Balance = { key: string; currency: string; balanceMinor: string };
export type Payout = { id: string; amountMinor: string; currency: string; status: string; createdAt: string };

/** Balances and payout requests, shared by seller, creator and developer workspaces. */
export async function PayoutPanel({ balances, payouts }: { balances: Balance[]; payouts: Payout[] }) {
  const { t, m, d, status } = await pageContext();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {balances.length === 0 && <StatCard label={t('app.finance.available')} value="—" />}
        {balances.map((b) => (
          <div key={b.key} className="card p-4 sm:p-5">
            <p className="text-[0.8125rem] text-muted">{t('app.finance.available')} · {b.currency}</p>
            <p className="mt-2 font-display text-[1.6rem] font-semibold tabular-nums">{m(b.balanceMinor, b.currency)}</p>
            {BigInt(b.balanceMinor) > 0n && (
              <div className="mt-3">
                <FormDialog
                  trigger={t('app.finance.requestPayout')} title={t('app.finance.requestPayout')} description={t('app.finance.payoutBody')} triggerVariant="secondary"
                  endpoint="/payouts" extra={{ accountKey: b.key }} idempotent submitLabel={t('app.finance.requestPayout')} success={t('app.finance.payoutRequested')}
                  fields={[{ name: 'amountMinor', label: t('app.finance.amount'), type: 'money', currency: b.currency, required: true, defaultValue: toMajorString(BigInt(b.balanceMinor), b.currency) }]}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4"><SimulatedNotice>{t('app.finance.ledgerNote')}</SimulatedNotice></div>
      <section className="mt-8">
        <SectionTitle title={t('app.finance.payouts')} />
        {payouts.length === 0 ? <p className="text-sm text-muted">{t('app.finance.noPayouts')}</p> : (
          <DataTable
            caption={t('app.finance.payouts')} rows={payouts} rowKey={(p) => p.id}
            columns={[
              { header: t('app.orders.date'), cell: (p) => d(p.createdAt) },
              { header: t('app.orders.status'), cell: (p) => <StatusBadge status={p.status} label={status(p.status)} /> },
              { header: t('app.finance.amount'), align: 'end', cell: (p) => <span className="tabular-nums">{m(p.amountMinor, p.currency)}</span> },
            ]}
          />
        )}
      </section>
    </>
  );
}
