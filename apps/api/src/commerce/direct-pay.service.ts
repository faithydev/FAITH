import { Injectable } from '@nestjs/common';
import type { directPayBody, receiptBody } from '@faith/validators';
import type { z } from 'zod';
import { badRequest, conflict, notFound } from '../core/errors';
import { AuditService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { SellerService } from './seller.service';

/** Receipts are photos or PDFs of a bank or Click/Payme transfer. */
const RECEIPT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

const masked = (v: string | null) => (v ? `${v.slice(0, 4)} •••• •••• ${v.slice(-4)}` : null);

/**
 * Direct payments: the buyer pays the seller's own card or company account, uploads the receipt,
 * and the seller confirms it. Confirming settles the order through the normal payment path, so
 * course access and VIP community membership open on their own, with nobody adding people by hand.
 */
@Injectable()
export class DirectPayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly seller: SellerService,
    private readonly audit: AuditService,
  ) {}

  // --- Seller settings ----------------------------------------------------------

  async account(storeId: string, userId: string) {
    await this.seller.ownedStore(storeId, userId);
    return (await this.prisma.db.directPayAccount.findUnique({ where: { storeId } })) ?? { storeId, enabled: false };
  }

  async saveAccount(storeId: string, userId: string, body: z.infer<typeof directPayBody>) {
    await this.seller.ownedStore(storeId, userId);
    const saved = await this.prisma.db.directPayAccount.upsert({ where: { storeId }, update: body, create: { ...body, storeId } });
    await this.audit.record({
      actor: { id: userId }, action: 'store.direct_pay_saved', resourceType: 'Store', resourceId: storeId,
      metadata: { enabled: body.enabled, card: masked(body.cardNumber ?? null), account: body.accountNumber ? `…${body.accountNumber.slice(-4)}` : null },
    });
    return saved;
  }

  // --- Buyer ----------------------------------------------------------------------

  private async ownPayment(paymentId: string, userId: string) {
    const p = await this.prisma.db.payment.findUnique({
      where: { id: paymentId },
      include: {
        receipt: true,
        order: {
          include: {
            items: { select: { title: true, product: { select: { course: { select: { slug: true } }, community: { select: { slug: true } } } } } },
            sellerOrders: { include: { store: { include: { directPay: true } } } },
          },
        },
      },
    });
    if (!p || p.payerId !== userId || p.provider !== 'receipt' || !p.order) throw notFound('PAYMENT_NOT_FOUND');
    const store = p.order.sellerOrders[0]?.store;
    if (!store) throw notFound('PAYMENT_NOT_FOUND');
    return { p, order: p.order, store };
  }

  /** What the buyer needs to pay: the amount, where to send it, and how their receipt is doing. */
  async payerView(paymentId: string, userId: string) {
    const { p, order, store } = await this.ownPayment(paymentId, userId);
    const d = store.directPay;
    const first = order.items[0]?.product;
    return {
      paymentId: p.id, status: p.status, amountMinor: p.amountMinor, currency: p.currency,
      order: { id: order.id, number: order.number, titles: order.items.map((i) => i.title) },
      store: { name: store.name, slug: store.slug },
      payTo: d ? {
        cardNumber: d.cardNumber, cardHolder: d.cardHolder, legalName: d.legalName, tin: d.tin,
        bankName: d.bankName, accountNumber: d.accountNumber, mfo: d.mfo, note: d.note,
      } : null,
      receipt: p.receipt ? { status: p.receipt.status, reason: p.receipt.reason, submittedAt: p.receipt.submittedAt, id: p.receipt.id } : null,
      /** Where the buyer lands once access is open. */
      next: first?.course ? `/courses/${first.course.slug}` : first?.community ? `/communities/${first.community.slug}` : `/app/orders/${order.id}`,
    };
  }

  async submitReceipt(paymentId: string, userId: string, body: z.infer<typeof receiptBody>) {
    const { p, order, store } = await this.ownPayment(paymentId, userId);
    if (p.status !== 'PENDING') throw conflict('PAYMENT_ALREADY_SETTLED');
    if (p.receipt?.status === 'SUBMITTED') throw conflict('RECEIPT_ALREADY_SUBMITTED');
    const upload = await this.prisma.db.upload.findUnique({ where: { id: body.uploadId } });
    if (!upload || upload.ownerId !== userId) throw notFound('UPLOAD_NOT_FOUND');
    if (!RECEIPT_TYPES.has(upload.mime) || !upload.storageKey.startsWith('private/')) throw badRequest('UNSUPPORTED_FILE_TYPE');

    await this.prisma.tx(async (tx) => {
      const data = { fileKey: upload.storageKey, fileMime: upload.mime, note: body.note || null, status: 'SUBMITTED' as const, reason: null, submittedAt: new Date(), decidedById: null, decidedAt: null };
      await tx.paymentReceipt.upsert({
        where: { paymentId: p.id },
        update: data,
        create: { ...data, paymentId: p.id, storeId: store.id, payerId: userId },
      });
      await tx.notification.create({
        data: {
          userId: store.ownerId, kind: 'receipt.submitted', href: '/app/seller/orders',
          params: { number: order.number, amountMinor: p.amountMinor.toString(), currency: p.currency },
        },
      });
    });
    return this.payerView(paymentId, userId);
  }

  // --- Seller review ----------------------------------------------------------------

  async storeReceipts(storeId: string, userId: string) {
    await this.seller.ownedStore(storeId, userId);
    const rows = await this.prisma.db.paymentReceipt.findMany({
      where: { storeId },
      orderBy: { submittedAt: 'desc' },
      take: 100,
      include: {
        payer: { select: { profile: { select: { displayName: true, username: true } } } },
        payment: { select: { amountMinor: true, currency: true, status: true, order: { select: { number: true, items: { select: { title: true } } } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id, status: r.status, reason: r.reason, note: r.note, submittedAt: r.submittedAt, decidedAt: r.decidedAt, fileMime: r.fileMime,
      buyer: r.payer.profile, amountMinor: r.payment.amountMinor, currency: r.payment.currency, paymentStatus: r.payment.status,
      orderNumber: r.payment.order?.number ?? null, titles: r.payment.order?.items.map((i) => i.title) ?? [],
    }));
  }

  /** The receipt file, for its seller and for the buyer who sent it. */
  async receiptFile(receiptId: string, userId: string) {
    const r = await this.prisma.db.paymentReceipt.findUnique({ where: { id: receiptId } });
    if (!r) throw notFound('RECEIPT_NOT_FOUND');
    if (r.payerId !== userId) await this.seller.ownedStore(r.storeId, userId).catch(() => { throw notFound('RECEIPT_NOT_FOUND'); });
    return { key: r.fileKey, mime: r.fileMime };
  }

  /**
   * The seller's answer. Approving settles the order in the same transaction: the buyer gets the
   * course or the VIP community at once. Rejecting keeps the order open, so the buyer can send a
   * clearer receipt.
   */
  async decide(receiptId: string, userId: string, approve: boolean, reason?: string) {
    const r = await this.prisma.db.paymentReceipt.findUnique({ where: { id: receiptId }, include: { payment: { include: { order: true } } } });
    if (!r) throw notFound('RECEIPT_NOT_FOUND');
    await this.seller.ownedStore(r.storeId, userId);
    if (!approve && !reason) throw badRequest('REASON_REQUIRED');

    await this.prisma.tx(async (tx) => {
      // The conditional update is the lock: only one decision can win, however many arrive.
      const claimed = await tx.paymentReceipt.updateMany({
        where: { id: r.id, status: 'SUBMITTED' },
        data: { status: approve ? 'APPROVED' : 'REJECTED', reason: approve ? null : reason, decidedById: userId, decidedAt: new Date() },
      });
      if (claimed.count !== 1) throw conflict('RECEIPT_ALREADY_DECIDED');
      if (approve) await this.payments.confirmDirect(tx, r.paymentId);
      await tx.notification.create({
        data: {
          userId: r.payerId,
          kind: approve ? 'receipt.approved' : 'receipt.rejected',
          href: approve ? (r.payment.orderId ? `/app/orders/${r.payment.orderId}` : '/app/library') : `/checkout/receipt/${r.paymentId}`,
          params: { number: r.payment.order?.number ?? '', title: reason ?? '' },
        },
      });
    });
    await this.audit.record({ actor: { id: userId }, action: approve ? 'receipt.approved' : 'receipt.rejected', resourceType: 'PaymentReceipt', resourceId: r.id });
    return { id: r.id, status: approve ? 'APPROVED' : 'REJECTED' };
  }
}
