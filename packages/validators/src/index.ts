/** Request contracts shared by the API (enforcement) and the web app (form feedback). */
import { z } from 'zod';
import { API_SCOPES, APP_PERMISSIONS, LOCALES, PERSONAS, WEBHOOK_EVENTS, WORKSPACES } from '@faith/config';

// --- Primitives -------------------------------------------------------------

/** Minor units travel as digit strings because JSON numbers lose precision. */
export const minorAmount = z.string().regex(/^\d{1,18}$/, 'invalid_amount');
export const positiveMinor = minorAmount.refine((v) => BigInt(v) > 0n, 'invalid_amount');
export const currency = z.string().regex(/^[A-Z]{3}$/);
export const slug = z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const shortText = z.string().trim().min(1).max(160);
export const longText = z.string().trim().min(1).max(20_000);
const httpsUrl = z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), 'invalid_url');
const tags = z.array(z.string().trim().min(1).max(40)).max(20);

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

// --- Auth -------------------------------------------------------------------

export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(10, 'password_too_short').max(128);

export const registerBody = z.object({
  email,
  password,
  displayName: z.string().trim().min(2).max(80),
  locale: z.enum(LOCALES).optional(),
});
export const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
  totp: z.string().trim().min(6).max(16).optional(),
});
export const tokenBody = z.object({ token: z.string().min(16).max(200) });
export const forgotBody = z.object({ email });
export const resetBody = z.object({ token: z.string().min(16).max(200), password });
export const changePasswordBody = z.object({ current: z.string().min(1).max(128), next: password });
export const totpBody = z.object({ code: z.string().trim().min(6).max(16) });
export const deleteAccountBody = z.object({ password: z.string().min(1).max(128), confirm: z.literal('DELETE') });

export const onboardingBody = z.object({
  personas: z.array(z.enum(PERSONAS)).max(PERSONAS.length),
  answers: z.record(z.string(), z.record(z.string(), z.union([z.string().max(200), z.array(z.string().max(60)).max(10)]))).default({}),
});
export const profileBody = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  username: z.string().trim().toLowerCase().min(3).max(32).regex(/^[a-z0-9_]+$/).optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  country: z.string().trim().max(60).nullable().optional(),
  website: httpsUrl.nullable().optional(),
  recommendationsConsent: z.boolean().optional(),
});
export const preferencesBody = z.object({
  locale: z.enum(LOCALES).optional(),
  currency: currency.optional(),
  activeWorkspace: z.enum(WORKSPACES).optional(),
});
export const addRoleBody = z.object({ persona: z.enum(PERSONAS) });

// --- Organizations ----------------------------------------------------------

export const organizationBody = z.object({
  name: shortText,
  type: z.enum(['BUSINESS', 'BRAND', 'AGENCY', 'STUDIO']),
  country: z.string().trim().max(60).optional(),
  website: httpsUrl.optional(),
  about: z.string().trim().max(2000).optional(),
});
export const orgMemberBody = z.object({
  email,
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
});
export const verificationBody = z.object({
  kind: z.enum(['SELLER', 'DEVELOPER', 'BRAND', 'IDENTITY']),
  orgId: z.string().optional(),
  note: z.string().trim().max(2000).optional(),
});

// --- Commerce ---------------------------------------------------------------

export const productTypes = [
  'DIGITAL_DOWNLOAD', 'DESIGN_TEMPLATE', 'SOURCE_CODE', 'WEBSITE_TEMPLATE', 'SAAS_ACCESS',
  'COURSE', 'MEMBERSHIP', 'SERVICE', 'DIGITAL_LICENSE',
] as const;

export const storeBody = z.object({
  name: shortText,
  slug: slug.optional(),
  tagline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  country: z.string().trim().max(60).optional(),
  currency: currency.default('USD'),
  orgId: z.string().optional(),
});
export const storeUpdateBody = storeBody.partial().extend({
  theme: z.object({ accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), layout: z.enum(['grid', 'list']).optional() }).optional(),
});

