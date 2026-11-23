import { Controller, Get, HttpCode, Injectable, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { STAFF_ROLES, type RoleKey } from '@faith/config';
import { violationBody } from '@faith/validators';
import type { z } from 'zod';
import { AuditService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';
import { RateLimit } from '../core/rate-limit';
import { ZBody } from '../core/zod';
import { Auth, AuthContext, ClientIp } from './context';

/** Warnings before the block. */
export const STRIKE_LIMIT = 3;
/** Older attempts are forgiven. */
const STRIKE_WINDOW_MS = 7 * 86_400_000;
/** How long the account stays signed out once the limit is reached. */
export const BLOCK_MS = 24 * 3_600_000;
/** One key press can fire on key down and key up; within this gap it counts once. */
const DEBOUNCE_MS = 5_000;

/**
 * Strikes for trying to capture protected video. A web page cannot see a screen recorder; it
 * can see a screenshot key or the desktop app's capture guard, and reports those here. Each one
 * is a warning; the third within a week signs the account out everywhere for a day.
 */
@Injectable()
export class ProtectionService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async strikes(userId: string, blockedUntil: Date | null) {
    const since = new Date(Math.max(Date.now() - STRIKE_WINDOW_MS, blockedUntil?.getTime() ?? 0));
    return this.prisma.db.securityEvent.count({ where: { userId, kind: 'content.violation', createdAt: { gt: since } } });
  }

  async status(a: AuthContext) {
    return { strikes: await this.strikes(a.user.id, a.user.contentBlockedUntil), limit: STRIKE_LIMIT };
  }

  /** People never get strikes on their own videos, and staff never do. */
  private async exempt(a: AuthContext, contentId?: string) {
    if (a.roles.some((r) => STAFF_ROLES.includes(r as RoleKey))) return true;
    if (!contentId) return false;
    const [lesson, post] = await Promise.all([
      this.prisma.db.lesson.count({ where: { id: contentId, section: { course: { creatorId: a.user.id } } } }),
      this.prisma.db.post.count({ where: { id: contentId, community: { ownerId: a.user.id } } }),
    ]);
    return lesson + post > 0;
  }

  async violation(a: AuthContext, body: z.infer<typeof violationBody>, ip?: string) {
    const userId = a.user.id;
    if (await this.exempt(a, body.contentId)) return { strikes: 0, limit: STRIKE_LIMIT, blockedUntil: null, exempt: true };

    const last = await this.prisma.db.securityEvent.findFirst({ where: { userId, kind: 'content.violation' }, orderBy: { createdAt: 'desc' } });
    if (!last || Date.now() - last.createdAt.getTime() > DEBOUNCE_MS) {
      await this.audit.security('content.violation', { userId, ip, metadata: { kind: body.kind, contentId: body.contentId ?? null } });
    }
    const strikes = await this.strikes(userId, a.user.contentBlockedUntil);
    if (strikes < STRIKE_LIMIT) return { strikes, limit: STRIKE_LIMIT, blockedUntil: null, exempt: false };

    const blockedUntil = new Date(Date.now() + BLOCK_MS);
    await this.prisma.tx(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { contentBlockedUntil: blockedUntil } });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'blocked' } });
      await this.audit.record({ actor: { id: userId }, action: 'user.content_blocked', resourceType: 'User', resourceId: userId, metadata: { until: blockedUntil.toISOString(), strikes } }, tx);
    });
    await this.audit.security('content.blocked', { userId, ip, metadata: { until: blockedUntil.toISOString() } });
    return { strikes: STRIKE_LIMIT, limit: STRIKE_LIMIT, blockedUntil, exempt: false };
  }

  /** For administrators: lift a block early. The block's end moves to now, so earlier strikes stay spent. */
  async unblock(actorId: string, userId: string) {
    await this.prisma.db.user.update({ where: { id: userId }, data: { contentBlockedUntil: new Date() } });
    await this.audit.record({ actor: { id: actorId }, action: 'user.content_unblocked', resourceType: 'User', resourceId: userId });
    return { status: 'ok' };
  }
}

@ApiTags('protection')
@Controller('protection')
export class ProtectionController {
  constructor(private readonly protection: ProtectionService) {}

  /** A signed-in check the player makes while it plays: it learns at once when this device was signed out. */
  @Get('status')
  status(@Auth() a: AuthContext) {
    return this.protection.status(a);
  }

  @Post('violations') @HttpCode(200) @RateLimit(30, 60)
  violation(@Auth() a: AuthContext, @ZBody(violationBody) b: z.infer<typeof violationBody>, @ClientIp() ip?: string) {
    return this.protection.violation(a, b, ip);
  }
}
