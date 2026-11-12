import { refreshRates, settleBadges } from '@faith/automation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockPaymentProvider } from '../src/payments/provider';
import { buy, createStoreWithProduct, fixtures, TestApp } from './harness';

const t = new TestApp();
beforeAll(() => t.start());
afterAll(() => t.stop());

describe('identity', () => {
  it('registers, verifies, onboards with several roles and switches workspace', async () => {
    const u = await t.signUp(['sell', 'create', 'job']);
    expect(u.me.roles.sort()).toEqual(['creator', 'customer', 'job_seeker', 'seller']);
    expect(u.me.workspaces).toEqual(expect.arrayContaining(['buyer', 'seller', 'creator', 'work']));
    await u.agent.patch('/v1/me/preferences').send({ activeWorkspace: 'creator' }).expect(200);
    expect((await u.agent.get('/v1/me')).body.activeWorkspace).toBe('creator');
    await u.agent.patch('/v1/me/preferences').send({ activeWorkspace: 'admin' }).expect(403);
  });

  it('does not reveal whether an email is registered', async () => {
    const u = await t.signUp();
    const repeat = await t.http.post('/v1/auth/register').send({ email: u.email, password: 'another-long-password', displayName: 'Someone' });
    const fresh = await t.http.post('/v1/auth/register').send({ email: `${t.unique('new')}@test.faith`, password: 'another-long-password', displayName: 'Someone' });
    expect(repeat.status).toBe(fresh.status);
    expect(repeat.body).toEqual(fresh.body);
    const noUser = await t.http.post('/v1/auth/login').send({ email: 'nobody@test.faith', password: 'whatever-password' });
    const badPass = await t.http.post('/v1/auth/login').send({ email: u.email, password: 'wrong-password-here' });
    expect(noUser.status).toBe(401);
    expect(noUser.body.error.code).toBe(badPass.body.error.code);
  });

  it('never stores a plaintext password and blocks login before verification', async () => {
    const email = `${t.unique('x')}@test.faith`;
    await t.http.post('/v1/auth/register').send({ email, password: 'correct-horse-battery', displayName: 'Xena' }).expect(202);
    const row = await t.db.user.findUniqueOrThrow({ where: { email } });
    expect(row.passwordHash).toMatch(/^\$argon2/);
    const r = await t.http.post('/v1/auth/login').send({ email, password: 'correct-horse-battery' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('resets a password once, and revokes old sessions', async () => {
    const u = await t.signUp();
    await t.http.post('/v1/auth/forgot-password').send({ email: u.email }).expect(202);
    const token = await t.lastEmailToken(u.email);
    await t.http.post('/v1/auth/reset-password').send({ token, password: 'a-brand-new-password' }).expect(200);
    await u.agent.get('/v1/me').expect(401);
    await t.http.post('/v1/auth/reset-password').send({ token, password: 'yet-another-password' }).expect(400);
    await t.http.post('/v1/auth/login').send({ email: u.email, password: 'a-brand-new-password' }).expect(200);
  });

  it('cannot self-assign a staff role through onboarding', async () => {
    const u = await t.signUp();
    await u.agent.post('/v1/onboarding').send({ personas: ['admin'], answers: {} }).expect(422);
    await u.agent.post('/v1/me/roles').send({ persona: 'super_admin' }).expect(422);
  });

  it('rejects a cross-site state change', async () => {
    const u = await t.signUp();
    const r = await u.agent.patch('/v1/me/preferences').set('Origin', 'https://evil.example').send({ locale: 'en' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('BAD_ORIGIN');
  });
});

describe('commerce', () => {
  it('sells a digital product, takes 3.5%, grants access and updates seller earnings', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { store, product, variantId } = await createStoreWithProduct(t, seller, { priceMinor: '10000' });

    const listed = await t.http.get(`/v1/marketplace/products?q=${encodeURIComponent(product.title)}`).expect(200);
    expect(listed.body.items.map((p: { id: string }) => p.id)).toContain(product.id);

    const { orderId } = await buy(t, buyer, variantId);

    const order = (await buyer.agent.get(`/v1/orders/${orderId}`).expect(200)).body;
    expect(order.status).toBe('PAID');
    const so = await t.db.sellerOrder.findFirstOrThrow({ where: { orderId } });
    expect(so.commissionBps).toBe(350);
    expect(so.commissionMinor).toBe(350n);
    expect(so.sellerNetMinor).toBe(9650n);

    expect(await t.ledgerBalance('platform:commission:USD')).toBeGreaterThanOrEqual(350n);
    expect(await t.ledgerBalance(`store:${store.id}:payable:USD`)).toBe(9650n);

    const library = (await buyer.agent.get('/v1/library').expect(200)).body;
    expect(library).toHaveLength(1);
    const asset = library[0].product.assets[0];
    const { url } = (await buyer.agent.post(`/v1/library/${library[0].id}/assets/${asset.id}/download`).expect(200)).body;
    const file = await t.http.get(url.replace('/api', ''));
    expect(file.status).toBe(200);

    const analytics = (await seller.agent.get(`/v1/seller/stores/${store.id}/analytics`).expect(200)).body;
    expect(analytics).toMatchObject({ grossMinor: '10000', netEarningsMinor: '9650', orders: 1 });
    expect((await t.db.outboxEvent.count({ where: { type: 'order.paid', payload: { path: ['orderId'], equals: orderId } } }))).toBe(1);
  });

  it('allocates commission across sellers and rounds to the exact fee', async () => {
    const a = await t.signUp(['sell']);
    const b = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const pa = await createStoreWithProduct(t, a, { priceMinor: '1001' });
    const pb = await createStoreWithProduct(t, b, { priceMinor: '3333' });
    await buyer.agent.post('/v1/cart/items').send({ variantId: pa.variantId, quantity: 1 }).expect(201);
    await buyer.agent.post('/v1/cart/items').send({ variantId: pb.variantId, quantity: 3 }).expect(201);
    const c = (await buyer.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('multi') }).expect(201)).body;
    await buyer.agent.post(`/v1/payments/${c.payment.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);

    const sellers = await t.db.sellerOrder.findMany({ where: { orderId: c.orderId }, include: { items: true } });
    expect(sellers).toHaveLength(2);
    const byStore = new Map(sellers.map((s) => [s.storeId, s]));
    expect(byStore.get(pa.store.id)!.commissionMinor).toBe(35n); // 35.035 rounds down
    expect(byStore.get(pb.store.id)!.commissionMinor).toBe(350n); // 349.965 rounds up
    for (const s of sellers) {
      expect(s.items.reduce((sum, i) => sum + i.commissionMinor, 0n)).toBe(s.commissionMinor);
      expect(s.items.reduce((sum, i) => sum + i.netMinor, 0n)).toBe(s.netMinor);
    }
    const payment = await t.db.payment.findFirstOrThrow({ where: { orderId: c.orderId } });
    expect(payment.amountMinor).toBe(1001n + 3333n * 3n);
  });

  it('applies a store discount before commission', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { store, variantId } = await createStoreWithProduct(t, seller, { priceMinor: '10000' });
    await seller.agent.post(`/v1/seller/stores/${store.id}/discounts`).send({ code: 'SAVE20', kind: 'PERCENT', value: '2000' }).expect(201);
    await buyer.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
    const c = (await buyer.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('d'), discountCode: 'SAVE20' }).expect(201)).body;
    const so = await t.db.sellerOrder.findFirstOrThrow({ where: { orderId: c.orderId } });
    expect(so).toMatchObject({ discountMinor: 2000n, netMinor: 8000n, commissionMinor: 280n });
  });

  it('treats a repeated checkout and a replayed webhook as one payment', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { store, variantId } = await createStoreWithProduct(t, seller, { priceMinor: '5000' });
    await buyer.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
    const idempotencyKey = t.unique('same');
    const first = (await buyer.agent.post('/v1/checkout').send({ idempotencyKey }).expect(201)).body;
    const second = (await buyer.agent.post('/v1/checkout').send({ idempotencyKey }).expect(201)).body;
    expect(second.payment.paymentId).toBe(first.payment.paymentId);
    expect(await t.db.order.count({ where: { buyerId: buyer.id } })).toBe(1);

    const payment = await t.db.payment.findUniqueOrThrow({ where: { id: first.payment.paymentId } });
    const body = JSON.stringify({ eventId: t.unique('evt'), type: 'payment.succeeded', providerRef: payment.providerRef, amountMinor: '5000', currency: 'USD' });
    const send = () => t.http.post('/v1/webhooks/payments/mock').set('content-type', 'application/json').set('x-faith-mock-signature', MockPaymentProvider.sign(body)).send(body);
    expect((await send().expect(200)).body.status).toBe('processed');
    expect((await send().expect(200)).body.status).toBe('duplicate');
    expect(await t.ledgerBalance(`store:${store.id}:payable:USD`)).toBe(4825n);
    expect(await t.db.digitalEntitlement.count({ where: { userId: buyer.id } })).toBe(1);
  });

  it('rejects a forged webhook and a mismatched amount', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { variantId } = await createStoreWithProduct(t, seller, { priceMinor: '5000' });
    await buyer.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
    const c = (await buyer.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('f') }).expect(201)).body;
    const payment = await t.db.payment.findUniqueOrThrow({ where: { id: c.payment.paymentId } });

    const forged = JSON.stringify({ eventId: t.unique('evt'), type: 'payment.succeeded', providerRef: payment.providerRef, amountMinor: '5000', currency: 'USD' });
    await t.http.post('/v1/webhooks/payments/mock').set('content-type', 'application/json').set('x-faith-mock-signature', 'bad').send(forged).expect(403);

    const cheap = JSON.stringify({ eventId: t.unique('evt'), type: 'payment.succeeded', providerRef: payment.providerRef, amountMinor: '1', currency: 'USD' });
    await t.http.post('/v1/webhooks/payments/mock').set('content-type', 'application/json').set('x-faith-mock-signature', MockPaymentProvider.sign(cheap)).send(cheap).expect(400);
    expect((await t.db.order.findUniqueOrThrow({ where: { id: c.orderId } })).status).toBe('PENDING_PAYMENT');
  });

  it('keeps the cart and grants nothing when payment fails', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { variantId } = await createStoreWithProduct(t, seller);
    const { orderId } = await buy(t, buyer, variantId, 'failure');
    expect((await t.db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAYMENT_FAILED');
    expect(await t.db.digitalEntitlement.count({ where: { userId: buyer.id } })).toBe(0);
    expect((await buyer.agent.get('/v1/cart')).body.items).toHaveLength(1);
  });

  it('reverses commission correctly on partial and full refunds, and revokes access', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { store, variantId } = await createStoreWithProduct(t, seller, { priceMinor: '10000' });
    const { orderId } = await buy(t, buyer, variantId);
    const item = await t.db.orderItem.findFirstOrThrow({ where: { orderId } });
    const commissionBefore = await t.ledgerBalance('platform:commission:USD');

    const partial = (await buyer.agent.post(`/v1/orders/${orderId}/refunds`).send({ orderItemId: item.id, amountMinor: '2500', reason: 'Only part was useful' }).expect(201)).body;
    await seller.agent.post(`/v1/seller/refunds/${partial.id}/decide`).send({ approve: true }).expect(200);
    await seller.agent.post(`/v1/seller/refunds/${partial.id}/decide`).send({ approve: true }).expect(409);

    expect(await t.ledgerBalance('platform:commission:USD')).toBe(commissionBefore - 88n);
    expect(await t.ledgerBalance(`store:${store.id}:payable:USD`)).toBe(9650n - (2500n - 88n));
    expect((await t.db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PARTIALLY_REFUNDED');
    expect((await buyer.agent.get('/v1/library')).body).toHaveLength(1);

    const rest = (await buyer.agent.post(`/v1/orders/${orderId}/refunds`).send({ orderItemId: item.id, reason: 'Refund the rest' }).expect(201)).body;
    expect(rest.amountMinor).toBe('7500');
    await seller.agent.post(`/v1/seller/refunds/${rest.id}/decide`).send({ approve: true }).expect(200);

    expect(await t.ledgerBalance('platform:commission:USD')).toBe(commissionBefore - 350n);
    expect(await t.ledgerBalance(`store:${store.id}:payable:USD`)).toBe(0n);
    expect((await t.db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('REFUNDED');
    expect((await buyer.agent.get('/v1/library')).body).toHaveLength(0);
    const again = await buyer.agent.post(`/v1/orders/${orderId}/refunds`).send({ orderItemId: item.id, reason: 'Once more please' }).expect(400);
    expect(again.body.error.code).toBe('ORDER_NOT_REFUNDABLE');
  });

  it('allows reviews only from verified buyers, once', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const stranger = await t.signUp(['discover']);
    const { product, variantId } = await createStoreWithProduct(t, seller);
    const { orderId } = await buy(t, buyer, variantId);
    const item = await t.db.orderItem.findFirstOrThrow({ where: { orderId } });
    await stranger.agent.post('/v1/marketplace/reviews').send({ orderItemId: item.id, rating: 5, body: 'Never bought it' }).expect(404);
    await buyer.agent.post('/v1/marketplace/reviews').send({ orderItemId: item.id, rating: 4, body: 'Solid work' }).expect(201);
    await buyer.agent.post('/v1/marketplace/reviews').send({ orderItemId: item.id, rating: 5, body: 'Again' }).expect(409);
    const p = await t.db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(p).toMatchObject({ ratingCount: 1, ratingSum: 4 });
  });

  it('splits a sale through the Revenue Graph and claws back on refund', async () => {
    const seller = await t.signUp(['sell']);
    const partner = await t.signUp(['create']);
    const buyer = await t.signUp(['discover']);
    const { store, product, variantId } = await createStoreWithProduct(t, seller, { priceMinor: '10000' });
    await seller.agent.post(`/v1/seller/products/${product.id}/revenue-shares`).send({ participantEmail: partner.email, role: 'COLLABORATOR', bps: 2000 }).expect(201);
    const { orderId } = await buy(t, buyer, variantId);
    expect(await t.ledgerBalance(`user:${partner.id}:earnings:USD`)).toBe(1930n);
    expect(await t.ledgerBalance(`store:${store.id}:payable:USD`)).toBe(7720n);

    const item = await t.db.orderItem.findFirstOrThrow({ where: { orderId } });
    const r = (await buyer.agent.post(`/v1/orders/${orderId}/refunds`).send({ orderItemId: item.id, reason: 'Did not fit' }).expect(201)).body;
    await seller.agent.post(`/v1/seller/refunds/${r.id}/decide`).send({ approve: true }).expect(200);
    expect(await t.ledgerBalance(`user:${partner.id}:earnings:USD`)).toBe(0n);
    expect(await t.ledgerBalance(`store:${store.id}:payable:USD`)).toBe(0n);
  });
});

describe('isolation', () => {
  it("stops one seller touching another seller's resources", async () => {
    const owner = await t.signUp(['sell']);
    const rival = await t.signUp(['sell']);
    const { store, product } = await createStoreWithProduct(t, owner);
    await rival.agent.patch(`/v1/seller/products/${product.id}`).send({ title: 'Stolen' }).expect(404);
    await rival.agent.post(`/v1/seller/products/${product.id}/publish`).expect(404);
    await rival.agent.get(`/v1/seller/stores/${store.id}/orders`).expect(404);
    await rival.agent.get(`/v1/seller/stores/${store.id}/analytics`).expect(404);
    await rival.agent.patch(`/v1/seller/stores/${store.id}`).send({ name: 'Mine now' }).expect(404);
    await rival.agent.post(`/v1/seller/stores/${store.id}/products`).send({
      title: 'Planted', summary: 's', description: 'd', type: 'DIGITAL_DOWNLOAD', currency: 'USD', variants: [{ name: 'x', priceMinor: '1' }],
    }).expect(404);
    expect((await t.db.product.findUniqueOrThrow({ where: { id: product.id } })).title).toBe(product.title);
  });

  it('requires the seller permission to open a store', async () => {
    const buyer = await t.signUp(['discover']);
    await buyer.agent.post('/v1/seller/stores').send({ name: 'Nope', currency: 'USD' }).expect(403);
  });

  it("does not let a buyer see another buyer's order or files", async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const other = await t.signUp(['discover']);
    const { variantId } = await createStoreWithProduct(t, seller);
    const { orderId } = await buy(t, buyer, variantId);
    await other.agent.get(`/v1/orders/${orderId}`).expect(404);
    const lib = (await buyer.agent.get('/v1/library')).body;
    await other.agent.post(`/v1/library/${lib[0].id}/assets/${lib[0].product.assets[0].id}/download`).expect(404);
  });

  it('cannot publish a downloadable product with no file, or upload a disguised file', async () => {
    const seller = await t.signUp(['sell']);
    const store = (await seller.agent.post('/v1/seller/stores').send({ name: t.unique('S'), currency: 'USD' }).expect(201)).body;
    const p = (await seller.agent.post(`/v1/seller/stores/${store.id}/products`).send({
      title: 'Empty', summary: 's', description: 'd', type: 'DIGITAL_DOWNLOAD', currency: 'USD', variants: [{ name: 'x', priceMinor: '100' }],
    }).expect(201)).body;
    const r = await seller.agent.post(`/v1/seller/products/${p.id}/publish`);
    expect(r.body.error.code).toBe('PRODUCT_NEEDS_FILE');
    const bad = await seller.agent.post('/v1/uploads').attach('file', fixtures.html, 'cover.png');
    expect(bad.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('refuses to let a seller buy their own product, which would fake a sale', async () => {
    const seller = await t.signUp(['sell', 'discover']);
    const { variantId } = await createStoreWithProduct(t, seller);
    const r = await seller.agent.post('/v1/cart/items').send({ variantId, quantity: 1 });
    expect(r.body.error.code).toBe('CANNOT_BUY_OWN_PRODUCT');
  });
});

describe('currencies', () => {
  const feed = [
    { Ccy: 'USD', Rate: '11964.27', Nominal: '1', Date: '12.11.2026' },
    { Ccy: 'KZT', Rate: '26.88', Nominal: '1', Date: '12.11.2026' },
    { Ccy: 'IDR', Rate: '6.59', Nominal: '10', Date: '12.11.2026' },
    { Ccy: 'XDR', Rate: '16000.00', Nominal: '1', Date: '12.11.2026' },
    { Ccy: 'EUR', Rate: 'not-a-number', Nominal: '1', Date: '12.11.2026' },
  ];
  const fetchImpl = (async () => new Response(JSON.stringify(feed), { status: 200 })) as unknown as typeof fetch;

  it('stores official rates exactly and serves them, skipping what it cannot read', async () => {
    const result = await refreshRates(t.db, { fetchImpl });
    expect(result).toEqual({ updated: 3, asOf: '2026-11-12' });
    const body = (await t.http.get('/v1/rates').expect(200)).body;
    expect(body).toMatchObject({ base: ['UZS', 'USD'], source: 'cbu.uz', asOf: '2026-11-12' });
    expect(body.rates).toMatchObject({ UZS: '1000000', USD: '11964270000', KZT: '26880000', IDR: '659000' });
    // An unsupported unit of account and an unreadable row are left out, never guessed.
    expect(body.rates.XDR).toBeUndefined();
    expect(body.rates.EUR).toBeUndefined();
  });

  it('keeps the stored rates when the source fails', async () => {
    await refreshRates(t.db, { fetchImpl });
    const down = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch;
    await expect(refreshRates(t.db, { fetchImpl: down })).rejects.toThrow(/503/);
    const empty = (async () => new Response('[]', { status: 200 })) as unknown as typeof fetch;
    await expect(refreshRates(t.db, { fetchImpl: empty })).rejects.toThrow(/no usable/);
    expect((await t.http.get('/v1/rates').expect(200)).body.rates.USD).toBe('11964270000');
  });

  it('lets people read prices in their own currency but prices things only in soum or dollars', async () => {
    const u = await t.signUp(['sell']);
    await u.agent.patch('/v1/me/preferences').send({ currency: 'KZT' }).expect(200);
    expect((await u.agent.get('/v1/me')).body.currency).toBe('KZT');
    await u.agent.patch('/v1/me/preferences').send({ currency: 'XXX' }).expect(422);
    await u.agent.post('/v1/seller/stores').send({ name: t.unique('Euro shop'), currency: 'EUR' }).expect(422);
    await u.agent.post('/v1/seller/stores').send({ name: t.unique('Soum shop'), currency: 'UZS' }).expect(201);
    // Only people who run the platform may trigger a refresh by hand.
    await u.agent.post('/v1/admin/rates/refresh').expect(403);
  });
});

describe('selling tools', () => {
  it('opens a checkout link for a published plan, counts visits and stops when switched off', async () => {
    const seller = await t.signUp(['sell']);
    const rival = await t.signUp(['sell']);
    const { store, product, variantId } = await createStoreWithProduct(t, seller);
    const other = await createStoreWithProduct(t, rival);

    // A link can only sell the store's own plans.
    await seller.agent.post(`/v1/seller/stores/${store.id}/links`).send({ variantId: other.variantId, label: 'Not mine' }).expect(404);
    await rival.agent.post(`/v1/seller/stores/${store.id}/links`).send({ variantId, label: 'Hijack' }).expect(404);
    const link = (await seller.agent.post(`/v1/seller/stores/${store.id}/links`).send({ variantId, label: 'Instagram bio' }).expect(201)).body;

    const open = (await t.http.get(`/v1/marketplace/links/${link.code}`).expect(200)).body;
    expect(open).toMatchObject({ label: 'Instagram bio', variant: { id: variantId }, product: { slug: product.slug }, store: { slug: store.slug } });
    await t.http.get(`/v1/marketplace/links/${link.code}`).expect(200);
    const listed = (await seller.agent.get(`/v1/seller/stores/${store.id}/links`).expect(200)).body;
    expect(listed[0]).toMatchObject({ code: link.code, clicks: 2, active: true });

    await seller.agent.patch(`/v1/seller/stores/${store.id}/links/${link.id}`).send({ active: false }).expect(200);
    await t.http.get(`/v1/marketplace/links/${link.code}`).expect(404);
    await t.http.get('/v1/marketplace/links/nope').expect(404);
  });

  it('ranks stores on the leaderboard by paid orders only', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { store, variantId } = await createStoreWithProduct(t, seller);
    const before = (await t.http.get('/v1/marketplace/leaderboard?period=week').expect(200)).body as { slug: string }[];
    expect(before.find((r) => r.slug === store.slug)).toBeUndefined();
    await buy(t, buyer, variantId);
    const after = (await t.http.get('/v1/marketplace/leaderboard?period=week').expect(200)).body as { slug: string; sales: number; rank: number }[];
    expect(after.find((r) => r.slug === store.slug)).toMatchObject({ sales: 1 });
    expect(after.map((r) => r.rank)).toEqual(after.map((_, i) => i + 1));
    await t.http.get('/v1/marketplace/leaderboard?period=decade').expect(422);
  });
});

describe('billing', () => {
  it('moves from Free to Pro through the simulator and gates a feature', async () => {
    const u = await t.signUp(['sell'], { free: true });
    const free = (await u.agent.get('/v1/me')).body;
    expect(free.plan.key).toBe('free');
    // Free accounts browse and buy; the seller role waits for Pro.
    expect(free.lockedRoles).toContain('seller');
    expect(free.permissions).not.toContain('store.manage');
    await u.agent.post('/v1/seller/stores').send({ name: t.unique('Locked shop') }).expect(403);
    // Pro needs exactly one role from the list.
    await u.agent.post('/v1/billing/upgrade').send({ interval: 'MONTHLY', idempotencyKey: t.unique('up') }).expect(422);
    await u.agent.post('/v1/billing/upgrade').send({ interval: 'MONTHLY', idempotencyKey: t.unique('up'), badgeKind: 'founder' }).expect(422);
    const pay = (await u.agent.post('/v1/billing/upgrade').send({ interval: 'MONTHLY', idempotencyKey: t.unique('up'), badgeKind: 'seller' }).expect(201)).body;
    await u.agent.post(`/v1/payments/${pay.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    const me = (await u.agent.get('/v1/me')).body;
    expect(me.plan.key).toBe('pro');
    expect(me.permissions).toContain('store.manage');
    expect(me.badge).toMatchObject({ kind: 'seller', status: 'PENDING' });
    // Within 24 hours the badge goes live on its own.
    await t.db.verifiedBadge.update({ where: { userId: u.id }, data: { grantAt: new Date(Date.now() - 1000) } });
    expect((await settleBadges(t.db)).granted).toBeGreaterThan(0);
    expect((await u.agent.get('/v1/me')).body.badge).toMatchObject({ kind: 'seller', status: 'VERIFIED' });
    expect(me.features).toContain('analytics.advanced');
    await u.agent.post('/v1/billing/cancel').expect(200);
    expect((await u.agent.get('/v1/me')).body.plan).toMatchObject({ key: 'pro', cancelAtPeriodEnd: true });
    expect(await t.ledgerBalance('platform:subscriptions:USD')).toBeGreaterThanOrEqual(1900n);
  });

  it('keeps upgrades closed when no price is configured', async () => {
    await t.db.subscriptionPlan.update({ where: { key: 'pro' }, data: { monthlyMinor: null } });
    const u = await t.signUp();
    const r = await u.agent.post('/v1/billing/upgrade').send({ interval: 'MONTHLY', idempotencyKey: t.unique('up'), badgeKind: 'customer' });
    expect(r.body.error.code).toBe('PLAN_PRICE_NOT_SET');
    await t.db.subscriptionPlan.update({ where: { key: 'pro' }, data: { monthlyMinor: 1900n } });
  });
});

describe('ledger integrity', () => {
  it('rejects updates and deletes at the database level', async () => {
    const entry = await t.db.ledgerEntry.findFirstOrThrow();
    await expect(t.db.ledgerEntry.update({ where: { id: entry.id }, data: { amountMinor: 1n } })).rejects.toThrow(/immutable/);
    await expect(t.db.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/immutable/);
  });

  it('rejects an unbalanced transaction at commit', async () => {
    const account = await t.db.ledgerAccount.findFirstOrThrow({ where: { currency: 'USD' } });
    await expect(t.db.$transaction(async (tx) => {
      const lt = await tx.ledgerTransaction.create({ data: { idempotencyKey: t.unique('bad'), kind: 'test', currency: 'USD' } });
      await tx.ledgerEntry.create({ data: { transactionId: lt.id, accountId: account.id, direction: 'DEBIT', amountMinor: 5n } });
    })).rejects.toThrow(/balance/);
  });

  it('balances debits and credits across every test above', async () => {
    const rows = await t.db.$queryRaw<{ d: bigint; c: bigint }[]>`
      SELECT COALESCE(SUM("amountMinor") FILTER (WHERE "direction"='DEBIT'),0)::bigint d,
             COALESCE(SUM("amountMinor") FILTER (WHERE "direction"='CREDIT'),0)::bigint c FROM "LedgerEntry"`;
    expect(rows[0]!.d).toBe(rows[0]!.c);
  });
});