export const variantInput = z.object({
  id: z.string().optional(),
  name: shortText,
  priceMinor: minorAmount,
  compareAtMinor: minorAmount.nullable().optional(),
  active: z.boolean().default(true),
});
export const productBody = z.object({
  title: shortText,
  summary: z.string().trim().min(1).max(300),
  description: longText,
  type: z.enum(productTypes),
  categoryId: z.string().nullable().optional(),
  currency,
  tags: tags.default([]),
  licenseId: z.string().nullable().optional(),
  affiliateBps: z.number().int().min(1).max(5000).nullable().optional(),
  variants: z.array(variantInput).min(1).max(20),
});
export const productUpdateBody = productBody.partial();
/** The simple path: one price, one variant. */
export const quickProductBody = productBody.omit({ variants: true }).extend({
  variantName: shortText,
  priceMinor: minorAmount,
});
export const productQuery = pageQuery.extend({
  q: z.string().trim().max(120).optional(),
  category: z.string().max(80).optional(),
  type: z.enum(productTypes).optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'rating', 'popular']).default('relevance'),
  minPrice: minorAmount.optional(),
  maxPrice: minorAmount.optional(),
  store: z.string().max(80).optional(),
});
export const licenseBody = z.object({
  name: shortText,
  terms: z.string().trim().min(10).max(10_000),
  commercialUse: z.boolean().default(false),
  seats: z.number().int().min(1).max(100_000).default(1),
  territory: z.string().trim().max(120).default('worldwide'),
  durationDays: z.number().int().min(1).max(36_500).nullable().optional(),
});
export const discountBody = z.object({
  code: z.string().trim().toUpperCase().min(3).max(32).regex(/^[A-Z0-9_-]+$/),
  kind: z.enum(['PERCENT', 'FIXED']),
  value: minorAmount,
  endsAt: z.coerce.date().optional(),
  maxRedemptions: z.number().int().min(1).optional(),
});
export const cartItemBody = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(99).default(1) });
export const cartQuantityBody = z.object({ quantity: z.number().int().min(1).max(99) });
export const checkoutBody = z.object({
  /** One key per checkout attempt, so a double click cannot create two orders. */
  idempotencyKey: z.string().min(8).max(100),
  discountCode: z.string().trim().toUpperCase().max(32).optional(),
  affiliateCode: z.string().trim().max(40).optional(),
});
export const mockPaymentBody = z.object({ outcome: z.enum(['success', 'failure']) });
export const reviewBody = z.object({
  orderItemId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(3).max(2000),
});
export const refundRequestBody = z.object({
  orderItemId: z.string().min(1),
  /** Omit to refund the remaining amount on the line. */
  amountMinor: positiveMinor.optional(),
  reason: z.string().trim().min(3).max(1000),
});
export const refundDecisionBody = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(1000).optional(),
});
export const payoutBody = z.object({
  accountKey: z.string().min(1).max(200),
  amountMinor: positiveMinor,
  idempotencyKey: z.string().min(8).max(100),
});
export const payoutDecisionBody = z.object({
  decision: z.enum(['approve', 'reject', 'mark_paid']),
  note: z.string().trim().max(1000).optional(),
  confirm: z.literal(true),
});

// --- Billing ----------------------------------------------------------------

export const upgradeBody = z.object({ interval: z.enum(['MONTHLY', 'YEARLY']), idempotencyKey: z.string().min(8).max(100) });
export const planPriceBody = z.object({
  monthlyMinor: minorAmount.nullable(),
  yearlyMinor: minorAmount.nullable(),
  currency,
  confirm: z.literal(true),
});

// --- Rewards ----------------------------------------------------------------

export const campaignTypes = [
  'VIDEO_CLIPPING', 'ORIGINAL_UGC', 'VERIFIED_VIEWS', 'QUALIFIED_CLICKS', 'VERIFIED_LEADS',
  'CONFIRMED_SALES', 'APP_TESTING', 'TASK_BOUNTY', 'HYBRID', 'RETAINER',
] as const;
export const rewardMetrics = ['APPROVED_SUBMISSION', 'VIEWS', 'CLICKS', 'LEADS', 'SALES'] as const;
export const socialPlatforms = ['youtube', 'tiktok', 'instagram', 'other'] as const;

