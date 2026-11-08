# Security

What the code does today. None of it replaces a professional security review, which has not
happened.

## Accounts

- Passwords: argon2id; never stored or logged in plain text.
- Sessions: opaque random tokens in an HttpOnly, SameSite=Lax cookie; only a SHA-256 hash is
  stored. Sessions can be listed and ended from Settings.
- Two-factor: TOTP with one-time backup codes; the TOTP secret is encrypted at rest.
- Registration and password reset always answer the same way, so they do not reveal which
  email addresses have accounts.
- Repeated failed logins lock the account temporarily; rate limits apply per route.

## Requests

- State-changing requests must come from the web origin (origin check against CSRF).
- Every body is validated with zod before it reaches a service.
- Authorisation is checked on the server for every route, and ownership for every row.
- Errors return stable codes and a request id, never stack traces.

## Files

- Uploads are checked by their actual bytes, not their name, against an allow list.
- Downloads use short-lived signed links created per request, only for owners.

## Money

- Payments are confirmed only by signed provider webhooks; the browser cannot mark an order paid.
- The ledger is append-only and must balance, enforced by database triggers.
- Financially consequential, destructive or publishing actions require explicit confirmation.

## Developer platform

- Third-party code never runs inside FAITH. Apps run on their own infrastructure and call the
  public API with scoped keys.
- API keys are stored as hashes, scoped, split into sandbox and live, and revocable.
- Webhooks are signed with HMAC-SHA256 over timestamp and body. Signing secrets are encrypted at
  rest. In production, deliveries to private network addresses are refused (SSRF protection).

## Headers

Content Security Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and
a permissions policy that disables camera, microphone and geolocation.

## Audit

Staff actions go to the audit log with actor, action and target. Security events (logins,
lockouts, password resets and changes, two-factor on and off) are recorded with user and IP
address. Both are visible to staff with the audit permission.

## Reporting

Until a security contact exists, report issues privately to the repository owner rather than in
a public issue.
