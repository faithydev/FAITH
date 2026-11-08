import { Injectable } from '@nestjs/common';
import { DEFAULT_LOCALE, LOCALES, Locale, PERSONA_ROLE } from '@faith/config';
import type { AuthTokenType, User } from '@faith/database';
import { hash, verify } from '@node-rs/argon2';
import { generateSecret, generateURI, verifySync } from 'otplib';
import type { z } from 'zod';
import type { deleteAccountBody, loginBody, registerBody } from '@faith/validators';
import { EmailService } from '../core/adapters';
import { decrypt, encrypt, randomToken, sha256, slugify } from '../core/crypto';
import { env } from '../core/env';
import { appleConfigured } from './apple';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../core/errors';
import { AuditService } from '../core/platform.services';
import { PrismaService } from '../core/prisma.service';
import { renderEmail } from './emails';

const SESSION_DAYS = 30;
const LOCK_AFTER = 8;
const LOCK_MINUTES = 15;

// Verifying against this when the account does not exist keeps response times alike.
const DUMMY_HASH = hash('faith-timing-equaliser-not-a-password');

export type SessionMeta = { userAgent?: string; ip?: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  private link(path: string, token: string, locale: string) {
    const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
    return `${env.WEB_ORIGIN}${prefix}${path}?token=${encodeURIComponent(token)}`;
  }

  private async issueToken(userId: string, type: AuthTokenType, ttlMinutes: number) {
    const token = randomToken();
    await this.prisma.db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.db.authToken.create({
      data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
    });
    return token;
  }

  private async consumeToken(token: string, type: AuthTokenType) {
    const row = await this.prisma.db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.type !== type || row.usedAt || row.expiresAt <= new Date()) throw badRequest('INVALID_TOKEN');
    const { count } = await this.prisma.db.authToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count !== 1) throw badRequest('INVALID_TOKEN');
    return row;
  }

  /**
   * The answer is the same whether or not the address is taken, so this endpoint cannot be
   * used to discover who has an account. An existing owner gets a heads-up email instead.
   */
  async register(body: z.infer<typeof registerBody>) {
    const passwordHash = await hash(body.password);
    const locale: Locale = body.locale ?? DEFAULT_LOCALE;
    const existing = await this.prisma.db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      const token = await this.issueToken(existing.id, 'PASSWORD_RESET', 60);
      await this.email.send({ to: existing.email, ...renderEmail('exists', existing.locale, this.link('/reset-password', token, existing.locale)) });
      return;
    }
    const customer = await this.prisma.db.role.findUniqueOrThrow({ where: { key: 'customer' } });
    const user = await this.prisma.db.user.create({
      data: {
        email: body.email,
        passwordHash,
        locale,
        // A public demo cannot send email, so its accounts are usable at once.
        emailVerifiedAt: env.PUBLIC_DEMO ? new Date() : null,
        profile: { create: { displayName: body.displayName, username: await this.freeUsername(body.displayName) } },
        roles: { create: { roleId: customer.id } },
      },
    });
    await this.announce(user.id, body.displayName, user.email, 'email');
    if (!env.PUBLIC_DEMO) await this.sendVerification(user);
  }

  /** Tells the platform owners about a new account (drained into notifications by the worker). */
  private announce(userId: string, name: string, email: string, method: string) {
    return this.prisma.db.outboxEvent.create({ data: { type: 'user.registered', payload: { userId, name, email, method } } });
  }

  private async freeUsername(displayName: string) {
    const base = slugify(displayName).replace(/-/g, '_').slice(0, 24) || 'user';
    for (let i = 0; i < 6; i++) {
      const candidate = i === 0 ? base : `${base}_${randomToken(2).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const taken = await this.prisma.db.userProfile.findUnique({ where: { username: candidate } });
      if (!taken) return candidate;
    }
    return `user_${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }

  private async sendVerification(user: User) {
    const token = await this.issueToken(user.id, 'EMAIL_VERIFY', 60 * 24);
    await this.email.send({ to: user.email, ...renderEmail('verify', user.locale, this.link('/verify-email', token, user.locale)) });
  }

  async resendVerification(email: string) {
    const user = await this.prisma.db.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt && user.status === 'ACTIVE') await this.sendVerification(user);
  }

  async verifyEmail(token: string, meta: SessionMeta) {
    const row = await this.consumeToken(token, 'EMAIL_VERIFY');
    const user = await this.prisma.db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
    await this.audit.record({ actor: user, action: 'auth.email_verified', resourceType: 'User', resourceId: user.id });
    return this.createSession(user.id, meta);
  }

  async login(body: z.infer<typeof loginBody>, meta: SessionMeta) {
    const user = await this.prisma.db.user.findUnique({ where: { email: body.email } });
    const usable = user && user.passwordHash && user.status !== 'DELETED';
    if (!usable) {
      await verify(await DUMMY_HASH, body.password);
      throw unauthorized('INVALID_CREDENTIALS');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await verify(await DUMMY_HASH, body.password);
      throw unauthorized('INVALID_CREDENTIALS');
    }
    if (!(await verify(user.passwordHash!, body.password))) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= LOCK_AFTER;
      await this.prisma.db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined },
      });
      if (lock) await this.audit.security('auth.locked', { userId: user.id, ip: meta.ip });
      throw unauthorized('INVALID_CREDENTIALS');
    }
    // Past this point the caller has proven they know the password.
    if (!user.emailVerifiedAt) throw forbidden('EMAIL_NOT_VERIFIED');
    if (user.status === 'SUSPENDED') throw forbidden('ACCOUNT_SUSPENDED');
    if (user.twoFactorEnabledAt) {
      if (!body.totp) throw unauthorized('TOTP_REQUIRED');
      await this.assertSecondFactor(user, body.totp);
    }
    await this.prisma.db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await this.audit.security('auth.login', { userId: user.id, ip: meta.ip });
    return this.createSession(user.id, meta);
  }

  async assertSecondFactor(user: User, code: string) {
    const clean = code.replace(/\s/g, '');
    const secret = user.twoFactorSecret ? decrypt(user.twoFactorSecret) : null;
    // Authenticator codes are always six digits; anything else can only be a backup code.
    if (secret && /^\d{6}$/.test(clean) && verifySync({ secret, token: clean, epochTolerance: 30 }).valid) return;
    const hashed = sha256(clean);
    if (user.twoFactorBackupHashes.includes(hashed)) {
      await this.prisma.db.user.update({
        where: { id: user.id },
        data: { twoFactorBackupHashes: user.twoFactorBackupHashes.filter((h) => h !== hashed) },
      });
      return;
    }
    throw unauthorized('INVALID_TOTP');
  }

  async createSession(userId: string, meta: SessionMeta) {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await this.prisma.db.session.create({
      data: { userId, tokenHash: sha256(token), expiresAt, userAgent: meta.userAgent?.slice(0, 300), ipAddress: meta.ip },
    });
    return { token, expiresAt };
  }

  logout(sessionId: string) {
    return this.prisma.db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  async forgot(email: string) {
    const user = await this.prisma.db.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;
    const token = await this.issueToken(user.id, 'PASSWORD_RESET', 60);
    await this.email.send({ to: user.email, ...renderEmail('reset', user.locale, this.link('/reset-password', token, user.locale)) });
  }

  async reset(token: string, password: string) {
    const row = await this.consumeToken(token, 'PASSWORD_RESET');
    await this.prisma.db.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hash(password), failedLoginCount: 0, lockedUntil: null },
    });
    await this.revokeAll(row.userId);
    await this.audit.security('auth.password_reset', { userId: row.userId });
  }

  async changePassword(user: User, current: string, next: string, keepSessionId: string) {
    if (!user.passwordHash || !(await verify(user.passwordHash, current))) throw unauthorized('INVALID_CREDENTIALS');
    await this.prisma.db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(next) } });
    await this.revokeAll(user.id, keepSessionId);
    await this.audit.security('auth.password_changed', { userId: user.id });
  }

  revokeAll(userId: string, exceptId?: string) {
    return this.prisma.db.session.updateMany({
      where: { userId, revokedAt: null, id: exceptId ? { not: exceptId } : undefined },
      data: { revokedAt: new Date() },
    });
  }

  sessions(userId: string) {
    return this.prisma.db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true, expiresAt: true },
    });
  }

  async revokeSession(userId: string, id: string) {
    const { count } = await this.prisma.db.session.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (count === 0) throw notFound();
  }

  // --- Two-factor ----------------------------------------------------------

  async twoFactorSetup(user: User) {
    if (user.twoFactorEnabledAt) throw conflict('TOTP_ALREADY_ENABLED');
    const secret = generateSecret();
    await this.prisma.db.user.update({ where: { id: user.id }, data: { twoFactorSecret: encrypt(secret) } });
    return { secret, uri: generateURI({ issuer: 'FAITH', label: user.email, secret }) };
  }

  async twoFactorEnable(user: User, code: string) {
    if (!user.twoFactorSecret) throw badRequest('TOTP_NOT_STARTED');
    if (!/^\d{6}$/.test(code) || !verifySync({ secret: decrypt(user.twoFactorSecret), token: code, epochTolerance: 30 }).valid) {
      throw unauthorized('INVALID_TOTP');
    }
    const backupCodes = Array.from({ length: 8 }, () => randomToken(6));
    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabledAt: new Date(), twoFactorBackupHashes: backupCodes.map(sha256) },
    });
    await this.audit.security('auth.2fa_enabled', { userId: user.id });
    return { backupCodes };
  }

  async twoFactorDisable(user: User, code: string) {
    await this.assertSecondFactor(user, code);
    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabledAt: null, twoFactorSecret: null, twoFactorBackupHashes: [] },
    });
    await this.audit.security('auth.2fa_disabled', { userId: user.id });
  }

  /**
   * Removes personal data while keeping financial records, which must stay intact.
   * The row remains with an anonymised address so ledger references stay valid.
   */
  async deleteAccount(user: User, body: z.infer<typeof deleteAccountBody>) {
    if (!user.passwordHash || !(await verify(user.passwordHash, body.password))) throw unauthorized('INVALID_CREDENTIALS');
    const open = await this.prisma.db.payoutRequest.count({
      where: { requestedById: user.id, status: { in: ['REQUESTED', 'APPROVED'] } },
    });
    if (open > 0) throw conflict('OPEN_PAYOUTS');
    const anonymous = `deleted+${user.id}@deleted.faith.invalid`;
    await this.prisma.tx(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: anonymous, passwordHash: null, status: 'DELETED', deletedAt: new Date(), deletionRequestedAt: new Date(),
          twoFactorSecret: null, twoFactorEnabledAt: null, twoFactorBackupHashes: [],
        },
      });
      await tx.userProfile.updateMany({
        where: { userId: user.id },
        data: { displayName: 'Deleted user', username: `deleted_${user.id}`, bio: null, avatarKey: null, website: null, country: null, recommendationsConsent: false },
      });
      await tx.candidateProfile.deleteMany({ where: { userId: user.id } });
      await tx.freelancerProfile.deleteMany({ where: { userId: user.id } });
      await tx.creatorProfile.deleteMany({ where: { userId: user.id } });
      await tx.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
      await tx.cart.deleteMany({ where: { userId: user.id } });
    });
    await this.audit.record({ actor: { id: user.id }, action: 'account.deleted', resourceType: 'User', resourceId: user.id });
  }

  // --- OAuth ---------------------------------------------------------------

  oauthProviders() {
    return { google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), apple: appleConfigured() };
  }

  /** Signs in by a provider-verified email, linking to an existing account if there is one. */
  async oauthSignIn(input: { provider: string; subject: string; email: string; name: string; locale?: string }, meta: SessionMeta) {
    const email = input.email.toLowerCase();
    const link = await this.prisma.db.account.findUnique({
      where: { provider_providerAccountId: { provider: input.provider, providerAccountId: input.subject } },
    });
    let userId = link?.userId;
    if (!userId) {
      const existing = await this.prisma.db.user.findUnique({ where: { email } });
      if (existing) {
        if (existing.status !== 'ACTIVE') throw forbidden('ACCOUNT_SUSPENDED');
        userId = existing.id;
      } else {
        const customer = await this.prisma.db.role.findUniqueOrThrow({ where: { key: PERSONA_ROLE.discover } });
        const locale = LOCALES.find((l) => l === input.locale) ?? DEFAULT_LOCALE;
        const created = await this.prisma.db.user.create({
          data: {
            email, emailVerifiedAt: new Date(), locale,
            profile: { create: { displayName: input.name.slice(0, 80), username: await this.freeUsername(input.name) } },
            roles: { create: { roleId: customer.id } },
          },
        });
        userId = created.id;
        await this.announce(created.id, input.name, email, input.provider);
      }
      await this.prisma.db.account.create({ data: { userId, provider: input.provider, providerAccountId: input.subject } });
    }
    return this.createSession(userId, meta);
  }
}