export const rewardRuleInput = z.object({
  metric: z.enum(rewardMetrics),
  unitSize: z.string().regex(/^[1-9]\d{0,12}$/).default('1'),
  rateMinor: positiveMinor,
  minQualified: minorAmount.default('0'),
  capMinor: minorAmount.nullable().optional(),
});
export const campaignBody = z.object({
  orgId: z.string().min(1),
  title: shortText,
  summary: z.string().trim().min(1).max(300),
  description: longText,
  type: z.enum(campaignTypes),
  currency,
  budgetMinor: positiveMinor,
  platforms: z.array(z.enum(socialPlatforms)).min(1),
  countries: z.array(z.string().trim().min(2).max(60)).max(60).default([]),
  guidelines: longText,
  requiresApplication: z.boolean().default(false),
  submissionDeadline: z.coerce.date(),
  usageRights: z.string().trim().min(3).max(4000),
  creatorPermissions: z.string().trim().min(3).max(4000),
  attribution: z.string().trim().min(3).max(1000),
  adDisclosure: z.string().trim().min(3).max(1000),
  licenseDays: z.number().int().min(1).max(36_500).nullable().optional(),
  territory: z.string().trim().max(200).nullable().optional(),
  prohibitedContent: z.string().trim().min(3).max(4000),
  requirements: z.array(z.object({ label: shortText, required: z.boolean().default(true) })).max(30).default([]),
  rules: z.array(rewardRuleInput).min(1).max(5),
});
export const campaignQuery = pageQuery.extend({
  q: z.string().trim().max(120).optional(),
  type: z.enum(campaignTypes).optional(),
  platform: z.enum(socialPlatforms).optional(),
  country: z.string().max(60).optional(),
});
export const applicationBody = z.object({ pitch: z.string().trim().min(10).max(2000) });
export const applicationDecisionBody = z.object({ approve: z.boolean() });
export const submissionBody = z.object({
  platform: z.enum(socialPlatforms),
  url: httpsUrl,
  note: z.string().trim().max(2000).optional(),
  evidenceKeys: z.array(z.string().max(300)).max(10).default([]),
  /** Creator's confirmation that they read the rights and disclosure terms. */
  acceptedTerms: z.literal(true),
});
export const submissionDecisionBody = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(1000).optional(),
}).refine((b) => b.decision === 'approve' || !!b.reason, { message: 'reason_required', path: ['reason'] });
export const metricBody = z.object({
  metric: z.enum(['VIEWS', 'CLICKS', 'LEADS', 'SALES']),
  value: z.string().regex(/^\d{1,15}$/),
});
export const appealBody = z.object({ reason: z.string().trim().min(10).max(2000) });
export const appealDecisionBody = z.object({ uphold: z.boolean(), resolution: z.string().trim().min(3).max(1000) });
export const fraudDecisionBody = z.object({ status: z.enum(['DISMISSED', 'CONFIRMED']) });

// --- Work -------------------------------------------------------------------

