import {
  CanActivate, Controller, createParamDecorator, ExecutionContext, Get, Injectable, SetMetadata, UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { ApiScope } from '@faith/config';
import type { DeveloperCredential } from '@faith/database';
import type { Request } from 'express';
import { Public } from '../auth/context';
import { sha256 } from '../core/crypto';
import { forbidden, tooMany, unauthorized } from '../core/errors';
import { PrismaService } from '../core/prisma.service';

const SCOPE_KEY = 'faith:scope';
const Scope = (scope: ApiScope) => SetMetadata(SCOPE_KEY, scope);
type KeyRequest = Request & { credential?: DeveloperCredential };

export const Credential = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<KeyRequest>().credential!;
});

/** API-key authentication with scope checks and a per-key rate limit. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<KeyRequest>();
    const raw = req.headers['x-api-key'];
    if (typeof raw !== 'string') throw unauthorized('API_KEY_REQUIRED');
    const key = await this.prisma.db.developerCredential.findUnique({ where: { keyHash: sha256(raw) } });
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date())) throw unauthorized('INVALID_API_KEY');

    const scope = this.reflector.get<ApiScope | undefined>(SCOPE_KEY, ctx.getHandler());
    if (scope && !key.scopes.includes(scope)) throw forbidden('INSUFFICIENT_SCOPE');

    const now = Date.now();
    const w = this.windows.get(key.id);
    if (!w || w.resetAt <= now) this.windows.set(key.id, { count: 1, resetAt: now + 60_000 });
    else if (++w.count > key.rateLimitPerMinute) throw tooMany();

    void this.prisma.db.developerCredential.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    req.credential = key;
    return true;
  }
}

const SANDBOX_PRODUCTS = [
  { id: 'prod_sandbox_1', slug: 'sandbox-template', title: 'Sandbox template', status: 'PUBLISHED', currency: 'USD', priceFromMinor: '1900' },
];
const SANDBOX_ORDERS = [
  { id: 'order_sandbox_1', number: 'F-SANDBOX-1', status: 'PAID', currency: 'USD', netMinor: '1900', commissionMinor: '67' },
];

/**
 * The third-party API. Sandbox keys get fixed sample data and never touch real records. Live
 * keys only ever see resources belonging to the key's owner.
 */
@ApiTags('public-api')
@ApiSecurity('api-key')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('public')
export class PublicApiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me') @Scope('profile:read')
  async me(@Credential() key: DeveloperCredential) {
    const p = await this.prisma.db.userProfile.findUnique({ where: { userId: key.ownerId }, select: { displayName: true, username: true } });
    return { ...p, env: key.env, scopes: key.scopes };
  }

  @Get('products') @Scope('products:read')
  async products(@Credential() key: DeveloperCredential) {
    if (key.env === 'SANDBOX') return { sandbox: true, items: SANDBOX_PRODUCTS };
    const items = await this.prisma.db.product.findMany({
      where: { store: { ownerId: key.ownerId } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, slug: true, title: true, status: true, currency: true, priceFromMinor: true, salesCount: true },
    });
    return { sandbox: false, items };
  }

  @Get('orders') @Scope('orders:read')
  async orders(@Credential() key: DeveloperCredential) {
    if (key.env === 'SANDBOX') return { sandbox: true, items: SANDBOX_ORDERS };
    const rows = await this.prisma.db.sellerOrder.findMany({
      where: { store: { ownerId: key.ownerId }, status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
      orderBy: { order: { paidAt: 'desc' } },
      take: 100,
      include: { order: { select: { number: true, currency: true, paidAt: true } } },
    });
    return {
      sandbox: false,
      items: rows.map((r) => ({
        id: r.id, number: r.order.number, status: r.status, currency: r.order.currency, paidAt: r.order.paidAt,
        netMinor: r.netMinor, commissionMinor: r.commissionMinor, sellerNetMinor: r.sellerNetMinor, refundedMinor: r.refundedMinor,
      })),
    };
  }

  @Get('campaigns') @Scope('campaigns:read')
  async campaigns(@Credential() key: DeveloperCredential) {
    if (key.env === 'SANDBOX') return { sandbox: true, items: [] };
    const orgs = await this.prisma.db.organizationMember.findMany({ where: { userId: key.ownerId }, select: { orgId: true } });
    const items = await this.prisma.db.brandCampaign.findMany({
      where: { orgId: { in: orgs.map((o) => o.orgId) } },
      select: { id: true, slug: true, title: true, status: true, currency: true, budgetMinor: true, accruedMinor: true },
    });
    return { sandbox: false, items };
  }
}
