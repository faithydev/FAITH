import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adBody, affiliateLinkBody, aiActionProposalBody, aiRequestBody, apiKeyBody, appBody, appInstallBody, appRatingBody,
  appVersionBody, automationBody, conversationBody, messageBody, pageQuery, payoutBody, ticketBody, webhookBody,
} from '@faith/validators';
import { FREE_LIMITS } from '@faith/config';
import { z } from 'zod';
import { AiService } from '../ai/ai.service';
import { Auth, AuthContext, OptionalAuth, Public, RequirePermission } from '../auth/context';
import { EntitlementsService } from '../auth/entitlements.service';
import { DeveloperService } from '../developer/developer.service';
import { forbidden, notFound } from '../core/errors';
import { Prisma } from '@faith/database';
import { PrismaService } from '../core/prisma.service';
import { ZBody, ZQuery } from '../core/zod';
import { PayoutsService } from '../finance/payouts.service';
import { CommunicationService, GrowthService, InsightService } from './platform.service';

const appQuery = pageQuery.extend({ q: z.string().trim().max(120).optional(), category: z.string().max(40).optional() });
const devProfileBody = z.object({ name: z.string().trim().min(2).max(120), website: z.string().url().optional(), bio: z.string().trim().max(2000).optional() });
const fundBody = z.object({ idempotencyKey: z.string().min(8).max(100) });
const decisionBody = z.object({ accept: z.boolean() });

@ApiTags('communication')
@Controller()
export class CommunicationController {
  constructor(private readonly comms: CommunicationService) {}

  @Public() @Get('search')
  search(@Query('q') q = '') {
    return this.comms.search(q);
  }

  @Get('conversations')
  list(@Auth() a: AuthContext) {
    return this.comms.conversations(a.user.id);
  }

  @Post('conversations')
  start(@Auth() a: AuthContext, @ZBody(conversationBody) b: z.infer<typeof conversationBody>) {
    return this.comms.start(a.user.id, b);
  }

  @Get('conversations/:id')
  thread(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.comms.thread(id, a.user.id);
  }

  @Post('conversations/:id/messages')
  send(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(messageBody) b: z.infer<typeof messageBody>) {
    return this.comms.send(id, a.user.id, b.body);
  }

  @Get('notifications')
  notifications(@Auth() a: AuthContext) {
    return this.comms.notifications(a.user.id);
  }

  @Post('notifications/read-all') @HttpCode(200)
  readAll(@Auth() a: AuthContext) {
    return this.comms.markRead(a.user.id);
  }

  @Post('notifications/:id/read') @HttpCode(200)
  read(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.comms.markRead(a.user.id, id);
  }
}

@ApiTags('growth')
@Controller()
export class GrowthController {
  constructor(private readonly growth: GrowthService, private readonly insight: InsightService, private readonly payouts: PayoutsService) {}

  @Get('ads')
  ads(@Auth() a: AuthContext) {
    return this.growth.myAds(a.user.id);
  }

  @Post('ads')
  createAd(@Auth() a: AuthContext, @ZBody(adBody) b: z.infer<typeof adBody>) {
    return this.growth.createAd(a.user.id, b);
  }

  @Post('ads/:id/fund')
  fund(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(fundBody) b: z.infer<typeof fundBody>) {
    return this.growth.fundAd(id, a.user.id, b.idempotencyKey);
  }

  @Public() @Post('ads/:id/click') @HttpCode(200)
  click(@Param('id') id: string) {
    return this.growth.adClick(id);
  }

  @Get('affiliates')
  links(@Auth() a: AuthContext) {
    return this.growth.myAffiliateLinks(a.user.id);
  }

  @Post('affiliates')
  link(@Auth() a: AuthContext, @ZBody(affiliateLinkBody) b: z.infer<typeof affiliateLinkBody>) {
    return this.growth.createAffiliateLink(a.user.id, b.productId);
  }

  @Public() @Post('affiliates/:code/click') @HttpCode(200)
  affiliateClick(@Param('code') code: string) {
    return this.growth.affiliateClick(code);
  }

