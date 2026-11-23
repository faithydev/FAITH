import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStoreWithProduct, fixtures, TestApp } from './harness';

const t = new TestApp();
beforeAll(() => t.start());
afterAll(() => t.stop());

/** What the browser's own video player sends; download managers and pasted addresses do not. */
const player = { 'Sec-Fetch-Dest': 'video', 'Sec-Fetch-Site': 'same-origin' };

type User = Awaited<ReturnType<TestApp['signUp']>>;

async function directStore(seller: User, opts: { type?: string; priceMinor?: string } = {}) {
  const made = await createStoreWithProduct(t, seller, { type: opts.type ?? 'COURSE', priceMinor: opts.priceMinor ?? '250000', currency: 'UZS' });
  await seller.agent.put(`/v1/seller/stores/${made.store.id}/direct-pay`).send({
    enabled: true, cardNumber: '8600 1234 5678 9012', cardHolder: 'ALISHER KARIMOV', legalName: 'Trade Academy MChJ', tin: '305123456',
    bankName: 'Kapitalbank', accountNumber: '20208000900123456001', mfo: '01018',
  }).expect(200);
  return made;
}

async function checkoutDirect(buyer: User, variantId: string) {
  await buyer.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
  return (await buyer.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('attempt') }).expect(201)).body as {
    orderId: string; payment: { paymentId: string; provider: string; redirectUrl: string; simulated: boolean };
  };
}

