# FAITH

A creator-commerce platform in one account: marketplace, content rewards, jobs and freelance,
courses and communities, an app marketplace, an AI assistant, automation and a double-entry ledger.
The launch market is Uzbekistan. The interface ships in Uzbek (default), Russian, English, Turkish,
Kazakh, Arabic (RTL), Chinese and Spanish.

**Status: development build. Not production-ready and not legally reviewed.** Payments run through
a labelled simulator and no real money moves. See [TASKS.md](TASKS.md) for what is verified and
what is missing.

## Requirements

- Node 22.12 or newer, pnpm 12
- No Docker needed: PostgreSQL runs from the `embedded-postgres` package. Redis is optional.

## Run locally

```bash
pnpm install
```

```bash
pnpm bootstrap
```

```bash
pnpm dev
```

`pnpm bootstrap` creates `.env` with fresh secrets, applies migrations and seeds demo data. It is
safe to repeat. `pnpm setup` is a built-in pnpm command, which is why the script has another name.

- Web: http://localhost:3000
- API: http://localhost:4000/v1 (health at `/v1/health`)

To check a compiled build on one machine, run `pnpm build`, then `pnpm start`.

## Demo accounts (seeded development data only)

The password for all of them is `FaithDemo2026!`. The seed refuses to run in production.

`admin@`, `moderator@`, `finance@`, `seller@`, `timur@`, `creator@`, `jasur@`, `kamola@`, `brand@`,
`developer@`, `talent@`, `buyer@`, `customer1@` to `customer5@`, all at `faith.dev`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript across the workspace |
| `pnpm test:unit` | Money and commission unit tests |
| `pnpm test:api` | API integration tests on a throwaway PostgreSQL |
| `pnpm test:e2e` | Playwright journeys, language, accessibility and fallback tests |
| `pnpm i18n:check` | Every language has every key and placeholder |
| `pnpm db:reset` | Rebuilds the local database. Destroys local data |
| `node scripts/example-smoke.mjs` | Key, webhook and sample app against a running stack |

## Layout

```text
apps/web       Next.js App Router interface
apps/api       NestJS modular monolith
apps/worker    Outbox, webhooks and expiry jobs
packages/      config, money, validators, design-tokens, database, automation, sdk
examples/      order-notifier, a sample third-party app
tests/e2e      Playwright
scripts/       bootstrap, dev, start, database and test helpers
```

## Containers

`infrastructure/docker/docker-compose.yml` runs PostgreSQL, Redis, migrations with the seed, the
API, the worker and the web app (`docker compose -f infrastructure/docker/docker-compose.yml up --build`).
It is a local stack, not a deployment, and it has not been run in this environment.

## Environment

`.env.example` lists every variable. Real payment providers, S3, SMTP, Google login and the
Anthropic adapter stay off until their credentials exist, and the interface says so.

## Look and feel

Pure black with one neon green. Buttons hold light in a corner that floods toward the pointer
and blooms when pressed; sign-in is black glass over a lit horizon; pages hand over to each
other through View Transitions with no flash. Onest and Geist cover Uzbek, Russian and Kazakh
fully. Details in [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Documentation

| Document | Covers |
| --- | --- |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Apps, packages, modules, request path, integration status |
| [DATABASE](docs/DATABASE.md) | Schema, migrations, money, database-enforced integrity |
| [API](docs/API.md) | Conventions, route groups, public API, webhooks |
| [AUTHORIZATION](docs/AUTHORIZATION.md) | Roles, permissions, ownership, plans, sensitive actions |
| [PAYMENTS](docs/PAYMENTS.md) | 3.5% commission, ledger, refunds, payouts, what real money needs |
| [REWARDS](docs/REWARDS.md) | Campaign lifecycle, verification labels, risk checks |
| [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) | Tokens, type, buttons, fields, motion, page transitions |
| [THREE_JS](docs/THREE_JS.md) | Scenes, fallbacks, quality tiers, cost control |
| [TESTING](docs/TESTING.md) | Every test command and what it covers |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Processes, services, configuration, what going live needs |
| [SECURITY](docs/SECURITY.md) | Accounts, requests, files, money, developer platform |
| [ROADMAP](docs/ROADMAP.md) | What comes next, in order |
| [TASKS](TASKS.md) | Verified results and open work |
