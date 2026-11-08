import { Injectable } from '@nestjs/common';
import { FREE_LIMITS } from '@faith/config';
import { Prisma } from '@faith/database';
import type {
  discountBody, licenseBody, productBody, productUpdateBody, revenueShareBody, storeBody, storeUpdateBody,
} from '@faith/validators';
import type { z } from 'zod';
import { EntitlementsService } from '../auth/entitlements.service';
import { uniqueSlug } from '../core/crypto';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { EventsService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';
import { LedgerService } from '../finance/ledger.service';

const NEEDS_FILE = new Set(['DIGITAL_DOWNLOAD', 'DESIGN_TEMPLATE', 'SOURCE_CODE', 'WEBSITE_TEMPLATE']);

@Injectable()
export class SellerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly entitlements: EntitlementsService,
    private readonly ledger: LedgerService,
  ) {}

  /** The single ownership check. Every seller path goes through it, so IDOR has one choke point. */
  async ownedStore(storeId: string, userId: string) {
    const store = await this.prisma.db.store.findUnique({ where: { id: storeId } });
    if (!store) throw notFound('STORE_NOT_FOUND');
    if (store.ownerId === userId) return store;
    if (store.orgId) {
      const member = await this.prisma.db.organizationMember.findUnique({ where: { orgId_userId: { orgId: store.orgId, userId } } });
      if (member && member.role !== 'MEMBER') return store;
    }
    // Same answer as a missing store: outsiders learn nothing about what exists.
    throw notFound('STORE_NOT_FOUND');
  }

  async ownedProduct(productId: string, userId: string) {
    const product = await this.prisma.db.product.findUnique({ where: { id: productId }, include: { variants: true, assets: true } });
    if (!product) throw notFound('PRODUCT_NOT_FOUND');
    try {
      await this.ownedStore(product.storeId, userId);
    } catch {
      throw notFound('PRODUCT_NOT_FOUND');
    }
    return product;
  }

  private async storeIds(userId: string) {
    const orgs = await this.prisma.db.organizationMember.findMany({
      where: { userId, role: { in: ['OWNER', 'ADMIN', 'MANAGER'] } },
      select: { orgId: true },
    });
    const stores = await this.prisma.db.store.findMany({
      where: { OR: [{ ownerId: userId }, { orgId: { in: orgs.map((o) => o.orgId) } }] },
      select: { id: true },
    });
    return stores.map((s) => s.id);
  }

  myStores(userId: string) {
    return this.storeIds(userId).then((ids) => this.prisma.db.store.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: 'asc' },
    }));
  }

  async createStore(userId: string, body: z.infer<typeof storeBody>) {
    if (body.orgId) {
      const m = await this.prisma.db.organizationMember.findUnique({ where: { orgId_userId: { orgId: body.orgId, userId } } });
      if (!m || m.role === 'MEMBER') throw forbidden('ORG_ROLE_REQUIRED');
    }
    return this.prisma.db.store.create({
      data: { ...body, slug: body.slug ?? uniqueSlug(body.name), ownerId: userId, status: 'ACTIVE' },
    });
  }

  async updateStore(storeId: string, userId: string, body: z.infer<typeof storeUpdateBody>) {
    await this.ownedStore(storeId, userId);
    if (body.theme) {
      const premium = await this.entitlements.has(userId, 'storefront.premium');
      if (!premium) throw forbidden('PLAN_UPGRADE_REQUIRED');
    }
    const { orgId: _ignored, ...data } = body;
    return this.prisma.db.store.update({ where: { id: storeId }, data });
  }

  async products(storeId: string, userId: string) {
    await this.ownedStore(storeId, userId);
    return this.prisma.db.product.findMany({
      where: { storeId },
      orderBy: { updatedAt: 'desc' },
      include: { variants: { orderBy: { position: 'asc' } }, assets: true, _count: { select: { orderItems: true } } },
    });
  }

  async productForEdit(productId: string, userId: string) {
    const product = await this.ownedProduct(productId, userId);
    const versions = await this.prisma.db.productVersion.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } });
    const shares = await this.prisma.db.revenueShare.findMany({
      where: { productId },
      include: { participant: { select: { profile: { select: { displayName: true } } } } },
    });
    return { ...product, versions, revenueShares: shares };
  }

  async createProduct(storeId: string, userId: string, body: z.infer<typeof productBody>) {
    const store = await this.ownedStore(storeId, userId);
    if (store.status !== 'ACTIVE') throw forbidden('STORE_NOT_ACTIVE');
    const limit = await this.entitlements.limit(userId, 'limit.products', FREE_LIMITS.products);
    const count = await this.prisma.db.product.count({ where: { storeId, status: { not: 'ARCHIVED' } } });
    if (count >= limit) throw forbidden('PLAN_LIMIT_REACHED');

    const { variants, categoryId, licenseId, ...rest } = body;
    return this.prisma.db.product.create({
      data: {
        ...rest,
        storeId,
        slug: uniqueSlug(body.title),
        status: 'DRAFT',
        categoryId: categoryId ?? null,
        licenseId: licenseId ?? null,
        tags: body.tags.map((t) => t.toLowerCase()),
        priceFromMinor: minPrice(variants),
        variants: {
          create: variants.map((v, position) => ({
            name: v.name, priceMinor: BigInt(v.priceMinor), active: v.active, position,
            compareAtMinor: v.compareAtMinor ? BigInt(v.compareAtMinor) : null,
          })),
        },
      },
      include: { variants: true },
    });
  }

  async updateProduct(productId: string, userId: string, body: z.infer<typeof productUpdateBody>) {
    const product = await this.ownedProduct(productId, userId);
    const { variants, ...rest } = body;
    return this.prisma.tx(async (tx) => {
      if (variants) {
        const keep = new Set(variants.flatMap((v) => (v.id ? [v.id] : [])));
        // Sold variants are referenced by orders, so they deactivate instead of disappearing.
        await tx.productVariant.updateMany({ where: { productId, id: { notIn: [...keep] } }, data: { active: false } });
        for (const [position, v] of variants.entries()) {
          const data = {
            name: v.name, priceMinor: BigInt(v.priceMinor), active: v.active, position,
            compareAtMinor: v.compareAtMinor ? BigInt(v.compareAtMinor) : null,
          };
          if (v.id) {
            if (!product.variants.some((x) => x.id === v.id)) throw notFound('VARIANT_NOT_FOUND');
            await tx.productVariant.update({ where: { id: v.id }, data });
          } else {
            await tx.productVariant.create({ data: { ...data, productId } });
          }
        }
      }
      const active = await tx.productVariant.findMany({ where: { productId, active: true } });
      return tx.product.update({
        where: { id: productId },
        data: {
          ...rest,
          ...(rest.tags ? { tags: rest.tags.map((t) => t.toLowerCase()) } : {}),
          priceFromMinor: active.length ? active.reduce((m, v) => (v.priceMinor < m ? v.priceMinor : m), active[0]!.priceMinor) : 0n,
        },
      });
    });
  }

  async publish(productId: string, userId: string) {
    const product = await this.ownedProduct(productId, userId);
    if (!['DRAFT', 'REJECTED', 'ARCHIVED'].includes(product.status)) throw conflict('PRODUCT_NOT_PUBLISHABLE');
    if (!product.variants.some((v) => v.active)) throw badRequest('PRODUCT_NEEDS_VARIANT');
    if (NEEDS_FILE.has(product.type) && !product.assets.some((a) => a.kind === 'FILE')) throw badRequest('PRODUCT_NEEDS_FILE');
    const published = await this.prisma.tx(async (tx) => {
      const p = await tx.product.update({
        where: { id: productId },
        data: { status: 'PUBLISHED', publishedAt: product.publishedAt ?? new Date(), moderationNote: null },
      });
      await this.events.emit(tx, 'product.published', { productId, storeId: p.storeId, ownerId: userId, title: p.title });
      return p;
    });
    return published;
  }

  async archive(productId: string, userId: string) {
    await this.ownedProduct(productId, userId);
    return this.prisma.db.product.update({ where: { id: productId }, data: { status: 'ARCHIVED' } });
  }

  async addVersion(productId: string, userId: string, version: string, changelog?: string) {
    await this.ownedProduct(productId, userId);
    return this.prisma.db.productVersion.create({ data: { productId, version, changelog } });
  }

  /** Attaches an uploaded file. The upload must belong to the caller. */
  async attachAsset(productId: string, userId: string, uploadId: string, kind: 'IMAGE' | 'FILE' | 'VIDEO', versionId?: string) {
    await this.ownedProduct(productId, userId);
    const upload = await this.prisma.db.upload.findUnique({ where: { id: uploadId } });
    if (!upload || upload.ownerId !== userId) throw notFound('UPLOAD_NOT_FOUND');
    if (kind === 'IMAGE' && !upload.mime.startsWith('image/')) throw badRequest('IMAGE_REQUIRED');
    const asset = await this.prisma.db.productAsset.create({
      data: { productId, versionId, kind, storageKey: upload.storageKey, filename: upload.filename, mime: upload.mime, sizeBytes: upload.sizeBytes },
    });
    if (kind === 'IMAGE' && upload.storageKey.startsWith('public/')) {
      await this.prisma.db.product.updateMany({ where: { id: productId, coverKey: null }, data: { coverKey: upload.storageKey } });
    }
    return asset;
  }

  async removeAsset(productId: string, userId: string, assetId: string) {
    await this.ownedProduct(productId, userId);
    const { count } = await this.prisma.db.productAsset.deleteMany({ where: { id: assetId, productId } });
    if (count === 0) throw notFound();
    return { status: 'ok' };
  }

  // --- Discounts and licences ----------------------------------------------

  async discounts(storeId: string, userId: string) {
    await this.ownedStore(storeId, userId);
    return this.prisma.db.discount.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } });
  }

  async createDiscount(storeId: string, userId: string, body: z.infer<typeof discountBody>) {
    await this.ownedStore(storeId, userId);
    if (body.kind === 'PERCENT' && BigInt(body.value) > 10_000n) throw badRequest('INVALID_DISCOUNT');
    return this.prisma.db.discount.create({ data: { ...body, value: BigInt(body.value), storeId } });
  }

  async setDiscountActive(storeId: string, userId: string, id: string, active: boolean) {
    await this.ownedStore(storeId, userId);
    const { count } = await this.prisma.db.discount.updateMany({ where: { id, storeId }, data: { active } });
    if (count === 0) throw notFound();
    return { active };
  }

  async licenses(storeId: string, userId: string) {
    await this.ownedStore(storeId, userId);
    return this.prisma.db.licenseTemplate.findMany({ where: { OR: [{ storeId }, { storeId: null }] }, orderBy: { name: 'asc' } });
  }

  async createLicense(storeId: string, userId: string, body: z.infer<typeof licenseBody>) {
    await this.ownedStore(storeId, userId);
    return this.prisma.db.licenseTemplate.create({ data: { ...body, storeId } });
  }

  // --- Revenue Graph -------------------------------------------------------

  async addRevenueShare(productId: string, userId: string, body: z.infer<typeof revenueShareBody>) {
    await this.ownedProduct(productId, userId);
    const participant = await this.prisma.db.user.findUnique({ where: { email: body.participantEmail } });
    if (!participant) throw notFound('USER_NOT_FOUND');
    const existing = await this.prisma.db.revenueShare.findMany({ where: { productId, active: true } });
    const used = existing.reduce((a, s) => a + s.bps, 0);
    if (used + body.bps > 10_000) throw badRequest('SHARES_EXCEED_100');
    return this.prisma.db.revenueShare.create({
      data: { productId, participantId: participant.id, role: body.role, bps: body.bps },
    });
  }

  // --- Orders, customers, analytics ----------------------------------------

  async orders(storeId: string, userId: string, page: { page: number; pageSize: number }) {
    await this.ownedStore(storeId, userId);
    const where: Prisma.SellerOrderWhereInput = { storeId, status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } };
    const [items, total] = await Promise.all([
      this.prisma.db.sellerOrder.findMany({
        where,
        orderBy: { order: { paidAt: 'desc' } },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
        include: {
          items: { select: { id: true, title: true, variantName: true, quantity: true, netMinor: true, refundedMinor: true } },
          order: { select: { number: true, paidAt: true, currency: true, buyer: { select: { profile: { select: { displayName: true } } } } } },
        },
      }),
      this.prisma.db.sellerOrder.count({ where }),
    ]);
    return { items, total, page: page.page, pageSize: page.pageSize, pages: Math.max(1, Math.ceil(total / page.pageSize)) };
  }

  /** Display names only. A buyer's email is never shared with sellers. */
  async customers(storeId: string, userId: string) {
    await this.ownedStore(storeId, userId);
    const rows = await this.prisma.db.$queryRaw<{ buyerId: string; orders: bigint; spent: bigint; currency: string; last: Date }[]>`
      SELECT o."buyerId", COUNT(*)::bigint AS orders, SUM(so."netMinor" - so."refundedMinor")::bigint AS spent,
             o."currency", MAX(o."paidAt") AS last
      FROM "SellerOrder" so JOIN "Order" o ON o."id" = so."orderId"
      WHERE so."storeId" = ${storeId} AND so."status" IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
      GROUP BY o."buyerId", o."currency" ORDER BY last DESC LIMIT 200`;
    const profiles = await this.prisma.db.userProfile.findMany({
      where: { userId: { in: rows.map((r) => r.buyerId) } },
      select: { userId: true, displayName: true },
    });
    const names = new Map(profiles.map((p) => [p.userId, p.displayName]));
    return rows.map((r, i) => ({
      key: `customer-${i}`, displayName: names.get(r.buyerId) ?? '—', orders: r.orders, spentMinor: r.spent, currency: r.currency, lastOrderAt: r.last,
    }));
  }

  async analytics(storeId: string, userId: string) {
    const store = await this.ownedStore(storeId, userId);
    const orders = await this.prisma.db.sellerOrder.findMany({
      where: { storeId, status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
      select: { netMinor: true, sellerNetMinor: true, refundedMinor: true, commissionMinor: true, commissionReversedMinor: true, order: { select: { buyerId: true, paidAt: true, currency: true } } },
    });
    const sum = (f: (o: (typeof orders)[number]) => bigint) => orders.reduce((a, o) => a + f(o), 0n);
    const gross = sum((o) => o.netMinor);
    const refunded = sum((o) => o.refundedMinor);
    const commission = sum((o) => o.commissionMinor - o.commissionReversedMinor);
    const buyers = new Map<string, number>();
    for (const o of orders) buyers.set(o.order.buyerId, (buyers.get(o.order.buyerId) ?? 0) + 1);
    const repeat = [...buyers.values()].filter((n) => n > 1).length;

    const series = await this.prisma.db.$queryRaw<{ day: Date; revenue: bigint; orders: bigint }[]>`
      SELECT date_trunc('day', o."paidAt") AS day, SUM(so."netMinor" - so."refundedMinor")::bigint AS revenue, COUNT(*)::bigint AS orders
      FROM "SellerOrder" so JOIN "Order" o ON o."id" = so."orderId"
      WHERE so."storeId" = ${storeId} AND so."status" IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
        AND o."paidAt" >= now() - interval '30 days'
      GROUP BY day ORDER BY day`;

    const products = await this.prisma.db.product.findMany({
      where: { storeId },
      orderBy: { salesCount: 'desc' },
      take: 8,
      select: { id: true, title: true, salesCount: true, viewCount: true, ratingCount: true, ratingSum: true },
    });
    const views = await this.prisma.db.product.aggregate({ where: { storeId }, _sum: { viewCount: true } });
    const viewTotal = views._sum.viewCount ?? 0;

    return {
      currency: store.currency,
      grossMinor: gross,
      refundedMinor: refunded,
      commissionMinor: commission,
      netEarningsMinor: gross - refunded - commission,
      orders: orders.length,
      customers: buyers.size,
      repeatCustomers: repeat,
      refundRateBps: gross === 0n ? 0 : Number((refunded * 10_000n) / gross),
      conversionBps: viewTotal === 0 ? 0 : Math.round((orders.length / viewTotal) * 10_000),
      views: viewTotal,
      series,
      products,
    };
  }

  async earnings(storeId: string, userId: string) {
    await this.ownedStore(storeId, userId);
    const balances = await this.ledger.balancesFor('store', [storeId]);
    const payouts = await this.prisma.db.payoutRequest.findMany({
      where: { ownerType: 'store', ownerId: storeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { balances, payouts };
  }
}

function minPrice(variants: { priceMinor: string; active: boolean }[]): bigint {
  const prices = variants.filter((v) => v.active).map((v) => BigInt(v.priceMinor));
  return prices.length ? prices.reduce((a, b) => (b < a ? b : a)) : 0n;
}
