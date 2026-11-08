/**
 * Showcase account for local development: one person who uses every part of FAITH at scale.
 * Runs after the main seed (`pnpm bootstrap`) and goes through the real services, so every
 * sale, refund, reward and payout produces genuine ledger entries and obeys the same rules as
 * live traffic. Only order and refund dates are spread over the past months afterwards, so the
 * charts read like a business with history. Money here is simulated; every person is fictional.
 *
 *   pnpm showcase
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { drainOutbox } from '@faith/automation';
import { createPrismaClient } from '@faith/database';
import { hash } from '@node-rs/argon2';
import type { RoleKey } from '@faith/config';
import { randomBytes } from 'node:crypto';
import { AdminService } from './admin/admin.service';
import { AppModule } from './app.module';
import { OrdersService } from './commerce/orders.service';
import { SellerService } from './commerce/seller.service';
import { StorageService } from './core/adapters';
import { env, isProd } from './core/env';
import { CreatorService } from './creator/creator.service';
import { DeveloperService } from './developer/developer.service';
import { PayoutsService } from './finance/payouts.service';
import { IdentityService } from './identity/identity.service';
import { PaymentsService } from './payments/payments.service';
import { RewardsService } from './rewards/rewards.service';
import { WorkService } from './work/work.service';

/** Same development-only password as every seeded account (see README, Demo accounts). */
const PASSWORD = 'FaithDemo2026!';
const EMAIL = 'fayzziyo@faith.dev';
const zip = Buffer.from('504b050600000000000000000000000000000000000000', 'hex');
const DAY = 86_400_000;
const days = (n: number) => new Date(Date.now() + n * DAY);

let seed = 20261108;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
const between = (a: number, b: number) => Math.round(a + rand() * (b - a));
let counter = 0;
const key = (p: string) => `showcase-${p}-${Date.now()}-${++counter}`;

const FIRST_M = ['Aziz', 'Bobur', 'Dilshod', 'Eldor', 'Farrux', 'Husan', 'Islom', 'Jamshid', 'Kamron', 'Laziz', 'Mansur', 'Nodir', 'Otabek', 'Rustam', 'Sanjar', 'Temur', 'Ulugʻbek', 'Vohid', 'Shoxruh', 'Zafar', 'Daniel', 'Lucas', 'Omar', 'Yusuf', 'Arman', 'Nurlan'];
const FIRST_F = ['Aziza', 'Barno', 'Dilfuza', 'Feruza', 'Gulnora', 'Hilola', 'Iroda', 'Kamila', 'Lola', 'Madina', 'Nigora', 'Oydin', 'Rayhona', 'Sevara', 'Shahzoda', 'Umida', 'Yulduz', 'Zilola', 'Anna', 'Emma', 'Mei', 'Sofia', 'Aigerim', 'Dana'];
const LAST = ['Karimov', 'Rahimov', 'Tursunov', 'Aliyev', 'Nazarov', 'Qodirov', 'Sobirov', 'Ismoilov', 'Yusupov', 'Ergashev', 'Hamidov', 'Mirzayev', 'Umarov', 'Saidov', 'Xolmatov', 'Abdullayev', 'Jurayev', 'Chen', 'Garcia', 'Kim', 'Novak', 'Petrov', 'Smith'];
const fullName = () => {
  const female = rand() < 0.48;
  const last = pick(LAST);
  return `${female ? pick(FIRST_F) : pick(FIRST_M)} ${female && /(ov|ev)$/.test(last) ? `${last}a` : last}`;
};