async function sendReceipt(buyer: User, paymentId: string) {
  const file = (await buyer.agent.post('/v1/uploads?purpose=receipt').attach('file', fixtures.png, 'chek.png').expect(201)).body;
  expect(file.storageKey).toMatch(/^private\//);
  return (await buyer.agent.post(`/v1/payments/${paymentId}/receipt`).send({ uploadId: file.id, note: 'Click orqali' }).expect(200)).body;
}

describe('direct payments to the seller, confirmed by receipt', () => {
  it('needs a card or an account once switched on', async () => {
    const seller = await t.signUp(['create']);
    const { store } = await createStoreWithProduct(t, seller, { type: 'COURSE' });
    const r = await seller.agent.put(`/v1/seller/stores/${store.id}/direct-pay`).send({ enabled: true }).expect(422);
    expect(JSON.stringify(r.body)).toContain('DIRECT_PAY_DETAILS_REQUIRED');
    await seller.agent.put(`/v1/seller/stores/${store.id}/direct-pay`).send({ enabled: true, accountNumber: '123' }).expect(422);
    const stranger = await t.signUp(['create']);
    await stranger.agent.get(`/v1/seller/stores/${store.id}/direct-pay`).expect(404);
  });

  it('opens the course once the seller approves the receipt, and books FAITH fee as owed by the seller', async () => {
    const seller = await t.signUp(['create']);
    const buyer = await t.signUp(['discover']);
    const stranger = await t.signUp(['discover']);
    const { store, product, variantId } = await directStore(seller);
    const course = (await seller.agent.post('/v1/creator/courses').send({ title: 'Price action', summary: 'Trading', productId: product.id }).expect(201)).body;
    const section = (await seller.agent.post(`/v1/creator/courses/${course.id}/sections`).send({ title: 'Basics' }).expect(201)).body;
    await seller.agent.post(`/v1/creator/sections/${section.id}/lessons`).send({ title: 'Levels', body: 'PAID LESSON' }).expect(201);
    await seller.agent.post(`/v1/creator/courses/${course.id}/published`).send({ published: true }).expect(200);

    const checkout = await checkoutDirect(buyer, variantId);
    expect(checkout.payment).toMatchObject({ provider: 'receipt', simulated: false });
    expect(checkout.payment.redirectUrl).toBe(`/checkout/receipt/${checkout.payment.paymentId}`);
    const pid = checkout.payment.paymentId;

    const view = (await buyer.agent.get(`/v1/payments/${pid}/direct`).expect(200)).body;
    expect(view.payTo).toMatchObject({ cardNumber: '8600123456789012', accountNumber: '20208000900123456001', mfo: '01018' });
    expect(view.next).toBe(`/courses/${course.slug}`);
    await stranger.agent.get(`/v1/payments/${pid}/direct`).expect(404);
    // The simulator cannot settle a direct payment.
    await buyer.agent.post(`/v1/payments/${pid}/simulate`).send({ outcome: 'success' }).expect(404);

    const sent = await sendReceipt(buyer, pid);
    expect(sent.receipt.status).toBe('SUBMITTED');
    const stillLocked = (await buyer.agent.get(`/v1/courses/${course.slug}`).expect(200)).body;
    expect(stillLocked.access).toBe(false);

    const list = (await seller.agent.get(`/v1/seller/stores/${store.id}/receipts`).expect(200)).body;
    expect(list).toHaveLength(1);
    const receiptId = list[0].id;
    const note = await t.db.notification.findFirst({ where: { userId: seller.id, kind: 'receipt.submitted' } });
    expect(note).not.toBeNull();

    // The receipt image: for its seller and its buyer, nobody else.
    const img = await seller.agent.get(`/v1/receipts/${receiptId}/file`).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['cache-control']).toBe('private, no-store');
    await buyer.agent.get(`/v1/receipts/${receiptId}/file`).expect(200);
    await stranger.agent.get(`/v1/receipts/${receiptId}/file`).expect(404);
    await stranger.agent.post(`/v1/seller/receipts/${receiptId}/decide`).send({ approve: true }).expect(403);

    // A rejection needs a reason, keeps the order open, and the buyer can send a clearer receipt.
    await seller.agent.post(`/v1/seller/receipts/${receiptId}/decide`).send({ approve: false }).expect(400);
    await seller.agent.post(`/v1/seller/receipts/${receiptId}/decide`).send({ approve: false, reason: 'Summa ko‘rinmayapti' }).expect(200);
    const rejected = (await buyer.agent.get(`/v1/payments/${pid}/direct`).expect(200)).body;
    expect(rejected.receipt).toMatchObject({ status: 'REJECTED', reason: 'Summa ko‘rinmayapti' });
    expect(rejected.status).toBe('PENDING');
    await sendReceipt(buyer, pid);

    await seller.agent.post(`/v1/seller/receipts/${receiptId}/decide`).send({ approve: true }).expect(200);
    await seller.agent.post(`/v1/seller/receipts/${receiptId}/decide`).send({ approve: true }).expect(409);

    const open = (await buyer.agent.get(`/v1/courses/${course.slug}`).expect(200)).body;
    expect(open.access).toBe(true);
    expect(open.sections[0].lessons[0].body).toBe('PAID LESSON');
    const order = await t.db.order.findUniqueOrThrow({ where: { id: checkout.orderId }, include: { sellerOrders: true } });
    expect(order.status).toBe('PAID');
    expect((await buyer.agent.get(`/v1/payments/${pid}/direct`).expect(200)).body.status).toBe('SUCCEEDED');
    expect(await t.db.notification.count({ where: { userId: buyer.id, kind: 'receipt.approved' } })).toBe(1);

    // FAITH received nothing: the seller owes its fee instead of being owed the sale.
    const fee = order.sellerOrders[0]!.commissionMinor;
    expect(fee).toBeGreaterThan(0n);
    expect(await t.ledgerBalance(`store:${store.id}:payable:UZS`)).toBe(-fee);
    const sale = await t.db.ledgerTransaction.findUniqueOrThrow({ where: { idempotencyKey: `order:${checkout.orderId}:paid` }, include: { entries: { include: { account: true } } } });
    expect(sale.kind).toBe('sale_direct');
    expect(sale.entries.map((e) => e.account.key)).not.toContain('platform:clearing:UZS');
    // A negative balance cannot be paid out.
    const payout = await seller.agent.post('/v1/payouts').send({ accountKey: `store:${store.id}:payable:UZS`, amountMinor: '1000', idempotencyKey: t.unique('payout') });
    expect(payout.status).toBe(400);

    // A refund here is the seller returning the money; FAITH gives its fee back, and access ends.
    const item = await t.db.orderItem.findFirstOrThrow({ where: { orderId: checkout.orderId } });
    const refund = (await buyer.agent.post(`/v1/orders/${checkout.orderId}/refunds`).send({ orderItemId: item.id, reason: 'Not for me' }).expect(201)).body;
    await seller.agent.post(`/v1/seller/refunds/${refund.id}/decide`).send({ approve: true }).expect(200);
    expect(await t.ledgerBalance(`store:${store.id}:payable:UZS`)).toBe(0n);
    const back = await t.db.ledgerTransaction.findUniqueOrThrow({ where: { idempotencyKey: `refund:${refund.id}` }, include: { entries: { include: { account: true } } } });
    expect(back.entries.map((e) => e.account.key)).not.toContain('platform:clearing:UZS');
    expect((await buyer.agent.get(`/v1/courses/${course.slug}`).expect(200)).body.access).toBe(false);
  });

  it('adds the buyer to a VIP community on approval, with no one adding them by hand', async () => {
    const owner = await t.signUp(['create']);
    const buyer = await t.signUp(['discover']);
    const { store, product, variantId } = await directStore(owner, { type: 'MEMBERSHIP' });
    const vip = (await owner.agent.post('/v1/communities').send({ name: t.unique('VIP signals'), description: 'Daily setups', visibility: 'PRIVATE', productId: product.id }).expect(201)).body;
    await owner.agent.post(`/v1/communities/${vip.slug}/posts`).send({ title: 'EURUSD', body: 'Long above 1.0850' }).expect(201);

    const before = (await buyer.agent.get(`/v1/communities/${vip.slug}`).expect(200)).body;
    expect(before.canRead).toBe(false);
    const { payment } = await checkoutDirect(buyer, variantId);
    await sendReceipt(buyer, payment.paymentId);
    const [receipt] = (await owner.agent.get(`/v1/seller/stores/${store.id}/receipts`).expect(200)).body;
    await owner.agent.post(`/v1/seller/receipts/${receipt.id}/decide`).send({ approve: true }).expect(200);

    const after = (await buyer.agent.get(`/v1/communities/${vip.slug}`).expect(200)).body;
    expect(after.canRead).toBe(true);
    expect(after.posts[0].body).toBe('Long above 1.0850');
    expect((await buyer.agent.get(`/v1/payments/${payment.paymentId}/direct`).expect(200)).body.next).toBe(`/communities/${vip.slug}`);
  });

  it('pays a direct-pay store on its own, never in a cart with another store', async () => {
    const a = await t.signUp(['create']);
    const b = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const direct = await directStore(a);
    const other = await createStoreWithProduct(t, b, { currency: 'UZS' });
    await buyer.agent.post('/v1/cart/items').send({ variantId: direct.variantId, quantity: 1 }).expect(201);
    await buyer.agent.post('/v1/cart/items').send({ variantId: other.variantId, quantity: 1 }).expect(201);
    const r = await buyer.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('attempt') }).expect(400);
    expect(r.body.error.code).toBe('DIRECT_PAY_ONE_STORE');
  });
});

