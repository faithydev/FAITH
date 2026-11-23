import {
  CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FREE_ROLES, STAFF_ROLES, type Feature, type Permission, type RoleKey } from '@faith/config';
import type { Session, User } from '@faith/database';
import type { Request } from 'express';
import { env } from '../core/env';
import { forbidden, unauthorized } from '../core/errors';
import { sha256 } from '../core/crypto';
import { PrismaService } from '../core/prisma.service';
import { EntitlementsService } from './entitlements.service';

export const SESSION_COOKIE = 'faith_session';

export type AuthContext = {
  user: User;
  session: Session;
  /** Roles in effect now. Without Pro only free roles (and staff roles) are in effect. */
  roles: string[];
  /** Roles the person holds that wait for Pro. */
  lockedRoles: string[];
  pro: boolean;
  permissions: Set<string>;
};

export type AuthedRequest = Request & { auth?: AuthContext };

const PUBLIC_KEY = 'faith:public';
const PERMISSION_KEY = 'faith:permission';
const FEATURE_KEY = 'faith:feature';
const RECENT_KEY = 'faith:recent-auth';

/** Route needs no session. A valid session, if present, is still attached. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Route needs every listed permission. Checked on the server for every request. */
export const RequirePermission = (...p: Permission[]) => SetMetadata(PERMISSION_KEY, p);
/** Route needs a subscription entitlement. */
export const RequireFeature = (f: Feature) => SetMetadata(FEATURE_KEY, f);
/**
 * For actions that cannot be undone or that move money or power: the session must have been
 * opened by a sign-in within the last `minutes`. A stolen session cookie is then useless for
 * them once it is older than that, and the owner simply signs in again.
 */
export const RequireRecentAuth = (minutes = 30) => SetMetadata(RECENT_KEY, minutes);

export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().auth!;
});
export const OptionalAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext | undefined => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().auth;
});
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
  return ctx.switchToHttp().getRequest<Request>().ip;
});

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    let ended: string | undefined;
    if (token) {
      const resolved = await this.resolve(token);
      if (resolved && 'ended' in resolved) ended = resolved.ended;
      else req.auth = resolved;
    }
    if (req.auth?.user.status === 'SUSPENDED' && !isPublic) throw forbidden('ACCOUNT_SUSPENDED');
    if (!req.auth && !isPublic) {
      // Say why the session ended, so the device that lost it can tell its owner.
      if (ended === 'replaced') throw unauthorized('SESSION_REPLACED');
      if (ended === 'blocked') throw unauthorized('ACCOUNT_TEMP_BLOCKED');
      throw unauthorized();
    }
    return true;
  }

  private async resolve(token: string): Promise<AuthContext | { ended: string } | undefined> {
    const session = await this.prisma.db.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        user: {
          include: {
            roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
            subscriptions: { where: { status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } }, select: { id: true }, take: 1 },
          },
        },
      },
    });
    if (session?.revokedAt && session.revokedReason) return { ended: session.revokedReason };
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return undefined;
    const { user, ...rest } = session;
    if (user.status === 'DELETED') return undefined;

    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
      await this.prisma.db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    const { roles, subscriptions, ...plainUser } = user;
    const pro = subscriptions.length > 0;
    const open = (key: string) => pro || FREE_ROLES.includes(key as RoleKey) || STAFF_ROLES.includes(key as RoleKey);
    const active = roles.filter((r) => open(r.role.key));
    return {
      user: plainUser,
      session: rest,
      roles: active.map((r) => r.role.key),
      lockedRoles: roles.filter((r) => !open(r.role.key)).map((r) => r.role.key),
      pro,
      permissions: new Set(active.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
    };
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly entitlements: EntitlementsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const required = this.reflector.getAllAndMerge<Permission[]>(PERMISSION_KEY, targets);
    const feature = this.reflector.getAllAndOverride<Feature | undefined>(FEATURE_KEY, targets);
    const recent = this.reflector.getAllAndOverride<number | undefined>(RECENT_KEY, targets);
    if (required.length === 0 && !feature && !recent) return true;

    const auth = ctx.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth) throw unauthorized();
    if (required.some((p) => !auth.permissions.has(p))) throw forbidden('MISSING_PERMISSION');
    if (feature && !(await this.entitlements.has(auth.user.id, feature))) throw forbidden('PLAN_UPGRADE_REQUIRED');
    if (recent && Date.now() - auth.session.createdAt.getTime() > recent * 60_000) throw forbidden('REAUTH_REQUIRED');
    return true;
  }
}

/**
 * Rejects cross-site state changes. Browsers always send Origin on these requests, and
 * cookie-less clients such as API-key integrations are not exposed to CSRF.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const origin = req.headers.origin;
    if (!origin || origin === env.WEB_ORIGIN || origin === env.API_ORIGIN) return true;
    // Apple returns the user with a form POST from its own origin; the callback checks its state.
    if (origin === 'https://appleid.apple.com' && req.path.endsWith('/auth/oauth/apple/callback')) return true;
    throw forbidden('BAD_ORIGIN');
  }
}
