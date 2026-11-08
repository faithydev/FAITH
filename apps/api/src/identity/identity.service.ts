import { Injectable } from '@nestjs/common';
import {
  ONBOARDING_QUESTIONS, Persona, PERSONA_ROLE, ROLE_WORKSPACES, RoleKey, SELF_ASSIGNABLE_ROLES, Workspace, WORKSPACES,
} from '@faith/config';
import { Prisma } from '@faith/database';
import type { organizationBody, orgMemberBody, preferencesBody, profileBody, verificationBody, onboardingBody } from '@faith/validators';
import type { z } from 'zod';
import { EntitlementsService } from '../auth/entitlements.service';
import type { AuthContext } from '../auth/context';
import { uniqueSlug } from '../core/crypto';
import { badRequest, conflict, forbidden, notFound } from '../core/errors';
import { FlagsService, AuditService } from '../core/platform.services';
import { PrismaService, Tx } from '../core/prisma.service';

export function workspacesFor(roles: string[]): Workspace[] {
  const owned = new Set(roles.flatMap((r) => ROLE_WORKSPACES[r as RoleKey] ?? []));
  owned.add('buyer');
  return WORKSPACES.filter((w) => owned.has(w));
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly flags: FlagsService,
    private readonly audit: AuditService,
  ) {}

  async me(a: AuthContext) {
    const [profile, plan, features, flags, unread, cartCount, badge] = await Promise.all([
      this.prisma.db.userProfile.findUnique({ where: { userId: a.user.id } }),
      this.entitlements.activePlan(a.user.id),
      this.entitlements.features(a.user.id),
      this.flags.publicState(a.user.id),
      this.prisma.db.notification.count({ where: { userId: a.user.id, readAt: null } }),
      this.prisma.db.cartItem.count({ where: { cart: { userId: a.user.id } } }),
      this.prisma.db.verifiedBadge.findUnique({ where: { userId: a.user.id }, select: { kind: true, status: true, grantAt: true, verifiedAt: true } }),
    ]);
    const workspaces = workspacesFor(a.roles);
    return {
      id: a.user.id,
      email: a.user.email,
      locale: a.user.locale,
      currency: a.user.currency,
      activeWorkspace: workspaces.includes(a.user.activeWorkspace as Workspace) ? a.user.activeWorkspace : 'buyer',
      onboarded: !!a.user.onboardingCompletedAt,
      twoFactor: !!a.user.twoFactorEnabledAt,
      profile,
      roles: a.roles,
      lockedRoles: a.lockedRoles,
      pro: a.pro,
      badge,
      permissions: [...a.permissions],
      workspaces,
      plan: { key: plan.plan?.key ?? 'free', renewsAt: plan.subscription?.currentPeriodEnd ?? null, cancelAtPeriodEnd: plan.subscription?.cancelAtPeriodEnd ?? false },
      features: [...features.keys()],
      flags,
      unreadNotifications: unread,
      cartCount,
    };
  }

  private async grantPersona(tx: Tx, userId: string, persona: Persona) {
    const key = PERSONA_ROLE[persona];
    if (!SELF_ASSIGNABLE_ROLES.includes(key)) throw forbidden('ROLE_NOT_ASSIGNABLE');
    const role = await tx.role.findUniqueOrThrow({ where: { key } });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
    return key;
  }

  onboardingQuestions(personas: Persona[]) {
    return personas.filter((p) => ONBOARDING_QUESTIONS[p]).map((p) => ({ persona: p, questions: ONBOARDING_QUESTIONS[p] }));
  }

  /** Grants only self-assignable roles. Staff roles cannot be reached through this path. */
  async completeOnboarding(a: AuthContext, body: z.infer<typeof onboardingBody>) {
    await this.prisma.tx(async (tx) => {
      const roles: RoleKey[] = [];
      for (const p of body.personas) roles.push(await this.grantPersona(tx, a.user.id, p));

      for (const persona of body.personas) {
        const allowed = ONBOARDING_QUESTIONS[persona] ?? [];
        for (const q of allowed) {
          const answer = body.answers[persona]?.[q.key];
          if (answer === undefined) continue;
          await tx.onboardingResponse.upsert({
            where: { userId_persona_question: { userId: a.user.id, persona, question: q.key } },
            update: { answer: answer as Prisma.InputJsonValue },
            create: { userId: a.user.id, persona, question: q.key, answer: answer as Prisma.InputJsonValue },
          });
        }
      }
      const first = roles.flatMap((r) => ROLE_WORKSPACES[r] ?? [])[0];
      await tx.user.update({
        where: { id: a.user.id },
        data: { onboardingCompletedAt: new Date(), activeWorkspace: first ?? 'buyer' },
      });
    });
    return { status: 'ok' };
  }

  async addPersona(a: AuthContext, persona: Persona) {
    await this.prisma.tx((tx) => this.grantPersona(tx, a.user.id, persona));
    return { status: 'ok' };
  }

  async updateProfile(userId: string, body: z.infer<typeof profileBody>) {
    if (body.username) {
      const owner = await this.prisma.db.userProfile.findUnique({ where: { username: body.username } });
      if (owner && owner.userId !== userId) throw conflict('USERNAME_TAKEN');
    }
    return this.prisma.db.userProfile.update({ where: { userId }, data: body });
  }

  async updatePreferences(a: AuthContext, body: z.infer<typeof preferencesBody>) {
    if (body.activeWorkspace && !workspacesFor(a.roles).includes(body.activeWorkspace)) {
      throw forbidden('WORKSPACE_NOT_AVAILABLE');
    }
    await this.prisma.db.user.update({ where: { id: a.user.id }, data: body });
    return { status: 'ok' };
  }

  // --- Organizations -------------------------------------------------------

  async myOrganizations(userId: string) {
    const rows = await this.prisma.db.organizationMember.findMany({
      where: { userId },
      include: { org: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({ ...m.org, memberRole: m.role }));
  }

  createOrganization(userId: string, body: z.infer<typeof organizationBody>) {
    return this.prisma.db.organization.create({
      data: { ...body, slug: uniqueSlug(body.name), members: { create: { userId, role: 'OWNER' } } },
    });
  }

  async assertOrgRole(orgId: string, userId: string, roles: ('OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER')[]) {
    const m = await this.prisma.db.organizationMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!m) throw notFound('ORGANIZATION_NOT_FOUND');
    if (!roles.includes(m.role)) throw forbidden('ORG_ROLE_REQUIRED');
    return m;
  }

  async members(orgId: string, userId: string) {
    await this.assertOrgRole(orgId, userId, ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']);
    return this.prisma.db.organizationMember.findMany({
      where: { orgId },
      include: { user: { select: { id: true, profile: { select: { displayName: true, username: true } } } } },
    });
  }

  async addMember(orgId: string, actorId: string, body: z.infer<typeof orgMemberBody>) {
    await this.assertOrgRole(orgId, actorId, ['OWNER', 'ADMIN']);
    const target = await this.prisma.db.user.findUnique({ where: { email: body.email } });
    // Same answer for an unknown address, so this cannot probe for accounts.
    if (!target) return { status: 'invited_if_registered' };
    await this.prisma.db.organizationMember.upsert({
      where: { orgId_userId: { orgId, userId: target.id } },
      update: { role: body.role },
      create: { orgId, userId: target.id, role: body.role },
    });
    await this.audit.record({ actor: { id: actorId }, action: 'org.member_added', resourceType: 'Organization', resourceId: orgId, metadata: { targetId: target.id, role: body.role } });
    return { status: 'invited_if_registered' };
  }

  async removeMember(orgId: string, actorId: string, targetId: string) {
    await this.assertOrgRole(orgId, actorId, ['OWNER', 'ADMIN']);
    const target = await this.prisma.db.organizationMember.findUnique({ where: { orgId_userId: { orgId, userId: targetId } } });
    if (!target) throw notFound();
    if (target.role === 'OWNER') throw badRequest('CANNOT_REMOVE_OWNER');
    await this.prisma.db.organizationMember.delete({ where: { orgId_userId: { orgId, userId: targetId } } });
    return { status: 'ok' };
  }

  // --- Verification --------------------------------------------------------

  async requestVerification(userId: string, body: z.infer<typeof verificationBody>) {
    if (body.orgId) await this.assertOrgRole(body.orgId, userId, ['OWNER', 'ADMIN']);
    const open = await this.prisma.db.verificationRequest.findFirst({ where: { userId, kind: body.kind, status: 'PENDING' } });
    if (open) throw conflict('VERIFICATION_PENDING');
    return this.prisma.db.verificationRequest.create({
      data: { userId, kind: body.kind, orgId: body.orgId, evidence: { note: body.note ?? null } },
    });
  }

  myVerifications(userId: string) {
    return this.prisma.db.verificationRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
}
