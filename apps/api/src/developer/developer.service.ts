import { Injectable, OnModuleInit } from '@nestjs/common';
import { API_SCOPES, SETTING_KEYS } from '@faith/config';
import type { Payment, Prisma } from '@faith/database';
import { commissionFor } from '@faith/money';
import type { apiKeyBody, appBody, appVersionBody, webhookBody } from '@faith/validators';
import type { z } from 'zod';
import { encrypt, randomToken, sha256, uniqueSlug } from '../core/crypto';
import { isProd } from '../core/env';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { EventsService, SettingsService } from '../core/platform.services';
import { PrismaService, Tx } from '../core/prisma.service';
import { skipTake, paged } from '../core/zod';
import { Accounts, LedgerService } from '../finance/ledger.service';
import { PaymentsService } from '../payments/payments.service';

const appCard = {
  id: true, slug: true, name: true, tagline: true, category: true, iconKey: true, pricing: true, priceMinor: true,
  currency: true, installCount: true, developer: { select: { developerProfile: { select: { name: true, verifiedAt: true } } } },
} satisfies Prisma.AppListingSelect;

@Injectable()
export class DeveloperService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
  ) {}

  onModuleInit() {
    this.payments.register('APP_PURCHASE', {
      succeeded: (tx, p) => this.settleApp(tx, p),
      failed: async (tx, p) => { await tx.appInstallation.deleteMany({ where: { id: p.installationId!, status: 'PENDING_PAYMENT' } }); },
    });
  }

  // --- Public catalogue ----------------------------------------------------

  async catalogue(q: { q?: string; category?: string; page: number; pageSize: number }) {
    const where: Prisma.AppListingWhereInput = {
      status: 'PUBLISHED',
      ...(q.category ? { category: q.category } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.appListing.findMany({ where, orderBy: { installCount: 'desc' }, ...skipTake(q), select: appCard }),
      this.prisma.db.appListing.count({ where }),
    ]);
    return paged(items, total, q);
  }

  async app(slug: string, userId?: string) {
    const app = await this.prisma.db.appListing.findUnique({
      where: { slug },
      include: {
        developer: { select: { developerProfile: { select: { name: true, website: true, verifiedAt: true } } } },
        versions: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 1 },
        reviews: { orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { profile: { select: { displayName: true } } } } } },
      },
    });
    if (!app || app.status !== 'PUBLISHED') throw notFound('APP_NOT_FOUND');
    const installation = userId
      ? await this.prisma.db.appInstallation.findUnique({ where: { appId_userId: { appId: app.id, userId } } })
      : null;
    return { ...app, installation, latest: app.versions[0] ?? null };
  }

  // --- Installation --------------------------------------------------------

  /**
   * Permissions shown at install must match what the approved version declares, so a user
   * cannot be granted something they did not see. Paid apps go through payment first.
   */
  async install(slug: string, userId: string, accepted: string[]) {
    const app = await this.prisma.db.appListing.findUnique({
      where: { slug },
      include: { versions: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!app || app.status !== 'PUBLISHED' || !app.versions[0]) throw notFound('APP_NOT_FOUND');
    const version = app.versions[0];
    const declared = [...version.permissions].sort().join(',');
    if ([...accepted].sort().join(',') !== declared) throw badRequest('PERMISSIONS_MISMATCH');

    const existing = await this.prisma.db.appInstallation.findUnique({ where: { appId_userId: { appId: app.id, userId } } });
    if (existing?.status === 'ACTIVE') throw conflict('APP_ALREADY_INSTALLED');

    const paid = app.pricing !== 'FREE' && app.priceMinor > 0n;
    if (paid) {
      const bps = await this.settings.get<number | null>(SETTING_KEYS.appCommissionBps, null);
      if (bps === null) throw conflict('APP_COMMISSION_NOT_CONFIGURED');
    }
    const data = { versionId: version.id, grantedScopes: version.permissions, status: paid ? 'PENDING_PAYMENT' as const : 'ACTIVE' as const, uninstalledAt: null };
    const installation = await this.prisma.tx(async (tx) => {
      const row = await tx.appInstallation.upsert({
        where: { appId_userId: { appId: app.id, userId } },
        update: data,
        create: { ...data, appId: app.id, userId },
      });
      if (!paid) await this.activated(tx, app.id, userId, app.developerId);
      return row;
    });
    if (!paid) return { status: 'installed', installation };
    const payment = await this.payments.start({
      purpose: 'APP_PURCHASE', payerId: userId, amountMinor: app.priceMinor, currency: app.currency,
      idempotencyKey: `app:${installation.id}:${installation.createdAt.getTime()}`, description: `FAITH app: ${app.name}`,
      installationId: installation.id,
    });
    return { status: 'payment_required', installation, payment };
  }

  private async activated(tx: Tx, appId: string, userId: string, developerId: string) {
    await tx.appListing.update({ where: { id: appId }, data: { installCount: { increment: 1 } } });
    await this.events.emit(tx, 'app.installed', { appId, userId, developerId });
  }

  /** Developer revenue, commission and the sale itself stay separate ledger legs. */
  private async settleApp(tx: Tx, payment: Payment) {
    const inst = await tx.appInstallation.update({ where: { id: payment.installationId! }, data: { status: 'ACTIVE' }, include: { app: true } });
    const bps = await this.settings.get<number>(SETTING_KEYS.appCommissionBps, 0, tx);
    const fee = commissionFor(payment.amountMinor, bps);
    const c = payment.currency;
    await this.ledger.post(tx, {
      idempotencyKey: `app:${payment.id}:sold`, kind: 'app_sale', currency: c, refType: 'AppInstallation', refId: inst.id,
      debit: [{ account: Accounts.clearing(c), amountMinor: payment.amountMinor }],
      credit: [
        { account: Accounts.developerPayable(inst.app.developerId, c), amountMinor: payment.amountMinor - fee },
        { account: Accounts.appCommission(c), amountMinor: fee },
      ],
    });
    await this.activated(tx, inst.appId, inst.userId, inst.app.developerId);
  }

  async uninstall(slug: string, userId: string) {
    const app = await this.prisma.db.appListing.findUnique({ where: { slug } });
    if (!app) throw notFound('APP_NOT_FOUND');
    const { count } = await this.prisma.db.appInstallation.updateMany({
      where: { appId: app.id, userId, status: 'ACTIVE' },
      data: { status: 'UNINSTALLED', uninstalledAt: new Date(), grantedScopes: [] },
    });
    if (count === 0) throw notFound('APP_NOT_INSTALLED');
    await this.prisma.db.appListing.update({ where: { id: app.id }, data: { installCount: { decrement: 1 } } });
    return { status: 'uninstalled' };
  }

  async installed(userId: string) {
    const rows = await this.prisma.db.appInstallation.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { app: { select: appCard }, version: { select: { version: true, permissions: true } } },
    });
    return rows;
  }

  async rate(slug: string, userId: string, rating: number, body: string) {
    const app = await this.prisma.db.appListing.findUnique({ where: { slug } });
    if (!app) throw notFound('APP_NOT_FOUND');
    const installed = await this.prisma.db.appInstallation.findUnique({ where: { appId_userId: { appId: app.id, userId } } });
    if (!installed) throw forbidden('INSTALL_REQUIRED');
    return this.prisma.db.appReview.upsert({
      where: { appId_userId: { appId: app.id, userId } },
      update: { rating, body },
      create: { appId: app.id, userId, rating, body },
    });
  }

  // --- Developer workspace -------------------------------------------------

  profile(userId: string) {
    return this.prisma.db.developerProfile.findUnique({ where: { userId } });
  }

  saveProfile(userId: string, body: { name: string; website?: string; bio?: string }) {
    return this.prisma.db.developerProfile.upsert({ where: { userId }, update: body, create: { ...body, userId } });
  }

  private async owned(id: string, userId: string) {
    const app = await this.prisma.db.appListing.findUnique({ where: { id } });
    if (!app || app.developerId !== userId) throw notFound('APP_NOT_FOUND');
    return app;
  }

  myApps(userId: string) {
    return this.prisma.db.appListing.findMany({
      where: { developerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: { versions: { orderBy: { createdAt: 'desc' } }, _count: { select: { installations: true } } },
    });
  }

  async createApp(userId: string, body: z.infer<typeof appBody>) {
    return this.prisma.db.appListing.create({
      data: { ...body, priceMinor: BigInt(body.priceMinor), slug: uniqueSlug(body.name), developerId: userId, iconKey: body.iconKey ?? null },
    });
  }

  async updateApp(id: string, userId: string, body: Partial<z.infer<typeof appBody>>) {
    await this.owned(id, userId);
    const { priceMinor, ...rest } = body;
    return this.prisma.db.appListing.update({
      where: { id },
      data: { ...rest, ...(priceMinor !== undefined ? { priceMinor: BigInt(priceMinor) } : {}) },
    });
  }

  async addVersion(id: string, userId: string, body: z.infer<typeof appVersionBody>) {
    await this.owned(id, userId);
    return this.prisma.db.appVersion.create({ data: { ...body, appId: id } });
  }

  /** Sends the app and its newest draft version to the review queue. */
  async submit(id: string, userId: string) {
    const app = await this.owned(id, userId);
    if (!['DRAFT', 'REJECTED', 'PUBLISHED'].includes(app.status)) throw conflict('APP_NOT_SUBMITTABLE');
    const draft = await this.prisma.db.appVersion.findFirst({ where: { appId: id, status: { in: ['DRAFT', 'REJECTED'] } }, orderBy: { createdAt: 'desc' } });
    if (!draft) throw badRequest('APP_NEEDS_VERSION');
    return this.prisma.tx(async (tx) => {
      await tx.appVersion.update({ where: { id: draft.id }, data: { status: 'IN_REVIEW' } });
      return tx.appListing.update({ where: { id }, data: { status: app.status === 'PUBLISHED' ? 'PUBLISHED' : 'IN_REVIEW' } });
    });
  }

  reviewQueue() {
    return this.prisma.db.appVersion.findMany({
      where: { status: 'IN_REVIEW' },
      orderBy: { createdAt: 'asc' },
      include: { app: { select: { id: true, slug: true, name: true, tagline: true, category: true, pricing: true, developer: { select: { profile: { select: { displayName: true } } } } } } },
    });
  }

  async review(versionId: string, reviewerId: string, approve: boolean, note?: string) {
    const version = await this.prisma.db.appVersion.findUnique({ where: { id: versionId }, include: { app: true } });
    if (!version || version.status !== 'IN_REVIEW') throw notFound('VERSION_NOT_IN_REVIEW');
    if (version.app.developerId === reviewerId) throw forbidden('CANNOT_REVIEW_OWN_APP');
    return this.prisma.tx(async (tx) => {
      await tx.appVersion.update({
        where: { id: versionId },
        data: { status: approve ? 'APPROVED' : 'REJECTED', reviewNote: note, reviewedById: reviewerId, reviewedAt: new Date() },
      });
      const live = version.app.status === 'PUBLISHED';
      return tx.appListing.update({
        where: { id: version.appId },
        data: { status: approve || live ? 'PUBLISHED' : 'REJECTED', reviewNote: note },
      });
    });
  }

  async analytics(userId: string) {
    const apps = await this.prisma.db.appListing.findMany({
      where: { developerId: userId },
      select: { id: true, name: true, status: true, installCount: true, _count: { select: { reviews: true } } },
    });
    const balances = await this.ledger.balancesFor('developer', [userId]);
    return { apps, balances };
  }

  // --- API keys ------------------------------------------------------------

  keys(userId: string) {
    return this.prisma.db.developerCredential.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, keyPrefix: true, scopes: true, env: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true, rateLimitPerMinute: true },
    });
  }

  /** The secret is shown once and only its hash is stored. */
  async createKey(userId: string, body: z.infer<typeof apiKeyBody>) {
    if (body.appId) await this.owned(body.appId, userId);
    const raw = `faith_${body.env === 'LIVE' ? 'live' : 'test'}_${randomToken(32)}`;
    const row = await this.prisma.db.developerCredential.create({
      data: {
        ownerId: userId, appId: body.appId, name: body.name, scopes: body.scopes, env: body.env,
        keyPrefix: raw.slice(0, 16), keyHash: sha256(raw),
        expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000) : null,
      },
    });
    return { id: row.id, key: raw, keyPrefix: row.keyPrefix, scopes: row.scopes, env: row.env };
  }

  async revokeKey(userId: string, id: string) {
    const { count } = await this.prisma.db.developerCredential.updateMany({
      where: { id, ownerId: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw notFound();
    return { status: 'revoked' };
  }

  // --- Webhooks ------------------------------------------------------------

  webhooks(userId: string) {
    return this.prisma.db.webhookEndpoint.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, url: true, events: true, active: true, createdAt: true,
        deliveries: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, eventType: true, status: true, attempts: true, responseStatus: true, lastError: true, createdAt: true } },
      },
    });
  }

  /** Public URLs only outside development: webhooks must not become an SSRF vector. */
  async createWebhook(userId: string, body: z.infer<typeof webhookBody>) {
    if (body.appId) await this.owned(body.appId, userId);
    const url = new URL(body.url);
    if (isProd && (url.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname))) {
      throw badRequest('WEBHOOK_URL_NOT_ALLOWED');
    }
    const secret = `whsec_${randomToken(32)}`;
    const row = await this.prisma.db.webhookEndpoint.create({ data: { ...body, ownerId: userId, secret: encrypt(secret) } });
    return { id: row.id, url: row.url, events: row.events, secret };
  }

  async deleteWebhook(userId: string, id: string) {
    const { count } = await this.prisma.db.webhookEndpoint.deleteMany({ where: { id, ownerId: userId } });
    if (count === 0) throw notFound();
    return { status: 'deleted' };
  }

  docs() {
    return { scopes: API_SCOPES };
  }
}
