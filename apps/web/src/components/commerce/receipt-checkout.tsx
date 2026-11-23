'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, LinkButton, fieldClass } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi, uploadFile } from '@/lib/client';
import { toMajorString } from '@faith/money';
import { CheckCircle2, Clock, Copy, FileUp, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

export type DirectPayment = {
  paymentId: string; status: string; amountMinor: string; currency: string;
  order: { id: string; number: string; titles: string[] };
  store: { name: string; slug: string };
  payTo: {
    cardNumber: string | null; cardHolder: string | null; legalName: string | null; tin: string | null;
    bankName: string | null; accountNumber: string | null; mfo: string | null; note: string | null;
  } | null;
  receipt: { id: string; status: 'SUBMITTED' | 'APPROVED' | 'REJECTED'; reason: string | null; submittedAt: string } | null;
  next: string;
};

/** How often the page asks whether the seller has confirmed, while the receipt waits. */
const POLL_MS = 8_000;

/** 8600123456789012 becomes 8600 1234 5678 9012, easier to read and check. */
const groups = (v: string) => v.replace(/(\d{4})(?=\d)/g, '$1 ');

function CopyRow({ label, value, display, testId }: { label: string; value: string; display?: string; testId?: string }) {
  const t = useTranslations();
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <dt className="text-xs text-subtle">{label}</dt>
        <dd className="truncate font-mono text-[0.95rem] tabular-nums" data-testid={testId}>{display ?? value}</dd>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success(t('directPay.copied')), () => {})}
        aria-label={t('directPay.copy', { what: label })}
        className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        <Copy size={15} />
      </button>
    </div>
  );
}

/**
 * Direct payment, step by step: pay the seller's own card or company account, send the receipt,
 * and wait while the seller confirms. The page checks by itself, so access opens without a reload.
 * The amount arrives formatted by the server, so it reads the same before and after hydration.
 */
export function ReceiptCheckout({ initial, amount }: { initial: DirectPayment; amount: string }) {
  const t = useTranslations();
  const id = useId();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [p, setP] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const waiting = p.status === 'PENDING' && p.receipt?.status === 'SUBMITTED';

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      clientApi<DirectPayment>(`/payments/${p.paymentId}/direct`).then(setP).catch(() => {});
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [waiting, p.paymentId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(file, 'receipt');
      setP(await clientApi<DirectPayment>(`/payments/${p.paymentId}/receipt`, { body: { uploadId: uploaded.id, note: note || undefined } }));
      setFile(null);
      toast.success(t('directPay.sent'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (p.status === 'SUCCEEDED') {
    return (
      <div role="status" className="mt-6" data-testid="receipt-approved">
        <p className="flex items-center gap-2 font-medium text-positive"><CheckCircle2 size={20} />{t('directPay.approvedTitle')}</p>
        <p className="mt-1.5 text-sm text-muted">{t('directPay.approvedBody')}</p>
        <LinkButton href={p.next} size="lg" className="mt-5 w-full" onClick={() => router.refresh()}>{t('directPay.open')}</LinkButton>
      </div>
    );
  }

  const d = p.payTo;
  return (
    <div className="mt-5 space-y-6">
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs text-accent">1</span>{t('directPay.step1')}</h2>
        <p className="mt-1 text-sm text-muted">{t('directPay.step1Body', { store: p.store.name })}</p>
        {d ? (
          <dl className="mt-3 divide-y divide-line rounded-2xl border border-line px-4">
            <CopyRow label={t('directPay.amount')} value={toMajorString(BigInt(p.amountMinor), p.currency)} display={amount} />
            {d.cardNumber && <CopyRow label={t('directPay.card')} value={d.cardNumber} display={groups(d.cardNumber)} testId="pay-card" />}
            {d.cardNumber && d.cardHolder && <div className="py-2.5"><dt className="text-xs text-subtle">{t('directPay.cardHolder')}</dt><dd className="font-medium">{d.cardHolder}</dd></div>}
            {d.accountNumber && (
              <>
                {d.legalName && <div className="py-2.5"><dt className="text-xs text-subtle">{t('directPay.legalName')}</dt><dd className="font-medium">{d.legalName}</dd></div>}
                <CopyRow label={t('directPay.account')} value={d.accountNumber} display={groups(d.accountNumber)} />
                {d.bankName && <div className="py-2.5"><dt className="text-xs text-subtle">{t('directPay.bank')}</dt><dd>{d.bankName}</dd></div>}
                {d.mfo && <CopyRow label={t('directPay.mfo')} value={d.mfo} />}
                {d.tin && <CopyRow label={t('directPay.tin')} value={d.tin} />}
                <CopyRow label={t('directPay.purposeLabel')} value={t('directPay.purposeText', { number: p.order.number })} />
              </>
            )}
          </dl>
        ) : <p className="mt-3 text-sm text-negative">{t('directPay.noDetails')}</p>}
        {d?.note && <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{d.note}</p>}
        <p className="mt-2 text-xs text-subtle">{t('directPay.direct')}</p>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs text-accent">2</span>{t('directPay.step2')}</h2>
        {waiting ? (
          <div role="status" className="mt-3 rounded-2xl border border-line p-4" data-testid="receipt-waiting">
            <p className="flex items-center gap-2 font-medium"><Clock size={17} className="text-warning" />{t('directPay.waitingTitle')}</p>
            <p className="mt-1 text-sm text-muted">{t('directPay.waitingBody')}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-subtle"><Loader2 size={13} className="animate-spin" />{t('directPay.checking')}</p>
          </div>
        ) : (
          <form onSubmit={send} className="mt-3 space-y-3">
            {p.receipt?.status === 'REJECTED' && (
              <div role="alert" className="rounded-2xl border border-negative/40 bg-[color-mix(in_srgb,var(--negative)_8%,transparent)] p-3 text-sm" data-testid="receipt-rejected">
                <p className="flex items-center gap-2 font-medium text-negative"><XCircle size={16} />{t('directPay.rejectedTitle')}</p>
                {p.receipt.reason && <p className="mt-1 text-muted">{p.receipt.reason}</p>}
              </div>
            )}
            <p className="text-sm text-muted">{t('directPay.step2Body')}</p>
            <label htmlFor={`${id}-file`} className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong p-5 text-sm text-muted transition-colors hover:border-accent hover:text-ink">
              <FileUp size={18} />{file ? file.name : t('directPay.chooseFile')}
            </label>
            <input id={`${id}-file`} type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="receipt-file" />
            <div>
              <label htmlFor={`${id}-note`} className={fieldClass.label}>{t('directPay.note')}</label>
              <input id={`${id}-note`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('directPay.notePlaceholder')} className={fieldClass.input} />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={!file || busy} data-testid="receipt-send">
              {busy && <Loader2 size={15} className="animate-spin" />}{t('directPay.send')}
            </Button>
          </form>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs text-accent">3</span>{t('directPay.step3')}</h2>
        <p className="mt-1 text-sm text-muted">{t('directPay.step3Body')}</p>
      </section>
    </div>
  );
}
