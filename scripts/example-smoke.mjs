#!/usr/bin/env node
/**
 * Proves the developer platform end to end against a running stack: creates a scoped key and a
 * webhook, starts examples/order-notifier as a separate process, makes a real order through the
 * payment simulator, then waits for the worker's signed delivery to reach the app.
 *
 * Needs `pnpm dev` or `pnpm start` running on seeded data. Writes one order and one key.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const API = process.env.FAITH_API_URL ?? 'http://localhost:4000';
const ORIGIN = process.env.FAITH_WEB_URL ?? 'http://localhost:3000';
const PASSWORD = 'FaithDemo2026!';

function session(email) {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(`${API}/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: ORIGIN, cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };
  return { call, login: () => call('POST', '/auth/login', { email, password: PASSWORD }) };
}

const seller = session('seller@faith.dev');
await seller.login();
const stamp = Date.now();
// The seeded seller builds nothing yet, so it adds the developer role like any user would.
await seller.call('POST', '/me/roles', { persona: 'build' });
const key = await seller.call('POST', '/developer/keys', { name: `Notifier ${stamp}`, scopes: ['profile:read', 'orders:read'], env: 'LIVE' });
const hook = await seller.call('POST', '/developer/webhooks', { url: 'http://localhost:4100/webhooks/faith', events: ['order.paid'] });

const lines = [];
const app = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', 'server.ts'], {
  cwd: resolve(root, 'examples/order-notifier'),
  env: { ...process.env, FAITH_API_KEY: key.key, FAITH_WEBHOOK_SECRET: hook.secret, FAITH_API_URL: API },
});
app.stdout.on('data', (d) => { process.stdout.write(`[app] ${d}`); lines.push(String(d)); });
app.stderr.on('data', (d) => process.stderr.write(`[app] ${d}`));

const wait = async (test, label, seconds) => {
  for (let i = 0; i < seconds * 2; i++) {
    if (test()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  app.kill();
  throw new Error(`Timed out waiting for: ${label}`);
};

let failed = false;
try {
  await wait(() => lines.join('').includes('Order notifier on'), 'the app to listen', 15);

  const buyer = session('customer5@faith.dev');
  await buyer.login();
  const stores = await seller.call('GET', '/seller/stores');
  const owned = new Set((await buyer.call('GET', '/library')).items?.map((i) => i.product?.id ?? i.productId) ?? []);
  const mine = new Set(stores.map((x) => x.slug));
  const products = (await buyer.call('GET', '/marketplace/products?pageSize=48')).items.filter((p) => mine.has(p.store.slug));
  const pick = products.find((p) => !owned.has(p.id));
  if (!pick) throw new Error('This customer already owns every product in the store');
  const detail = await buyer.call('GET', `/marketplace/products/${pick.slug}`);
  await buyer.call('POST', '/cart/items', { variantId: detail.variants[0].id, quantity: 1 });
  const checkout = await buyer.call('POST', '/checkout', { idempotencyKey: `smoke-${stamp}` });
  await buyer.call('POST', `/payments/${checkout.payment.paymentId}/simulate`, { outcome: 'success' });
  console.log(`Order paid: ${checkout.order?.number ?? checkout.number ?? 'ok'}. Waiting for the worker.`);

  await wait(() => lines.join('').includes('Sold '), 'the signed webhook', 30);
  await wait(() => lines.join('').includes('Orders visible to this key'), 'the SDK call', 15);
  console.log('PASS: signed webhook verified by the app, and the SDK read orders with the scoped key.');
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  failed = true;
} finally {
  await seller.call('DELETE', `/developer/webhooks/${hook.id}`).catch(() => {});
  await seller.call('DELETE', `/developer/keys/${key.id}`).catch(() => {});
  app.kill();
}
process.exit(failed ? 1 : 0);
