# Deployment

**This build is not ready for production.** It has no integrated payment provider, its legal
texts are unreviewed drafts, and several adapters have never run against live services. This
document says what a production deployment needs; it does not claim one exists.

## Processes

| Process | Command | Notes |
| --- | --- | --- |
| API | `node apps/api/dist/main.js` | Stateless; scale horizontally |
| Web | `pnpm --filter @faith/web start` | Stateless; needs `INTERNAL_API_URL` |
| Worker | `node apps/worker/dist/main.js` | Several can run; outbox claims use SKIP LOCKED |
| Migrations | `pnpm --filter @faith/database exec prisma migrate deploy` | Run once per release, before the API |

Build everything with `pnpm build`. `pnpm start` runs the three processes on one machine for a
local check of the compiled build.

## Services

| Service | Required | Notes |
| --- | --- | --- |
| PostgreSQL 16+ | Yes | Developed and tested on 18 |
| Redis | No | Enables BullMQ scheduling; the Postgres outbox works without it |
| S3-compatible storage | Yes in production | Local disk is for development only |
| SMTP | Yes in production | The development mailbox is refused in production |
| Payment partner | Yes for any real money | No adapter is integrated yet |

## Configuration

Every variable is listed in `.env.example`. In production:

- Generate all four secrets fresh (32+ random bytes each) and keep them in a secret manager.
- `PAYMENT_PROVIDER=mock` and `ALLOW_MOCK_PAYMENTS=true` are refused when `NODE_ENV=production`.
- `EMAIL_DRIVER=dev` is refused in production.
- Serve over HTTPS; the web app already sends HSTS, CSP and frame protection headers.
- Webhook endpoints must be public HTTPS addresses in production (private targets are refused).

## Containers

`infrastructure/docker/Dockerfile` builds one image for all three processes, and
`infrastructure/docker/docker-compose.yml` runs PostgreSQL, Redis, migrations with the seed, the
API, the worker and the web app locally. Both files are written but were not executed here,
because Docker is not installed in this environment. The compose stack is development-configured
on purpose (simulated payments, development mailbox) and is not a production template.

## Before going live

1. A licensed payment partner contract and a verified adapter, with refunds and reconciliation.
2. Legal review: terms, privacy, consumer law, tax, data protection and data residency.
3. Live tests of S3, SMTP, Google login and the Anthropic adapter.
4. A security review and penetration test.
5. Backups, point-in-time recovery, monitoring, alerting and an incident runbook.
6. The final Pro price and App Marketplace commission, decided by the business.