  @Get('opportunities')
  opportunities(@Auth() a: AuthContext) {
    return this.insight.opportunities(a.user.id);
  }

  @Public() @Get('trust/:username')
  trust(@Param('username') u: string) {
    return this.insight.trust(u);
  }

  @Get('support/tickets')
  tickets(@Auth() a: AuthContext) {
    return this.insight.myTickets(a.user.id);
  }

  @Post('support/tickets')
  ticket(@Auth() a: AuthContext, @ZBody(ticketBody) b: z.infer<typeof ticketBody>) {
    return this.insight.ticket(a.user.id, b.subject, b.body);
  }

  @Get('payouts')
  payoutOverview(@Auth() a: AuthContext) {
    return this.payouts.overview(a.user.id);
  }

  @Post('payouts') @RequirePermission('payout.request')
  requestPayout(@Auth() a: AuthContext, @ZBody(payoutBody) b: z.infer<typeof payoutBody>) {
    return this.payouts.request(a.user.id, b);
  }
}

@ApiTags('developer')
@Controller()
export class DeveloperController {
  constructor(private readonly dev: DeveloperService) {}

  @Public() @Get('apps')
  apps(@ZQuery(appQuery) q: z.infer<typeof appQuery>) {
    return this.dev.catalogue(q);
  }

  @Public() @Get('apps/:slug')
  app(@Param('slug') slug: string, @OptionalAuth() a?: AuthContext) {
    return this.dev.app(slug, a?.user.id);
  }

  @Post('apps/:slug/install')
  install(@Auth() a: AuthContext, @Param('slug') slug: string, @ZBody(appInstallBody) b: z.infer<typeof appInstallBody>) {
    return this.dev.install(slug, a.user.id, b.acceptedPermissions);
  }

  @Post('apps/:slug/uninstall') @HttpCode(200)
  uninstall(@Auth() a: AuthContext, @Param('slug') slug: string) {
    return this.dev.uninstall(slug, a.user.id);
  }

  @Post('apps/:slug/reviews')
  rate(@Auth() a: AuthContext, @Param('slug') slug: string, @ZBody(appRatingBody) b: z.infer<typeof appRatingBody>) {
    return this.dev.rate(slug, a.user.id, b.rating, b.body);
  }

  @Get('installed-apps')
  installed(@Auth() a: AuthContext) {
    return this.dev.installed(a.user.id);
  }

  @Get('developer/profile')
  profile(@Auth() a: AuthContext) {
    return this.dev.profile(a.user.id);
  }

  @Put('developer/profile') @RequirePermission('app.manage')
  saveProfile(@Auth() a: AuthContext, @ZBody(devProfileBody) b: z.infer<typeof devProfileBody>) {
    return this.dev.saveProfile(a.user.id, b);
  }

  @Get('developer/apps') @RequirePermission('app.manage')
  myApps(@Auth() a: AuthContext) {
    return this.dev.myApps(a.user.id);
  }

  @Post('developer/apps') @RequirePermission('app.manage')
  create(@Auth() a: AuthContext, @ZBody(appBody) b: z.infer<typeof appBody>) {
    return this.dev.createApp(a.user.id, b);
  }

  @Post('developer/apps/:id/versions') @RequirePermission('app.manage')
  version(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(appVersionBody) b: z.infer<typeof appVersionBody>) {
    return this.dev.addVersion(id, a.user.id, b);
  }

  @Post('developer/apps/:id/submit') @HttpCode(200) @RequirePermission('app.manage')
  submit(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.dev.submit(id, a.user.id);
  }

  @Get('developer/analytics') @RequirePermission('app.manage')
  analytics(@Auth() a: AuthContext) {
    return this.dev.analytics(a.user.id);
  }

  @Get('developer/keys') @RequirePermission('apikey.manage')
  keys(@Auth() a: AuthContext) {
    return this.dev.keys(a.user.id);
  }

