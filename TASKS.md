# FAITH status

Last updated 2026-11-08. Every result below comes from a command that was actually run.

## Verified

| Check | Result |
| --- | --- |
| `pnpm build` (packages, API, worker, Next.js production build) | Passes |
| `pnpm typecheck` (all packages, apps and the sample app) | Passes |
| `pnpm lint` | Passes |
| `pnpm i18n:check` | Passes: 1345 keys in 8 languages |
| `pnpm test:unit` | 21/21 |
| `pnpm test:api` (real PostgreSQL) | 66/66 |
| Playwright on the production build, fresh database | 38/39 first run; the one failure is explained below and passes on rerun |
| `node scripts/example-smoke.mjs` | Passes: real simulated order, signed webhook verified by the sample app, scoped key read through the SDK |
| `pnpm bootstrap` from nothing (no `.env`, no database) | Passes in about 45 s |
| `pnpm dev` | Database, API, web and worker all start; pages answer 200 |
| `pnpm start` | Compiled API, web and worker start; the worker drains the Postgres outbox |

### Fixed during this round

- **Form dialogs never closed after saving.** The page behind stayed hidden, so, for example,
  a developer could not reach "Submit for review" after adding a version. Dialogs now close on
  success. The app submission journey passes.
- **Stale cached data after rebuilding the database.** The web app caches public answers for a
  minute; after a rebuild, job links pointed at rows that no longer existed for that minute.
  `pnpm bootstrap` and `pnpm db:reset` now clear that cache.
- **Kazakh letters fell back to another font** (Manrope has no ұ, ү, ғ). Display and interface
  fonts are now Onest and Geist, which cover Uzbek, Russian and Kazakh fully.
- Reward rules with a unit of one read "per 1 leads"; they now read "per lead" in all languages.

### Changed on purpose

- The "no canvas on sign-in" test became "no three.js on sign-in": the new sign-in page has a
  small decorative WebGL shader (no three.js, hidden from assistive technology, never blocking
  the form) and a static fallback, covered by a new test.

## Design

Pure black and neon green, light-follows-pointer buttons with press bloom, black-glass sign-in
over a lit horizon, View Transitions between pages with a neon progress line. See
`docs/DESIGN_SYSTEM.md`. Checked by screenshot: home, sign-up, marketplace, rewards and the seller
dashboard at desktop width; sign-up at 375 px; the marketplace in the light theme. Arabic RTL
and the full page list at 375/768/1440/1920 px are covered by the browser tests, not by eye.

## Not run

- Docker Compose and the Dockerfile: Docker is not installed here.
- The GitHub Actions workflow: not pushed or run on GitHub.
- Lighthouse.
- The BullMQ path (no Redis available).

## Not built

- Apple sign-in. Its button is visibly disabled and says it is not connected.
- Phone number at sign-up. The reference design had one; the form uses a password field instead,
  because accounts sign in with a password and no phone verification exists.
- Downloadable campaign reports (CSV/PDF). A JSON route exists.
- Content scheduling, live streaming, video transcoding (flagged off until infrastructure exists).

## Never tested live

- S3, SMTP, Google login, the Anthropic adapter.
- Click, Payme and Stripe are disabled adapters. No real money can move.
- Legal texts are unreviewed drafts. Translations other than English have had no native review.

## Local data

`.dev/postgres` holds a freshly seeded demo database. Two earlier databases with test data were
set aside, not deleted: `.dev/postgres-before-bootstrap-20261108` and
`.dev/postgres-e2e-20261108`, plus the earlier `.env` in `.dev/env.before-bootstrap-20261108`.
They are git-ignored and can be removed when no longer needed.

Running the browser suite writes test records and a $19/$190 Pro price into the database it runs
against. That price is a test fixture, not a business decision. Rebuild with `pnpm db:reset`.
