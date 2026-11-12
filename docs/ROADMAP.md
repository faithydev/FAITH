# Roadmap

> The full, current roadmap (in Uzbek, for the platform owner) is [ROADMAP.md](../ROADMAP.md) at the
> repository root. This page keeps the short engineering list.

Ordered by what unblocks real use. Nothing here is promised by a date.

## 1. Real money

- Contract with a licensed payment partner in Uzbekistan and build a verified adapter.
- Reconciliation against settlement reports; payouts through the partner's API.
- Legal review of terms, privacy, tax and consumer rules, in Uzbek and Russian first.

## 2. Live integrations

- Move uploads to S3-compatible storage (Render's free disk is wiped on every deploy) and turn on SMTP. Google login is live.
- Apple sign-in: implemented; waits for Apple Developer credentials.
- Official platform connections for creator metrics where the platform allows them
  (account authorisation flows), replacing manual entry for those metrics.
- Run the BullMQ path against Redis under load.

## 3. Product depth

- Downloadable campaign reports (CSV and PDF) instead of the JSON route.
- Phone number sign-up, with verification, if the business needs it.
- Content scheduling once publishing integrations exist.
- Live streaming and video transcoding, behind their existing flags, once infrastructure exists.
- Physical products, behind `marketplace.physicalProducts`.

## 4. Operations

- CI on GitHub with required checks; preview deployments.
- Monitoring, alerting, backups with restore drills.
- Lighthouse budgets in CI.
- Native-speaker review of all eight dictionaries.

## 5. Business decisions the code waits for

- The Pro yearly price (monthly is $11.99).
- The App Marketplace commission rate.
- Payment partners in Uzbekistan and for international cards.
