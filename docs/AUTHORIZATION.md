# Authorization

Every decision is made on the server. The web app hides what a person cannot use, but hiding is
never the protection.

## Identity

One account per person. Roles are added to that account; nobody signs up twice to sell or hire.
A person chooses a workspace (Personal, Seller, Creator, Career, Freelance, Brand, Developer) and
the API remembers it, but the workspace only changes navigation, not permissions.

## Roles

Self-assignable: `customer`, `job_seeker`, `freelancer`, `seller`, `creator`, `developer`,
`brand`, `business_owner`. Onboarding answers map to these (`packages/config`, `PERSONAS`).

Staff roles, granted only by an administrator and recorded in the audit log: `moderator`,
`finance`, `support`, `admin`, `super_admin`.

## Permissions

Routes declare `@RequirePermission('...')`. The full map lives in `packages/config`
(`ROLE_PERMISSIONS`). Highlights:

| Role | Permissions |
| --- | --- |
| customer | marketplace.buy |
| seller | store.manage, product.manage, order.sell.read, refund.manage, payout.request, course.manage, community.manage |
| creator | campaign.participate plus the seller set for their own store |
| developer | app.manage, apikey.manage, webhook.manage, payout.request |
| brand | campaign.manage, job.post |
| moderator | admin.access and moderation of users, marketplace, rewards, jobs, apps, ads, verification |
| finance | admin.access, admin.finance.read, admin.finance.write, admin.audit.read |
| admin | All admin permissions except admin.finance.write |

## Ownership

Permissions say what kind of action is allowed. Services then check ownership on every row:
a seller can only touch their own stores, a reviewer cannot review their own submission, a
person cannot buy their own product or apply to their own organisation's job.

## Plans

`@RequireFeature()` gates Pro capabilities by entitlement, not by role. Free and Pro limits are
in `packages/config` (`FREE_LIMITS`, `PRO_LIMITS`). The Pro price is not set by the code; until
staff set it in Admin → Settings, upgrading is closed.

## Sensitive actions

Admin actions that move money or change rules require an explicit `confirm: true` in the body
and are written to `AuditLog` with the actor, the action and its target. The web app asks
for confirmation in a dialog before sending them.

## API keys

Keys carry scopes and an environment. A sandbox key can never read real records. Revoked keys
stop working immediately. Installing an app asks the person to approve each permission.
