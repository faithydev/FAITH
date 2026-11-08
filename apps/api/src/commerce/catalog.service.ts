import { Injectable } from '@nestjs/common';
import { Prisma } from '@faith/database';
import type { productQuery, reviewBody } from '@faith/validators';
import type { z } from 'zod';
import { badRequest, conflict, notFound } from '../core/errors';
import { PrismaService } from '../core/prisma.service';
import { paged, skipTake } from '../core/zod';

const cardSelect = {
  id: true, slug: true, title: true, summary: true, type: true, currency: true, coverKey: true, tags: true,
  priceFromMinor: true, ratingCount: true, ratingSum: true, salesCount: true,
  store: { select: { slug: true, name: true } },
  category: { select: { slug: true, names: true } },
} satisfies Prisma.ProductSelect;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  categories() {
    return this.prisma.db.productCategory.findMany({ orderBy: { position: 'asc' } });
  }

  /** Organic results only. Paid placements come from `sponsored` and are never merged here. */
  async search(q: z.infer<typeof productQuery>) {
    const where: Prisma.ProductWhereInput = {
      status: 'PUBLISHED',
      store: { status: 'ACTIVE', ...(q.store ? { slug: q.store } : {}) },
      ...(q.type ? { type: q.type } : {}),
      ...(q.category ? { category: { slug: q.category } } : {}),
      ...(q.q ? {
        OR: [
          { title: { contains: q.q, mode: 'insensitive' } },
          { summary: { contains: q.q, mode: 'insensitive' } },
          { tags: { has: q.q.toLowerCase() } },
        ],
      } : {}),
      ...(q.minPrice || q.maxPrice ? {
        priceFromMinor: {
          ...(q.minPrice ? { gte: BigInt(q.minPrice) } : {}),
          ...(q.maxPrice ? { lte: BigInt(q.maxPrice) } : {}),
        },
      } : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = {
      relevance: [{ salesCount: 'desc' }, { publishedAt: 'desc' }],
      newest: [{ publishedAt: 'desc' }],
      price_asc: [{ priceFromMinor: 'asc' }],
      price_desc: [{ priceFromMinor: 'desc' }],
      rating: [{ ratingCount: 'desc' }, { ratingSum: 'desc' }],
      popular: [{ salesCount: 'desc' }],
    }[q.sort] as Prisma.ProductOrderByWithRelationInput[];

    const [items, total] = await Promise.all([
      this.prisma.db.product.findMany({ where, orderBy: [...orderBy, { id: 'asc' }], ...skipTake(q), select: cardSelect }),
      this.prisma.db.product.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async detail(slug: string, userId?: string) {
    const product = await this.prisma.db.product.findUnique({
      where: { slug },
      include: {
        store: { select: { id: true, slug: true, name: true, tagline: true, ownerId: true, logoKey: true, owner: { select: { badge: { select: { kind: true, status: true } } } } } },
        category: { select: { slug: true, names: true } },
        variants: { where: { active: true }, orderBy: { position: 'asc' } },
        assets: { orderBy: { position: 'asc' }, select: { id: true, kind: true, storageKey: true, filename: true, sizeBytes: true, mime: true } },
        versions: { orderBy: { createdAt: 'desc' }, select: { version: true, changelog: true, createdAt: true } },
        license: true,
        course: { select: { slug: true, title: true } },
        community: { select: { slug: true, name: true } },
      },
    });
    if (!product || product.status !== 'PUBLISHED') throw notFound('PRODUCT_NOT_FOUND');
    await this.prisma.db.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } });

    const [wishlisted, entitlement, reviews] = await Promise.all([
      userId ? this.prisma.db.wishlist.findUnique({ where: { userId_productId: { userId, productId: product.id } } }) : null,
      userId ? this.prisma.db.digitalEntitlement.findFirst({ where: { userId, productId: product.id, status: 'ACTIVE' }, select: { id: true } }) : null,
      this.reviews(product.id),
    ]);
    const { ownerId, owner, ...store } = product.store;
    return {
      ...product,
      store: { ...store, badge: owner.badge?.status === 'VERIFIED' ? owner.badge.kind : null },
      // Buyers see that files exist, never where they live.
      assets: product.assets.map((a) => (a.kind === 'IMAGE' ? a : { ...a, storageKey: undefined })),
      wishlisted: !!wishlisted,
      ownedEntitlementId: entitlement?.id ?? null,
      isOwnProduct: userId === ownerId,
      reviews,
    };
  }

  private reviews(productId: string) {
    return this.prisma.db.customerReview.findMany({
      where: { productId, status: 'VISIBLE' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, rating: true, body: true, createdAt: true,
        user: { select: { profile: { select: { displayName: true } } } },
      },
    });
  }

  async store(slug: string) {
    const store = await this.prisma.db.store.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, name: true, tagline: true, description: true, logoKey: true, bannerKey: true,
        theme: true, status: true, country: true, createdAt: true,
        owner: { select: { badge: { select: { kind: true, status: true } } } },
      },
    });
    if (!store || store.status !== 'ACTIVE') throw notFound('STORE_NOT_FOUND');
    const stats = await this.prisma.db.product.aggregate({
      where: { storeId: store.id, status: 'PUBLISHED' },
      _count: true, _sum: { salesCount: true, ratingCount: true, ratingSum: true },
    });
    const { owner, ...rest } = store;
    return { ...rest, badge: owner.badge?.status === 'VERIFIED' ? owner.badge.kind : null, productCount: stats._count, salesCount: stats._sum.salesCount ?? 0, ratingCount: stats._sum.ratingCount ?? 0, ratingSum: stats._sum.ratingSum ?? 0 };
  }

  /** Paid placements, each marked so the interface always labels it as advertising. */
  async sponsored(placement: 'MARKETPLACE_TOP' | 'PROMOTED_LISTING' | 'CREATOR_DISCOVERY' | 'SPONSORED_COLLECTION') {
    const now = new Date();
    const ads = await this.prisma.db.advertisement.findMany({
      where: {
        placement, status: 'ACTIVE',
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: { product: { select: cardSelect } },
    });
    if (ads.length) {
      await this.prisma.db.advertisement.updateMany({ where: { id: { in: ads.map((a) => a.id) } }, data: { impressions: { increment: 1 } } });
    }
    return ads.map((a) => ({ id: a.id, title: a.title, placement: a.placement, sponsored: true as const, product: a.product }));
  }

  // --- Wishlist ------------------------------------------------------------

  async wishlist(userId: string) {
    const rows = await this.prisma.db.wishlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: cardSelect } },
    });
    return rows.map((r) => r.product);
  }

  async setWishlist(userId: string, productId: string, on: boolean) {
    if (on) {
      const product = await this.prisma.db.product.findUnique({ where: { id: productId } });
      if (!product) throw notFound('PRODUCT_NOT_FOUND');
      await this.prisma.db.wishlist.upsert({ where: { userId_productId: { userId, productId } }, update: {}, create: { userId, productId } });
    } else {
      await this.prisma.db.wishlist.deleteMany({ where: { userId, productId } });
    }
    return { wishlisted: on };
  }

  // --- Reviews -------------------------------------------------------------

  /** Verified purchases only: the review is tied to a paid order item the author owns. */
  async addReview(userId: string, body: z.infer<typeof reviewBody>) {
    const item = await this.prisma.db.orderItem.findUnique({
      where: { id: body.orderItemId },
      include: { order: true, review: true },
    });
    if (!item || item.order.buyerId !== userId) throw notFound('ORDER_ITEM_NOT_FOUND');
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(item.order.status)) throw badRequest('ORDER_NOT_PAID');
    if (item.review) throw conflict('ALREADY_REVIEWED');
    return this.prisma.tx(async (tx) => {
      const review = await tx.customerReview.create({
        data: { productId: item.productId, userId, orderItemId: item.id, rating: body.rating, body: body.body },
      });
      await tx.product.update({
        where: { id: item.productId },
        data: { ratingCount: { increment: 1 }, ratingSum: { increment: body.rating } },
      });
      return review;
    });
  }
}
