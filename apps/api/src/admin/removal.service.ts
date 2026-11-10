/**
 * Account removal by the platform owners.
 *
 * Money records can never be deleted (the ledger refuses it), so a removed account is stripped of
 * everything personal and kept as an anonymous row that orders and ledger lines still point to.
 * Everything the account showed in public is taken down in the same transaction.
 */
import { Injectable } from '@nestjs/common';
import { badRequest, forbidden } from '../core/errors';
import { AuditService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';
import type { AuthContext } from '../auth/context';

export type RemovalPreview = { keep: { email: string; name: string | null }[]; remove: number; missing: string[] };

@Injectable()
export class RemovalService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private assertOwner(a: AuthContext) {
    if (!a.roles.includes('super_admin')) throw forbidden('SUPER_ADMIN_REQUIRED');
  }

  private async plan(a: AuthContext, keepEmails: string[]) {
    const wanted = [...new Set(keepEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const kept = await this.prisma.db.user.findMany({
      where: { OR: [{ id: a.user.id }, { email: { in: wanted, mode: 'insensitive' } }], status: { not: 'DELETED' } },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
    });
    const found = new Set(kept.map((k) => k.email.toLowerCase()));
    const missing = wanted.filter((e) => !found.has(e));
    const where = { id: { notIn: kept.map((k) => k.id) }, status: { not: 'DELETED' as const } };
    return { kept, missing, where };
  }

  /** What a removal would do, without doing it. */
  async preview(a: AuthContext, keepEmails: string[]): Promise<RemovalPreview> {
    this.assertOwner(a);
    const { kept, missing, where } = await this.plan(a, keepEmails);
    return {
      keep: kept.map((k) => ({ email: k.email, name: k.profile?.displayName ?? null })),
      remove: await this.prisma.db.user.count({ where }),
      missing,
    };
  }

  /**
   * Removes every account except the caller and the listed emails. Refuses when a listed email
   * matches no account, so a typo can never remove someone who was meant to stay.
   */
  async removeOthers(a: AuthContext, keepEmails: string[]) {
    this.assertOwner(a);
    const { kept, missing, where } = await this.plan(a, keepEmails);
    if (missing.length) throw badRequest('KEEP_EMAIL_NOT_FOUND');
    const ids = (await this.prisma.db.user.findMany({ where, select: { id: true } })).map((u) => u.id);
    const now = new Date();

    // In slices, so one very large clean-up cannot hold a single huge transaction open.
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const owner = { in: slice };
      await this.prisma.db.$transaction(async (tx) => {
        // Public listings come down first.
        const stores = (await tx.store.findMany({ where: { ownerId: owner }, select: { id: true } })).map((s) => s.id);
        await tx.product.updateMany({ where: { storeId: { in: stores }, status: { in: ['PUBLISHED', 'IN_REVIEW'] } }, data: { status: 'ARCHIVED' } });
        await tx.store.updateMany({ where: { id: { in: stores } }, data: { status: 'SUSPENDED' } });
        await tx.job.updateMany({ where: { postedById: owner, status: { in: ['OPEN', 'PENDING_REVIEW'] } }, data: { status: 'CLOSED' } });
        await tx.serviceListing.updateMany({ where: { freelancerId: owner, status: 'PUBLISHED' }, data: { status: 'PAUSED' } });
        await tx.course.updateMany({ where: { creatorId: owner, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
        await tx.community.updateMany({ where: { ownerId: owner }, data: { visibility: 'PRIVATE' } });
        await tx.post.updateMany({ where: { authorId: owner, status: 'VISIBLE' }, data: { status: 'REMOVED' } });
        await tx.customerReview.updateMany({ where: { userId: owner, status: 'VISIBLE' }, data: { status: 'HIDDEN' } });
        await tx.appListing.updateMany({ where: { developerId: owner, status: { in: ['PUBLISHED', 'IN_REVIEW'] } }, data: { status: 'SUSPENDED' } });
        await tx.advertisement.updateMany({ where: { createdById: owner, status: { in: ['ACTIVE', 'PENDING_REVIEW', 'PAUSED'] } }, data: { status: 'ENDED' } });
        // A campaign stays up only while its organization still has a member.
        await tx.organizationMember.deleteMany({ where: { userId: owner } });
        await tx.brandCampaign.updateMany({ where: { status: { in: ['ACTIVE', 'PENDING_REVIEW'] }, org: { members: { none: {} } } }, data: { status: 'PAUSED' } });

        // Access and money in motion.
        await tx.session.updateMany({ where: { userId: owner, revokedAt: null }, data: { revokedAt: now } });
        await tx.account.deleteMany({ where: { userId: owner } });
        await tx.authToken.deleteMany({ where: { userId: owner } });
        await tx.developerCredential.updateMany({ where: { ownerId: owner, revokedAt: null }, data: { revokedAt: now } });
        await tx.webhookEndpoint.updateMany({ where: { ownerId: owner }, data: { active: false } });
        await tx.payoutRequest.updateMany({ where: { requestedById: owner, status: { in: ['REQUESTED', 'APPROVED'] } }, data: { status: 'REJECTED' } });
        await tx.subscription.updateMany({ where: { userId: owner, status: { in: ['ACTIVE', 'PENDING', 'PAST_DUE'] } }, data: { status: 'CANCELED', canceledAt: now } });

        // Personal data.
        await tx.userRole.deleteMany({ where: { userId: owner } });
        await tx.verifiedBadge.deleteMany({ where: { userId: owner } });
        await tx.candidateProfile.deleteMany({ where: { userId: owner } });
        await tx.freelancerProfile.deleteMany({ where: { userId: owner } });
        await tx.creatorProfile.deleteMany({ where: { userId: owner } });
        await tx.notification.deleteMany({ where: { userId: owner } });
        await tx.cart.deleteMany({ where: { userId: owner } });
        for (const id of slice) {
          await tx.user.update({
            where: { id },
            data: {
              email: `deleted+${id}@deleted.faith.invalid`, passwordHash: null, status: 'DELETED', deletedAt: now, deletionRequestedAt: now,
              twoFactorSecret: null, twoFactorEnabledAt: null, twoFactorBackupHashes: [],
            },
          });
          await tx.userProfile.updateMany({
            where: { userId: id },
            data: { displayName: 'Deleted user', username: `deleted_${id}`, bio: null, avatarKey: null, website: null, country: null, recommendationsConsent: false },
          });
        }
      }, { timeout: 120_000, maxWait: 20_000 });
    }

    await this.audit.record({ actor: { id: a.user.id }, action: 'accounts.removed', resourceType: 'User', metadata: { removed: ids.length, kept: kept.length } });
    return { removed: ids.length, kept: kept.length };
  }
}
