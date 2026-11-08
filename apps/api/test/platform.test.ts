import { SYSTEM_RULES, deliverWebhooks, drainOutbox, expireSubscriptions, settleBadges } from '@faith/automation';

/** Drains every pending event; one call handles a batch, and sign-ups add events of their own. */
const drainAll = async (db: Parameters<typeof drainOutbox>[0]) => { while ((await drainOutbox(db, { batch: 200 })).processed > 0); };
import { FaithClient, verifyWebhook } from '@faith/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeContentUrl } from '../src/rewards/verification';
import { buy, createStoreWithProduct, TestApp } from './harness';

const t = new TestApp();
beforeAll(() => t.start());
afterAll(() => t.stop());

type Person = Awaited<ReturnType<TestApp['signUp']>>;

async function staff(role: 'moderator' | 'finance' | 'admin' | 'super_admin') {
  const u = await t.signUp();
  await t.makeStaff(u.id, role);
  return u;
}

const campaignPayload = (orgId: string, over: Record<string, unknown> = {}) => ({
  orgId, title: t.unique('Launch clips'), summary: 'Clip our launch video', description: 'Make short clips of the launch.',
  type: 'VERIFIED_VIEWS', currency: 'USD', budgetMinor: '100000', platforms: ['youtube', 'tiktok'], countries: ['UZ'],
  guidelines: 'Keep it honest.', submissionDeadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  usageRights: 'Brand may repost for 90 days', creatorPermissions: 'Creator keeps ownership', attribution: 'Tag @brand',
  adDisclosure: 'Include #ad', licenseDays: 90, territory: 'Worldwide', prohibitedContent: 'hate speech, gambling',
  requirements: [{ label: 'At least 15 seconds' }],
  rules: [{ metric: 'VIEWS', unitSize: '1000', rateMinor: '150', capMinor: '30000' }, { metric: 'APPROVED_SUBMISSION', rateMinor: '500' }],
  ...over,
});

