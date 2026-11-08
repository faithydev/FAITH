import {
  CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Feature, Permission } from '@faith/config';
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
  roles: string[];
  permissions: Set<string>;
};

export type AuthedRequest = Request & { auth?: AuthContext };

const PUBLIC_KEY = 'faith:public';
const PERMISSION_KEY = 'faith:permission';
const FEATURE_KEY = 'faith:feature';

/** Route needs no session. A valid session, if present, is still attached. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Route needs every listed permission. Checked on the server for every request. */
export const RequirePermission = (...p: Permission[]) => SetMetadata(PERMISSION_KEY, p);
/** Route needs a subscription entitlement. */
export const RequireFeature = (f: Feature) => SetMetadata(FEATURE_KEY, f);

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
    if (token) req.auth = await this.resolve(token);
    if (req.auth?.user.status === 'SUSPENDED' && !isPublic) throw forbidden('ACCOUNT_SUSPENDED');
    if (!req.auth && !isPublic) throw unauthorized();
    return true;
  }

  private async resolve(token: string): Promise<AuthContext | undefined> {
    const session = await this.prisma.db.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return undefined;
    const { user, ...rest } = session;
    if (user.status === 'DELETED') return undefined;

    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
      await this.prisma.db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    const { roles, ...plainUser } = user;
    return {
      user: plainUser,
      session: rest,
      roles: roles.map((r) => r.role.key),
      permissions: new Set(roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
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
    if (required.length === 0 && !feature) return true;

    const auth = ctx.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth) throw unauthorized();
    if (required.some((p) => !auth.permissions.has(p))) throw forbidden('MISSING_PERMISSION');
    if (feature && !(await this.entitlements.has(auth.user.id, feature))) throw forbidden('PLAN_UPGRADE_REQUIRED');
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
