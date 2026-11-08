import { Breadcrumbs, Card, PageHeader, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { FormDialog } from '@/components/ui/client';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { pageContext } from '@/lib/page';
import type { Order } from '@/lib/types';
import { notFound } from 'next/navigation';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { t, m, d, status }] = await Promise.all([params, pageContext()]);
  const order = await api<Order>(`/orders/${id}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const paid = ['PAID', 'PARTIALLY_REFUNDED'].includes(order.status);
  return (
    <>
      <Breadcrumbs label={t('common.breadcrumbs')} items={[{ label: t('app.orders.title'), href: '/app/orders' }, { label: order.number }]} />
      <PageHeader title={order.number} description={d(order.createdAt)} actions={<span data-testid="order-status"><StatusBadge status={order.status} label={status(order.status)} /></span>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        <ul className="card divide-y divide-line">
          {order.items.map((i) => {
            const left = BigInt(i.netMinor) - BigInt(i.refundedMinor);
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/marketplace/${i.product?.slug ?? ''}`} className="font-medium hover:underline">{i.title}</Link>
                  <p className="text-xs text-muted">{i.variantName}</p>
                  {BigInt(i.refundedMinor) > 0n && <p className="text-xs text-muted">{t('app.orders.refunded', { amount: m(i.refundedMinor, order.currency) })}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">{m(i.netMinor, order.currency)}</span>
                  {paid && !i.review && (
                    <FormDialog
                      trigger={t('app.orders.review')} title={t('app.orders.reviewTitle', { title: i.title })} triggerVariant="secondary"
                      endpoint="/marketplace/reviews" extra={{ orderItemId: i.id }} submitLabel={t('app.orders.submitReview')} success={t('app.orders.reviewSaved')}
                      fields={[
                        { name: 'rating', label: t('app.orders.rating'), type: 'select', required: true, defaultValue: '5', options: ['5', '4', '3', '2', '1'].map((v) => ({ value: v, label: v })) },
                        { name: 'body', label: t('app.orders.reviewBody'), type: 'textarea', required: true, minLength: 3 },
                      ]}
                    />
                  )}
                  {paid && left > 0n && (
                    <FormDialog
                      trigger={t('app.orders.requestRefund')} title={t('app.orders.refundTitle')} description={t('app.orders.refundBody', { amount: m(left, order.currency) })} triggerVariant="ghost"
                      endpoint={`/orders/${order.id}/refunds`} extra={{ orderItemId: i.id }} submitLabel={t('app.orders.requestRefund')} success={t('app.orders.refundRequested')}
                      fields={[{ name: 'reason', label: t('app.orders.refundReason'), type: 'textarea', required: true, minLength: 3 }]}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <Card className="p-5">
          <SectionTitle title={t('cart.summary')} />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">{t('cart.subtotal')}</dt><dd className="tabular-nums">{m(order.subtotalMinor, order.currency)}</dd></div>
            {BigInt(order.discountMinor) > 0n && <div className="flex justify-between"><dt className="text-muted">{t('app.orders.discount')}</dt><dd className="tabular-nums">−{m(order.discountMinor, order.currency)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>{t('app.orders.total')}</dt><dd className="tabular-nums">{m(order.totalMinor, order.currency)}</dd></div>
          </dl>
          {order.refunds.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">{t('app.orders.refunds')}</p>
              <ul className="space-y-1.5">
                {order.refunds.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 text-sm"><StatusBadge status={r.status} label={status(r.status)} /><span className="tabular-nums">{m(r.amountMinor, order.currency)}</span></li>)}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
