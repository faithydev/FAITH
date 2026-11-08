# Roadmap

Ordered by what unblocks real use. Nothing here is promised by a date.

## 1. Real money

- Contract with a licensed payment partner in Uzbekistan and build a verified adapter.
- Reconciliation against settlement reports; payouts through the partner's API.
- Legal review of terms, privacy, tax and consumer rules, in Uzbek and Russian first.

## 2. Live integrations

- Test S3 storage, SMTP and Google login against real services.
- Apple sign-in (the button exists and is disabled until this is done).
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

- The final Pro price.
- The App Marketplace commission rate.