describe('one device per account', () => {
  it('signs the earlier device out, says why, and leaves staff alone', async () => {
    const u = await t.signUp(['discover']);
    const phone = request.agent(t.app.getHttpServer());
    await phone.post('/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
    await phone.get('/v1/me').expect(200);
    const old = await u.agent.get('/v1/me').expect(401);
    expect(old.body.error.code).toBe('SESSION_REPLACED');
    expect((await u.agent.get('/v1/courses')).status).toBe(200);

    const staff = await t.signUp();
    await t.makeStaff(staff.id, 'support');
    const second = request.agent(t.app.getHttpServer());
    await second.post('/v1/auth/login').send({ email: staff.email, password: staff.password }).expect(200);
    await staff.agent.get('/v1/me').expect(200);
    await second.get('/v1/me').expect(200);
  });
});

describe('protected video', () => {
  async function paidLesson() {
    const creator = await t.signUp(['create']);
    const student = await t.signUp(['discover']);
    const { product, variantId } = await createStoreWithProduct(t, creator, { type: 'COURSE', priceMinor: '2000' });
    const course = (await creator.agent.post('/v1/creator/courses').send({ title: 'Scalping', summary: 'Fast', productId: product.id }).expect(201)).body;
    const section = (await creator.agent.post(`/v1/creator/courses/${course.id}/sections`).send({ title: 'One' }).expect(201)).body;
    const lesson = (await creator.agent.post(`/v1/creator/sections/${section.id}/lessons`).send({ title: 'Entry' }).expect(201)).body;
    const video = (await creator.agent.post('/v1/uploads?purpose=lesson').attach('file', fixtures.mp4, 'entry.mp4').expect(201)).body;
    const set = (await creator.agent.put(`/v1/creator/lessons/${lesson.id}/video`).send({ uploadId: video.id, access: 'paid' }).expect(200)).body;
    expect(set.access).toBe('paid');
    await creator.agent.post(`/v1/creator/courses/${course.id}/published`).send({ published: true }).expect(200);
    await student.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
    const c = (await student.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('attempt') }).expect(201)).body;
    await student.agent.post(`/v1/payments/${c.payment.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    return { creator, student, lesson, course };
  }

  it('serves video only to the browser player, not to download managers or a pasted address', async () => {
    const { creator, student, lesson, course } = await paidLesson();
    await student.agent.get(`/v1/lessons/${lesson.id}/stream`).set(player).set('Range', 'bytes=0-99').expect(206);
    // IDM and similar tools fetch with the viewer's cookies but without the player's labels.
    await student.agent.get(`/v1/lessons/${lesson.id}/stream`).set('Range', 'bytes=0-99').expect(403);
    await student.agent.get(`/v1/lessons/${lesson.id}/stream`).set({ ...player, 'Sec-Fetch-Dest': 'empty' }).expect(403);
    await student.agent.get(`/v1/lessons/${lesson.id}/stream`).set({ ...player, 'Sec-Fetch-Site': 'cross-site' }).expect(403);
    // iPhone's media player sends no labels, but names itself.
    await student.agent.get(`/v1/lessons/${lesson.id}/stream`).set('User-Agent', 'AppleCoreMedia/1.0.0.21A329 (iPhone; U; CPU OS 17_0 like Mac OS X)').set('Range', 'bytes=0-9').expect(206);

    // Switched to free, the lesson plays for anyone.
    await t.http.get(`/v1/lessons/${lesson.id}/stream`).set(player).expect(401);
    await creator.agent.put(`/v1/creator/lessons/${lesson.id}/access`).send({ access: 'free' }).expect(200);
    await t.http.get(`/v1/lessons/${lesson.id}/stream`).set(player).set('Range', 'bytes=0-9').expect(206);
    expect((await t.http.get(`/v1/courses/${course.slug}`).expect(200)).body.sections[0].lessons[0]).toMatchObject({ isPreview: true, locked: false });
  });

  it('warns on each capture attempt and blocks the account for a day on the third', async () => {
    const { creator, student, lesson } = await paidLesson();
    const first = (await student.agent.post('/v1/protection/violations').send({ kind: 'screenshot_key', contentId: lesson.id }).expect(200)).body;
    expect(first).toMatchObject({ strikes: 1, limit: 3, blockedUntil: null });
    // A held key fires twice; it counts once.
    const again = (await student.agent.post('/v1/protection/violations').send({ kind: 'screenshot_key', contentId: lesson.id }).expect(200)).body;
    expect(again.strikes).toBe(1);
    // The creator never gets strikes on their own video.
    const own = (await creator.agent.post('/v1/protection/violations').send({ kind: 'screenshot_key', contentId: lesson.id }).expect(200)).body;
    expect(own).toMatchObject({ strikes: 0, exempt: true });

    await t.db.securityEvent.updateMany({ where: { userId: student.id, kind: 'content.violation' }, data: { createdAt: new Date(Date.now() - 60_000) } });
    await t.db.securityEvent.create({ data: { userId: student.id, kind: 'content.violation', createdAt: new Date(Date.now() - 30_000) } });
    const third = (await student.agent.post('/v1/protection/violations').send({ kind: 'screenshot_key', contentId: lesson.id }).expect(200)).body;
    expect(third.strikes).toBe(3);
    expect(new Date(third.blockedUntil).getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);

    const me = await student.agent.get('/v1/me').expect(401);
    expect(me.body.error.code).toBe('ACCOUNT_TEMP_BLOCKED');
    const login = await t.http.post('/v1/auth/login').send({ email: student.email, password: student.password }).expect(403);
    expect(login.body.error.code).toBe('ACCOUNT_TEMP_BLOCKED');

    const admin = await t.signUp();
    await t.makeStaff(admin.id, 'super_admin');
    const listed = (await admin.agent.get(`/v1/admin/users?q=${encodeURIComponent(student.email)}`).expect(200)).body;
    expect(listed.items[0].contentBlockedUntil).not.toBeNull();
    await admin.agent.post(`/v1/admin/users/${student.id}/unblock`).expect(200);
    const back = request.agent(t.app.getHttpServer());
    await back.post('/v1/auth/login').send({ email: student.email, password: student.password }).expect(200);
    // Earlier strikes are spent: counting starts again after the block.
    await t.db.securityEvent.updateMany({ where: { userId: student.id, kind: 'content.violation' }, data: { createdAt: new Date(Date.now() - 120_000) } });
    const next = (await back.post('/v1/protection/violations').send({ kind: 'screenshot_key', contentId: lesson.id }).expect(200)).body;
    expect(next).toMatchObject({ strikes: 1, blockedUntil: null });
  });

  it('streams VIP post video to members only; only owners and moderators post video', async () => {
    const owner = await t.signUp(['create']);
    const member = await t.signUp(['discover']);
    const outsider = await t.signUp(['discover']);
    const vip = (await owner.agent.post('/v1/communities').send({ name: t.unique('VIP room'), description: 'Members', visibility: 'PRIVATE' }).expect(201)).body;
    await t.db.communityMember.create({ data: { communityId: vip.id, userId: member.id } });

    const video = (await owner.agent.post('/v1/uploads?purpose=post').attach('file', fixtures.mp4, 'setup.mp4').expect(201)).body;
    const post = (await owner.agent.post(`/v1/communities/${vip.slug}/posts`).send({ title: 'Setup', body: 'Watch', videoUploadId: video.id }).expect(201)).body;
    expect(post.hasVideo).toBe(true);
    expect(JSON.stringify(post)).not.toContain(video.storageKey);

    const mine = (await member.agent.post('/v1/uploads?purpose=post').attach('file', fixtures.mp4, 'mine.mp4').expect(201)).body;
    await member.agent.post(`/v1/communities/${vip.slug}/posts`).send({ title: 'Mine', body: 'x', videoUploadId: mine.id }).expect(403);

    const view = (await member.agent.get(`/v1/communities/${vip.slug}`).expect(200)).body;
    expect(view.posts[0].hasVideo).toBe(true);
    expect(JSON.stringify(view)).not.toContain(video.storageKey);
    await member.agent.get(`/v1/posts/${post.id}/stream`).set(player).set('Range', 'bytes=0-99').expect(206);
    await member.agent.get(`/v1/posts/${post.id}/stream`).expect(403);
    await outsider.agent.get(`/v1/posts/${post.id}/stream`).set(player).expect(403);
    await t.http.get(`/v1/posts/${post.id}/stream`).set(player).expect(401);
  });
});
