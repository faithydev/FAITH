import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@faith/database';
import { allocate, commissionFor, commissionReversal, discountFor, divRoundHalfUp } from '@faith/money';
import type { checkoutBody, refundRequestBody } from '@faith/validators';
import { randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { AuditService, EventsService, SettingsService } from '../core/platform.services';
import { PrismaService, Tx } from '../core/prisma.service';
import { Accounts, Leg, LedgerService } from '../finance/ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { SellerService } from './seller.service';

const orderNumber = () => `F-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly seller: SellerService,
  ) {}

  onModuleInit() {
    this.payments.register('ORDER', {
      succeeded: (tx, payment) => this.settle(tx, payment.orderId!),
      failed: async (tx, payment) => {
        await tx.order.updateMany({ where: { id: payment.orderId!, status: 'PENDING_PAYMENT' }, data: { status: 'PAYMENT_FAILED' } });
        await tx.sellerOrder.updateMany({ where: { orderId: payment.orderId! }, data: { status: 'PAYMENT_FAILED' } });
      },
    });
  }

  // --- Cart ----------------------------------------------------------------

  async cart(userId: string) {
    const cart = await this.prisma.db.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            variant: {
              include: {
                product: { select: { id: true, slug: true, title: true, currency: true, coverKey: true, type: true, status: true, store: { select: { id: true, name: true, slug: true } } } },
              },
            },
          },
        },
      },
    });
    const items = (cart?.items ?? []).map((i) => ({
      id: i.id, quantity: i.quantity, variantId: i.variantId, variantName: i.variant.name,
      unitPriceMinor: i.variant.priceMinor, product: i.variant.product,
      available: i.variant.active && i.variant.product.status === 'PUBLISHED',
    }));
    const byCurrency = new Map<string, bigint>();
    for (const i of items) {
      if (!i.available) continue;
      const c = i.product.currency;
      byCurrency.set(c, (byCurrency.get(c) ?? 0n) + i.unitPriceMinor * BigInt(i.quantity));
    }
    return { items, totals: [...byCurrency].map(([currency, subtotalMinor]) => ({ currency, subtotalMinor })) };
  }

  async addToCart(userId: string, variantId: string, quantity: number) {
    const variant = await this.prisma.db.productVariant.findUnique({ where: { id: variantId }, include: { product: { include: { store: true } } } });
    if (!variant || !variant.active || variant.product.status !== 'PUBLISHED') throw notFound('PRODUCT_NOT_FOUND');
    if (variant.product.store.ownerId === userId) throw badRequest('CANNOT_BUY_OWN_PRODUCT');
    const cart = await this.prisma.db.cart.upsert({ where: { userId }, update: {}, create: { userId } });
    await this.prisma.db.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      update: { quantity },
      create: { cartId: cart.id, variantId, quantity },
    });
    return this.cart(userId);
  }

  async setQuantity(userId: string, itemId: string, quantity: number) {
    const { count } = await this.prisma.db.cartItem.updateMany({ where: { id: itemId, cart: { userId } }, data: { quantity } });
    if (count === 0) throw notFound();
    return this.cart(userId);
  }

  async removeFromCart(userId: string, itemId: string) {
    await this.prisma.db.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
    return this.cart(userId);
  }

  // --- Checkout ------------------------------------------------------------

  /**
   * Prices come from the database, never the client. A store's discount applies only to that
   * store's lines. Commission is computed per seller on net item subtotal, after discounts and
   * excluding tax, then allocated to lines so line and seller totals always agree.
   */
  async checkout(userId: string, body: z.infer<typeof checkoutBody>) {
    const idempotencyKey = `checkout:${userId}:${body.idempotencyKey}`;
    const prior = await this.prisma.db.payment.findUnique({ where: { idempotencyKey } });
    if (prior) {
      const order = await this.prisma.db.order.findUniqueOrThrow({ where: { id: prior.orderId! } });
      return { orderId: order.id, number: order.number, status: order.status, payment: await this.payments.get(prior.id, userId) };
    }

    const cart = await this.prisma.db.cart.findUnique({
      where: { userId },
      include: { items: { orderBy: { createdAt: 'asc' }, include: { variant: { include: { product: { include: { store: true, license: true } } } } } } },
    });
    const lines = cart?.items ?? [];
    if (lines.length === 0) throw badRequest('CART_EMPTY');

    for (const l of lines) {
      const p = l.variant.product;
      if (!l.variant.active || p.status !== 'PUBLISHED' || p.store.status !== 'ACTIVE') throw conflict('PRODUCT_UNAVAILABLE', { productId: p.id });
      if (p.store.ownerId === userId) throw badRequest('CANNOT_BUY_OWN_PRODUCT');
    }
    const currencies = new Set(lines.map((l) => l.variant.product.currency));
    if (currencies.size > 1) throw badRequest('MIXED_CURRENCY');
    const currency = lines[0]!.variant.product.currency;

    const owned = await this.prisma.db.digitalEntitlement.findFirst({
      where: { userId, status: 'ACTIVE', productId: { in: lines.map((l) => l.variant.productId) } },
      select: { productId: true },
    });
    if (owned) throw conflict('ALREADY_OWNED', { productId: owned.productId });

    const bps = await this.settings.commissionBps();
    const byStore = new Map<string, typeof lines>();
    for (const l of lines) {
      const id = l.variant.product.storeId;
      byStore.set(id, [...(byStore.get(id) ?? []), l]);
    }

    const created = await this.prisma.tx(async (tx) => {
      let subtotal = 0n;
      let discountTotal = 0n;
      const order = await tx.order.create({
        data: { number: orderNumber(), buyerId: userId, currency, subtotalMinor: 0n, totalMinor: 0n, affiliateCode: body.affiliateCode },
      });

      for (const [storeId, storeLines] of byStore) {
        const gross = storeLines.map((l) => l.variant.priceMinor * BigInt(l.quantity));
        const storeSubtotal = gross.reduce((a, b) => a + b, 0n);
        const discount = body.discountCode ? await this.redeem(tx, storeId, body.discountCode, storeSubtotal) : 0n;
        const net = storeSubtotal - discount;
        const commission = commissionFor(net, bps);

        const lineDiscounts = allocate(discount, gross);
        const lineNets = gross.map((g, i) => g - lineDiscounts[i]!);
        const lineCommissions = allocate(commission, lineNets);

        const sellerOrder = await tx.sellerOrder.create({
          data: {
            orderId: order.id, storeId, subtotalMinor: storeSubtotal, discountMinor: discount, netMinor: net,
            commissionBps: bps, commissionMinor: commission, sellerNetMinor: net - commission,
          },
        });
        for (const [i, l] of storeLines.entries()) {
          const p = l.variant.product;
          await tx.orderItem.create({
            data: {
              orderId: order.id, sellerOrderId: sellerOrder.id, productId: p.id, variantId: l.variantId,
              title: p.title, variantName: l.variant.name, unitPriceMinor: l.variant.priceMinor, quantity: l.quantity,
              grossMinor: gross[i]!, discountMinor: lineDiscounts[i]!, netMinor: lineNets[i]!, commissionMinor: lineCommissions[i]!,
              licenseSnapshot: p.license
                ? { name: p.license.name, terms: p.license.terms, commercialUse: p.license.commercialUse, seats: p.license.seats, territory: p.license.territory, durationDays: p.license.durationDays }
                : Prisma.JsonNull,
            },
          });
        }
        subtotal += storeSubtotal;
        discountTotal += discount;
      }
      if (body.discountCode && discountTotal === 0n) throw badRequest('INVALID_DISCOUNT');

      const total = subtotal - discountTotal;
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { subtotalMinor: subtotal, discountMinor: discountTotal, totalMinor: total },
      });
      // Nothing to collect on a free order, so it settles right here.
      if (total === 0n) await this.settle(tx, order.id);
      return updated;
    });

    if (created.totalMinor === 0n) {
      return { orderId: created.id, number: created.number, status: 'PAID', payment: null };
    }
    const payment = await this.payments.start({
      purpose: 'ORDER', payerId: userId, amountMinor: created.totalMinor, currency, idempotencyKey,
      description: `FAITH order ${created.number}`, orderId: created.id,
    });
    return { orderId: created.id, number: created.number, status: created.status, payment };
  }

  /** Conditional increment, so the last redemption cannot be used twice concurrently. */
  private async redeem(tx: Tx, storeId: string, code: string, subtotal: bigint) {
    const d = await tx.discount.findUnique({ where: { storeId_code: { storeId, code } } });
    const now = new Date();
    if (!d || !d.active || (d.startsAt && d.startsAt > now) || (d.endsAt && d.endsAt < now)) return 0n;
    const claimed = await tx.discount.updateMany({
      where: { id: d.id, ...(d.maxRedemptions ? { redemptions: { lt: d.maxRedemptions } } : {}) },
      data: { redemptions: { increment: 1 } },
    });
    if (claimed.count !== 1) return 0n;
    return discountFor(subtotal, d.kind === 'PERCENT' ? { kind: 'PERCENT', bps: Number(d.value) } : { kind: 'FIXED', amountMinor: d.value });
  }

  /**
   * Runs once per order, inside the payment transaction. Everything a buyer paid for becomes
   * true atomically: access, sale counts, and the ledger entries. If any step fails, the
   * payment stays unprocessed and the provider's retry runs this again.
   */
  private async settle(tx: Tx, orderId: string) {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['PENDING_PAYMENT'] } },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (count !== 1) return;
    await tx.sellerOrder.updateMany({ where: { orderId }, data: { status: 'PAID' } });

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: { include: { course: true, community: true, license: true } } } }, sellerOrders: { include: { store: true } } },
    });

    const earnings = new Map<string, bigint>();
    const storeDeductions = new Map<string, bigint>();
    const addAllocation = (participantId: string, storeId: string, amount: bigint) => {
      earnings.set(participantId, (earnings.get(participantId) ?? 0n) + amount);
      storeDeductions.set(storeId, (storeDeductions.get(storeId) ?? 0n) + amount);
    };

    for (const item of order.items) {
      const durationDays = item.product.license?.durationDays;
      await tx.digitalEntitlement.create({
        data: {
          userId: order.buyerId, productId: item.productId, orderItemId: item.id,
          licenseKey: `FAITH-${randomBytes(8).toString('hex').toUpperCase()}`,
          licenseTerms: item.licenseSnapshot ?? Prisma.JsonNull,
          expiresAt: durationDays ? new Date(Date.now() + durationDays * 86_400_000) : null,
        },
      });
      await tx.product.update({ where: { id: item.productId }, data: { salesCount: { increment: item.quantity } } });

      if (item.product.course) {
        await tx.enrollment.upsert({
          where: { courseId_userId: { courseId: item.product.course.id, userId: order.buyerId } },
          update: {},
          create: { courseId: item.product.course.id, userId: order.buyerId },
        });
        await this.events.emit(tx, 'course.enrolled', { courseId: item.product.course.id, userId: order.buyerId, title: item.product.course.title });
      }
      if (item.product.community) {
        await tx.communityMember.upsert({
          where: { communityId_userId: { communityId: item.product.community.id, userId: order.buyerId } },
          update: {},
          create: { communityId: item.product.community.id, userId: order.buyerId },
        });
      }

      const seller = order.sellerOrders.find((s) => s.id === item.sellerOrderId)!;
      const sellerNet = item.netMinor - item.commissionMinor;

      // Revenue Graph: contractual shares come out of the seller's net, never FAITH's fee.
      const shares = await tx.revenueShare.findMany({ where: { productId: item.productId, active: true } });
      for (const share of shares) {
        const amount = commissionFor(sellerNet, share.bps);
        if (amount === 0n) continue;
        await tx.revenueAllocation.create({
          data: { orderItemId: item.id, shareId: share.id, amountMinor: amount, currency: order.currency },
        });
        addAllocation(share.participantId, seller.storeId, amount);
      }
      if (order.affiliateCode) {
        const link = await tx.affiliateLink.findUnique({ where: { code: order.affiliateCode } });
        const eligible = link && link.active && link.productId === item.productId
          && link.ownerId !== order.buyerId && link.ownerId !== seller.store.ownerId;
        if (eligible) {
          const taken = storeDeductionsFor(storeDeductions, seller.storeId);
          const amount = min(commissionFor(sellerNet, link.commissionBps), seller.sellerNetMinor - taken);
          if (amount > 0n) {
            await tx.referralConversion.create({ data: { linkId: link.id, orderItemId: item.id, amountMinor: amount, currency: order.currency } });
            addAllocation(link.ownerId, seller.storeId, amount);
          }
        }
      }
    }

    await tx.cartItem.deleteMany({ where: { cart: { userId: order.buyerId }, variantId: { in: order.items.map((i) => i.variantId) } } });

    if (order.totalMinor > 0n) {
      const c = order.currency;
      const credit: Leg[] = [];
      for (const s of order.sellerOrders) {
        credit.push({ account: Accounts.storePayable(s.storeId, c), amountMinor: s.sellerNetMinor - (storeDeductions.get(s.storeId) ?? 0n) });
        credit.push({ account: Accounts.commission(c), amountMinor: s.commissionMinor });
      }
      for (const [userId, amount] of earnings) credit.push({ account: Accounts.userEarnings(userId, c), amountMinor: amount });
      await this.ledger.post(tx, {
        idempotencyKey: `order:${order.id}:paid`, kind: 'sale', currency: c, refType: 'Order', refId: order.id,
        debit: [{ account: Accounts.clearing(c), amountMinor: order.totalMinor }],
        credit,
      });
    }

    await this.events.emit(tx, 'order.paid', {
      orderId: order.id, number: order.number, buyerId: order.buyerId, totalMinor: order.totalMinor.toString(), currency: order.currency,
      sellers: order.sellerOrders.map((s) => ({ storeId: s.storeId, ownerId: s.store.ownerId, netMinor: s.netMinor.toString() })),
    });
  }

  // --- Buyer views ---------------------------------------------------------

  async myOrders(userId: string) {
    return this.prisma.db.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        items: { select: { id: true, title: true, variantName: true, netMinor: true, refundedMinor: true, productId: true, review: { select: { id: true } } } },
        refunds: { select: { id: true, status: true, amountMinor: true, createdAt: true } },
      },
    });
  }

  async order(userId: string, id: string) {
    const order = await this.prisma.db.order.findUnique({
      where: { id },
      include: {
        items: { include: { review: { select: { id: true } }, product: { select: { slug: true } } } },
        refunds: true,
        payments: { select: { id: true, status: true, provider: true, amountMinor: true, currency: true, createdAt: true } },
      },
    });
    if (!order || order.buyerId !== userId) throw notFound('ORDER_NOT_FOUND');
    return order;
  }

  async library(userId: string) {
    const rows = await this.prisma.db.digitalEntitlement.findMany({
      where: { userId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { grantedAt: 'desc' },
      include: {
        product: {
          select: {
            id: true, slug: true, title: true, type: true, coverKey: true,
            assets: { where: { kind: 'FILE' }, select: { id: true, filename: true, sizeBytes: true, mime: true } },
            course: { select: { slug: true } },
            community: { select: { slug: true } },
          },
        },
      },
    });
    return rows;
  }

  // --- Refunds -------------------------------------------------------------

  async requestRefund(userId: string, orderId: string, body: z.infer<typeof refundRequestBody>) {
    const item = await this.prisma.db.orderItem.findUnique({
      where: { id: body.orderItemId },
      include: { order: true, sellerOrder: true, refundLines: { include: { refund: true } } },
    });
    if (!item || item.orderId !== orderId || item.order.buyerId !== userId) throw notFound('ORDER_ITEM_NOT_FOUND');
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(item.order.status)) throw badRequest('ORDER_NOT_REFUNDABLE');

    const open = item.refundLines
      .filter((l) => ['REQUESTED', 'APPROVED'].includes(l.refund.status))
      .reduce((a, l) => a + l.amountMinor, 0n);
    const refundable = item.netMinor - item.refundedMinor - open;
    if (refundable <= 0n) throw conflict('NOTHING_TO_REFUND');
    const amount = body.amountMinor ? BigInt(body.amountMinor) : refundable;
    if (amount > refundable) throw badRequest('REFUND_EXCEEDS_REFUNDABLE', { refundableMinor: refundable });

    return this.prisma.db.refund.create({
      data: {
        orderId, storeId: item.sellerOrder.storeId, requestedById: userId, reason: body.reason,
        amountMinor: amount, currency: item.order.currency,
        items: { create: { orderItemId: item.id, sellerOrderId: item.sellerOrderId, amountMinor: amount } },
      },
    });
  }

  async storeRefunds(storeId: string, userId: string) {
    await this.seller.ownedStore(storeId, userId);
    return this.prisma.db.refund.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { number: true } }, items: { include: { orderItem: { select: { title: true, netMinor: true } } } } },
    });
  }

  async decideRefund(refundId: string, actorId: string, approve: boolean, note: string | undefined, opts: { staff?: boolean } = {}) {
    const refund = await this.prisma.db.refund.findUnique({ where: { id: refundId }, include: { items: true } });
    if (!refund) throw notFound('REFUND_NOT_FOUND');
    if (!opts.staff) await this.seller.ownedStore(refund.storeId, actorId);

    // The conditional update is the lock: only one decision can win, however many arrive.
    const claimed = await this.prisma.db.refund.updateMany({
      where: { id: refundId, status: 'REQUESTED' },
      data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: actorId, decidedAt: new Date(), decisionNote: note },
    });
    if (claimed.count !== 1) throw conflict('REFUND_ALREADY_DECIDED');
    if (!approve) {
      await this.audit.record({ actor: { id: actorId }, action: 'refund.rejected', resourceType: 'Refund', resourceId: refundId });
      return this.prisma.db.refund.findUniqueOrThrow({ where: { id: refundId } });
    }

    const payment = await this.prisma.db.payment.findFirst({ where: { orderId: refund.orderId, status: 'SUCCEEDED' } });
    if (payment) {
      try {
        await this.payments.refund(payment, refund.amountMinor, refund.id);
      } catch (err) {
        await this.prisma.db.refund.update({ where: { id: refundId }, data: { status: 'REQUESTED', decidedById: null, decidedAt: null } });
        throw err;
      }
    }
    await this.prisma.tx((tx) => this.applyRefund(tx, refund.id));
    await this.audit.record({ actor: { id: actorId }, action: 'refund.processed', resourceType: 'Refund', resourceId: refundId, metadata: { amountMinor: refund.amountMinor.toString() } });
    return this.prisma.db.refund.findUniqueOrThrow({ where: { id: refundId } });
  }

  private async applyRefund(tx: Tx, refundId: string) {
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { items: true } });
    const c = refund.currency;
    const debit: Leg[] = [];
    const credit: Leg[] = [{ account: Accounts.clearing(c), amountMinor: refund.amountMinor }];
    let reversedTotal = 0n;

    for (const line of refund.items) {
      await tx.$queryRaw`SELECT 1 FROM "OrderItem" WHERE "id" = ${line.orderItemId} FOR UPDATE`;
      const item = await tx.orderItem.findUniqueOrThrow({
        where: { id: line.orderItemId },
        include: { allocations: { include: { share: true } }, conversion: { include: { link: true } } },
      });
      const reversal = commissionReversal({
        netMinor: item.netMinor, commissionMinor: item.commissionMinor, refundedMinor: item.refundedMinor,
        reversedMinor: item.commissionReversedMinor, refundMinor: line.amountMinor,
      });
      const refundedAfter = item.refundedMinor + line.amountMinor;
      await tx.orderItem.update({
        where: { id: item.id },
        data: { refundedMinor: refundedAfter, commissionReversedMinor: { increment: reversal } },
      });
      await tx.refundItem.update({ where: { id: line.id }, data: { commissionMinor: reversal } });
      await tx.sellerOrder.update({
        where: { id: line.sellerOrderId },
        data: { refundedMinor: { increment: line.amountMinor }, commissionReversedMinor: { increment: reversal } },
      });
      reversedTotal += reversal;
      const storeId = refund.storeId;
      debit.push({ account: Accounts.storePayable(storeId, c), amountMinor: line.amountMinor - reversal });
      debit.push({ account: Accounts.commission(c), amountMinor: reversal });

      // Claw back partner shares in proportion, so the seller does not fund them twice.
      const claw = (amount: bigint, reversed: bigint) => divRoundHalfUp(amount * refundedAfter, item.netMinor) - reversed;
      for (const a of item.allocations) {
        const delta = claw(a.amountMinor, a.reversedMinor);
        if (delta <= 0n) continue;
        await tx.revenueAllocation.update({ where: { id: a.id }, data: { reversedMinor: { increment: delta } } });
        debit.push({ account: Accounts.userEarnings(a.share.participantId, c), amountMinor: delta });
        credit.push({ account: Accounts.storePayable(storeId, c), amountMinor: delta });
      }
      if (item.conversion) {
        const delta = claw(item.conversion.amountMinor, item.conversion.reversedMinor);
        if (delta > 0n) {
          await tx.referralConversion.update({ where: { id: item.conversion.id }, data: { reversedMinor: { increment: delta } } });
          debit.push({ account: Accounts.userEarnings(item.conversion.link.ownerId, c), amountMinor: delta });
          credit.push({ account: Accounts.storePayable(storeId, c), amountMinor: delta });
        }
      }

      if (refundedAfter === item.netMinor) {
        await tx.digitalEntitlement.updateMany({
          where: { orderItemId: item.id, status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: new Date() },
        });
      }
      const so = await tx.sellerOrder.findUniqueOrThrow({ where: { id: line.sellerOrderId } });
      await tx.sellerOrder.update({
        where: { id: so.id },
        data: { status: so.refundedMinor === so.netMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });
    }

    await this.ledger.post(tx, {
      idempotencyKey: `refund:${refund.id}`, kind: 'refund', currency: c, refType: 'Refund', refId: refund.id,
      debit, credit,
    });
    await tx.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSED', commissionMinor: reversedTotal } });

    const sellers = await tx.sellerOrder.findMany({ where: { orderId: refund.orderId } });
    const allDone = sellers.every((s) => s.status === 'REFUNDED');
    const order = await tx.order.update({ where: { id: refund.orderId }, data: { status: allDone ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
    await this.events.emit(tx, 'order.refunded', {
      orderId: order.id, number: order.number, buyerId: order.buyerId, refundId: refund.id,
      amountMinor: refund.amountMinor.toString(), currency: c,
    });
  }

  /** Buyer-facing guard used by the download route. */
  async assertDownload(userId: string, entitlementId: string, assetId: string) {
    const e = await this.prisma.db.digitalEntitlement.findUnique({ where: { id: entitlementId } });
    if (!e || e.userId !== userId) throw notFound('ENTITLEMENT_NOT_FOUND');
    if (e.status !== 'ACTIVE' || (e.expiresAt && e.expiresAt <= new Date())) throw forbidden('ACCESS_REVOKED');
    const asset = await this.prisma.db.productAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.productId !== e.productId || asset.kind !== 'FILE') throw notFound('ASSET_NOT_FOUND');
    await this.prisma.db.downloadEvent.create({ data: { entitlementId, assetId } });
    return asset;
  }
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const storeDeductionsFor = (m: Map<string, bigint>, id: string) => m.get(id) ?? 0n;
