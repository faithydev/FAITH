# Order notifier

A complete FAITH integration in one file. It shows the two halves of the developer platform:

1. It calls the API with a scoped key, through `@faith/sdk`.
2. It receives signed webhooks and verifies them before acting.

## Run it

1. In FAITH, open **Developer → API keys** and create a key with `profile:read` and `orders:read`.
2. Open **Developer → Webhooks** and add `http://localhost:4100/webhooks/faith` for `order.paid`.
   Copy the secret; it is shown once.
3. Start the app:

```bash
FAITH_API_KEY=faith_test_... FAITH_WEBHOOK_SECRET=whsec_... node --experimental-strip-types examples/order-notifier/server.ts
```

Sandbox keys (`faith_test_`) receive fixed sample data. Live keys only see the owner's records.