  @Post('developer/keys') @RequirePermission('apikey.manage')
  createKey(@Auth() a: AuthContext, @ZBody(apiKeyBody) b: z.infer<typeof apiKeyBody>) {
    return this.dev.createKey(a.user.id, b);
  }

  @Delete('developer/keys/:id') @RequirePermission('apikey.manage')
  revoke(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.dev.revokeKey(a.user.id, id);
  }

  @Get('developer/webhooks') @RequirePermission('webhook.manage')
  webhooks(@Auth() a: AuthContext) {
    return this.dev.webhooks(a.user.id);
  }

  @Post('developer/webhooks') @RequirePermission('webhook.manage')
  createWebhook(@Auth() a: AuthContext, @ZBody(webhookBody) b: z.infer<typeof webhookBody>) {
    return this.dev.createWebhook(a.user.id, b);
  }

  @Delete('developer/webhooks/:id') @RequirePermission('webhook.manage')
  deleteWebhook(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.dev.deleteWebhook(a.user.id, id);
  }
}

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return this.ai.status();
  }

  @Post('run') @HttpCode(200)
  run(@Auth() a: AuthContext, @ZBody(aiRequestBody) b: z.infer<typeof aiRequestBody>) {
    return this.ai.run(a.user.id, b);
  }

  @Get('history')
  history(@Auth() a: AuthContext) {
    return this.ai.history(a.user.id);
  }

  @Post('actions')
  propose(@Auth() a: AuthContext, @ZBody(aiActionProposalBody) b: z.infer<typeof aiActionProposalBody>) {
    return this.ai.propose(a.user.id, b.action, b.targetId);
  }

  @Post('actions/:id/decide') @HttpCode(200)
  decide(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(decisionBody) b: z.infer<typeof decisionBody>) {
    return this.ai.confirm(id, a.user.id, b.accept);
  }
}

@ApiTags('automation')
@Controller('automations')
export class AutomationController {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: EntitlementsService) {}

  /** A person's own rules, plus the platform rules that act on their behalf, read-only. */
  @Get()
  async list(@Auth() a: AuthContext) {
    const [mine, system] = await Promise.all([
      this.prisma.db.automationRule.findMany({
        where: { ownerId: a.user.id },
        orderBy: { createdAt: 'desc' },
        include: { runs: { orderBy: { startedAt: 'desc' }, take: 5 } },
      }),
      this.prisma.db.automationRule.findMany({
        where: { ownerId: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, trigger: true, active: true, key: true },
      }),
    ]);
    return { mine, system };
  }

  @Post()
  async create(@Auth() a: AuthContext, @ZBody(automationBody) b: z.infer<typeof automationBody>) {
    const limit = await this.entitlements.limit(a.user.id, 'limit.automations', FREE_LIMITS.automations);
    const count = await this.prisma.db.automationRule.count({ where: { ownerId: a.user.id } });
    if (count >= limit) throw forbidden('PLAN_LIMIT_REACHED');
    for (const action of b.actions) {
      if (action.type !== 'grant_community') continue;
      const c = await this.prisma.db.community.findUnique({ where: { id: action.communityId } });
      if (!c || c.ownerId !== a.user.id) throw notFound('COMMUNITY_NOT_FOUND');
    }
    return this.prisma.db.automationRule.create({
      data: {
        ownerId: a.user.id, name: b.name, trigger: b.trigger, active: b.active,
        conditions: b.conditions as Prisma.InputJsonValue, actions: b.actions as Prisma.InputJsonValue,
      },
    });
  }

  @Patch(':id')
  async setActive(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(z.object({ active: z.boolean() })) b: { active: boolean }) {
    const { count } = await this.prisma.db.automationRule.updateMany({ where: { id, ownerId: a.user.id }, data: { active: b.active } });
    if (count === 0) throw notFound();
    return { active: b.active };
  }

  @Delete(':id')
  async remove(@Auth() a: AuthContext, @Param('id') id: string) {
    const { count } = await this.prisma.db.automationRule.deleteMany({ where: { id, ownerId: a.user.id } });
    if (count === 0) throw notFound();
    return { status: 'deleted' };
  }
}
