# Architecture

FAITH is a pnpm monorepo with one API, one web app, one background worker and shared packages.

```text
apps/web       Next.js 16 App Router (React 19.3), Tailwind 4, next-intl, three.js
apps/api       NestJS 11 modular monolith, prefix /v1, OpenAPI at /docs
apps/worker    Outbox drain, webhook delivery, subscription expiry, cleanup
packages/
  config         Locales, roles, permissions, plans, flags, scopes, webhook events
  money          Integer money, 3.5% commission, allocation and refund reversal
  validators     Every request body as a zod schema, shared by API and web
  design-tokens  Colours, radii, motion; rendered to CSS custom properties
  database       Prisma 7 schema, migrations, client factory, reference data
  automation     Outbox processing, rules, signed webhooks
  sdk            TypeScript client for the public API and webhook verification
examples/order-notifier  A third-party app that runs outside FAITH
```

## Request path

1. The browser talks only to the web origin. `next.config.ts` rewrites `/api/v1/*` to the API,
   so the session cookie is first-party and CORS is not needed.
2. Server components call the API directly with the visitor's cookie (`lib/api.ts`).
3. The API runs four global guards in order: origin check for state-changing requests, rate
   limit, session, permission. Routes opt out with `@Public()` and opt in with
   `@RequirePermission()` and `@RequireFeature()`.
4. Services do the work inside Prisma transactions. Anything other parts must hear about is
   written to `OutboxEvent` in the same transaction.
5. The worker claims outbox rows with `FOR UPDATE SKIP LOCKED`, runs automation rules, creates
   notifications and queues signed webhook deliveries.

## Modules (apps/api/src)

| Module | Owns |
| --- | --- |
| auth | Registration, login, sessions, TOTP, password reset, email verification, OAuth start |
| identity | Profiles, roles, onboarding, workspaces, organisations, verification requests |
| commerce | Catalogue, stores, products, files, cart, checkout, orders, refunds, reviews, library |
| payments | Provider interface, simulator, webhook intake, purpose handlers |
| finance | Double-entry ledger, balances, payout requests |
| billing | Plans, Pro subscriptions, entitlements |
| rewards | Campaigns, funding, applications, submissions, metrics, review, accruals, appeals |
| work | Jobs, applications, candidate profiles, freelance services, projects, disputes |
| creator | Creator profiles, courses, lessons, enrolments, communities, posts |
| developer | Apps, versions, installs, API keys, webhooks, the public API |
| ai | Assistant capabilities with an Anthropic adapter and a labelled demo adapter |
| platform | Messages, notifications, automations, ads, affiliate links, opportunities |
| admin | Staff console: users, moderation, finance, apps review, settings, flags, audit |

## Background work

The worker uses BullMQ when `REDIS_URL` is set and plain timers otherwise. The Postgres outbox
is the source of truth either way, so nothing is lost if Redis is absent or restarts. The BullMQ
path compiles but has not been executed against a real Redis yet.

## Web app

- Route groups: `(public)`, `(auth)`, `app/*` (signed-in workspaces), `admin/*` (staff).
- Eight locales through next-intl. Uzbek is the default and has no URL prefix.
- Page changes run through React `<ViewTransition>` (see DESIGN_SYSTEM.md).
- Client components receive only the dictionary sections they use (`IntlScope`).

## Integrations and their real state

| Integration | State |
| --- | --- |
| Payments | Simulator only. Click, Payme and Stripe adapters are disabled stubs |
| Storage | Local disk works. S3-compatible driver written, not tested against a live bucket |
| Email | Development mailbox works. SMTP driver written, not tested live |
| Google login | Written, appears only when configured, not tested against Google |
| Apple login | Not implemented; its button is disabled and says so |
| AI | Demo adapter works. Anthropic adapter written, not called with a live key here |
| Social metrics | No platform connection; reviewers enter numbers, labelled as such |
