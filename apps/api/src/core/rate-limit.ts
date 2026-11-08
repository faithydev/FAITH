import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { tooMany } from './errors';
import { env } from './env';

type Window = { count: number; resetAt: number };
const RATE_KEY = 'faith:rate';

/** Per-IP fixed window for a route. In-memory, so the limit applies per API instance. */
export const RateLimit = (limit: number, windowSeconds: number) => SetMetadata(RATE_KEY, { limit, windowSeconds });

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<{ limit: number; windowSeconds: number } | undefined>(RATE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!rule) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    // Integration tests exercise auth flows far faster than a person can. One test re-enables it.
    if (env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) return true;

    const key = `${ctx.getClass().name}.${ctx.getHandler().name}:${req.ip}`;
    const now = Date.now();
    const w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
      this.sweep(now);
      return true;
    }
    w.count += 1;
    if (w.count > rule.limit) throw tooMany();
    return true;
  }

  private sweep(now: number) {
    if (this.windows.size < 10_000) return;
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }
}