async function main() {
  if (isProd && !env.PUBLIC_DEMO) throw new Error('The showcase never runs in production.');
  if (!env.ALLOW_MOCK_PAYMENTS) throw new Error('The showcase needs ALLOW_MOCK_PAYMENTS=true.');
  const db = createPrismaClient(env.DATABASE_URL);

  if (await db.user.findUnique({ where: { email: EMAIL } })) {
    console.log(`The showcase account ${EMAIL} already exists. Run \`pnpm db:reset\` and \`pnpm showcase\` to rebuild it.`);
    await db.$disconnect();
    return;
  }
  const moderator = await db.user.findUnique({ where: { email: 'moderator@faith.dev' } });
  const brandOwner = await db.user.findUnique({ where: { email: 'brand@faith.dev' } });
  if (!moderator || !brandOwner) throw new Error('Run `pnpm bootstrap` first: the showcase builds on the demo world.');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const seller = app.get(SellerService);
  const orders = app.get(OrdersService);
  const payments = app.get(PaymentsService);
  const rewards = app.get(RewardsService);
  const work = app.get(WorkService);
  const creator = app.get(CreatorService);
  const dev = app.get(DeveloperService);
  const identity = app.get(IdentityService);
  const admin = app.get(AdminService);
  const payouts = app.get(PayoutsService);
  const storage = app.get(StorageService);

  const passwordHash = await hash(PASSWORD);
  const roleId = new Map((await db.role.findMany()).map((r) => [r.key, r.id]));
  const person = (email: string, displayName: string, username: string, roles: RoleKey[], workspace = 'buyer', bio?: string) => db.user.create({
    data: {
      email, passwordHash, emailVerifiedAt: days(-between(120, 400)), onboardingCompletedAt: new Date(), activeWorkspace: workspace,
      profile: { create: { displayName, username, country: rand() < 0.75 ? 'Uzbekistan' : pick(['Kazakhstan', 'Turkey', 'United Arab Emirates', 'Germany', 'United States']), bio } },
      roles: { create: ['customer' as RoleKey, ...roles].map((r) => ({ roleId: roleId.get(r)! })) },
    },
  });

  const log = (m: string) => console.log(`[showcase] ${m}`);

  // The account ---------------------------------------------------------------
  const me = await person(EMAIL, 'Fayzziyo', 'fayzziyo', ['seller', 'creator', 'developer', 'brand', 'business_owner', 'job_seeker', 'freelancer', 'super_admin', 'admin', 'finance'], 'seller',
    'Founder of Fayzziyo Group. Brand systems, fintech software and education for builders across Central Asia.');
  await db.creatorProfile.create({ data: { userId: me.id, headline: 'Founder, investor and creator', niches: ['business', 'education', 'technology'], socials: {} } });
  await db.verificationRequest.create({ data: { kind: 'SELLER', userId: me.id, status: 'APPROVED', decidedAt: new Date(), reviewerId: moderator.id } });
  await db.verificationRequest.create({ data: { kind: 'BRAND', userId: me.id, status: 'APPROVED', decidedAt: new Date(), reviewerId: moderator.id } });

  // Customers and creators -----------------------------------------------------
  const clients = [];
  for (let i = 1; i <= 150; i++) clients.push(await person(`client${String(i).padStart(3, '0')}@faith.dev`, fullName(), `client${i}`, [], 'buyer'));
  const creators = [];
  for (let i = 1; i <= 24; i++) creators.push(await person(`studio${String(i).padStart(2, '0')}@faith.dev`, fullName(), `studio${i}`, ['creator'], 'creator', 'Short-form creator working with brands.'));
  log(`people: ${clients.length} clients, ${creators.length} creators`);

  // Stores, licences, products ---------------------------------------------------
  const cats = new Map((await db.productCategory.findMany()).map((c) => [c.slug, c.id]));
  const studio = await seller.createStore(me.id, { name: 'Fayzziyo Studio', tagline: 'Brand systems for companies that scale', description: 'Identity systems, investor decks and retail suites used by teams from Tashkent to Dubai.', country: 'Uzbekistan', currency: 'USD' });
  const labs = await seller.createStore(me.id, { name: 'Fayzziyo Labs', tagline: 'Production software, licensed', description: 'Fintech cores, marketplace engines and operations software with source and support.', country: 'Uzbekistan', currency: 'USD' });
  const academy = await seller.createStore(me.id, { name: 'Fayzziyo Academy', tagline: 'Learn from people who built it', description: 'Courses, playbooks and a private founders circle.', country: 'Uzbekistan', currency: 'USD' });
  const licence = async (storeId: string, name: string, seats: number) => (await seller.createLicense(storeId, me.id, { name, terms: 'Commercial use within the licensed organisation. Redistribution of the files or source is not allowed.', commercialUse: true, seats, territory: 'worldwide' })).id;
  const studioLicence = await licence(studio.id, 'Company licence', 50);
  const labsLicence = await licence(labs.id, 'Enterprise licence', 500);

  type Spec = { store: string; title: string; summary: string; type: 'DESIGN_TEMPLATE' | 'SOURCE_CODE' | 'WEBSITE_TEMPLATE' | 'DIGITAL_DOWNLOAD' | 'COURSE' | 'MEMBERSHIP' | 'SAAS_ACCESS'; cat: string; tags: string[]; prices: [string, string][]; licenseId?: string };
  const specs: Spec[] = [
    { store: studio.id, title: 'Enterprise Brand System', summary: 'Identity, tokens and 400 templates for multi-brand companies.', type: 'DESIGN_TEMPLATE', cat: 'design', tags: ['branding', 'enterprise', 'figma'], prices: [['Team', '149000'], ['Enterprise', '990000']], licenseId: studioLicence },
    { store: studio.id, title: 'Investor Deck Atelier', summary: 'The deck system behind seed to Series B rounds.', type: 'DESIGN_TEMPLATE', cat: 'business', tags: ['deck', 'fundraising'], prices: [['Founder', '89000'], ['Fund', '490000']], licenseId: studioLicence },
    { store: studio.id, title: 'Retail Identity Suite', summary: 'Signage, packaging and in-store systems for chains.', type: 'DIGITAL_DOWNLOAD', cat: 'marketing', tags: ['retail', 'packaging'], prices: [['Store', '240000'], ['Chain', '1490000']], licenseId: studioLicence },
    { store: labs.id, title: 'Fintech Core Platform', summary: 'Ledger, payments orchestration and KYC flows, with source.', type: 'SOURCE_CODE', cat: 'development', tags: ['fintech', 'ledger', 'typescript'], prices: [['Startup', '490000'], ['Enterprise', '2490000']], licenseId: labsLicence },
    { store: labs.id, title: 'Marketplace Engine', summary: 'Multi-vendor commerce with payouts and search.', type: 'SOURCE_CODE', cat: 'development', tags: ['marketplace', 'nestjs'], prices: [['Single', '690000'], ['Unlimited', '1990000']], licenseId: labsLicence },
    { store: labs.id, title: 'AI Support Desk', summary: 'An assistant desk for support teams, hosted for you.', type: 'SAAS_ACCESS', cat: 'software', tags: ['ai', 'support', 'saas'], prices: [['Annual', '360000'], ['Enterprise', '1200000']], licenseId: labsLicence },
    { store: labs.id, title: 'Logistics Control Tower', summary: 'Fleet, routes and warehouse dashboards for operators.', type: 'WEBSITE_TEMPLATE', cat: 'development', tags: ['logistics', 'dashboard'], prices: [['Site', '290000'], ['Network', '990000']], licenseId: labsLicence },
    { store: academy.id, title: 'Scaling to Eight Figures', summary: 'Twelve weeks on hiring, finance and distribution.', type: 'COURSE', cat: 'education', tags: ['course', 'growth', 'founders'], prices: [['Seat', '199000'], ['Team', '790000']] },
    { store: academy.id, title: 'Founders Circle', summary: 'A private circle of operators, with monthly sessions.', type: 'MEMBERSHIP', cat: 'community', tags: ['membership', 'founders'], prices: [['Member', '240000'], ['Patron', '960000']] },
    { store: academy.id, title: 'Deal Room Playbooks', summary: 'Term sheets, data rooms and negotiation scripts.', type: 'DIGITAL_DOWNLOAD', cat: 'business', tags: ['deals', 'playbook'], prices: [['Personal', '99000'], ['Firm', '390000']] },
  ];
  const products: { id: string; slug: string; title: string; type: string; variants: string[] }[] = [];
  for (const s of specs) {
    const p = await seller.createProduct(s.store, me.id, {
      title: s.title, summary: s.summary, description: `${s.summary}\n\nBuilt and maintained by Fayzziyo Group. Includes updates for twelve months.`,
      type: s.type, currency: 'USD', categoryId: cats.get(s.cat), tags: s.tags, licenseId: s.licenseId ?? null, affiliateBps: 1000,
      variants: s.prices.map(([name, priceMinor]) => ({ name, priceMinor, active: true })),
    });
    const version = await seller.addVersion(p.id, me.id, '2.4.0', 'Performance and accessibility release');
    const storageKey = `private/${me.id}/${key('file')}.zip`;
    await storage.store.put(storageKey, zip, 'application/zip');
    const file = await db.upload.create({ data: { ownerId: me.id, storageKey, filename: `${p.slug}.zip`, mime: 'application/zip', sizeBytes: zip.length, purpose: 'product' } });
    await seller.attachAsset(p.id, me.id, file.id, 'FILE', version.id);
    await seller.publish(p.id, me.id);
    products.push({ id: p.id, slug: p.slug, title: s.title, type: s.type, variants: p.variants.map((v: { id: string }) => v.id) });
  }
  await seller.createDiscount(studio.id, me.id, { code: 'FOUNDERS', kind: 'PERCENT', value: '1000' });

  // The course and the circle attach to the products before anyone buys them.
  const coursePid = products.find((p) => p.type === 'COURSE')!.id;
  const course = await creator.createCourse(me.id, { title: 'Scaling to Eight Figures', summary: 'Hiring, finance and distribution for founders past product-market fit.', level: 'advanced', language: 'en', productId: coursePid });
  for (const [section, lessons] of [['Team', ['Hiring your first ten', 'Managers who multiply']], ['Money', ['Unit economics that survive scale', 'Raising without losing control']], ['Distribution', ['Channels that compound', 'Partnerships in Central Asia']]] as const) {
    const s = await creator.addSection(course.id, me.id, section);
    for (const [i, title] of lessons.entries()) await creator.addLesson(s.id, me.id, { title, body: `${title}: frameworks, numbers and the mistakes we made so you do not have to.`, durationSec: between(600, 1500), isPreview: i === 0 && section === 'Team' });
  }
  await creator.setCoursePublished(course.id, me.id, true);
  const membershipPid = products.find((p) => p.type === 'MEMBERSHIP')!.id;
  await creator.createCommunity(me.id, { name: 'Founders Circle', description: 'Operators building across Central Asia.', visibility: 'PRIVATE', productId: membershipPid });
  const openCommunity = await creator.createCommunity(me.id, { name: 'Fayzziyo Builders', description: 'An open room for people building companies.', visibility: 'PUBLIC' });
  log(`catalogue: ${products.length} products in 3 stores, a course and two communities`);

  // Sales through the real checkout --------------------------------------------
  const paidOrders: string[] = [];
  for (const client of clients) {
    const owned = new Set<number>();
    const orderCount = between(1, 4);
    for (let o = 0; o < orderCount; o++) {
      const items = between(1, 2);
      const chosen: number[] = [];
      for (let t = 0; t < items * 3 && chosen.length < items; t++) {
        const i = Math.floor(rand() * products.length);
        if (!owned.has(i) && !chosen.includes(i)) chosen.push(i);
      }
      if (chosen.length === 0) continue;
      for (const i of chosen) {
        owned.add(i);
        const variants = products[i]!.variants;
        // Most companies here buy the higher tier.
        await orders.addToCart(client.id, variants[rand() < 0.58 ? variants.length - 1 : 0]!, 1);
      }
      // FOUNDERS belongs to one store, so it is only offered when the whole cart is from that store.
      const studioOnly = chosen.every((i) => specs[i]!.store === studio.id);
      const c = await orders.checkout(client.id, { idempotencyKey: key('checkout'), discountCode: studioOnly && rand() < 0.2 ? 'FOUNDERS' : undefined });
      if (c.payment) await payments.simulate(c.payment.paymentId, client.id, 'success');
      paidOrders.push(c.orderId);
    }
  }
  log(`sales: ${paidOrders.length} paid orders`);

  // Refunds, reviews, interest ---------------------------------------------------
  const sold = await db.orderItem.findMany({ where: { orderId: { in: paidOrders } }, include: { order: { select: { buyerId: true } } } });
  let refunded = 0;
  for (const item of sold) {
    if (rand() < 0.025) {
      const r = await orders.requestRefund(item.order.buyerId, item.orderId, { orderItemId: item.id, reason: pick(['Bought the wrong tier.', 'Our team changed direction.', 'Duplicate purchase by a colleague.']) });
      await orders.decideRefund(r.id, me.id, true, 'Refunded as agreed.');
      refunded++;
    } else if (rand() < 0.55) {
      const rating = rand() < 0.82 ? 5 : 4;
      await db.customerReview.create({ data: { productId: item.productId, userId: item.order.buyerId, orderItemId: item.id, rating, body: pick(['Paid for itself in the first month.', 'The best-documented package we have bought.', 'Our whole team uses it daily.', 'Serious quality. Support answered within hours.', 'Exactly what an enterprise team needs.', 'Saved us a quarter of engineering time.']) } });
      await db.product.update({ where: { id: item.productId }, data: { ratingCount: { increment: 1 }, ratingSum: { increment: rating } } });
    }
  }
  for (const p of products) await db.product.update({ where: { id: p.id }, data: { viewCount: between(18_000, 140_000) } });
  log(`refunds: ${refunded}, reviews written`);

  // Brand campaigns ---------------------------------------------------------------
  const group = await identity.createOrganization(me.id, { name: 'Fayzziyo Group', type: 'BRAND', country: 'Uzbekistan', about: 'A holding of brands in design, software and education.' });
  await db.organization.update({ where: { id: group.id }, data: { verifiedAt: new Date() } });
  const rights = {
    usageRights: 'The brand may repost approved content on its channels and in paid ads for the licence period.',
    creatorPermissions: 'You keep ownership and may keep the content on your own channels.',
    attribution: 'Tag @fayzziyo in the caption.', adDisclosure: 'Start the caption with #reklama or #ad.',
    prohibitedContent: 'misleading financial claims, purchased views, hate speech',
  };
  const campaignSpecs = [
    { title: 'Fayzziyo Labs: build in public', summary: 'Show how your team ships with our software.', type: 'VIDEO_CLIPPING' as const, budget: '40000000', platforms: ['youtube', 'tiktok', 'instagram'] as ('youtube' | 'tiktok' | 'instagram')[], rules: [{ metric: 'VIEWS' as const, unitSize: '1000', rateMinor: '250', minQualified: '5000', capMinor: '500000' }] },
    { title: 'Founders Circle stories', summary: 'Tell the story of a decision that changed your company.', type: 'ORIGINAL_UGC' as const, budget: '25000000', platforms: ['instagram', 'tiktok'] as ('instagram' | 'tiktok')[], rules: [{ metric: 'APPROVED_SUBMISSION' as const, unitSize: '1', rateMinor: '50000', minQualified: '0' }, { metric: 'VIEWS' as const, unitSize: '1000', rateMinor: '150', minQualified: '1000', capMinor: '250000' }] },
    { title: 'Academy waitlist leads', summary: 'Bring founders to the next Academy cohort.', type: 'VERIFIED_LEADS' as const, budget: '15000000', platforms: ['instagram', 'youtube'] as ('instagram' | 'youtube')[], rules: [{ metric: 'LEADS' as const, unitSize: '1', rateMinor: '400', minQualified: '10', capMinor: '300000' }] },
  ];
  const campaigns = [];
  for (const c of campaignSpecs) {
    const created = await rewards.create(me.id, {
      orgId: group.id, title: c.title, summary: c.summary, description: `${c.summary} Honest, specific, and in your own voice.`, type: c.type, currency: 'USD', budgetMinor: c.budget,
      platforms: c.platforms, countries: ['Uzbekistan', 'Kazakhstan'], guidelines: 'Be specific, be honest and follow the disclosure rules.',
      requiresApplication: false, submissionDeadline: days(60), licenseDays: 180, territory: 'Central Asia', ...rights,
      requirements: [{ label: 'At least 20 seconds', required: true }, { label: 'Disclosure in the caption', required: true }],
      rules: c.rules,
    });
    const pay = await rewards.startFunding(created.id, me.id, key('fund'));
    await payments.simulate(pay.paymentId, me.id, 'success');
    await rewards.submitForReview(created.id, me.id);
    await admin.moderateCampaign(moderator.id, created.id, true);
    campaigns.push(created);
  }
  let approvedSubs = 0;
  for (const [ci, campaign] of campaigns.entries()) {
    for (const [i, cr] of creators.entries()) {
      if (rand() < 0.25) continue;
      const platform = campaignSpecs[ci]!.platforms[i % campaignSpecs[ci]!.platforms.length]!;
      const url = platform === 'youtube' ? `https://youtube.com/shorts/fz${ci}x${i}` : platform === 'tiktok' ? `https://www.tiktok.com/@studio${i}/video/9${ci}${String(i).padStart(4, '0')}` : `https://www.instagram.com/reel/fz${ci}x${i}/`;
      const s = await rewards.submit(campaign.slug, cr.id, { platform, url, acceptedTerms: true, evidenceKeys: [] });
      const metric = campaignSpecs[ci]!.rules.find((r) => r.metric !== 'APPROVED_SUBMISSION')!.metric;
      await rewards.recordMetric(s.id, me.id, { metric, value: String(metric === 'LEADS' ? between(40, 900) : between(60_000, 2_400_000)) }, false, 'SIMULATED');
      const roll = rand();
      if (roll < 0.72) { await rewards.decide(s.id, me.id, { decision: 'approve' }); approvedSubs++; }
      else if (roll < 0.84) await rewards.decide(s.id, me.id, { decision: 'reject', reason: 'The disclosure is missing from the caption.' });
    }
  }
  // As a creator, on the demo world's campaigns.
  const demoCampaigns = await db.brandCampaign.findMany({ where: { createdById: brandOwner.id, status: 'ACTIVE' }, take: 2 });
  for (const [i, dc] of demoCampaigns.entries()) {
    if (!dc.platforms.includes('instagram')) continue;
    try {
      const s = await rewards.submit(dc.slug, me.id, { platform: 'instagram', url: `https://www.instagram.com/reel/fayzziyo${i}/`, acceptedTerms: true, evidenceKeys: [] });
      await rewards.recordMetric(s.id, brandOwner.id, { metric: 'VIEWS', value: String(between(400_000, 1_800_000)) }, false, 'SIMULATED').catch(() => undefined);
      await rewards.decide(s.id, brandOwner.id, { decision: 'approve' });
    } catch (err) {
      log(`skipped a demo campaign: ${(err as Error).message}`);
    }
  }
  log(`campaigns: ${campaigns.length} funded, ${approvedSubs} approved submissions`);

  // Hiring and freelance ------------------------------------------------------------
  const jobSpecs = [
    { title: 'Head of Engineering', employmentType: 'FULL_TIME' as const, workplace: 'HYBRID' as const, experience: 'LEAD' as const, salaryMinMinor: '600000', salaryMaxMinor: '900000', skills: ['leadership', 'typescript', 'architecture'] },
    { title: 'Senior Product Designer', employmentType: 'FULL_TIME' as const, workplace: 'REMOTE' as const, experience: 'SENIOR' as const, salaryMinMinor: '300000', salaryMaxMinor: '450000', skills: ['figma', 'design systems'] },
    { title: 'Growth Marketing Lead', employmentType: 'FULL_TIME' as const, workplace: 'ONSITE' as const, experience: 'SENIOR' as const, salaryMinMinor: '250000', salaryMaxMinor: '380000', skills: ['growth', 'analytics', 'content'] },
  ];
  for (const j of jobSpecs) {
    const job = await work.postJob(me.id, { orgId: group.id, title: j.title, description: `Join Fayzziyo Group as ${j.title}. You will own outcomes, not tasks.`, employmentType: j.employmentType, workplace: j.workplace, experience: j.experience, location: 'Tashkent', country: 'Uzbekistan', currency: 'USD', salaryMinMinor: j.salaryMinMinor, salaryMaxMinor: j.salaryMaxMinor, skills: j.skills, languages: ['uz', 'en', 'ru'] });
    await admin.moderateJob(moderator.id, job.id, true);
    for (const client of clients.slice(between(0, 40), between(60, 90))) {
      if (rand() < 0.75) continue;
      await db.userRole.upsert({ where: { userId_roleId: { userId: client.id, roleId: roleId.get('job_seeker')! } }, update: {}, create: { userId: client.id, roleId: roleId.get('job_seeker')! } });
      const application = await work.apply(job.slug, client.id, 'I have led similar work and would love to talk.');
      const status = pick(['REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const);
      await work.setApplicationStatus(application.id, me.id, status).catch(() => undefined);
    }
  }
  await work.saveFreelancer(me.id, { headline: 'Fractional CTO and brand strategist', bio: 'I help founders set up engineering and brand for scale.', hourlyRateMinor: '45000', currency: 'USD', skills: ['strategy', 'architecture', 'branding'], available: true });
  const advisory = await work.createService(me.id, {
    title: 'Fractional CTO advisory', summary: 'Architecture, hiring and roadmap reviews for growing teams.', description: 'Monthly advisory: architecture reviews, hiring loops and a roadmap your board understands.', currency: 'USD', tags: ['cto', 'advisory'], publish: true, categoryId: cats.get('development'),
    packages: [{ name: 'Review', description: 'One architecture review', priceMinor: '450000', deliveryDays: 7, revisions: 1 }, { name: 'Quarter', description: 'Three months of advisory', priceMinor: '3600000', deliveryDays: 90, revisions: 3 }],
  });
  for (const client of clients.slice(0, 9)) {
    const project = await work.requestProject(client.id, advisory.slug, advisory.packages[rand() < 0.5 ? 0 : 1]!.id, 'We are scaling the team and need an outside view.');
    await work.acceptProject(project.id, me.id);
  }
  log('hiring: 3 jobs with applicants, 9 advisory projects');

  // Apps ---------------------------------------------------------------------------
  await dev.saveProfile(me.id, { name: 'Fayzziyo Labs', website: 'https://example.com', bio: 'Software for merchants and operators.' });
  const appSpecs = [
    { name: 'Revenue Pulse', tagline: 'Live revenue, refunds and cohorts on one screen', category: 'analytics' as const, permissions: ['read:orders', 'read:analytics'] as ('read:orders' | 'read:analytics')[] },
    { name: 'Catalogue Copilot', tagline: 'Keep product pages consistent across stores', category: 'operations' as const, permissions: ['read:products', 'read:store'] as ('read:products' | 'read:store')[] },
  ];
  let installs = 0;
  for (const s of appSpecs) {
    const created = await dev.createApp(me.id, { name: s.name, tagline: s.tagline, description: `${s.tagline}. Runs on its own servers and only reads what you allow.`, category: s.category, pricing: 'FREE', priceMinor: '0', currency: 'USD', screenshots: [] });
    const v = await dev.addVersion(created.id, me.id, { version: '3.1.0', changelog: 'Faster sync and new reports', permissions: s.permissions });
    await dev.submit(created.id, me.id);
    await dev.review(v.id, moderator.id, true, 'Permissions match the described behaviour.');
    for (const client of clients) {
      if (rand() < 0.55) continue;
      await dev.install(created.slug, client.id, s.permissions).then(() => installs++).catch(() => undefined);
    }
  }
  log(`apps: 2 published, ${installs} installs`);

  // Community, messages, activity ----------------------------------------------------
  for (const client of clients.slice(0, 40)) await creator.join(openCommunity.slug, client.id);
  for (const client of clients.slice(0, 6)) {
    await db.conversation.create({
      data: {
        subject: pick(['Enterprise licence for our group', 'Custom onboarding', 'Volume pricing']),
        participants: { create: [{ userId: client.id, lastReadAt: new Date() }, { userId: me.id }] },
        messages: { create: [{ senderId: client.id, body: 'Salom! We would like to roll this out across all our companies. Can we talk this week?' }] },
      },
    });
  }
  // Recent sign-ins for the "active users" figure. These sessions cannot be used: their tokens are random.
  for (const client of clients) {
    if (rand() < 0.2) continue;
    await db.session.create({ data: { userId: client.id, tokenHash: randomBytes(32).toString('hex'), lastSeenAt: days(-rand() * 25), expiresAt: days(30), userAgent: 'showcase' } });
  }

  await drainOutbox(db, { batch: 2000 });

  // Payouts: part of the earnings has left the platform through the payment partner.
  const accounts = await db.ledgerAccount.findMany({ where: { ownerType: 'store', ownerId: { in: [studio.id, labs.id, academy.id] } } });
  let paidOut = 0n;
  for (const account of accounts) {
    const entries = await db.ledgerEntry.findMany({ where: { accountId: account.id }, select: { direction: true, amountMinor: true } });
    const balance = entries.reduce((sum, e) => sum + (e.direction === 'CREDIT' ? e.amountMinor : -e.amountMinor), 0n);
    for (const [share, ago] of [[35n, between(55, 80)], [20n, between(12, 30)]] as const) {
      const amount = (balance * share) / 100n;
      if (amount <= 0n) continue;
      const p = await payouts.request(me.id, { accountKey: account.key, amountMinor: amount.toString(), idempotencyKey: key('payout') });
      await payouts.decide(p.id, moderator.id, 'approve');
      await payouts.decide(p.id, moderator.id, 'mark_paid', 'Sent by the payment partner (simulated).');
      // Payout history over the past months, like a business that withdraws regularly.
      await db.payoutRequest.update({ where: { id: p.id }, data: { createdAt: days(-ago), decidedAt: days(-ago + 1), paidAt: days(-ago + 2) } });
      paidOut += amount;
    }
  }
  log(`payouts: ${(Number(paidOut) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} marked paid`);

  // History: spread the sales over four months with growth, so every chart has a shape.
  const mine = await db.order.findMany({ where: { id: { in: paidOrders } }, select: { id: true } });
  for (const o of mine) {
    const ago = Math.floor(118 * rand() ** 1.6) + rand();
    const at = new Date(Date.now() - ago * DAY - between(0, 9) * 3_600_000);
    await db.order.update({ where: { id: o.id }, data: { createdAt: at, paidAt: at } });
  }
  const refunds = await db.refund.findMany({ where: { orderId: { in: paidOrders } }, include: { order: { select: { paidAt: true } } } });
  for (const r of refunds) {
    const at = new Date(Math.min(Date.now() - 3_600_000, (r.order.paidAt ?? new Date()).getTime() + between(1, 6) * DAY));
    await db.refund.update({ where: { id: r.id }, data: { createdAt: at } });
  }

  const gmv = await db.order.aggregate({ where: { id: { in: paidOrders } }, _sum: { totalMinor: true } });
  await app.close();
  await db.$disconnect();
  const total = Number(gmv._sum.totalMinor ?? 0n) / 100;
  console.log(`
FAITH showcase is ready. All of it is simulated development data.

  Account     ${EMAIL}   (password: the demo password in README, Demo accounts)
  Sales       ${paidOrders.length} orders, ${total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} through the simulator
  Roles       seller, creator, brand, developer, freelancer, job seeker, super admin
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
