import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  appealBody, applicationBody, applicationDecisionBody, campaignBody, campaignQuery, fraudDecisionBody, metricBody,
  submissionBody, submissionDecisionBody,
} from '@faith/validators';
import { z } from 'zod';
import { Auth, AuthContext, OptionalAuth, Public, RequirePermission } from '../auth/context';
import { env, isProd } from '../core/env';
import { notFound } from '../core/errors';
import { ZBody, ZQuery } from '../core/zod';
import { RewardsService } from './rewards.service';

const fundBody = z.object({ idempotencyKey: z.string().min(8).max(100) });
const pausedBody = z.object({ paused: z.boolean() });

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  private staff(a: AuthContext) {
    return a.permissions.has('admin.rewards.moderate');
  }

  @Public() @Get('campaigns')
  discover(@ZQuery(campaignQuery) q: z.infer<typeof campaignQuery>) {
    return this.rewards.discover(q);
  }

  @Public() @Get('verification-status')
  verification() {
    return this.rewards.verificationStatus();
  }

  @Public() @Get('campaigns/:slug')
  detail(@Param('slug') slug: string, @OptionalAuth() a?: AuthContext) {
    return this.rewards.detail(slug, a?.user.id);
  }

  // Brand -------------------------------------------------------------------

  @Get('brand/campaigns') @RequirePermission('campaign.manage')
  mine(@Auth() a: AuthContext) {
    return this.rewards.mine(a.user.id);
  }

  @Post('brand/campaigns') @RequirePermission('campaign.manage')
  create(@Auth() a: AuthContext, @ZBody(campaignBody) b: z.infer<typeof campaignBody>) {
    return this.rewards.create(a.user.id, b);
  }

  @Post('brand/campaigns/:id/fund') @RequirePermission('campaign.manage')
  fund(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(fundBody) b: z.infer<typeof fundBody>) {
    return this.rewards.startFunding(id, a.user.id, b.idempotencyKey);
  }

  @Post('brand/campaigns/:id/submit') @HttpCode(200) @RequirePermission('campaign.manage')
  submitForReview(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.rewards.submitForReview(id, a.user.id);
  }

  @Post('brand/campaigns/:id/paused') @HttpCode(200) @RequirePermission('campaign.manage')
  paused(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(pausedBody) b: z.infer<typeof pausedBody>) {
    return this.rewards.setPaused(id, a.user.id, b.paused);
  }

  @Get('brand/campaigns/:id/review') @RequirePermission('campaign.manage')
  review(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.rewards.review(id, a.user.id);
  }

  @Get('brand/campaigns/:id/report') @RequirePermission('campaign.manage')
  report(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.rewards.report(id, a.user.id);
  }

  @Post('brand/applications/:id/decide') @HttpCode(200) @RequirePermission('campaign.manage')
  decideApplication(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(applicationDecisionBody) b: z.infer<typeof applicationDecisionBody>) {
    return this.rewards.decideApplication(id, a.user.id, b.approve);
  }

  @Post('submissions/:id/decide') @HttpCode(200)
  decide(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(submissionDecisionBody) b: z.infer<typeof submissionDecisionBody>) {
    return this.rewards.decide(id, a.user.id, b, this.staff(a));
  }

  @Post('submissions/:id/metrics')
  metric(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(metricBody) b: z.infer<typeof metricBody>) {
    return this.rewards.recordMetric(id, a.user.id, b, this.staff(a));
  }

  /** Development simulator. Stored with source SIMULATED and refused outside local development. */
  @Post('submissions/:id/simulate-metrics')
  simulate(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(metricBody) b: z.infer<typeof metricBody>) {
    if (isProd || !env.ALLOW_MOCK_PAYMENTS) throw notFound();
    return this.rewards.recordMetric(id, a.user.id, b, this.staff(a), 'SIMULATED');
  }

  @Post('signals/:id/decide') @HttpCode(200)
  signal(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(fraudDecisionBody) b: z.infer<typeof fraudDecisionBody>) {
    return this.rewards.decideSignal(id, a.user.id, b.status, this.staff(a));
  }

  // Creator -----------------------------------------------------------------

  @Post('campaigns/:slug/apply') @RequirePermission('campaign.participate')
  apply(@Auth() a: AuthContext, @Param('slug') slug: string, @ZBody(applicationBody) b: z.infer<typeof applicationBody>) {
    return this.rewards.apply(slug, a.user.id, b.pitch);
  }

  @Post('campaigns/:slug/submissions') @RequirePermission('campaign.participate')
  submit(@Auth() a: AuthContext, @Param('slug') slug: string, @ZBody(submissionBody) b: z.infer<typeof submissionBody>) {
    return this.rewards.submit(slug, a.user.id, b);
  }

  @Get('creator/submissions') @RequirePermission('campaign.participate')
  mySubmissions(@Auth() a: AuthContext) {
    return this.rewards.mySubmissions(a.user.id);
  }

  @Get('creator/earnings') @RequirePermission('campaign.participate')
  earnings(@Auth() a: AuthContext) {
    return this.rewards.earnings(a.user.id);
  }

  @Post('submissions/:id/appeal') @RequirePermission('campaign.participate')
  appeal(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(appealBody) b: z.infer<typeof appealBody>) {
    return this.rewards.appeal(id, a.user.id, b);
  }
}
