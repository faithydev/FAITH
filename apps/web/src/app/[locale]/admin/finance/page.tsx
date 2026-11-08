import { ActionButton } from '@/components/ui/client';
import { Badge, DataTable, EmptyState, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { Paged } from '@/lib/types';

type Payout = { id: string; ownerType: string; accountKey: string; amountMinor: string; currency: string; status: string; createdAt: string };
type Recon = { rows: { currency: string; capturedMinor: string; refundedMinor: string; paidOutMinor: string; expectedMinor: string; clearingMinor: string; matches: boolean }[] };
type Tx = { id: string; kind: string; currency: string; createdAt: string; entries: { id: string; direction: string; amountMinor: string; account: { key: string } }[] };

export default async function AdminFinance() {
  const { t, m, d, status, me } = await pageContext();
  const [payouts, recon, txs] = await Promise.all([
    api<Payout[]>('/admin/finance/payouts'), api<Recon>('/admin/finance/reconciliation'), api<Paged<Tx>>('/admin/finance/transactions?pageSize=20'),
  ]);
  const canWrite = me.permissions.includes('admin.finance.write');
  return (
    <>
      <PageHeader title={t('admin.nav.finance')} description={t('admin.financeBody')} />
      <section className="mb-8">
        <SectionTitle title={t('admin.reconciliation')} />
        <DataTable
          caption={t('admin.reconciliation')} rows={recon.rows} rowKey={(r) => r.currency}
          columns={[
            { header: t('app.seller.currency'), cell: (r) => r.currency },
            { header: t('admin.captured'), align: 'end', cell: (r) => <span className="tabular-nums">{m(r.capturedMinor, r.currency)}</span> },
            { header: t('admin.refundsCol'), align: 'end', cell: (r) => <span className="tabular-nums">{m(r.refundedMinor, r.currency)}</span> },
            { header: t('admin.paidOut'), align: 'end', cell: (r) => <span className="tabular-nums">{m(r.paidOutMinor, r.currency)}</span> },
            { header: t('admin.clearing'), align: 'end', cell: (r) => <span className="tabular-nums">{m(r.clearingMinor, r.currency)}</span> },
            { header: '', align: 'end', cell: (r) => <Badge tone={r.matches ? 'positive' : 'negative'}>{r.matches ? t('admin.matches') : t('admin.mismatch')}</Badge> },
          ]}
        />
      </section>
      <section className="mb-8">
        <SectionTitle title={t('app.finance.payouts')} />
        {payouts.length === 0 ? <EmptyState title={t('app.finance.noPayouts')} /> : (
          <DataTable
            caption={t('app.finance.payouts')} rows={payouts} rowKey={(p) => p.id}
            columns={[
              { header: t('app.orders.date'), cell: (p) => d(p.createdAt) },
              { header: t('admin.account'), cell: (p) => <code className="block max-w-52 truncate font-mono text-xs">{p.accountKey}</code> },
              { header: t('app.orders.status'), cell: (p) => <StatusBadge status={p.status} label={status(p.status)} /> },
              { header: t('app.finance.amount'), align: 'end', cell: (p) => <span className="tabular-nums">{m(p.amountMinor, p.currency)}</span> },
              {
                header: '', align: 'end',
                cell: (p) => canWrite && (
                  <span className="flex justify-end gap-1.5">
                    {p.status === 'REQUESTED' && <ActionButton endpoint={`/admin/finance/payouts/${p.id}/decide`} body={{ decision: 'approve', confirm: true }} label={t('common.approve')} confirm={{ title: t('admin.payoutApprove', { amount: m(p.amountMinor, p.currency) }) }} />}
                    {p.status === 'APPROVED' && <ActionButton endpoint={`/admin/finance/payouts/${p.id}/decide`} body={{ decision: 'mark_paid', confirm: true }} label={t('admin.markPaid')} confirm={{ title: t('admin.markPaidConfirm'), body: t('admin.markPaidBody') }} />}
                    {['REQUESTED', 'APPROVED'].includes(p.status) && <ActionButton endpoint={`/admin/finance/payouts/${p.id}/decide`} body={{ decision: 'reject', confirm: true }} label={t('common.reject')} variant="ghost" confirm={{ title: t('admin.payoutReject'), danger: true }} />}
                  </span>
                ),
              },
            ]}
          />
        )}
      </section>
      <SectionTitle title={t('admin.transactions')} />
      <DataTable
        caption={t('admin.transactions')} rows={txs.items} rowKey={(x) => x.id}
        columns={[
          { header: t('app.orders.date'), cell: (x) => d(x.createdAt) },
          { header: t('admin.kind'), cell: (x) => <Badge>{x.kind}</Badge> },
          { header: t('admin.entries'), cell: (x) => <ul className="space-y-0.5 font-mono text-xs">{x.entries.map((e) => <li key={e.id} className="flex justify-between gap-4"><span className="max-w-64 truncate">{e.direction === 'DEBIT' ? 'DR' : 'CR'} {e.account.key}</span><span className="tabular-nums">{m(e.amountMinor, x.currency)}</span></li>)}</ul> },
        ]}
      />
    </>
  );
}
