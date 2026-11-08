/** Platform constants shared by the API, the worker, the web app and the seed. */

export const LOCALES = ['uz', 'ru', 'en', 'tr', 'kk', 'ar', 'zh', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uz';
export const RTL_LOCALES: readonly Locale[] = ['ar'];
export const LOCALE_LABELS: Record<Locale, string> = {
  uz: 'Oʻzbekcha',
  ru: 'Русский',
  en: 'English',
  tr: 'Türkçe',
  kk: 'Қазақша',
  ar: 'العربية',
  zh: '简体中文',
  es: 'Español',
};
/** BCP-47 tags used for Intl number, date and currency formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  uz: 'uz-Latn-UZ',
  ru: 'ru-RU',
  en: 'en-US',
  tr: 'tr-TR',
  kk: 'kk-KZ',
  ar: 'ar',
  zh: 'zh-CN',
  es: 'es-ES',
};

/** Fixed business rule: 3.5% commission on eligible completed sales, in basis points. */
export const DEFAULT_COMMISSION_BPS = 350;

export const SETTING_KEYS = {
  commissionBps: 'finance.commissionBps',
  appCommissionBps: 'finance.appCommissionBps',
  rewardHoldDays: 'rewards.holdDays',
  defaultCurrency: 'finance.defaultCurrency',
} as const;

// ---------------------------------------------------------------------------
// Personas, roles and workspaces
// ---------------------------------------------------------------------------

export const PERSONAS = [
  'discover', 'job', 'services', 'sell', 'create', 'brand', 'build', 'business',
] as const;
export type Persona = (typeof PERSONAS)[number];

export const WORKSPACES = [
  'buyer', 'seller', 'creator', 'work', 'freelance', 'brand', 'developer', 'admin',
] as const;
export type Workspace = (typeof WORKSPACES)[number];

export const ROLE_KEYS = [
  'customer', 'job_seeker', 'freelancer', 'seller', 'creator', 'developer', 'brand',
  'business_owner', 'moderator', 'finance', 'support', 'admin', 'super_admin',
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERSONA_ROLE: Record<Persona, RoleKey> = {
  discover: 'customer',
  job: 'job_seeker',
  services: 'freelancer',
  sell: 'seller',
  create: 'creator',
  brand: 'brand',
  build: 'developer',
  business: 'business_owner',
};

export const ROLE_WORKSPACES: Partial<Record<RoleKey, Workspace[]>> = {
  customer: ['buyer'],
  job_seeker: ['work'],
  freelancer: ['freelance'],
  seller: ['seller'],
  creator: ['creator'],
  developer: ['developer'],
  brand: ['brand'],
  business_owner: ['seller', 'brand'],
  moderator: ['admin'],
  finance: ['admin'],
  support: ['admin'],
  admin: ['admin'],
  super_admin: ['admin'],
};

/** Roles a person may grant to themselves. Everything else requires an administrator. */
export const SELF_ASSIGNABLE_ROLES: readonly RoleKey[] = [
  'customer', 'job_seeker', 'freelancer', 'seller', 'creator', 'developer', 'brand', 'business_owner',
];
export const STAFF_ROLES: readonly RoleKey[] = ['moderator', 'finance', 'support', 'admin', 'super_admin'];

export const PERMISSIONS = [
  'marketplace.buy',
  'store.manage',
  'product.manage',
  'order.sell.read',
  'refund.manage',
  'payout.request',
  'campaign.manage',
  'campaign.participate',
  'job.post',
  'job.apply',
  'service.manage',
  'course.manage',
  'community.manage',
  'app.manage',
  'apikey.manage',
  'webhook.manage',
  'admin.access',
  'admin.users.read',
  'admin.users.write',
  'admin.roles.write',
  'admin.marketplace.moderate',
  'admin.rewards.moderate',
  'admin.jobs.moderate',
  'admin.apps.review',
  'admin.ads.moderate',
  'admin.verification.review',
  'admin.finance.read',
  'admin.finance.write',
  'admin.settings.write',
  'admin.flags.write',
  'admin.audit.read',
  'admin.support',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF_BASE: Permission[] = ['admin.access'];
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  customer: ['marketplace.buy'],
  job_seeker: ['job.apply'],
  freelancer: ['service.manage', 'payout.request'],
  seller: ['store.manage', 'product.manage', 'order.sell.read', 'refund.manage', 'payout.request', 'course.manage', 'community.manage'],
  creator: ['campaign.participate', 'course.manage', 'community.manage', 'store.manage', 'product.manage', 'order.sell.read', 'refund.manage', 'payout.request'],
  developer: ['app.manage', 'apikey.manage', 'webhook.manage', 'payout.request'],
  brand: ['campaign.manage', 'job.post'],
  business_owner: ['store.manage', 'product.manage', 'order.sell.read', 'refund.manage', 'payout.request', 'campaign.manage', 'job.post'],
  moderator: [...STAFF_BASE, 'admin.users.read', 'admin.marketplace.moderate', 'admin.rewards.moderate', 'admin.jobs.moderate', 'admin.apps.review', 'admin.ads.moderate', 'admin.verification.review'],
  finance: [...STAFF_BASE, 'admin.finance.read', 'admin.finance.write', 'admin.audit.read'],
  support: [...STAFF_BASE, 'admin.users.read', 'admin.support'],
  admin: [...STAFF_BASE, 'admin.users.read', 'admin.users.write', 'admin.marketplace.moderate', 'admin.rewards.moderate', 'admin.jobs.moderate', 'admin.apps.review', 'admin.ads.moderate', 'admin.verification.review', 'admin.finance.read', 'admin.settings.write', 'admin.flags.write', 'admin.audit.read', 'admin.support'],
  super_admin: [...PERMISSIONS.filter((p) => p.startsWith('admin.'))],
};

// ---------------------------------------------------------------------------
// Subscription entitlements
// ---------------------------------------------------------------------------

export const FEATURES = [
  'analytics.advanced',
  'automation.advanced',
  'integrations.extended',
  'storefront.customDomain',
  'storefront.premium',
  'ai.businessTools',
  'crm.advanced',
  'team.features',
  'reports.advanced',
  'support.priority',
] as const;
export type Feature = (typeof FEATURES)[number];

export const FREE_LIMITS = { products: 25, automations: 2, aiRequestsPerDay: 10 } as const;
export const PRO_LIMITS = { products: 1000, automations: 50, aiRequestsPerDay: 500 } as const;

/** Modules that exist as data and API but are switched by flag until infrastructure exists. */
export const FLAGS = {
  liveStreaming: 'creator.liveStreaming',
  videoTranscoding: 'creator.videoTranscoding',
  physicalProducts: 'marketplace.physicalProducts',
  aiAutopilot: 'ai.autopilot',
  futureLab: 'lab.enabled',
} as const;

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export type OnboardingQuestion = {
  key: string;
  kind: 'single' | 'multi' | 'text';
  options?: readonly string[];
};

export const ONBOARDING_QUESTIONS: Partial<Record<Persona, readonly OnboardingQuestion[]>> = {
  sell: [
    { key: 'productTypes', kind: 'multi', options: ['digital', 'physical', 'subscriptions', 'services'] },
    { key: 'entity', kind: 'single', options: ['individual', 'organization'] },
    { key: 'country', kind: 'text' },
    { key: 'hasBrand', kind: 'single', options: ['yes', 'no'] },
  ],
  build: [
    { key: 'stack', kind: 'text' },
    { key: 'publishApps', kind: 'single', options: ['yes', 'no', 'unsure'] },
    { key: 'sellTemplates', kind: 'single', options: ['yes', 'no'] },
    { key: 'teamMode', kind: 'single', options: ['individual', 'team'] },
  ],
  job: [
    { key: 'field', kind: 'text' },
    { key: 'experience', kind: 'single', options: ['entry', 'mid', 'senior', 'lead'] },
    { key: 'workplace', kind: 'single', options: ['remote', 'local', 'either'] },
    { key: 'languages', kind: 'text' },
  ],
  create: [
    { key: 'platforms', kind: 'multi', options: ['youtube', 'tiktok', 'instagram', 'other'] },
    { key: 'contentType', kind: 'multi', options: ['clips', 'ugc', 'education', 'entertainment'] },
  ],
  services: [
    { key: 'field', kind: 'text' },
    { key: 'experience', kind: 'single', options: ['entry', 'mid', 'senior', 'lead'] },
  ],
  brand: [
    { key: 'entity', kind: 'single', options: ['brand', 'agency'] },
    { key: 'goal', kind: 'multi', options: ['views', 'leads', 'sales', 'testing'] },
  ],
  business: [
    { key: 'stage', kind: 'single', options: ['idea', 'launched', 'growing'] },
    { key: 'teamSize', kind: 'single', options: ['solo', 'small', 'medium', 'large'] },
  ],
};

export const API_SCOPES = [
  'products:read', 'orders:read', 'campaigns:read', 'profile:read', 'webhooks:manage',
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const WEBHOOK_EVENTS = [
  'order.paid', 'order.refunded', 'product.published', 'submission.approved', 'app.installed', 'app.uninstalled',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Permissions an app can request from an installing user. */
export const APP_PERMISSIONS = [
  'read:store', 'read:products', 'read:orders', 'write:products', 'read:analytics', 'read:customers',
] as const;
export type AppPermission = (typeof APP_PERMISSIONS)[number];
