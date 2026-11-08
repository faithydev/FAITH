import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ROLE_KEYS } from '@faith/config';
import { createPrismaClient, PrismaClient, seedReference } from '@faith/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure';

export type Http = ReturnType<typeof request>;

export class TestApp {
  app!: INestApplication;
  db!: PrismaClient;
  private seq = 0;

  async start() {
    this.db = createPrismaClient(process.env.DATABASE_URL!);
    await seedReference(this.db);
    await this.db.subscriptionPlan.update({ where: { key: 'pro' }, data: { monthlyMinor: 1900n, yearlyMinor: 19_000n } });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    this.app = moduleRef.createNestApplication({ rawBody: true, logger: false });
    configureApp(this.app);
    await this.app.init();
    return this;
  }

  async stop() {
    await this.app?.close();
    await this.db?.$disconnect();
  }

  get http() {
    return request(this.app.getHttpServer());
  }

  unique(prefix: string) {
    this.seq += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.seq}`;
  }

  /** Registers through the real API, confirms the email, and returns a logged-in agent. */
  async signUp(personas: string[] = [], opts: { displayName?: string } = {}) {
    const email = `${this.unique('user')}@test.faith`;
    const password = 'correct-horse-battery';
    const agent = request.agent(this.app.getHttpServer());
    await agent.post('/v1/auth/register').send({ email, password, displayName: opts.displayName ?? 'Test Person' }).expect(202);
    const token = await this.lastEmailToken(email);
    await agent.post('/v1/auth/verify-email').send({ token }).expect(200);
    if (personas.length) await agent.post('/v1/onboarding').send({ personas, answers: {} }).expect(200);
    const me = (await agent.get('/v1/me').expect(200)).body as { id: string; roles: string[]; workspaces: string[] };
    return { agent, email, password, id: me.id, me };
  }

  async lastEmailToken(to: string) {
    const mail = await this.db.emailOutbox.findFirstOrThrow({ where: { to }, orderBy: { createdAt: 'desc' } });
    return new URL(/https?:\S+/.exec(mail.text)![0]).searchParams.get('token')!;
  }

  async makeStaff(userId: string, role: (typeof ROLE_KEYS)[number]) {
    const r = await this.db.role.findUniqueOrThrow({ where: { key: role } });
    await this.db.userRole.create({ data: { userId, roleId: r.id } });
  }

  async ledgerBalance(key: string) {
    const account = await this.db.ledgerAccount.findUnique({ where: { key }, include: { entries: true } });
    if (!account) return 0n;
    const debitNormal = account.type === 'ASSET' || account.type === 'EXPENSE';
    return account.entries.reduce((sum, e) => {
      const signed = (e.direction === 'DEBIT') === debitNormal ? e.amountMinor : -e.amountMinor;
      return sum + signed;
    }, 0n);
  }
}

/** A tiny valid PNG, ZIP and PDF, so uploads pass magic-byte sniffing. */
export const fixtures = {
  zip: Buffer.from('504b0304140000000000', 'hex'),
  png: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  html: Buffer.from('<html><script>alert(1)</script></html>'),
};

export async function createStoreWithProduct(
  t: TestApp,
  seller: Awaited<ReturnType<TestApp['signUp']>>,
  opts: { priceMinor?: string; currency?: string; publish?: boolean; type?: string; title?: string } = {},
) {
  const currency = opts.currency ?? 'USD';
  const store = (await seller.agent.post('/v1/seller/stores').send({ name: t.unique('Store'), currency }).expect(201)).body;
  const product = (await seller.agent.post(`/v1/seller/stores/${store.id}/products`).send({
    title: opts.title ?? t.unique('Template Pack'), summary: 'A useful thing', description: 'Long description of a useful thing.',
    type: opts.type ?? 'DIGITAL_DOWNLOAD', currency, variants: [{ name: 'Standard', priceMinor: opts.priceMinor ?? '10000' }],
  }).expect(201)).body;
  const upload = (await seller.agent.post('/v1/uploads?purpose=product').attach('file', fixtures.zip, 'pack.zip').expect(201)).body;
  await seller.agent.post(`/v1/seller/products/${product.id}/assets`).send({ uploadId: upload.id, kind: 'FILE' }).expect(201);
  if (opts.publish !== false) await seller.agent.post(`/v1/seller/products/${product.id}/publish`).expect(200);
  return { store, product, variantId: product.variants[0].id as string };
}

export async function buy(t: TestApp, buyer: Awaited<ReturnType<TestApp['signUp']>>, variantId: string, outcome: 'success' | 'failure' = 'success') {
  await buyer.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
  const checkout = (await buyer.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('attempt') }).expect(201)).body;
  await buyer.agent.post(`/v1/payments/${checkout.payment.paymentId}/simulate`).send({ outcome }).expect(200);
  return checkout as { orderId: string; number: string; payment: { paymentId: string } };
}