async function liveCampaign(brand: Person, moderator: Person, over: Record<string, unknown> = {}) {
  const org = (await brand.agent.post('/v1/organizations').send({ name: t.unique('Brand'), type: 'BRAND' }).expect(201)).body;
  const campaign = (await brand.agent.post('/v1/rewards/brand/campaigns').send(campaignPayload(org.id, over)).expect(201)).body;
  const pay = (await brand.agent.post(`/v1/rewards/brand/campaigns/${campaign.id}/fund`).send({ idempotencyKey: t.unique('fund') }).expect(201)).body;
  await brand.agent.post(`/v1/payments/${pay.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
  await brand.agent.post(`/v1/rewards/brand/campaigns/${campaign.id}/submit`).expect(200);
  await moderator.agent.post(`/v1/admin/campaigns/${campaign.id}/moderate`).send({ approve: true }).expect(200);
  return { org, campaign };
}

const submission = (url: string) => ({ platform: 'youtube', url, acceptedTerms: true });
const video = () => `https://youtube.com/watch?v=${t.unique('vid')}`;

describe('content rewards', () => {
  it('runs a campaign end to end and persists an accurate reward', async () => {
    const brand = await t.signUp(['brand']);
    const creator = await t.signUp(['create']);
    const mod = await staff('moderator');
    const { campaign } = await liveCampaign(brand, mod);

    expect(await t.ledgerBalance(`campaign:${campaign.id}:budget:USD`)).toBe(100_000n);
    const listed = await t.http.get('/v1/rewards/campaigns').expect(200);
    expect(listed.body.items.some((c: { id: string }) => c.id === campaign.id)).toBe(true);

    const s = (await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send(submission(video())).expect(201)).body;
    expect(s.verification).toBe('ACCOUNT_AUTH_REQUIRED');

    await brand.agent.post(`/v1/rewards/submissions/${s.id}/metrics`).send({ metric: 'VIEWS', value: '12500' }).expect(201);
    expect(await t.ledgerBalance(`user:${creator.id}:earnings:USD`)).toBe(0n);

    const review = await brand.agent.post(`/v1/rewards/submissions/${s.id}/decide`).send({ decision: 'approve' }).expect(200);
    expect(review.body.status).toBe('APPROVED');

    // 12 complete steps of 1000 views at 150, plus 500 for the approval.
    const expected = 12n * 150n + 500n;
    expect(await t.ledgerBalance(`user:${creator.id}:earnings:USD`)).toBe(expected);
    expect(await t.ledgerBalance(`campaign:${campaign.id}:budget:USD`)).toBe(100_000n - expected);
    const row = await t.db.brandCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(row.accruedMinor).toBe(expected);

    await brand.agent.post(`/v1/rewards/submissions/${s.id}/metrics`).send({ metric: 'VIEWS', value: '20000' }).expect(201);
    expect(await t.ledgerBalance(`user:${creator.id}:earnings:USD`)).toBe(20n * 150n + 500n);

    const earnings = (await creator.agent.get('/v1/rewards/creator/earnings').expect(200)).body;
    expect(earnings.accruals.find((a: { status: string }) => a.status === 'APPROVED').amountMinor).toBe('3500');
  });

  it('prevents duplicate approval, even when requests race', async () => {
    const brand = await t.signUp(['brand']);
    const creator = await t.signUp(['create']);
    const mod = await staff('moderator');
    const { campaign } = await liveCampaign(brand, mod);
    const s = (await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send(submission(video())).expect(201)).body;

    const results = await Promise.all(Array.from({ length: 5 }, () => brand.agent.post(`/v1/rewards/submissions/${s.id}/decide`).send({ decision: 'approve' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await t.ledgerBalance(`user:${creator.id}:earnings:USD`)).toBe(500n);
    expect(await t.db.rewardAccrual.count({ where: { submissionId: s.id } })).toBe(1);
  });

  it('never accrues beyond the funded budget', async () => {
    const brand = await t.signUp(['brand']);
    const creator = await t.signUp(['create']);
    const mod = await staff('moderator');
    const { campaign } = await liveCampaign(brand, mod, { budgetMinor: '1000', rules: [{ metric: 'APPROVED_SUBMISSION', rateMinor: '700' }] });
    const a = (await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send(submission(video())).expect(201)).body;
    const b = (await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send(submission(video())).expect(201)).body;
    await brand.agent.post(`/v1/rewards/submissions/${a.id}/decide`).send({ decision: 'approve' }).expect(200);
    await brand.agent.post(`/v1/rewards/submissions/${b.id}/decide`).send({ decision: 'approve' }).expect(200);
    expect(await t.ledgerBalance(`user:${creator.id}:earnings:USD`)).toBe(1000n);
    expect(await t.ledgerBalance(`campaign:${campaign.id}:budget:USD`)).toBe(0n);
  });

  it('rejects with a reason, allows one appeal, and pays if staff uphold it', async () => {
    const brand = await t.signUp(['brand']);
    const creator = await t.signUp(['create']);
    const mod = await staff('moderator');
    const { campaign } = await liveCampaign(brand, mod);
    const s = (await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send(submission(video())).expect(201)).body;

    await brand.agent.post(`/v1/rewards/submissions/${s.id}/decide`).send({ decision: 'reject' }).expect(422);
    await brand.agent.post(`/v1/rewards/submissions/${s.id}/decide`).send({ decision: 'reject', reason: 'Missing #ad disclosure' }).expect(200);
    const mine = (await creator.agent.get('/v1/rewards/creator/submissions').expect(200)).body;
    expect(mine[0].rejectionReason).toBe('Missing #ad disclosure');

    const appeal = (await creator.agent.post(`/v1/rewards/submissions/${s.id}/appeal`).send({ reason: 'The disclosure is in the first frame.' }).expect(201)).body;
    await creator.agent.post(`/v1/rewards/submissions/${s.id}/appeal`).send({ reason: 'Trying a second appeal here.' }).expect(409);
    await mod.agent.post(`/v1/admin/appeals/${appeal.id}/resolve`).send({ uphold: true, resolution: 'Disclosure confirmed' }).expect(200);
    expect(await t.ledgerBalance(`user:${creator.id}:earnings:USD`)).toBe(500n);
  });

  it('reverses rewards through the ledger after a confirmed violation', async () => {
    const brand = await t.signUp(['brand']);
    const creator = await t.signUp(['create']);
    const mod = await staff('moderator');
    const { campaign } = await liveCampaign(brand, mod);
    const s = (await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send(submission(video())).expect(201)).body;
    await brand.agent.post(`/v1/rewards/submissions/${s.id}/decide`).send({ decision: 'approve' }).expect(200);
    await mod.agent.post(`/v1/admin/submissions/${s.id}/reverse`).send({ reason: 'Purchased views', confirm: true }).expect(200);
    expect(await t.ledgerBalance(`user:${creator.id}:earnings:USD`)).toBe(0n);
    expect(await t.ledgerBalance(`campaign:${campaign.id}:budget:USD`)).toBe(100_000n);
  });

  it('flags duplicates and reuse for a human, without pretending that is fraud proof', async () => {
    const brand = await t.signUp(['brand']);
    const a = await t.signUp(['create']);
    const b = await t.signUp(['create']);
    const mod = await staff('moderator');
    const one = await liveCampaign(brand, mod);
    const two = await liveCampaign(brand, mod);
    const id = t.unique('dup');

    await a.agent.post(`/v1/rewards/campaigns/${one.campaign.slug}/submissions`).send(submission(`https://youtu.be/${id}`)).expect(201);
    const dup = await b.agent.post(`/v1/rewards/campaigns/${one.campaign.slug}/submissions`).send(submission(`https://www.youtube.com/watch?v=${id}&utm_source=x`));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_SUBMISSION');
    const signals = await t.db.fraudSignal.findMany({ where: { campaignId: one.campaign.id } });
    expect(signals.map((s) => s.kind)).toContain('DUPLICATE_URL');

    await b.agent.post(`/v1/rewards/campaigns/${two.campaign.slug}/submissions`).send(submission(`https://youtube.com/shorts/${id}`)).expect(201);
    const reuse = await t.db.fraudSignal.findFirst({ where: { campaignId: two.campaign.id, kind: 'UNAUTHORIZED_REUSE' } });
    expect(reuse?.severity).toBe('HIGH');
  });

  it('enforces applications, deadlines, platforms and reviewer isolation', async () => {
    const brand = await t.signUp(['brand']);
    const rival = await t.signUp(['brand']);
    const creator = await t.signUp(['create']);
    const mod = await staff('moderator');
    const { campaign } = await liveCampaign(brand, mod, { requiresApplication: true });

    const blocked = await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send(submission(video()));
    expect(blocked.body.error.code).toBe('APPLICATION_REQUIRED');

    const app = (await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/apply`).send({ pitch: 'I run a tech review channel.' }).expect(201)).body;
    await rival.agent.post(`/v1/rewards/brand/applications/${app.id}/decide`).send({ approve: true }).expect(404);
    await brand.agent.post(`/v1/rewards/brand/applications/${app.id}/decide`).send({ approve: true }).expect(200);

    const instagram = await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send({ ...submission(video()), platform: 'instagram' });
    expect(instagram.body.error.code).toBe('PLATFORM_NOT_ELIGIBLE');

    const s = (await creator.agent.post(`/v1/rewards/campaigns/${campaign.slug}/submissions`).send(submission(video())).expect(201)).body;
    await rival.agent.post(`/v1/rewards/submissions/${s.id}/decide`).send({ decision: 'approve' }).expect(404);
    await rival.agent.get(`/v1/rewards/brand/campaigns/${campaign.id}/review`).expect(404);
    await creator.agent.post(`/v1/rewards/submissions/${s.id}/metrics`).send({ metric: 'VIEWS', value: '9999999' }).expect(404);
  });

  it('cannot go live unfunded, and requires creator consent to the terms', async () => {
    const brand = await t.signUp(['brand']);
    const creator = await t.signUp(['create']);
    const mod = await staff('moderator');
    const org = (await brand.agent.post('/v1/organizations').send({ name: t.unique('B'), type: 'BRAND' }).expect(201)).body;
    const c = (await brand.agent.post('/v1/rewards/brand/campaigns').send(campaignPayload(org.id)).expect(201)).body;
    const r = await brand.agent.post(`/v1/rewards/brand/campaigns/${c.id}/submit`);
    expect(r.body.error.code).toBe('CAMPAIGN_NOT_FUNDED');
    const live = await liveCampaign(brand, mod);
    await creator.agent.post(`/v1/rewards/campaigns/${live.campaign.slug}/submissions`).send({ platform: 'youtube', url: video() }).expect(422);
  });

  it('normalises equivalent content URLs to one identity', () => {
    const canon = 'https://youtube.com/watch?v=abc';
    expect(normalizeContentUrl('https://youtu.be/abc?t=4')).toBe(canon);
    expect(normalizeContentUrl('http://www.youtube.com/watch?v=abc&list=x#t')).toBe(canon);
    expect(normalizeContentUrl('https://m.youtube.com/shorts/abc')).toBe(canon);
    expect(normalizeContentUrl('https://www.tiktok.com/@a/video/1?is_from_webapp=1')).toBe('https://tiktok.com/@a/video/1');
  });
});

describe('work', () => {
  it('runs a job from posting through moderation to an application', async () => {
    const employer = await t.signUp(['business']);
    const seeker = await t.signUp(['job']);
    const mod = await staff('moderator');
    const org = (await employer.agent.post('/v1/organizations').send({ name: t.unique('Acme'), type: 'BUSINESS' }).expect(201)).body;
    const job = (await employer.agent.post('/v1/jobs').send({
      orgId: org.id, title: 'Senior Designer', description: 'Design things.', employmentType: 'FULL_TIME', workplace: 'REMOTE',
      experience: 'SENIOR', currency: 'USD', skills: ['Figma'],
    }).expect(201)).body;
    await t.http.get(`/v1/jobs/${job.slug}`).expect(404);
    await mod.agent.post(`/v1/admin/jobs/${job.id}/moderate`).send({ approve: true }).expect(200);

    const app = (await seeker.agent.post(`/v1/jobs/${job.slug}/apply`).send({ coverLetter: 'I have ten years of design work.' }).expect(201)).body;
    await seeker.agent.post(`/v1/jobs/${job.slug}/apply`).send({ coverLetter: 'Applying a second time here.' }).expect(409);
    await employer.agent.post(`/v1/jobs/${job.slug}/apply`).send({ coverLetter: 'Applying to my own company.' }).expect(403);

    const list = (await employer.agent.get(`/v1/employer/jobs/${job.id}/applications`).expect(200)).body;
    expect(list).toHaveLength(1);
    await seeker.agent.get(`/v1/employer/jobs/${job.id}/applications`).expect(403);
    await employer.agent.patch(`/v1/employer/applications/${app.id}`).send({ status: 'SHORTLISTED' }).expect(200);
    expect((await seeker.agent.get('/v1/work/applications').expect(200)).body[0].status).toBe('SHORTLISTED');
  });

  it('shows candidates to employers only after they opt in', async () => {
    const employer = await t.signUp(['business']);
    const seeker = await t.signUp(['job']);
    const skill = t.unique('skill').toLowerCase();
    await seeker.agent.put('/v1/work/profile').send({ headline: 'Engineer', skills: [skill], discoverable: false }).expect(200);
    expect((await employer.agent.get(`/v1/employer/candidates?skill=${skill}`).expect(200)).body).toHaveLength(0);
    await seeker.agent.put('/v1/work/profile').send({ headline: 'Engineer', skills: [skill], discoverable: true }).expect(200);
    expect((await employer.agent.get(`/v1/employer/candidates?skill=${skill}`).expect(200)).body).toHaveLength(1);
  });

  it('runs a service project through milestones, delivery and a dispute', async () => {
    const pro = await t.signUp(['services']);
    const client = await t.signUp(['discover']);
    const outsider = await t.signUp(['discover']);
    const service = (await pro.agent.post('/v1/freelance/services').send({
      title: 'Logo design', summary: 'A distinctive logo', description: 'Three concepts and one refined mark.', currency: 'USD', publish: true,
      packages: [{ name: 'Basic', description: 'One concept', priceMinor: '50000', deliveryDays: 5 }],
    }).expect(201)).body;
    expect((await t.http.get('/v1/services').expect(200)).body.items.some((s: { id: string }) => s.id === service.id)).toBe(true);

    const project = (await client.agent.post(`/v1/services/${service.slug}/projects`).send({ packageId: service.packages[0].id, requirements: 'A mark for a coffee brand.' }).expect(201)).body;
    await outsider.agent.get(`/v1/projects/${project.id}`).expect(404);
    await client.agent.post(`/v1/projects/${project.id}/accept`).expect(403);
    await pro.agent.post(`/v1/projects/${project.id}/accept`).expect(200);

    const m = project.milestones[0].id;
    await client.agent.post(`/v1/milestones/${m}/deliver`).send({ deliveryNote: 'Not my job to deliver.' }).expect(403);
    await pro.agent.post(`/v1/milestones/${m}/deliver`).send({ deliveryNote: 'Final files attached.' }).expect(200);
    await pro.agent.post(`/v1/milestones/${m}/review`).send({ approve: true }).expect(403);
    await client.agent.post(`/v1/milestones/${m}/review`).send({ approve: true }).expect(200);
    expect((await client.agent.get(`/v1/projects/${project.id}`).expect(200)).body.status).toBe('COMPLETED');
  });
});

describe('creator studio', () => {
  it('builds a course, withholds lessons until purchase, tracks progress and ends access on refund', async () => {
    const creator = await t.signUp(['create']);
    const student = await t.signUp(['discover']);
    const { product, variantId } = await createStoreWithProduct(t, creator, { type: 'COURSE', priceMinor: '2000' });
    const course = (await creator.agent.post('/v1/creator/courses').send({ title: 'Video editing', summary: 'From zero', productId: product.id }).expect(201)).body;
    await creator.agent.post(`/v1/creator/courses/${course.id}/published`).send({ published: true }).expect(409);
    const section = (await creator.agent.post(`/v1/creator/courses/${course.id}/sections`).send({ title: 'Basics' }).expect(201)).body;
    const open = (await creator.agent.post(`/v1/creator/sections/${section.id}/lessons`).send({ title: 'Intro', body: 'Free preview', isPreview: true }).expect(201)).body;
    const paid = (await creator.agent.post(`/v1/creator/sections/${section.id}/lessons`).send({ title: 'Cutting', body: 'SECRET LESSON BODY' }).expect(201)).body;
    await creator.agent.post(`/v1/creator/courses/${course.id}/published`).send({ published: true }).expect(200);

    const anon = (await t.http.get(`/v1/courses/${course.slug}`).expect(200)).body;
    const lessons = anon.sections[0].lessons;
    expect(lessons[0].body).toBe('Free preview');
    expect(lessons[1].body).toBeNull();
    expect(JSON.stringify(anon)).not.toContain('SECRET LESSON BODY');
    await student.agent.post(`/v1/lessons/${paid.id}/complete`).expect(403);
    await student.agent.post(`/v1/courses/${course.slug}/enroll`).expect(403);

    const { orderId } = await buy(t, student, variantId);
    const bought = (await student.agent.get(`/v1/courses/${course.slug}`).expect(200)).body;
    expect(bought.sections[0].lessons[1].body).toBe('SECRET LESSON BODY');
    await student.agent.post(`/v1/lessons/${open.id}/complete`).expect(200);
    const done = (await student.agent.post(`/v1/lessons/${paid.id}/complete`).expect(200)).body;
    expect(done).toMatchObject({ completed: 2, total: 2, courseCompleted: true });

    const item = await t.db.orderItem.findFirstOrThrow({ where: { orderId } });
    const r = (await student.agent.post(`/v1/orders/${orderId}/refunds`).send({ orderItemId: item.id, reason: 'Changed my mind' }).expect(201)).body;
    await creator.agent.post(`/v1/seller/refunds/${r.id}/decide`).send({ approve: true }).expect(200);
    const after = (await student.agent.get(`/v1/courses/${course.slug}`).expect(200)).body;
    expect(after.access).toBe(false);
    expect(after.sections[0].lessons[1].body).toBeNull();
  });

  it('keeps private communities private and enforces moderation', async () => {
    const owner = await t.signUp(['create']);
    const member = await t.signUp(['discover']);
    const open = (await owner.agent.post('/v1/communities').send({ name: t.unique('Public club'), description: 'Open' }).expect(201)).body;
    const closed = (await owner.agent.post('/v1/communities').send({ name: t.unique('Inner circle'), description: 'Closed', visibility: 'PRIVATE' }).expect(201)).body;
    await owner.agent.post(`/v1/communities/${closed.slug}/posts`).send({ title: 'Members only', body: 'Private note' }).expect(201);

    const view = (await member.agent.get(`/v1/communities/${closed.slug}`).expect(200)).body;
    expect(view.canRead).toBe(false);
    expect(view.posts).toHaveLength(0);
    await member.agent.post(`/v1/communities/${closed.slug}/join`).expect(403);
    await member.agent.post(`/v1/communities/${closed.slug}/posts`).send({ title: 'x', body: 'y' }).expect(403);

    await member.agent.post(`/v1/communities/${open.slug}/join`).expect(201);
    const post = (await member.agent.post(`/v1/communities/${open.slug}/posts`).send({ title: 'Hello', body: 'First post' }).expect(201)).body;
    await member.agent.post(`/v1/posts/${post.id}/comments`).send({ body: 'And a comment' }).expect(201);
    await member.agent.post(`/v1/posts/${post.id}/hide`).expect(403);
    await owner.agent.post(`/v1/posts/${post.id}/hide`).expect(200);
    await owner.agent.patch(`/v1/communities/${open.id}/members/${member.id}`).send({ status: 'BANNED' }).expect(200);
    await member.agent.post(`/v1/communities/${open.slug}/posts`).send({ title: 'Back', body: 'Again' }).expect(403);
  });
});

describe('developer platform', () => {
  async function publishedApp(dev: Person, mod: Person, over: Record<string, unknown> = {}) {
    const app = (await dev.agent.post('/v1/developer/apps').send({
      name: t.unique('Sales Radar'), tagline: 'See every sale', description: 'Sales alerts.', category: 'analytics', ...over,
    }).expect(201)).body;
    const version = (await dev.agent.post(`/v1/developer/apps/${app.id}/versions`).send({ version: '1.0.0', permissions: ['read:orders'] }).expect(201)).body;
    await dev.agent.post(`/v1/developer/apps/${app.id}/submit`).expect(200);
    await mod.agent.post(`/v1/admin/apps/versions/${version.id}/review`).send({ approve: true }).expect(200);
    return app;
  }

  it('submits, reviews, publishes, installs and uninstalls an app', async () => {
    const dev = await t.signUp(['build']);
    const user = await t.signUp(['discover']);
    const mod = await staff('moderator');
    const app = await publishedApp(dev, mod);

    await user.agent.post(`/v1/apps/${app.slug}/install`).send({ acceptedPermissions: [] }).expect(400);
    await user.agent.post(`/v1/apps/${app.slug}/install`).send({ acceptedPermissions: ['read:orders'] }).expect(201);
    await user.agent.post(`/v1/apps/${app.slug}/install`).send({ acceptedPermissions: ['read:orders'] }).expect(409);
    expect((await t.db.appListing.findUniqueOrThrow({ where: { id: app.id } })).installCount).toBe(1);
    await user.agent.post(`/v1/apps/${app.slug}/uninstall`).expect(200);
    const row = await t.db.appInstallation.findFirstOrThrow({ where: { appId: app.id } });
    expect(row).toMatchObject({ status: 'UNINSTALLED', grantedScopes: [] });
  });

  it('stops a developer approving their own app', async () => {
    const dev = await t.signUp(['build']);
    await t.makeStaff(dev.id, 'moderator');
    const app = (await dev.agent.post('/v1/developer/apps').send({ name: t.unique('Self'), tagline: 'x', description: 'y', category: 'analytics' }).expect(201)).body;
    const v = (await dev.agent.post(`/v1/developer/apps/${app.id}/versions`).send({ version: '1.0.0', permissions: [] }).expect(201)).body;
    await dev.agent.post(`/v1/developer/apps/${app.id}/submit`).expect(200);
    await dev.agent.post(`/v1/admin/apps/versions/${v.id}/review`).send({ approve: true }).expect(403);
  });

  it('keeps paid apps closed until a commission is configured, then records revenue separately', async () => {
    const dev = await t.signUp(['build']);
    const user = await t.signUp(['discover']);
    const mod = await staff('moderator');
    const root = await staff('super_admin');
    const app = await publishedApp(dev, mod, { pricing: 'ONE_TIME', priceMinor: '10000' });

    const closed = await user.agent.post(`/v1/apps/${app.slug}/install`).send({ acceptedPermissions: ['read:orders'] });
    expect(closed.body.error.code).toBe('APP_COMMISSION_NOT_CONFIGURED');

    await root.agent.put('/v1/admin/settings/finance.appCommissionBps').send({ value: 2000, confirm: true }).expect(200);
    const r = (await user.agent.post(`/v1/apps/${app.slug}/install`).send({ acceptedPermissions: ['read:orders'] }).expect(201)).body;
    expect(r.status).toBe('payment_required');
    await user.agent.post(`/v1/payments/${r.payment.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    expect(await t.ledgerBalance(`developer:${dev.id}:payable:USD`)).toBe(8000n);
    expect(await t.ledgerBalance('platform:app_commission:USD')).toBeGreaterThanOrEqual(2000n);
    await t.db.platformSetting.delete({ where: { key: 'finance.appCommissionBps' } });
  });

  it('authenticates API keys, enforces scopes, isolates sandbox and honours revocation', async () => {
    const seller = await t.signUp(['sell', 'build']);
    const buyer = await t.signUp(['discover']);
    const { product, variantId } = await createStoreWithProduct(t, seller);
    await buy(t, buyer, variantId);
    const live = (await seller.agent.post('/v1/developer/keys').send({ name: 'Live', scopes: ['products:read', 'profile:read'], env: 'LIVE' }).expect(201)).body;
    const sandbox = (await seller.agent.post('/v1/developer/keys').send({ name: 'Test', scopes: ['products:read'] }).expect(201)).body;

    const client = new FaithClient({ apiKey: live.key, fetch: testFetch });
    const products = await client.products();
    expect(products.sandbox).toBe(false);
    expect(products.items.map((p) => p.id)).toContain(product.id);
    await expect(client.orders()).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_SCOPE' });

    const test = await new FaithClient({ apiKey: sandbox.key, fetch: testFetch }).products();
    expect(test.sandbox).toBe(true);
    expect(test.items.map((p) => p.id)).not.toContain(product.id);

    const stored = await t.db.developerCredential.findUniqueOrThrow({ where: { id: live.id } });
    expect(stored.keyHash).not.toContain(live.key);
    await seller.agent.delete(`/v1/developer/keys/${live.id}`).expect(200);
    await expect(client.products()).rejects.toMatchObject({ status: 401 });
    await t.http.get('/v1/public/products').expect(401);
  });

  it('signs webhooks so the SDK can verify them, and retries failures', async () => {
    const seller = await t.signUp(['sell', 'build']);
    const buyer = await t.signUp(['discover']);
    const { variantId } = await createStoreWithProduct(t, seller);
    const hook = (await seller.agent.post('/v1/developer/webhooks').send({ url: 'http://localhost:4999/hook', events: ['order.paid'] }).expect(201)).body;
    const { number } = await buy(t, buyer, variantId);
    await drainAll(t.db);

    const received: { body: string; headers: Record<string, string> }[] = [];
    const encryptionKey = process.env.APP_ENCRYPTION_KEY!;
    await deliverWebhooks(t.db, {
      encryptionKey, allowPrivateTargets: true,
      fetchImpl: (async (_url: string, init: RequestInit) => {
        received.push({ body: init.body as string, headers: init.headers as Record<string, string> });
        return new Response(null, { status: 500 });
      }) as unknown as typeof fetch,
    });
    const failed = await t.db.webhookDelivery.findFirstOrThrow({ where: { endpointId: hook.id } });
    expect(failed).toMatchObject({ status: 'PENDING', attempts: 1, responseStatus: 500 });

    await t.db.webhookDelivery.update({ where: { id: failed.id }, data: { nextAttemptAt: new Date(0) } });
    await deliverWebhooks(t.db, {
      encryptionKey, allowPrivateTargets: true,
      fetchImpl: (async (_url: string, init: RequestInit) => {
        received.push({ body: init.body as string, headers: init.headers as Record<string, string> });
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect((await t.db.webhookDelivery.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe('DELIVERED');

    const last = received.at(-1)!;
    const event = verifyWebhook<{ number: string }>({
      body: last.body, signature: last.headers['x-faith-signature'], timestamp: last.headers['x-faith-timestamp'], secret: hook.secret,
    });
    expect(event.data.number).toBe(number);
    expect(() => verifyWebhook({ body: `${last.body} `, signature: last.headers['x-faith-signature'], timestamp: last.headers['x-faith-timestamp'], secret: hook.secret })).toThrow();
    expect(() => verifyWebhook({ body: last.body, signature: last.headers['x-faith-signature'], timestamp: '1000', secret: hook.secret })).toThrow(/range/);
  });

  it('refuses to post webhooks to a private address outside development', async () => {
    const seller = await t.signUp(['sell', 'build']);
    const buyer = await t.signUp(['discover']);
    const { variantId } = await createStoreWithProduct(t, seller);
    const hook = (await seller.agent.post('/v1/developer/webhooks').send({ url: 'http://169.254.169.254/latest/meta-data', events: ['order.paid'] }).expect(201)).body;
    await buy(t, buyer, variantId);
    await drainAll(t.db);
    let called = false;
    await deliverWebhooks(t.db, { encryptionKey: process.env.APP_ENCRYPTION_KEY!, fetchImpl: (async () => { called = true; return new Response(); }) as unknown as typeof fetch });
    expect(called).toBe(false);
    expect((await t.db.webhookDelivery.findFirstOrThrow({ where: { endpointId: hook.id } })).lastError).toMatch(/private/);
  });

  function testFetch(input: string | URL | Request, init?: RequestInit) {
    const path = String(input).replace('http://localhost:4000', '');
    const apiKey = (init?.headers as Record<string, string>)['x-api-key']!;
    return t.http.get(path).set('x-api-key', apiKey).then((r) => new Response(JSON.stringify(r.body), { status: r.status }));
  }
});

describe('automation', () => {
  it('turns committed events into notifications, exactly once', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    await t.db.automationRule.upsert({
      where: { key: 'notify-seller-on-order' },
      update: {},
      create: { key: 'notify-seller-on-order', name: 'Notify seller', trigger: 'order.paid', actions: [{ type: 'notify', target: 'owner', kind: 'order.sold' }] },
    });
    const { variantId } = await createStoreWithProduct(t, seller);
    await buy(t, buyer, variantId);
    await drainAll(t.db);
    await drainAll(t.db);
    const notes = (await seller.agent.get('/v1/notifications').expect(200)).body;
    expect(notes.filter((n: { kind: string }) => n.kind === 'order.sold')).toHaveLength(1);
    const runs = await t.db.automationRun.findMany({ where: { rule: { key: 'notify-seller-on-order' } } });
    expect(runs.every((r) => r.status === 'SUCCEEDED')).toBe(true);
  });

  it('evaluates conditions and records skipped runs', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const rule = (await seller.agent.post('/v1/automations').send({
      name: 'Large orders', trigger: 'order.paid',
      conditions: [{ field: 'totalMinor', op: 'gte', value: 999999 }],
      actions: [{ type: 'notify', target: 'owner', kind: 'order.large' }],
    }).expect(201)).body;
    const { variantId } = await createStoreWithProduct(t, seller);
    await buy(t, buyer, variantId);
    await drainAll(t.db);
    const run = await t.db.automationRun.findFirstOrThrow({ where: { ruleId: rule.id } });
    expect(run.status).toBe('SKIPPED');
  });

  it('grants community access when a subscription activates', async () => {
    const owner = await t.signUp(['create']);
    const c = (await owner.agent.post('/v1/communities').send({ name: t.unique('Pro lounge'), description: 'For Pro', visibility: 'PRIVATE', grantPlanKey: 'pro' }).expect(201)).body;
    await t.db.automationRule.upsert({
      where: { key: 'grant-plan-communities' },
      update: {},
      create: { key: 'grant-plan-communities', name: 'Grant', trigger: 'subscription.activated', actions: [{ type: 'grant_community', byPlan: true }] },
    });
    const u = await t.signUp();
    const pay = (await u.agent.post('/v1/billing/upgrade').send({ interval: 'MONTHLY', idempotencyKey: t.unique('up'), badgeKind: 'customer' }).expect(201)).body;
    await u.agent.post(`/v1/payments/${pay.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    await drainAll(t.db);
    expect((await u.agent.get(`/v1/communities/${c.slug}`).expect(200)).body.canRead).toBe(true);
  });

  it('expires a subscription after its paid period and removes the entitlement', async () => {
    const u = await t.signUp(['sell'], { free: true });
    const pay = (await u.agent.post('/v1/billing/upgrade').send({ interval: 'MONTHLY', idempotencyKey: t.unique('up'), badgeKind: 'seller' }).expect(201)).body;
    await u.agent.post(`/v1/payments/${pay.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    await t.db.subscription.updateMany({ where: { userId: u.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    const after = (await u.agent.get('/v1/me')).body;
    expect(after.plan.key).toBe('free');
    expect(after.lockedRoles).toContain('seller');
    expect(await expireSubscriptions(t.db)).toBeGreaterThan(0);
    expect((await settleBadges(t.db)).revoked).toBeGreaterThan(0);
    expect((await u.agent.get('/v1/me')).body.badge.status).toBe('REVOKED');
  });
});

describe('ai', () => {
  it('labels demo output, logs it and enforces the Pro gate', async () => {
    const u = await t.signUp(['sell'], { free: true });
    const status = (await u.agent.get('/v1/ai/status').expect(200)).body;
    expect(status).toMatchObject({ provider: 'demo', live: false });
    const r = (await u.agent.post('/v1/ai/run').send({ capability: 'product_description', prompt: 'A pack of icons', locale: 'en' }).expect(200)).body;
    expect(r.live).toBe(false);
    expect(r.text).toContain('[DEMO');
    const gated = await u.agent.post('/v1/ai/run').send({ capability: 'business_plan', prompt: 'A coffee brand', locale: 'en' });
    expect(gated.body.error.code).toBe('PLAN_UPGRADE_REQUIRED');
    expect(await t.db.aiActionLog.count({ where: { userId: u.id } })).toBe(1);
  });

  it('never runs a consequential action without explicit confirmation', async () => {
    const root = await staff('super_admin');
    await t.db.featureFlag.upsert({ where: { key: 'ai.autopilot' }, update: { enabled: true, rolloutPct: 100 }, create: { key: 'ai.autopilot', description: 'x', enabled: true, rolloutPct: 100 } });
    void root;
    const seller = await t.signUp(['sell']);
    const rival = await t.signUp(['sell']);
    const { product } = await createStoreWithProduct(t, seller, { publish: false });
    const proposal = (await seller.agent.post('/v1/ai/actions').send({ action: 'product.publish', targetId: product.id }).expect(201)).body;
    expect(proposal).toMatchObject({ actionClass: 'PUBLISHING', status: 'AWAITING_CONFIRMATION' });
    expect((await t.db.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe('DRAFT');

    await rival.agent.post(`/v1/ai/actions/${proposal.id}/decide`).send({ accept: true }).expect(404);
    await seller.agent.post(`/v1/ai/actions/${proposal.id}/decide`).send({ accept: true }).expect(200);
    expect((await t.db.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe('PUBLISHED');
    await seller.agent.post(`/v1/ai/actions/${proposal.id}/decide`).send({ accept: true }).expect(409);

    const stolen = (await rival.agent.post('/v1/ai/actions').send({ action: 'product.archive', targetId: product.id }).expect(201)).body;
    await rival.agent.post(`/v1/ai/actions/${stolen.id}/decide`).send({ accept: true }).expect(404);
    expect((await t.db.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe('PUBLISHED');
  });
});

describe('administration', () => {
  it('tells the platform owners about every sign-up and exports it for Excel', async () => {
    const rule = SYSTEM_RULES.find((r) => r.key === 'staff-user-registered')!;
    await t.db.automationRule.upsert({ where: { key: rule.key }, update: {}, create: { key: rule.key, name: rule.name, trigger: rule.trigger, actions: rule.actions } });
    const root = await staff('super_admin');
    const newcomer = await t.signUp([], { displayName: 'Newcomer Person' });
    await drainAll(t.db);
    const note = await t.db.notification.findFirst({ where: { userId: root.id, kind: 'staff.user_registered', params: { path: ['email'], equals: newcomer.email } } });
    expect(note).toMatchObject({ href: '/admin/users', params: { name: 'Newcomer Person', method: 'email' } });

    const users = await root.agent.get('/v1/admin/export/users.csv').buffer(true).parse((res, done) => { const parts: Buffer[] = []; res.on('data', (c: Buffer) => parts.push(c)); res.on('end', () => done(null, Buffer.concat(parts))); }).expect(200);
    expect(users.headers['content-type']).toMatch(/^text\/csv/);
    expect(users.headers['content-disposition']).toMatch(/attachment; filename="faith-users-/);
    const text = (users.body as Buffer).toString('utf8');
    expect(text.startsWith('﻿registered,name,email')).toBe(true);
    expect(text).toContain(newcomer.email);
    expect((await root.agent.get('/v1/admin/export/activity.csv').expect(200)).text).toContain('user.registered');
    await newcomer.agent.get('/v1/admin/export/users.csv').expect(403);
    await newcomer.agent.get('/v1/admin/export/activity.csv').expect(403);
    await t.http.get('/v1/admin/export/orders.csv').expect(401);
  });

  it('rejects ordinary users on every admin area, whatever they send', async () => {
    const u = await t.signUp(['sell', 'brand']);
    for (const path of ['overview', 'users', 'finance/payouts', 'settings', 'flags', 'audit', 'experiments', 'finance/transactions']) {
      await u.agent.get(`/v1/admin/${path}`).expect(403);
    }
    await t.http.get('/v1/admin/overview').expect(401);
    await u.agent.put('/v1/admin/settings/finance.commissionBps').send({ value: 0, confirm: true }).expect(403);
    await u.agent.get('/v1/admin/overview').set('x-role', 'admin').set('x-is-admin', 'true').expect(403);
    await u.agent.patch('/v1/me/profile').send({ role: 'admin', status: 'ACTIVE', permissions: ['admin.access'] }).expect(200);
    await u.agent.get('/v1/admin/overview').expect(403);
  });

  it('scopes staff by role and logs privileged actions', async () => {
    const mod = await staff('moderator');
    const finance = await staff('finance');
    const admin = await staff('admin');
    const target = await t.signUp();
    await mod.agent.get('/v1/admin/finance/transactions').expect(403);
    await finance.agent.get('/v1/admin/users').expect(403);
    await finance.agent.get('/v1/admin/finance/transactions').expect(200);

    await admin.agent.post(`/v1/admin/users/${target.id}/status`).send({ status: 'SUSPENDED', reason: 'Testing suspension' }).expect(422);
    await admin.agent.post(`/v1/admin/users/${target.id}/status`).send({ status: 'SUSPENDED', reason: 'Testing suspension', confirm: true }).expect(200);
    await target.agent.get('/v1/me').expect(401);
    const log = await t.db.auditLog.findFirst({ where: { action: 'user.suspended', resourceId: target.id } });
    expect(log?.actorId).toBe(admin.id);

    await admin.agent.post(`/v1/admin/users/${admin.id}/status`).send({ status: 'SUSPENDED', reason: 'Self action test', confirm: true }).expect(400);
  });

  it('only lets a super admin grant staff roles, and never to themselves', async () => {
    const admin = await staff('admin');
    const root = await staff('super_admin');
    const u = await t.signUp();
    await admin.agent.post(`/v1/admin/users/${u.id}/roles/grant`).send({ role: 'admin' }).expect(403);
    await root.agent.post(`/v1/admin/users/${root.id}/roles/grant`).send({ role: 'finance' }).expect(403);
    await root.agent.post(`/v1/admin/users/${u.id}/roles/grant`).send({ role: 'seller' }).expect(400);
    await root.agent.post(`/v1/admin/users/${u.id}/roles/grant`).send({ role: 'moderator' }).expect(200);
    await u.agent.get('/v1/admin/users').expect(200);
  });

  it('protects the commission rate: admins cannot move it, and rate changes apply to new orders only', async () => {
    const admin = await staff('admin');
    const root = await staff('super_admin');
    await admin.agent.put('/v1/admin/settings/finance.commissionBps').send({ value: 100, confirm: true }).expect(403);
    await root.agent.put('/v1/admin/settings/finance.commissionBps').send({ value: 12.5, confirm: true }).expect(400);

    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { variantId } = await createStoreWithProduct(t, seller, { priceMinor: '10000' });
    await buyer.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
    const c = (await buyer.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('rate') }).expect(201)).body;

    await root.agent.put('/v1/admin/settings/finance.commissionBps').send({ value: 500, confirm: true }).expect(200);
    await buyer.agent.post(`/v1/payments/${c.payment.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    const so = await t.db.sellerOrder.findFirstOrThrow({ where: { orderId: c.orderId } });
    expect(so.commissionMinor).toBe(350n);
    await t.db.platformSetting.delete({ where: { key: 'finance.commissionBps' } });
  });

  it('computes payouts from the ledger and blocks overdrafts and double spends', async () => {
    const creator = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const finance = await staff('finance');
    const { store, variantId } = await createStoreWithProduct(t, creator, { priceMinor: '10000' });
    await buy(t, buyer, variantId);
    const accountKey = `store:${store.id}:payable:USD`;

    const rival = await t.signUp(['sell']);
    await rival.agent.post('/v1/payouts').send({ accountKey, amountMinor: '100', idempotencyKey: t.unique('key') }).expect(404);
    const over = await creator.agent.post('/v1/payouts').send({ accountKey, amountMinor: '999999', idempotencyKey: t.unique('key') });
    expect(over.body.error.code).toBe('INSUFFICIENT_BALANCE');

    const race = await Promise.all(Array.from({ length: 4 }, (_, i) => creator.agent.post('/v1/payouts').send({ accountKey, amountMinor: '9000', idempotencyKey: `race-key-${i}-${store.id}` })));
    expect(race.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await t.ledgerBalance(accountKey)).toBe(650n);

    const payout = race.find((r) => r.status === 201)!.body;
    await finance.agent.post(`/v1/admin/finance/payouts/${payout.id}/decide`).send({ decision: 'mark_paid', confirm: true }).expect(409);
    await finance.agent.post(`/v1/admin/finance/payouts/${payout.id}/decide`).send({ decision: 'approve', confirm: true }).expect(200);
    await finance.agent.post(`/v1/admin/finance/payouts/${payout.id}/decide`).send({ decision: 'mark_paid', confirm: true }).expect(200);
    expect((await t.db.payoutRequest.findUniqueOrThrow({ where: { id: payout.id } })).status).toBe('PAID');
  });

  it('reconciles provider captures against the ledger', async () => {
    const finance = await staff('finance');
    const r = (await finance.agent.get('/v1/admin/finance/reconciliation').expect(200)).body;
    expect(r.trialBalance.every((b: { balanced: boolean }) => b.balanced)).toBe(true);
    const usd = r.rows.find((x: { currency: string }) => x.currency === 'USD');
    expect(usd.matches).toBe(true);
  });

  it('labels sponsored content and keeps it out of organic ranking', async () => {
    const seller = await t.signUp(['sell']);
    const mod = await staff('moderator');
    const { product } = await createStoreWithProduct(t, seller, { title: t.unique('Sponsored thing') });
    const before = (await t.http.get('/v1/marketplace/products?pageSize=100')).body.items.map((p: { id: string }) => p.id);
    const ad = (await seller.agent.post('/v1/ads').send({ placement: 'MARKETPLACE_TOP', title: 'Promo', productId: product.id, currency: 'USD', budgetMinor: '5000' }).expect(201)).body;
    const pay = (await seller.agent.post(`/v1/ads/${ad.id}/fund`).send({ idempotencyKey: t.unique('adfund') }).expect(201)).body;
    await seller.agent.post(`/v1/payments/${pay.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    await mod.agent.post(`/v1/admin/ads/${ad.id}/moderate`).send({ approve: true }).expect(200);

    const sponsored = (await t.http.get('/v1/marketplace/sponsored').expect(200)).body;
    expect(sponsored.find((s: { id: string }) => s.id === ad.id).sponsored).toBe(true);
    const after = (await t.http.get('/v1/marketplace/products?pageSize=100')).body.items.map((p: { id: string }) => p.id);
    expect(after).toEqual(before);
    expect(await t.ledgerBalance('platform:advertising:USD')).toBeGreaterThanOrEqual(5000n);
  });

  it('runs an experiment with stable assignment, and rollback disables its flag', async () => {
    const root = await staff('super_admin');
    const key = t.unique('exp').toLowerCase();
    await t.db.featureFlag.create({ data: { key, description: 'x', enabled: true, rolloutPct: 50 } });
    await root.agent.post('/v1/admin/experiments').send({ key, name: 'Checkout copy', hypothesis: 'Clearer copy helps', variants: ['a', 'b'], flagKey: key }).expect(201);
    await root.agent.post(`/v1/admin/experiments/${key}/status`).send({ status: 'RUNNING' }).expect(200);
    const u = await t.signUp();
    const first = (await u.agent.get(`/v1/lab/experiments/${key}/assignment`).expect(200)).body.variant;
    expect((await u.agent.get(`/v1/lab/experiments/${key}/assignment`)).body.variant).toBe(first);
    await u.agent.post(`/v1/lab/experiments/${key}/feedback`).send({ rating: 4, comment: 'Nice' }).expect(201);
    await root.agent.post(`/v1/admin/experiments/${key}/status`).send({ status: 'ROLLED_BACK' }).expect(200);
    expect((await t.db.featureFlag.findUniqueOrThrow({ where: { key } })).enabled).toBe(false);
  });
});

describe('affiliates and trust', () => {
  it('pays the rate the seller agreed to, not one the affiliate picks', async () => {
    const seller = await t.signUp(['sell']);
    const affiliate = await t.signUp(['create']);
    const buyer = await t.signUp(['discover']);
    const { store, product, variantId } = await createStoreWithProduct(t, seller, { priceMinor: '10000' });
    await affiliate.agent.post('/v1/affiliates').send({ productId: product.id }).expect(403);
    await seller.agent.patch(`/v1/seller/products/${product.id}`).send({ affiliateBps: 1000 }).expect(200);
    const link = (await affiliate.agent.post('/v1/affiliates').send({ productId: product.id, commissionBps: 5000 }).expect(201)).body;
    expect(link.commissionBps).toBe(1000);

    await buyer.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
    const c = (await buyer.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('aff'), affiliateCode: link.code }).expect(201)).body;
    await buyer.agent.post(`/v1/payments/${c.payment.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    expect(await t.ledgerBalance(`user:${affiliate.id}:earnings:USD`)).toBe(965n);
    expect(await t.ledgerBalance(`store:${store.id}:payable:USD`)).toBe(9650n - 965n);
  });

  it('shows a checkable trust record with no opaque score', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { variantId } = await createStoreWithProduct(t, seller);
    await buy(t, buyer, variantId);
    const me = (await seller.agent.get('/v1/me')).body;
    const trust = (await t.http.get(`/v1/trust/${me.profile.username}`).expect(200)).body;
    expect(trust.verifiedSales).toBe(1);
    expect(trust).not.toHaveProperty('score');
  });

  it('explains recommendations and respects withdrawn consent', async () => {
    const employer = await t.signUp(['business']);
    const seeker = await t.signUp(['job']);
    const mod = await staff('moderator');
    const skill = t.unique('rust').toLowerCase();
    const org = (await employer.agent.post('/v1/organizations').send({ name: t.unique('Co'), type: 'BUSINESS' }).expect(201)).body;
    const job = (await employer.agent.post('/v1/jobs').send({
      orgId: org.id, title: 'Engineer', description: 'Build.', employmentType: 'FULL_TIME', workplace: 'REMOTE', experience: 'MID', currency: 'USD', skills: [skill],
    }).expect(201)).body;
    await mod.agent.post(`/v1/admin/jobs/${job.id}/moderate`).send({ approve: true }).expect(200);
    await seeker.agent.put('/v1/work/profile').send({ headline: 'Dev', skills: [skill] }).expect(200);

    const r = (await seeker.agent.get('/v1/opportunities').expect(200)).body;
    expect(r.items[0]).toMatchObject({ kind: 'job', reason: 'skills_match', matched: [skill] });
    await seeker.agent.patch('/v1/me/profile').send({ recommendationsConsent: false }).expect(200);
    expect((await seeker.agent.get('/v1/opportunities')).body).toEqual({ consent: false, items: [] });
  });
});

describe('account deletion', () => {
  it('removes personal data, ends sessions, and keeps financial records intact', async () => {
    const seller = await t.signUp(['sell']);
    const buyer = await t.signUp(['discover']);
    const { variantId } = await createStoreWithProduct(t, seller);
    const { orderId } = await buy(t, buyer, variantId);
    await buyer.agent.post('/v1/auth/delete-account').send({ password: 'wrong-password', confirm: 'DELETE' }).expect(401);
    await buyer.agent.post('/v1/auth/delete-account').send({ password: buyer.password, confirm: 'DELETE' }).expect(200);
    await buyer.agent.get('/v1/me').expect(401);
    const row = await t.db.user.findUniqueOrThrow({ where: { id: buyer.id }, include: { profile: true } });
    expect(row.email).not.toBe(buyer.email);
    expect(row.passwordHash).toBeNull();
    expect(row.profile?.displayName).toBe('Deleted user');
    expect(await t.db.order.findUnique({ where: { id: orderId } })).not.toBeNull();
    await t.http.post('/v1/auth/login').send({ email: buyer.email, password: buyer.password }).expect(401);
  });
});

describe('two-factor authentication', () => {
  it('requires a code once enabled and accepts a backup code once', async () => {
    const { generateSync } = await import('otplib');
    const u = await t.signUp();
    const setup = (await u.agent.post('/v1/auth/2fa/setup').expect(201)).body;
    await u.agent.post('/v1/auth/2fa/enable').send({ code: '000000' }).expect(401);
    const code = generateSync({ secret: setup.secret });
    const { backupCodes } = (await u.agent.post('/v1/auth/2fa/enable').send({ code }).expect(200)).body;
    expect(backupCodes).toHaveLength(8);

    const missing = await t.http.post('/v1/auth/login').send({ email: u.email, password: u.password });
    expect(missing.body.error.code).toBe('TOTP_REQUIRED');
    await t.http.post('/v1/auth/login').send({ email: u.email, password: u.password, totp: generateSync({ secret: setup.secret }) }).expect(200);
    await t.http.post('/v1/auth/login').send({ email: u.email, password: u.password, totp: backupCodes[0] }).expect(200);
    await t.http.post('/v1/auth/login').send({ email: u.email, password: u.password, totp: backupCodes[0] }).expect(401);
  });
});

describe('rate limiting and health', () => {
  it('limits repeated logins from one address', async () => {
    const results: number[] = [];
    for (let i = 0; i < 22; i++) {
      const r = await t.http.post('/v1/auth/login').set('x-test-rate-limit', '1').send({ email: 'limit@test.faith', password: 'whatever-it-is' });
      results.push(r.status);
    }
    expect(results).toContain(429);
  });

  it('reports adapters honestly', async () => {
    const h = (await t.http.get('/v1/health').expect(200)).body;
    expect(h.adapters.ai).toBe('demo');
    expect(h.adapters.queue).toBe('postgres-polling');
    const mock = h.adapters.payments.providers.find((p: { name: string }) => p.name === 'mock');
    expect(mock.live).toBe(false);
    for (const name of ['click', 'payme', 'stripe']) {
      expect(h.adapters.payments.providers.find((p: { name: string }) => p.name === name).live).toBe(false);
    }
  });
});
