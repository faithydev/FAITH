/** Shapes the web app reads from the API. Money is always a digit string of minor units. */

export type Me = {
  id: string; email: string; locale: string; currency: string; activeWorkspace: string; onboarded: boolean; twoFactor: boolean;
  profile: { displayName: string; username: string; bio: string | null; country: string | null; website: string | null; recommendationsConsent: boolean } | null;
  roles: string[]; lockedRoles: string[]; pro: boolean; permissions: string[]; workspaces: string[];
  badge: { kind: string; status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED'; grantAt: string; verifiedAt: string | null } | null;
  plan: { key: string; renewsAt: string | null; cancelAtPeriodEnd: boolean };
  features: string[]; flags: Record<string, boolean>; unreadNotifications: number; cartCount: number;
};

export type PlatformMeta = { demoData: boolean; mockPayments: boolean; aiLive: boolean; publicDemo?: boolean };
export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; pages: number };

export type Category = { id: string; slug: string; names: Record<string, string> };
export type ProductCard = {
  id: string; slug: string; title: string; summary: string; type: string; currency: string; coverKey: string | null; tags: string[];
  priceFromMinor: string; ratingCount: number; ratingSum: number; salesCount: number;
  store: { slug: string; name: string }; category: { slug: string; names: Record<string, string> } | null;
};
export type Variant = { id: string; name: string; priceMinor: string; compareAtMinor: string | null };
export type ProductDetail = ProductCard & {
  description: string; variants: Variant[];
  assets: { id: string; kind: string; storageKey?: string; filename: string; sizeBytes: number }[];
  versions: { version: string; changelog: string | null; createdAt: string }[];
  license: { name: string; terms: string; commercialUse: boolean; seats: number; territory: string; durationDays: number | null } | null;
  course: { slug: string; title: string } | null; community: { slug: string; name: string } | null;
  wishlisted: boolean; ownedEntitlementId: string | null; isOwnProduct: boolean;
  reviews: { id: string; rating: number; body: string; createdAt: string; user: { profile: { displayName: string } | null } }[];
  store: { id?: string; slug: string; name: string; tagline?: string | null; logoKey?: string | null; badge?: string | null };
};
export type Sponsored = { id: string; title: string; sponsored: true; product: ProductCard | null };
export type CartView = {
  items: { id: string; quantity: number; variantId: string; variantName: string; unitPriceMinor: string; available: boolean; product: { id: string; slug: string; title: string; currency: string; type: string; store: { name: string; slug: string } } }[];
  totals: { currency: string; subtotalMinor: string }[];
};
export type Order = {
  id: string; number: string; status: string; currency: string; subtotalMinor: string; discountMinor: string; totalMinor: string; createdAt: string; paidAt: string | null;
  items: { id: string; title: string; variantName: string; netMinor: string; refundedMinor: string; productId: string; review: { id: string } | null; product?: { slug: string } }[];
  refunds: { id: string; status: string; amountMinor: string; createdAt: string; reason?: string }[];
};
export type LibraryItem = {
  id: string; licenseKey: string; licenseTerms: { name?: string; terms?: string } | null; grantedAt: string; expiresAt: string | null;
  product: { id: string; slug: string; title: string; type: string; assets: { id: string; filename: string; sizeBytes: number }[]; course: { slug: string } | null; community: { slug: string } | null };
};
export type Store = { id: string; slug: string; name: string; tagline: string | null; description: string | null; currency: string; status: string; country: string | null; logoKey?: string | null; bannerKey?: string | null; _count?: { products: number } };
export type SellerProduct = {
  id: string; slug: string; title: string; summary: string; description: string; type: string; status: string; currency: string; priceFromMinor: string; salesCount: number; viewCount: number; updatedAt: string;
  tags: string[]; categoryId: string | null; licenseId: string | null; affiliateBps: number | null;
  variants: { id: string; name: string; priceMinor: string; active: boolean }[];
  assets: { id: string; kind: string; filename: string; sizeBytes: number; storageKey?: string }[]; coverKey?: string | null;
};
export type RewardRule = { metric: string; unitSize: string; rateMinor: string; capMinor: string | null; minQualified: string };
export type Campaign = {
  id: string; slug: string; title: string; summary: string; type: string; currency: string; budgetMinor: string; fundedMinor: string; accruedMinor: string;
  platforms: string[]; countries: string[]; submissionDeadline: string; requiresApplication: boolean; status?: string;
  org: { name: string; slug?: string; verifiedAt?: string | null }; rules: RewardRule[]; _count: { submissions: number; applications?: number };
};
export type CampaignDetail = Campaign & {
  description: string; guidelines: string; usageRights: string; creatorPermissions: string; attribution: string; adDisclosure: string;
  licenseDays: number | null; territory: string | null; prohibitedContent: string;
  requirements: { id: string; label: string; required: boolean }[];
  application: { status: string } | null;
  verification: { platform: string; availability: string; note: string }[];
};
export type Job = {
  id: string; slug: string; title: string; employmentType: string; workplace: string; experience: string; location: string | null; country: string | null;
  currency: string; salaryMinMinor: string | null; salaryMaxMinor: string | null; skills: string[]; publishedAt: string | null;
  org: { name: string; slug: string; verifiedAt: string | null };
};
export type Service = {
  id: string; slug: string; title: string; summary: string; currency: string; tags: string[];
  packages: { priceMinor: string; deliveryDays: number }[];
  freelancer: { id: string; profile: { displayName: string; username: string; country: string | null } | null };
};
export type AppCard = {
  id: string; slug: string; name: string; tagline: string; category: string; pricing: string; priceMinor: string; currency: string; installCount: number;
  developer: { developerProfile: { name: string; verifiedAt: string | null } | null };
};
export type StatusRow = { key: string; currency: string; balanceMinor: string; ownerId: string | null };
export type NotificationRow = { id: string; kind: string; params: Record<string, string>; href: string | null; readAt: string | null; createdAt: string };
