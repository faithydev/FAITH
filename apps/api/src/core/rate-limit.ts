import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { tooMany } from './errors';
import { env } from './env';

type Window = { count: number; resetAt: number };
const RATE_KEY = 'faith:rate';

/** Per-IP fixed window for a route. In-memory, so the limit applies per API instance. */
export const RateLimit = (limit: number, windowSeconds: number) => SetMetadata(RATE_KEY, { limit, windowSeconds });

/**
 * Every change without its own limit shares one per-IP budget, so no write route can be
 * hammered. Reads stay unlimited here: the web app's server renders pages for everyone from a
 * few addresses. Payment-provider webhooks are exempt; providers retry on their own schedule.
 */
// Generous, because mobile carriers put many people behind one address (CGNAT).
const WRITE_DEFAULT = { limit: 300, windowSeconds: 60 };
const isWrite = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<{ limit: number; windowSeconds: number } | undefined>(RATE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<Request>();
    const shared = !rule && isWrite(req.method) && !req.path.includes('/webhooks/');
    if (!rule && !shared) return true;
    // Integration tests exercise auth flows far faster than a person can. One test re-enables it.
    if (env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) return true;

    const limit = rule ?? WRITE_DEFAULT;
    const key = shared ? `writes:${req.ip}` : `${ctx.getClass().name}.${ctx.getHandler().name}:${req.ip}`;
    const now = Date.now();
    const w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + limit.windowSeconds * 1000 });
      this.sweep(now);
      return true;
    }
    w.count += 1;
    if (w.count > limit.limit) throw tooMany();
    return true;
  }

  private sweep(now: number) {
    if (this.windows.size < 10_000) return;
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }
}
