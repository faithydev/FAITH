# API

Base URL in development: `http://localhost:4000/v1`. Interactive OpenAPI: `http://localhost:4000/docs`
(JSON at `/docs/openapi.json`). From the browser, use the same paths under `/api/v1` on the web
origin; Next.js forwards them.

## Conventions

- **Authentication**: an opaque `faith_session` cookie (HttpOnly, SameSite=Lax). Only a SHA-256
  hash of the token is stored.
- **Origin check**: requests that change state must carry an `Origin` matching `WEB_ORIGIN`.
- **Money**: minor units as digit strings, for example `"1900"` with `"currency": "USD"`.
- **Idempotency**: checkout, funding and payout calls take an `idempotencyKey`; a repeat returns
  the first result.
- **Errors**: `{ "error": { "code": "ORDER_NOT_REFUNDABLE", "requestId": "...", "details": [...] } }`.
  Codes are stable and translated in the web app (`messages/*.json` under `errors`).
- **Validation**: every body is a zod schema from `@faith/validators`; failures return 422 with
  `details` per field.

## Route groups

| Prefix | Purpose |
| --- | --- |
| `/health`, `/health/meta` | Liveness, adapters in use, whether payments are simulated |
| `/auth/*` | Register, login, logout, verify email, reset password, TOTP, providers |
| `/me/*` | Profile, roles, onboarding, preferences, sessions, workspaces |
| `/marketplace/*` | Public catalogue, product pages, stores, sponsored placements |
| `/cart`, `/checkout`, `/orders`, `/library`, `/wishlist` | Buying |
| `/seller/*` | Stores, products, files, discounts, licences, orders, refunds, analytics |
| `/payments/*` | Provider webhooks; `simulate` exists only with the simulator enabled |
| `/billing/*` | Plans and the Pro subscription |
| `/rewards/*` | Campaigns, applications, submissions, review, appeals |
| `/jobs`, `/services`, `/projects` | Work |
| `/courses`, `/communities` | Learning and communities |
| `/developer/*` | Apps, versions, keys, webhooks, analytics |
| `/ai/*`, `/automations/*` | Assistant and automation |
| `/admin/*` | Staff console. Every route checks a staff permission on the server |
| `/public/*` | The public API for third-party apps (below) |

## Public API

Authenticate with `x-api-key`. Keys are created under Developer → API keys, shown once, and
stored as hashes. Each key has scopes: `products:read`, `orders:read`, `campaigns:read`,
`profile:read`, `webhooks:manage`. Sandbox keys (`faith_test_`) return fixed sample data.

```ts
import { FaithClient } from '@faith/sdk';
const faith = new FaithClient({ apiKey: process.env.FAITH_API_KEY! });
const { items } = await faith.orders();
```

## Webhooks

Events: `order.paid`, `order.refunded`, `product.published`, `submission.approved`,
`app.installed`, `app.uninstalled`.

Each delivery is a POST with:

- `x-faith-timestamp`: Unix seconds
- `x-faith-signature`: hex HMAC-SHA256 of `${timestamp}.${rawBody}` with the endpoint secret

Reject old timestamps and compare signatures in constant time; `verifyWebhook` in `@faith/sdk`
does both. Deliveries retry with exponential backoff, so handlers must be idempotent (use the
event `id`). `examples/order-notifier` is a working receiver, and
`node scripts/example-smoke.mjs` proves the round trip against a running stack.
