# Database

PostgreSQL 18 through Prisma 7 with the `@prisma/adapter-pg` driver adapter. The schema is
`packages/database/prisma/schema.prisma` (105 models and enums). Migrations live next to it.

## Local server without Docker

`pnpm db:start` runs a real PostgreSQL from the `embedded-postgres` package on port 54329 with
data in `.dev/postgres`. `pnpm bootstrap` starts it when needed. Any other PostgreSQL works:
point `DATABASE_URL` at it.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm db:migrate` | `prisma migrate deploy` |
| `pnpm db:seed` | Builds the API and runs the development seed through the real services |
| `pnpm db:reset` | Drops and rebuilds the local database. Destroys local data |

The seed refuses to run with `NODE_ENV=production`. Because it goes through the real services,
seeded orders, refunds and rewards create genuine ledger entries.

## Money

Amounts are `BigInt` minor units (cents, tiyin) with an ISO currency next to them. The API
serialises them as digit strings, so no value passes through a floating point number.

## Integrity enforced by the database itself

Migration `20261107000100_hardening` adds triggers that do not depend on application code:

- Ledger entries and transactions are append-only: no update, no delete.
- Every ledger transaction must balance (debits equal credits) when it commits.
- Every entry in a transaction must use the transaction's currency.

## Main groups of tables

| Area | Tables |
| --- | --- |
| Identity | User, UserProfile, Account, Session, AuthToken, Role, Permission, UserRole, Organization |
| Commerce | Store, Product, ProductVariant, ProductVersion, ProductAsset, LicenseTemplate, Discount, Cart, Order, SellerOrder, OrderItem, Refund, DigitalEntitlement, CustomerReview |
| Payments and money | Payment, PaymentEvent, LedgerAccount, LedgerTransaction, LedgerEntry, PayoutRequest, RevenueShare, RevenueAllocation |
| Billing | SubscriptionPlan, FeatureEntitlement, Subscription |
| Rewards | BrandCampaign, RewardRule, CampaignApplication, CampaignSubmission, CampaignMetric, RewardAccrual, RewardReview, RewardAppeal, FraudSignal |
| Work | Job, JobApplication, CandidateProfile, FreelancerProfile, ServiceListing, Project, ProjectMilestone, Dispute |
| Creator | CreatorProfile, Course, CourseSection, Lesson, Enrollment, Community, Post, Comment |
| Developer | DeveloperProfile, AppListing, AppVersion, AppInstallation, DeveloperCredential, WebhookEndpoint, WebhookDelivery |
| Platform | OutboxEvent, AutomationRule, AutomationRun, Notification, Conversation, Message, Advertisement, AiActionLog |
| Operations | PlatformSetting, FeatureFlag, Experiment, AuditLog, SecurityEvent, SupportTicket, EmailOutbox, Upload |

Secrets that must be readable later (webhook signing secrets, TOTP seeds) are encrypted with
AES-256-GCM under `APP_ENCRYPTION_KEY`. Secrets that only need checking (passwords, session
tokens, API keys) are stored as hashes only.
