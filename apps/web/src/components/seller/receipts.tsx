import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { FileText } from 'lucide-react';
import Image from 'next/image';

export type ReceiptRow = {
  id: string; status: 'SUBMITTED' | 'APPROVED' | 'REJECTED'; reason: string | null; note: string | null;
  submittedAt: string; decidedAt: string | null; fileMime: string;
  buyer: { displayName: string; username: string } | null;
  amountMinor: string; currency: string; paymentStatus: string; orderNumber: string | null; titles: string[];
};

type Labels = {
  title: string; body: string; history: string; view: string; approve: string; reject: string; rejectTitle: string; reason: string;
  confirmTitle: (amount: string) => string; confirmBody: string; note: string; status: (s: string) => string;
};

/**
 * Receipts buyers sent for direct transfers. The seller checks that the money reached their card
 * or account and approves; access to the course or VIP community then opens on its own.
 */
export function SellerReceipts({ rows, m, d, labels }: { rows: ReceiptRow[]; m: (minor: string, c: string) => string; d: (v: string) => string; labels: Labels }) {
  const open = rows.filter((r) => r.status === 'SUBMITTED');
  const done = rows.filter((r) => r.status !== 'SUBMITTED').slice(0, 10);
  if (rows.length === 0) return null;
  return (
    <section className="mb-8" data-testid="seller-receipts">
      <SectionTitle title={labels.title} action={open.length > 0 ? <Badge tone="warning">{open.length}</Badge> : undefined} />
      <p className="-mt-2 mb-3 text-sm text-muted">{labels.body}</p>
      {open.length > 0 && (
        <ul className="card divide-y divide-line">
          {open.map((r) => {
            const file = `/api/v1/receipts/${r.id}/file`;
            const amount = m(r.amountMinor, r.currency);
            return (
              <li key={r.id} className="flex flex-wrap items-start gap-4 p-4 text-sm" data-testid={`receipt-${r.id}`}>
                <a href={file} target="_blank" rel="noopener" className="relative block h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2" aria-label={labels.view}>
                  {r.fileMime === 'application/pdf'
                    ? <span className="grid h-full place-items-center text-muted"><FileText size={26} /></span>
                    : <Image src={file} alt={labels.view} fill unoptimized className="object-cover" />}
                </a>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold tabular-nums">{amount}</p>
                  <p className="font-medium">{r.titles.join(', ')}</p>
                  <p className="text-xs text-muted">{r.buyer?.displayName} · @{r.buyer?.username} · {r.orderNumber} · {d(r.submittedAt)}</p>
                  {r.note && <p className="mt-1 text-xs text-muted">{labels.note}: {r.note}</p>}
                  <a href={file} target="_blank" rel="noopener" className="mt-1 inline-block text-xs underline">{labels.view}</a>
                </div>
                <div className="flex items-center gap-2 self-center">
                  <FormDialog
                    trigger={labels.reject} title={labels.rejectTitle} triggerVariant="ghost" endpoint={`/seller/receipts/${r.id}/decide`}
                    extra={{ approve: false }} submitLabel={labels.reject}
                    fields={[{ name: 'reason', label: labels.reason, type: 'textarea', required: true, minLength: 3 }]}
                  />
                  <ActionButton
                    endpoint={`/seller/receipts/${r.id}/decide`} body={{ approve: true }} label={labels.approve} variant="primary"
                    confirm={{ title: labels.confirmTitle(amount), body: labels.confirmBody }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted">{labels.history}</summary>
          <ul className="card mt-2 divide-y divide-line">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0">{r.titles.join(', ')} <span className="text-muted">· {r.buyer?.displayName} · {r.orderNumber}</span>
                  {r.reason && <span className="block text-xs text-muted">{r.reason}</span>}
                </span>
                <span className="flex items-center gap-2"><span className="tabular-nums">{m(r.amountMinor, r.currency)}</span><StatusBadge status={r.status} label={labels.status(r.status)} /></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
