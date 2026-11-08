import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  changePasswordBody, deleteAccountBody, forgotBody, loginBody, registerBody, resetBody, tokenBody, totpBody,
} from '@faith/validators';
import type { CookieOptions, Request, Response } from 'express';
import type { z } from 'zod';
import { randomToken } from '../core/crypto';
import { env, isProd } from '../core/env';
import { badRequest, notFound } from '../core/errors';
import { logger } from '../core/logger';
import { PrismaService } from '../core/prisma.service';
import { RateLimit } from '../core/rate-limit';
import { ZBody } from '../core/zod';
import { appleAuthorizeUrl, appleIdentity } from './apple';
import { AuthService, SessionMeta } from './auth.service';
import { Auth, AuthContext, Public, SESSION_COOKIE } from './context';

const cookieBase: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' };
const meta = (req: Request): SessionMeta => ({ userAgent: req.headers['user-agent'], ip: req.ip });
const OAUTH_STATE = 'faith_oauth_state';
const APPLE_STATE = 'faith_apple_state';
/** Providers return through the web origin, so their cookies are first-party to the site. */
const callback = (provider: string) => `${env.WEB_ORIGIN}/api/v1/auth/oauth/${provider}/callback`;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService) {}

  private setSession(res: Response, s: { token: string; expiresAt: Date }) {
    res.cookie(SESSION_COOKIE, s.token, { ...cookieBase, expires: s.expiresAt });
  }

  @Public() @Post('register') @HttpCode(202) @RateLimit(10, 3600)
  async register(@ZBody(registerBody) body: z.infer<typeof registerBody>) {
    await this.auth.register(body);
    return { status: 'verification_sent' };
  }

  @Public() @Post('resend-verification') @HttpCode(202) @RateLimit(5, 3600)
  async resend(@ZBody(forgotBody) body: z.infer<typeof forgotBody>) {
    await this.auth.resendVerification(body.email);
    return { status: 'verification_sent' };
  }

  @Public() @Post('verify-email') @HttpCode(200) @RateLimit(20, 3600)
  async verify(@ZBody(tokenBody) body: z.infer<typeof tokenBody>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.setSession(res, await this.auth.verifyEmail(body.token, meta(req)));
    return { status: 'verified' };
  }

  @Public() @Post('login') @HttpCode(200) @RateLimit(20, 300)
  async login(@ZBody(loginBody) body: z.infer<typeof loginBody>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.setSession(res, await this.auth.login(body, meta(req)));
    return { status: 'ok' };
  }

  @Post('logout') @HttpCode(200)
  async logout(@Auth() a: AuthContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(a.session.id);
    res.clearCookie(SESSION_COOKIE, cookieBase);
    return { status: 'ok' };
  }

  @Public() @Post('forgot-password') @HttpCode(202) @RateLimit(5, 900)
  async forgot(@ZBody(forgotBody) body: z.infer<typeof forgotBody>) {
    await this.auth.forgot(body.email);
    return { status: 'sent_if_exists' };
  }

  @Public() @Post('reset-password') @HttpCode(200) @RateLimit(10, 900)
  async reset(@ZBody(resetBody) body: z.infer<typeof resetBody>) {
    await this.auth.reset(body.token, body.password);
    return { status: 'ok' };
  }

  @Post('change-password') @HttpCode(200) @RateLimit(10, 900)
  async change(@Auth() a: AuthContext, @ZBody(changePasswordBody) body: z.infer<typeof changePasswordBody>) {
    await this.auth.changePassword(a.user, body.current, body.next, a.session.id);
    return { status: 'ok' };
  }

  @Get('sessions')
  async sessions(@Auth() a: AuthContext) {
    const rows = await this.auth.sessions(a.user.id);
    return rows.map((s) => ({ ...s, current: s.id === a.session.id }));
  }

  @Delete('sessions/:id')
  async revoke(@Auth() a: AuthContext, @Param('id') id: string) {
    await this.auth.revokeSession(a.user.id, id);
    return { status: 'ok' };
  }

  @Post('2fa/setup')
  setup(@Auth() a: AuthContext) {
    return this.auth.twoFactorSetup(a.user);
  }

  @Post('2fa/enable') @HttpCode(200)
  enable(@Auth() a: AuthContext, @ZBody(totpBody) b: z.infer<typeof totpBody>) {
    return this.auth.twoFactorEnable(a.user, b.code);
  }

  @Post('2fa/disable') @HttpCode(200)
  async disable(@Auth() a: AuthContext, @ZBody(totpBody) b: z.infer<typeof totpBody>) {
    await this.auth.twoFactorDisable(a.user, b.code);
    return { status: 'ok' };
  }

  @Post('delete-account') @HttpCode(200) @RateLimit(5, 3600)
  async deleteAccount(
    @Auth() a: AuthContext, @ZBody(deleteAccountBody) b: z.infer<typeof deleteAccountBody>,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.deleteAccount(a.user, b);
    res.clearCookie(SESSION_COOKIE, cookieBase);
    return { status: 'deleted' };
  }

  @Public() @Get('providers')
  providers() {
    return this.auth.oauthProviders();
  }

  /** Start of the Google authorization-code flow. Only reachable when it is configured. */
  @Public() @Get('oauth/google/start')
  google(@Res() res: Response) {
    if (!this.auth.oauthProviders().google) throw notFound();
    const state = randomToken(16);
    res.cookie(OAUTH_STATE, state, { ...cookieBase, maxAge: 600_000 });
    const q = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: callback('google'),
      response_type: 'code', scope: 'openid email profile', state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  }

  @Public() @Get('oauth/google/callback')
  async googleCallback(
    @Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response,
  ) {
    const expected = (req.cookies as Record<string, string>)[OAUTH_STATE];
    if (!this.auth.oauthProviders().google) throw notFound();
    if (!code || !state || state !== expected) throw badRequest('INVALID_OAUTH_STATE');
    res.clearCookie(OAUTH_STATE, cookieBase);
    const tokens = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: callback('google'), grant_type: 'authorization_code',
      }),
    });
    if (!tokens.ok) {
      logger.warn({ status: tokens.status }, 'google token exchange failed');
      throw badRequest('OAUTH_FAILED');
    }
    const { access_token } = (await tokens.json()) as { access_token: string };
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${access_token}` },
    });
    const p = (await info.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; locale?: string };
    if (!p.email || !p.email_verified) throw badRequest('OAUTH_EMAIL_UNVERIFIED');
    const session = await this.auth.oauthSignIn(
      { provider: 'google', subject: p.sub, email: p.email, name: p.name ?? p.email.split('@')[0]!, locale: p.locale },
      meta(req),
    );
    this.setSession(res, session);
    res.redirect(`${env.WEB_ORIGIN}/app`);
  }

  /** Start of Sign in with Apple. Only reachable when all four Apple values are configured. */
  @Public() @Get('oauth/apple/start')
  apple(@Res() res: Response) {
    if (!this.auth.oauthProviders().apple) throw notFound();
    const state = randomToken(16);
    // Apple comes back with a cross-site POST, so this one cookie must be SameSite=None.
    res.cookie(APPLE_STATE, state, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 600_000 });
    res.redirect(appleAuthorizeUrl(callback('apple'), state));
  }

  @Public() @Post('oauth/apple/callback') @HttpCode(303)
  async appleCallback(@Body() body: { code?: string; state?: string; user?: string }, @Req() req: Request, @Res() res: Response) {
    if (!this.auth.oauthProviders().apple) throw notFound();
    const expected = (req.cookies as Record<string, string>)[APPLE_STATE];
    if (!body.code || !body.state || body.state !== expected) throw badRequest('INVALID_OAUTH_STATE');
    res.clearCookie(APPLE_STATE, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
    let identity;
    try {
      identity = await appleIdentity(body.code, callback('apple'));
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'apple sign-in failed');
      throw badRequest('OAUTH_FAILED');
    }
    if (!identity.email || !identity.emailVerified) throw badRequest('OAUTH_EMAIL_UNVERIFIED');
    // Apple sends the name only on the very first sign-in.
    let name = identity.email.split('@')[0]!;
    try {
      const u = body.user ? (JSON.parse(body.user) as { name?: { firstName?: string; lastName?: string } }) : undefined;
      const full = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ');
      if (full) name = full;
    } catch { /* keep the email-based name */ }
    const session = await this.auth.oauthSignIn({ provider: 'apple', subject: identity.sub, email: identity.email, name }, meta(req));
    this.setSession(res, session);
    res.redirect(303, `${env.WEB_ORIGIN}/app`);
  }

  /** Development mailbox, so the verification flow works with no email provider at all. */
  @Public() @Get('dev/mailbox')
  async devMailbox(@Query('to') to: string) {
    if (env.EMAIL_DRIVER !== 'dev' || isProd || !to) throw notFound();
    return this.prisma.db.emailOutbox.findMany({
      where: { to: to.toLowerCase() },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, subject: true, text: true, template: true, createdAt: true },
    });
  }
}