export const jobBody = z.object({
  orgId: z.string().min(1),
  title: shortText,
  description: longText,
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']),
  workplace: z.enum(['REMOTE', 'ONSITE', 'HYBRID']),
  experience: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD']),
  location: z.string().trim().max(120).optional(),
  country: z.string().trim().max(60).optional(),
  currency,
  salaryMinMinor: minorAmount.nullable().optional(),
  salaryMaxMinor: minorAmount.nullable().optional(),
  skills: tags.default([]),
  languages: tags.default([]),
});
export const jobQuery = pageQuery.extend({
  q: z.string().trim().max(120).optional(),
  workplace: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).optional(),
  experience: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD']).optional(),
});
export const jobApplyBody = z.object({ coverLetter: z.string().trim().min(10).max(4000) });
export const jobApplicationStatusBody = z.object({
  status: z.enum(['REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']),
});
export const candidateProfileBody = z.object({
  headline: shortText,
  summary: z.string().trim().max(4000).optional(),
  skills: tags.default([]),
  languages: tags.default([]),
  discoverable: z.boolean().default(false),
});
export const portfolioBody = z.object({
  title: shortText,
  description: z.string().trim().max(2000).optional(),
  url: httpsUrl.optional(),
});
export const freelancerProfileBody = z.object({
  headline: shortText,
  bio: z.string().trim().max(4000).optional(),
  hourlyRateMinor: minorAmount.nullable().optional(),
  currency: currency.default('USD'),
  skills: tags.default([]),
  available: z.boolean().default(true),
});
export const servicePackageInput = z.object({
  name: shortText,
  description: z.string().trim().min(1).max(1000),
  priceMinor: positiveMinor,
  deliveryDays: z.number().int().min(1).max(365),
  revisions: z.number().int().min(0).max(50).default(1),
});
export const serviceBody = z.object({
  title: shortText,
  summary: z.string().trim().min(1).max(300),
  description: longText,
  categoryId: z.string().nullable().optional(),
  currency,
  tags: tags.default([]),
  packages: z.array(servicePackageInput).min(1).max(3),
  publish: z.boolean().default(false),
});
/** The simple path: one package. */
export const quickServiceBody = serviceBody.omit({ packages: true }).extend({
  packageName: shortText,
  priceMinor: positiveMinor,
  deliveryDays: z.number().int().min(1).max(365),
});
export const projectRequestBody = z.object({
  packageId: z.string().min(1),
  requirements: z.string().trim().min(10).max(4000),
});
export const milestoneBody = z.object({
  title: shortText,
  description: z.string().trim().max(2000).optional(),
  amountMinor: minorAmount,
  dueDate: z.coerce.date().optional(),
});
export const milestoneDeliveryBody = z.object({ deliveryNote: z.string().trim().min(3).max(4000) });
export const milestoneReviewBody = z.object({ approve: z.boolean() });
export const disputeBody = z.object({
  projectId: z.string().optional(),
  orderId: z.string().optional(),
  reason: z.string().trim().min(10).max(4000),
}).refine((b) => !!b.projectId !== !!b.orderId, { message: 'exactly_one_reference' });
export const disputeResolutionBody = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  resolution: z.string().trim().min(3).max(4000),
});

// --- Creator ----------------------------------------------------------------

export const creatorProfileBody = z.object({
  headline: shortText,
  niches: tags.default([]),
  socials: z.record(z.string().max(30), httpsUrl).default({}),
});
export const courseBody = z.object({
  title: shortText,
  summary: z.string().trim().min(1).max(300),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  language: z.enum(LOCALES).default('uz'),
  productId: z.string().nullable().optional(),
});
export const sectionBody = z.object({ title: shortText });
export const lessonBody = z.object({
  title: shortText,
  body: z.string().trim().max(50_000).default(''),
  videoKey: z.string().max(300).nullable().optional(),
  fileKey: z.string().max(300).nullable().optional(),
  durationSec: z.number().int().min(0).max(86_400).nullable().optional(),
  isPreview: z.boolean().default(false),
});
export const communityBody = z.object({
  name: shortText,
  description: z.string().trim().min(1).max(2000),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  productId: z.string().nullable().optional(),
  grantPlanKey: z.string().max(40).nullable().optional(),
});
export const channelBody = z.object({ name: z.string().trim().min(1).max(60) });
export const postBody = z.object({
  title: shortText,
  body: longText,
  channelId: z.string().nullable().optional(),
});
export const commentBody = z.object({ body: z.string().trim().min(1).max(4000) });
export const memberModerationBody = z.object({
  status: z.enum(['ACTIVE', 'BANNED']).optional(),
  role: z.enum(['MODERATOR', 'MEMBER']).optional(),
});

// --- Messaging --------------------------------------------------------------

export const conversationBody = z.object({
  recipientId: z.string().min(1),
  subject: shortText,
  body: z.string().trim().min(1).max(4000),
  refType: z.string().max(40).optional(),
  refId: z.string().max(60).optional(),
});
export const messageBody = z.object({ body: z.string().trim().min(1).max(4000) });

// --- Developer --------------------------------------------------------------

