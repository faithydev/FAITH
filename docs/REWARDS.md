# Content Rewards

Brands fund campaigns up front; creators publish content and earn from approved results.

## Lifecycle

1. **Draft.** A brand organisation creates a campaign: type, guidelines, requirements, eligible
   platforms and countries, content rights, reward rules and a budget.
2. **Funding.** The brand pays the budget through a `CAMPAIGN_FUNDING` payment. Nothing can go
   live unfunded, so creators never work for an empty promise.
3. **Review.** Staff approve the campaign before it is public.
4. **Participation.** Creators apply when the campaign requires it, then submit content links
   and accept the rights, disclosure and prohibited-content terms.
5. **Metrics.** Results are recorded per submission with their source: `API`, `MANUAL`
   (entered by a reviewer) or `SIMULATED` (development only). The source is always shown.
6. **Decision.** A reviewer approves or rejects with a reason. Approval writes a reward accrual
   against the campaign budget account. The funded budget is a hard ceiling: a campaign can never
   owe more than it holds.
7. **Appeal.** A rejected creator can appeal once. Staff uphold or deny it, with a resolution.

## Reward rules

`APPROVED_SUBMISSION` pays a flat rate per approved piece. `VIEWS`, `CLICKS`, `LEADS` and `SALES`
pay per unit (for example per 1,000 views), with an optional cap per submission.

## What can be verified

Each platform and metric is labelled with one of:

| Label | Meaning |
| --- | --- |
| Automated | Numbers come from the platform. No such connection exists in this build |
| Account authorisation required | The platform shares numbers only if the creator authorises FAITH |
| Manual review | A reviewer checks numbers against evidence the creator provides |
| Unavailable | The number cannot be verified and is not paid on |

FAITH does not claim that private or unavailable metrics are verified automatically.

## Risk checks

Rule-based signals help reviewers: duplicate URLs, duplicate submissions, unusual frequency,
inconsistent metrics, repeated evidence, possible prohibited content, suspicious referrals and
possible content reuse. These are simple rules, not complete fraud prevention, and a person
makes every decision. The interface says this next to the signals.

## Sponsored content

Campaign content must carry the platform's advertising disclosure, and FAITH marks its own paid
placements as advertising. Paid placement never changes organic ranking.
