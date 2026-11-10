import { Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  appReviewDecisionBody, appealDecisionBody, disputeResolutionBody, experimentBody, experimentStatusBody, feedbackBody, flagBody,
  moderationBody, pageQuery, payoutDecisionBody, planPriceBody, refundDecisionBody, roleGrantBody, settingBody, userStatusBody,
} from '@faith/validators';
import { z } from 'zod';
import { Auth, AuthContext, RequirePermission } from '../auth/context';
import { ZBody, ZQuery } from '../core/zod';
import { DeveloperService } from '../developer/developer.service';
import { PayoutsService } from '../finance/payouts.service';
import { RewardsService } from '../rewards/rewards.service';
import { BadgesService } from '../identity/badges';
import { AdminService } from './admin.service';
import { RemovalService } from './removal.service';

const userQuery = pageQuery.extend({ q: z.string().trim().max(120).optional() });
const reverseBody = z.object({ reason: z.string().trim().min(3).max(1000), confirm: z.literal(true) });
const statusBody = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });
const contentStatus = z.object({ status: z.enum(['VISIBLE', 'HIDDEN', 'REMOVED']) });
const reviewStatus = z.object({ status: z.enum(['VISIBLE', 'HIDDEN']) });
const ticketStatus = z.object({ status: z.enum(['OPEN', 'PENDING', 'CLOSED']) });
const keepBody = z.object({ keepEmails: z.array(z.string().trim().email()).max(100) });
const removeBody = keepBody.extend({ confirm: z.literal('REMOVE') });
const badgeDecision = z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional() });
const badgeQuery = z.object({ status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED']).optional() });

/** Every route needs `admin.access` plus its own permission. Checks run on the server. */
@ApiTags('admin')
@Controller('admin')
@RequirePermission('admin.access')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payouts: PayoutsService,
    private readonly rewards: RewardsService,
    private readonly dev: DeveloperService,
    private readonly badges: BadgesService,
    private readonly removal: RemovalService,
  ) {}

  /** Counts what removing every other account would do. Super admins only. */
  @Post('users/removal/preview') @HttpCode(200) @RequirePermission('admin.users.write')
  removalPreview(@Auth() a: AuthContext, @ZBody(keepBody) b: z.infer<typeof keepBody>) {
    return this.removal.preview(a, b.keepEmails);
  }

  /** Removes every account except the caller and the listed emails. Cannot be undone. */
  @Post('users/removal') @HttpCode(200) @RequirePermission('admin.users.write')
  removalRun(@Auth() a: AuthContext, @ZBody(removeBody) b: z.infer<typeof removeBody>) {
    return this.removal.removeOthers(a, b.keepEmails);
  }

  @Get('badges') @RequirePermission('admin.users.read')
  badgeList(@ZQuery(badgeQuery) q: z.infer<typeof badgeQuery>) {
    return this.badges.list(q.status);
  }

  @Post('badges/:userId/decide') @HttpCode(200) @RequirePermission('admin.users.write')
  badgeDecide(@Auth() a: AuthContext, @Param('userId') userId: string, @ZBody(badgeDecision) b: z.infer<typeof badgeDecision>) {
    return this.badges.decide(userId, b.approve, a.user.id, b.note);
  }

  @Get('overview') @RequirePermission('admin.finance.read')
  overview() {
    return this.admin.overview();
  }

  @Get('users') @RequirePermission('admin.users.read')
  users(@ZQuery(userQuery) q: z.infer<typeof userQuery>) {
    return this.admin.users(q.q, q);
  }

  @Post('users/:id/status') @HttpCode(200) @RequirePermission('admin.users.write')
  userStatus(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(userStatusBody) b: z.infer<typeof userStatusBody>) {
    return this.admin.setUserStatus(a.user.id, id, b.status, b.reason);
  }

  @Post('users/:id/roles/grant') @HttpCode(200) @RequirePermission('admin.roles.write')
  grant(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(roleGrantBody) b: z.infer<typeof roleGrantBody>) {
    return this.admin.setRole(a.user.id, id, b.role, true);
  }

  @Post('users/:id/roles/revoke') @HttpCode(200) @RequirePermission('admin.roles.write')
  revoke(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(roleGrantBody) b: z.infer<typeof roleGrantBody>) {
    return this.admin.setRole(a.user.id, id, b.role, false);
  }

  @Get('roles') @RequirePermission('admin.users.read')
  roles() {
    return this.admin.roles();
  }

  @Get('organizations') @RequirePermission('admin.users.read')
  organizations() {
    return this.admin.organizations();
  }

  @Get('verifications') @RequirePermission('admin.verification.review')
  verifications() {
    return this.admin.verifications();
  }

  @Post('verifications/:id/decide') @HttpCode(200) @RequirePermission('admin.verification.review')
  decideVerification(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(moderationBody) b: z.infer<typeof moderationBody>) {
    return this.admin.decideVerification(a.user.id, id, b.approve, b.note);
  }

  @Get('products') @RequirePermission('admin.marketplace.moderate')
  products(@Query('status') status?: string) {
    return this.admin.products(status);
  }

  @Post('products/:id/moderate') @HttpCode(200) @RequirePermission('admin.marketplace.moderate')
  moderateProduct(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(moderationBody) b: z.infer<typeof moderationBody>) {
    return this.admin.moderateProduct(a.user.id, id, b.approve, b.note);
  }

  @Post('stores/:id/status') @HttpCode(200) @RequirePermission('admin.marketplace.moderate')
  storeStatus(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(statusBody) b: z.infer<typeof statusBody>) {
    return this.admin.setStoreStatus(a.user.id, id, b.status);
  }

  @Get('campaigns') @RequirePermission('admin.rewards.moderate')
  campaigns() {
    return this.admin.campaigns();
  }

  @Post('campaigns/:id/moderate') @HttpCode(200) @RequirePermission('admin.rewards.moderate')
  moderateCampaign(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(moderationBody) b: z.infer<typeof moderationBody>) {
    return this.admin.moderateCampaign(a.user.id, id, b.approve, b.note);
  }

  @Get('submissions') @RequirePermission('admin.rewards.moderate')
  submissions() {
    return this.admin.submissions();
  }

  @Post('submissions/:id/reverse') @HttpCode(200) @RequirePermission('admin.rewards.moderate')
  reverse(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(reverseBody) b: z.infer<typeof reverseBody>) {
    return this.rewards.reverse(id, a.user.id, b.reason);
  }

  @Get('appeals') @RequirePermission('admin.rewards.moderate')
  appeals() {
    return this.rewards.listAppeals();
  }

  @Post('appeals/:id/resolve') @HttpCode(200) @RequirePermission('admin.rewards.moderate')
  resolveAppeal(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(appealDecisionBody) b: z.infer<typeof appealDecisionBody>) {
    return this.rewards.resolveAppeal(id, a.user.id, b.uphold, b.resolution);
  }

  @Get('fraud-signals') @RequirePermission('admin.rewards.moderate')
  fraud() {
    return this.admin.fraudSignals();
  }

  @Get('jobs') @RequirePermission('admin.jobs.moderate')
  jobs() {
    return this.admin.jobs();
  }

  @Post('jobs/:id/moderate') @HttpCode(200) @RequirePermission('admin.jobs.moderate')
  moderateJob(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(moderationBody) b: z.infer<typeof moderationBody>) {
    return this.admin.moderateJob(a.user.id, id, b.approve, b.note);
  }

  @Get('apps/review') @RequirePermission('admin.apps.review')
  appQueue() {
    return this.dev.reviewQueue();
  }

  @Post('apps/versions/:id/review') @HttpCode(200) @RequirePermission('admin.apps.review')
  reviewApp(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(appReviewDecisionBody) b: z.infer<typeof appReviewDecisionBody>) {
    return this.dev.review(id, a.user.id, b.approve, b.note);
  }

  @Get('ads') @RequirePermission('admin.ads.moderate')
  ads() {
    return this.admin.ads();
  }

  @Post('ads/:id/moderate') @HttpCode(200) @RequirePermission('admin.ads.moderate')
  moderateAd(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(moderationBody) b: z.infer<typeof moderationBody>) {
    return this.admin.moderateAd(a.user.id, id, b.approve);
  }

  @Get('content') @RequirePermission('admin.marketplace.moderate')
  content() {
    return this.admin.content();
  }

  @Post('posts/:id/status') @HttpCode(200) @RequirePermission('admin.marketplace.moderate')
  postStatus(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(contentStatus) b: z.infer<typeof contentStatus>) {
    return this.admin.moderatePost(a.user.id, id, b.status);
  }

  @Post('reviews/:id/status') @HttpCode(200) @RequirePermission('admin.marketplace.moderate')
  reviewStatus(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(reviewStatus) b: z.infer<typeof reviewStatus>) {
    return this.admin.moderateReview(a.user.id, id, b.status);
  }

  // Finance ----------------------------------------------------------------

  @Get('finance/transactions') @RequirePermission('admin.finance.read')
  transactions(@ZQuery(pageQuery) q: z.infer<typeof pageQuery>) {
    return this.admin.transactions(q);
  }

  @Get('finance/reconciliation') @RequirePermission('admin.finance.read')
  reconciliation() {
    return this.admin.reconciliation();
  }

  @Get('finance/payouts') @RequirePermission('admin.finance.read')
  payoutList(@Query('status') status?: string) {
    return this.payouts.list(status);
  }

  @Post('finance/payouts/:id/decide') @HttpCode(200) @RequirePermission('admin.finance.write')
  decidePayout(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(payoutDecisionBody) b: z.infer<typeof payoutDecisionBody>) {
    return this.payouts.decide(id, a.user.id, b.decision, b.note);
  }

  @Get('finance/refunds') @RequirePermission('admin.finance.read')
  refunds() {
    return this.admin.refunds();
  }

  @Post('finance/refunds/:id/decide') @HttpCode(200) @RequirePermission('admin.finance.write')
  decideRefund(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(refundDecisionBody) b: z.infer<typeof refundDecisionBody>) {
    return this.admin.decideRefund(a.user.id, id, b.approve, b.note);
  }

  @Get('disputes') @RequirePermission('admin.support')
  disputes() {
    return this.admin.disputes();
  }

  @Post('disputes/:id/resolve') @HttpCode(200) @RequirePermission('admin.support')
  resolveDispute(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(disputeResolutionBody) b: z.infer<typeof disputeResolutionBody>) {
    return this.admin.resolveDispute(a.user.id, id, b.status, b.resolution);
  }

  // Configuration ----------------------------------------------------------

  @Get('plans') @RequirePermission('admin.settings.write')
  plans() {
    return this.admin.plans();
  }

  @Patch('plans/:key') @RequirePermission('admin.settings.write')
  planPrice(@Auth() a: AuthContext, @Param('key') key: string, @ZBody(planPriceBody) b: z.infer<typeof planPriceBody>) {
    return this.admin.setPlanPrice(a.user.id, key, b);
  }

  @Get('settings') @RequirePermission('admin.settings.write')
  settings() {
    return this.admin.allSettings();
  }

  @Put('settings/:key') @RequirePermission('admin.settings.write')
  setSetting(@Auth() a: AuthContext, @Param('key') key: string, @ZBody(settingBody) b: z.infer<typeof settingBody>) {
    return this.admin.setSetting({ id: a.user.id, permissions: a.permissions }, key, b.value);
  }

  @Get('flags') @RequirePermission('admin.flags.write')
  flags() {
    return this.admin.flagsList();
  }

  @Patch('flags/:key') @RequirePermission('admin.flags.write')
  setFlag(@Auth() a: AuthContext, @Param('key') key: string, @ZBody(flagBody) b: z.infer<typeof flagBody>) {
    return this.admin.setFlag(a.user.id, key, b);
  }

  @Get('experiments') @RequirePermission('admin.flags.write')
  experiments() {
    return this.admin.experiments();
  }

  @Post('experiments') @RequirePermission('admin.flags.write')
  createExperiment(@Auth() a: AuthContext, @ZBody(experimentBody) b: z.infer<typeof experimentBody>) {
    return this.admin.createExperiment(a.user.id, b);
  }

  @Post('experiments/:key/status') @HttpCode(200) @RequirePermission('admin.flags.write')
  experimentStatus(@Auth() a: AuthContext, @Param('key') key: string, @ZBody(experimentStatusBody) b: z.infer<typeof experimentStatusBody>) {
    return this.admin.setExperimentStatus(a.user.id, key, b.status);
  }

  @Get('audit') @RequirePermission('admin.audit.read')
  audit(@ZQuery(pageQuery) q: z.infer<typeof pageQuery>) {
    return this.admin.auditLogs(q);
  }

  @Get('security-events') @RequirePermission('admin.audit.read')
  security() {
    return this.admin.securityEvents();
  }

  @Get('outbox') @RequirePermission('admin.audit.read')
  outbox() {
    return this.admin.outbox();
  }

  @Get('tickets') @RequirePermission('admin.support')
  tickets() {
    return this.admin.tickets();
  }

  @Post('tickets/:id/status') @HttpCode(200) @RequirePermission('admin.support')
  ticket(@Auth() a: AuthContext, @Param('id') id: string, @ZBody(ticketStatus) b: z.infer<typeof ticketStatus>) {
    return this.admin.setTicketStatus(a.user.id, id, b.status);
  }
}

/** Experiments as a participant sees them. Open to any signed-in person. */
@ApiTags('lab')
@Controller('lab')
export class LabController {
  constructor(private readonly admin: AdminService) {}

  @Get('experiments/:key/assignment')
  assignment(@Auth() a: AuthContext, @Param('key') key: string) {
    return this.admin.assignment(key, a.user.id);
  }

  @Post('experiments/:key/feedback')
  feedback(@Auth() a: AuthContext, @Param('key') key: string, @ZBody(feedbackBody) b: z.infer<typeof feedbackBody>) {
    return this.admin.feedback(key, a.user.id, b.rating, b.comment);
  }
}