export const appBody = z.object({
  name: shortText,
  tagline: z.string().trim().min(1).max(160),
  description: longText,
  category: z.enum(['analytics', 'marketing', 'operations', 'finance', 'communication', 'developer']),
  website: httpsUrl.optional(),
  pricing: z.enum(['FREE', 'ONE_TIME', 'SUBSCRIPTION']).default('FREE'),
  priceMinor: minorAmount.default('0'),
  currency: currency.default('USD'),
  iconKey: z.string().max(300).nullable().optional(),
  screenshots: z.array(z.string().max(300)).max(8).default([]),
}).refine((b) => b.pricing === 'FREE' || BigInt(b.priceMinor) > 0n, { message: 'price_required', path: ['priceMinor'] });
export const appVersionBody = z.object({
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/),
  changelog: z.string().trim().max(4000).optional(),
  permissions: z.array(z.enum(APP_PERMISSIONS)).max(APP_PERMISSIONS.length),
});
export const appReviewDecisionBody = z.object({ approve: z.boolean(), note: z.string().trim().max(2000).optional() });
export const appInstallBody = z.object({ acceptedPermissions: z.array(z.enum(APP_PERMISSIONS)) });
export const appRatingBody = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().min(3).max(2000) });
export const apiKeyBody = z.object({
  name: shortText,
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  env: z.enum(['LIVE', 'SANDBOX']).default('SANDBOX'),
  appId: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(730).optional(),
});
export const webhookBody = z.object({
  url: httpsUrl,
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  appId: z.string().optional(),
});

// --- AI and automation ------------------------------------------------------

export const aiCapabilities = [
  'product_description', 'marketing_copy', 'landing_copy', 'campaign_suggestions',
  'store_optimization', 'categorize_product', 'support_draft', 'analytics_explain',
  'workflow_recommendation', 'translate', 'business_plan',
] as const;
export const aiRequestBody = z.object({
  capability: z.enum(aiCapabilities),
  prompt: z.string().trim().min(3).max(4000),
  locale: z.enum(LOCALES).default('uz'),
});
export const aiActionProposalBody = z.object({
  action: z.enum(['product.publish', 'product.archive', 'refund.approve']),
  targetId: z.string().min(1),
});
export const automationBody = z.object({
  name: shortText,
  trigger: z.enum(['order.paid', 'subscription.activated', 'reward.approved', 'course.enrolled', 'job.application.submitted']),
  conditions: z.array(z.object({
    field: z.string().max(60),
    op: z.enum(['eq', 'neq', 'gte', 'lte', 'contains']),
    value: z.union([z.string().max(200), z.number()]),
  })).max(10).default([]),
  actions: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('notify'), target: z.enum(['actor', 'owner', 'recipient']), kind: z.string().max(60) }),
    z.object({ type: z.literal('grant_community'), communityId: z.string() }),
  ])).min(1).max(5),
  active: z.boolean().default(true),
});

// --- Ads, affiliates, revenue graph, admin ----------------------------------

export const adBody = z.object({
  placement: z.enum(['MARKETPLACE_TOP', 'PROMOTED_LISTING', 'CREATOR_DISCOVERY', 'SPONSORED_COLLECTION']),
  title: shortText,
  productId: z.string().optional(),
  orgId: z.string().optional(),
  currency,
  budgetMinor: positiveMinor,
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});
export const affiliateLinkBody = z.object({ productId: z.string().min(1) });
export const revenueShareBody = z.object({
  participantEmail: email,
  role: z.enum(['AFFILIATE', 'COLLABORATOR', 'CONTENT_CREATOR', 'OTHER']),
  bps: z.number().int().min(1).max(10_000),
});
export const moderationBody = z.object({ approve: z.boolean(), note: z.string().trim().max(2000).optional() });
export const userStatusBody = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().min(3).max(1000), confirm: z.literal(true) });
export const roleGrantBody = z.object({ role: z.string().min(1).max(40) });
export const settingBody = z.object({ value: z.unknown(), confirm: z.literal(true) });
export const flagBody = z.object({
  enabled: z.boolean().optional(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
  allowUsers: z.array(z.string()).max(1000).optional(),
});
export const experimentBody = z.object({
  key: slug,
  name: shortText,
  hypothesis: z.string().trim().min(3).max(2000),
  variants: z.array(z.string().min(1).max(40)).min(2).max(6),
  flagKey: z.string().optional(),
});
export const experimentStatusBody = z.object({ status: z.enum(['RUNNING', 'PAUSED', 'ROLLED_BACK', 'SHIPPED']) });
export const feedbackBody = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).optional() });
export const ticketBody = z.object({ subject: shortText, body: z.string().trim().min(3).max(4000) });
export const confirmBody = z.object({ confirm: z.literal(true) });
