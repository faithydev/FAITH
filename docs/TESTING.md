# Testing

| Command | What runs | Needs |
| --- | --- | --- |
| `pnpm test:unit` | Money and commission maths (vitest) | Nothing |
| `pnpm test:api` | API integration tests against a throwaway PostgreSQL | Nothing; it boots its own server |
| `pnpm test:e2e` | Playwright: journeys, languages, accessibility, 3D fallbacks, layout | A running, seeded stack on :3000 and :4000 |
| `pnpm i18n:check` | Every locale has every key and placeholder; flags untranslated text | Nothing |
| `pnpm lint` / `pnpm typecheck` | ESLint, TypeScript across the workspace | Nothing |
| `node scripts/example-smoke.mjs` | Key, webhook, real order, signed delivery to the sample app | A running, seeded stack |

## Integration tests

`scripts/test-api.mjs` starts an embedded PostgreSQL on a random port, applies migrations and runs
`apps/api/test/*.test.ts` with fresh secrets. Set `TEST_DATABASE_URL` to use your own server.
The suites cover auth and sessions, two-factor, roles, checkout, the 3.5% commission, refunds and
their reversal, ledger balance, payouts, Pro billing, campaigns from funding to appeal, jobs,
apps and API keys, webhooks, and server-side admin authorisation.

## Browser tests

- `journeys.spec.ts`: sign up and onboard; skip onboarding; a seller publishes and a buyer pays
  and is refunded; a brand runs a campaign and a creator is paid; a job seeker applies and a
  developer submits an app; Free to Pro through the simulator; a normal user cannot reach admin.
- `quality.spec.ts`: workspaces at phone and desktop widths, every language with the right text
  direction, axe accessibility on key pages, 3D fallbacks.

The "Free to Pro" journey writes a test Pro price into the database it runs against. That price
is a fixture, not a business decision. Run E2E against a database you can reset.

On Windows without a Playwright browser download, `playwright.config.ts` uses a Chromium already
on the machine (`PW_CHROMIUM_PATH` overrides it).

## Continuous integration

`.github/workflows/ci.yml` runs install, lint, typecheck, dictionaries, unit, integration and
build, then a second job that starts the stack and runs Playwright. The workflow has been written
but not run on GitHub from this environment.
