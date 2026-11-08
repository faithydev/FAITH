/**
 * Development seed. Reference data comes first; the demo world then runs through the real
 * services, so seeded orders, refunds and rewards produce genuine ledger entries and pass the
 * same rules as live traffic. Every person, store and brand here is fictional.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SYSTEM_RULES, drainOutbox } from '@faith/automation';
import { compSampleAccounts } from './identity/badges';
import { createPrismaClient, seedReference } from '@faith/database';
import { hash } from '@node-rs/argon2';
import type { RoleKey } from '@faith/config';
import { AdminService } from './admin/admin.service';
import { AppModule } from './app.module';
import { OrdersService } from './commerce/orders.service';
import { SellerService } from './commerce/seller.service';
import { StorageService } from './core/adapters';
import { env, isProd } from './core/env';
import { CreatorService } from './creator/creator.service';
import { DeveloperService } from './developer/developer.service';
import { IdentityService } from './identity/identity.service';
import { PaymentsService } from './payments/payments.service';
import { RewardsService } from './rewards/rewards.service';
import { WorkService } from './work/work.service';

const DEMO_PASSWORD = 'FaithDemo2026!';
const zip = Buffer.from('504b050600000000000000000000000000000000000000', 'hex');
const days = (n: number) => new Date(Date.now() + n * 86_400_000);
let attempt = 0;
const key = (p: string) => `seed-${p}-${Date.now()}-${++attempt}`;

async function main() {
  if (isProd && !env.PUBLIC_DEMO) throw new Error('The demo seed never runs in production.');
  const db = createPrismaClient(env.DATABASE_URL);
  await seedReference(db);

  for (const rule of SYSTEM_RULES) {
    await db.automationRule.upsert({
      where: { key: rule.key },
      update: { name: rule.name, trigger: rule.trigger, actions: rule.actions },
      create: { key: rule.key, name: rule.name, trigger: rule.trigger, actions: rule.actions },
    });
  }

  if (await db.user.findUnique({ where: { email: 'admin@faith.dev' } })) {
    await compSampleAccounts(db);
    console.log('Demo data already present. Run `pnpm db:reset` to rebuild it.');
    await db.$disconnect();
    return;
  }
  if (!env.ALLOW_MOCK_PAYMENTS) throw new Error('The demo seed needs ALLOW_MOCK_PAYMENTS=true.');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const seller = app.get(SellerService);
  const orders = app.get(OrdersService);
  const payments = app.get(PaymentsService);
  const rewards = app.get(RewardsService);
  const work = app.get(WorkService);
  const creatorSvc = app.get(CreatorService);
  const dev = app.get(DeveloperService);
  const identity = app.get(IdentityService);
  const admin = app.get(AdminService);
  const storage = app.get(StorageService);

  const passwordHash = await hash(DEMO_PASSWORD);
  const roleId = new Map((await db.role.findMany()).map((r) => [r.key, r.id]));

  async function person(email: string, displayName: string, username: string, roles: RoleKey[], extra: { country?: string; bio?: string; workspace?: string } = {}) {
    const user = await db.user.create({
      data: {
        email, passwordHash, emailVerifiedAt: new Date(), onboardingCompletedAt: new Date(),
        activeWorkspace: extra.workspace ?? 'buyer',
        profile: { create: { displayName, username, country: extra.country ?? 'Uzbekistan', bio: extra.bio } },
        roles: { create: ['customer' as RoleKey, ...roles].map((r) => ({ roleId: roleId.get(r)! })) },
      },
    });
    return user;
  }

  // People ------------------------------------------------------------------

  const root = await person('admin@faith.dev', 'Nodira Karimova', 'nodira_admin', ['super_admin', 'admin', 'finance'], { workspace: 'admin' });
  const moderator = await person('moderator@faith.dev', 'Rustam Aliyev', 'rustam_mod', ['moderator'], { workspace: 'admin' });
  await person('finance@faith.dev', 'Dilnoza Rahimova', 'dilnoza_fin', ['finance'], { workspace: 'admin' });
  const aziza = await person('seller@faith.dev', 'Aziza Yusupova', 'aziza', ['seller'], { workspace: 'seller', bio: 'Brand identity designer in Tashkent. I make templates small teams can actually use.' });
  const timur = await person('timur@faith.dev', 'Timur Saidov', 'timur_dev', ['seller', 'developer'], { workspace: 'seller', bio: 'Full-stack engineer selling starter kits for Central Asian products.' });
  const malika = await person('creator@faith.dev', 'Malika Tursunova', 'malika', ['creator', 'seller'], { workspace: 'creator', bio: 'Video creator teaching short-form storytelling in Uzbek.' });
  const jasur = await person('jasur@faith.dev', 'Jasur Ergashev', 'jasur_clips', ['creator'], { workspace: 'creator', country: 'Uzbekistan', bio: 'Clipping long-form podcasts into shorts.' });
  const kamola = await person('kamola@faith.dev', 'Kamola Nazarova', 'kamola_ugc', ['creator'], { workspace: 'creator', bio: 'UGC for beauty and lifestyle brands.' });
  const brandUser = await person('brand@faith.dev', 'Sardor Xolmatov', 'sardor_brand', ['brand', 'business_owner'], { workspace: 'brand' });
  const devUser = await person('developer@faith.dev', 'Bekzod Umarov', 'bekzod', ['developer'], { workspace: 'developer', bio: 'I build integrations for merchants.' });
  const talent = await person('talent@faith.dev', 'Shahnoza Ismoilova', 'shahnoza', ['job_seeker', 'freelancer'], { workspace: 'freelance', bio: 'Product designer open to remote roles.' });
  const buyer = await person('buyer@faith.dev', 'Otabek Mirzayev', 'otabek', [], { workspace: 'buyer' });
  const buyers = [buyer];
  for (const [i, [name, u]] of ([['Madina Qodirova', 'madina_q'], ['Akmal Sobirov', 'akmal_s'], ['Zarina Bekova', 'zarina_b'], ['Elyor Nurmatov', 'elyor_n'], ['Laylo Hamidova', 'laylo_h']] as const).entries()) {
    buyers.push(await person(`customer${i + 1}@faith.dev`, name, u, []));
  }

  // Organizations -----------------------------------------------------------

  const silk = await identity.createOrganization(brandUser.id, { name: 'Ipak Yoʻli Coffee', type: 'BRAND', country: 'Uzbekistan', about: 'Specialty coffee roasters in Tashkent, opening across Central Asia.' });
  const nur = await identity.createOrganization(brandUser.id, { name: 'Nur Telecom', type: 'BUSINESS', country: 'Uzbekistan', about: 'A mobile operator building digital services.' });
  await db.organization.update({ where: { id: silk.id }, data: { verifiedAt: new Date() } });
  await db.verificationRequest.create({ data: { kind: 'SELLER', userId: aziza.id, status: 'APPROVED', decidedAt: new Date(), reviewerId: root.id } });
  await db.verificationRequest.create({ data: { kind: 'SELLER', userId: timur.id, evidence: { note: 'Sole proprietor certificate submitted' } } });

  // Stores and products -----------------------------------------------------

  const cats = new Map((await db.productCategory.findMany()).map((c) => [c.slug, c.id]));
  const studio = await seller.createStore(aziza.id, { name: 'Studio Aziza', tagline: 'Brand systems for small teams', description: 'Identity kits and presentation templates, designed in Tashkent.', country: 'Uzbekistan', currency: 'USD' });
  const forge = await seller.createStore(timur.id, { name: 'Tashkent Code Forge', tagline: 'Starter kits that ship', description: 'Production-minded source code for Central Asian products.', country: 'Uzbekistan', currency: 'USD' });
  const school = await seller.createStore(malika.id, { name: 'Malika Academy', tagline: 'Short-form storytelling', description: 'Courses and memberships for new creators.', country: 'Uzbekistan', currency: 'USD' });

  const standard = await seller.createLicense(studio.id, aziza.id, { name: 'Standard licence', terms: 'Use in unlimited projects for yourself or one client. Resale of the files is not allowed.', commercialUse: true, seats: 1, territory: 'worldwide' });
  const team = await seller.createLicense(forge.id, timur.id, { name: 'Team licence', terms: 'Use within one company by up to ten developers. Redistribution of the source is not allowed.', commercialUse: true, seats: 10, territory: 'worldwide' });

  type Spec = { store: { id: string }; owner: string; title: string; summary: string; description: string; type: 'DESIGN_TEMPLATE' | 'SOURCE_CODE' | 'WEBSITE_TEMPLATE' | 'DIGITAL_DOWNLOAD' | 'COURSE' | 'MEMBERSHIP' | 'SERVICE' | 'DIGITAL_LICENSE' | 'SAAS_ACCESS'; cat: string; tags: string[]; prices: [string, string][]; license?: string | null; affiliateBps?: number };

  const specs: Spec[] = [
    { store: studio, owner: aziza.id, title: 'Brand Starter Kit', summary: 'A complete identity system: logo grid, colour tokens and social templates.', description: 'Everything a young brand needs in one Figma file: a logo construction grid, a tokenised colour system, 40 social templates and a short brand guide you can hand to anyone.\n\nDesigned for teams without a full-time designer.', type: 'DESIGN_TEMPLATE', cat: 'design', tags: ['figma', 'branding', 'templates'], prices: [['Solo', '4900'], ['Studio', '12900']], license: standard.id, affiliateBps: 1000 },
    { store: studio, owner: aziza.id, title: 'Pitch Deck System', summary: 'Sixty modular slides for founders raising their first round.', description: 'A modular slide system with charts, team pages and financial layouts. Works in Figma and Google Slides.', type: 'DESIGN_TEMPLATE', cat: 'business', tags: ['deck', 'startup', 'slides'], prices: [['Standard', '3900']], license: standard.id },
    { store: studio, owner: aziza.id, title: 'Ramadan Social Pack', summary: 'Ninety elegant story and post templates for seasonal campaigns.', description: 'Seasonal social templates with Latin and Cyrillic type already set. Editable in Figma and Canva.', type: 'DESIGN_TEMPLATE', cat: 'marketing', tags: ['social', 'seasonal', 'canva'], prices: [['Pack', '1900']], license: standard.id },
    { store: studio, owner: aziza.id, title: 'Icon Set: Commerce 240', summary: '240 outlined commerce icons on a 24px grid.', description: 'Consistent outlined icons for product and commerce interfaces, exported as SVG with a Figma source.', type: 'DIGITAL_DOWNLOAD', cat: 'design', tags: ['icons', 'svg'], prices: [['Personal', '1500'], ['Commercial', '2900']], license: standard.id },
    { store: forge, owner: timur.id, title: 'NestJS SaaS Boilerplate', summary: 'Auth, billing hooks, multi-tenancy and audit logs, ready to extend.', description: 'A production-minded NestJS starter: session auth, organisation tenancy, an audit trail, background jobs and an OpenAPI contract. Includes a full test suite and deployment notes.', type: 'SOURCE_CODE', cat: 'development', tags: ['nestjs', 'typescript', 'saas'], prices: [['Single project', '14900'], ['Team', '39900']], license: team.id, affiliateBps: 1500 },
    { store: forge, owner: timur.id, title: 'Uzbek Locale Toolkit', summary: 'Number, date and currency formatting for Latin and Cyrillic Uzbek.', description: 'Tested helpers for soum formatting, transliteration between scripts and pluralisation rules. Zero dependencies.', type: 'SOURCE_CODE', cat: 'development', tags: ['i18n', 'uzbek', 'library'], prices: [['Licence', '2900']], license: team.id },
    { store: forge, owner: timur.id, title: 'Next.js Storefront Theme', summary: 'A fast storefront with cart, search and checkout screens.', description: 'A clean Next.js storefront using server components. Scores well on Core Web Vitals out of the box.', type: 'WEBSITE_TEMPLATE', cat: 'development', tags: ['nextjs', 'ecommerce', 'react'], prices: [['Single site', '7900'], ['Unlimited', '19900']], license: team.id },
    { store: forge, owner: timur.id, title: 'Telegram Bot Commerce Kit', summary: 'Sell through a Telegram bot with catalogue, cart and order flow.', description: 'A modular bot with a catalogue, a cart and an admin panel. Connect your own payment partner.', type: 'SOURCE_CODE', cat: 'software', tags: ['telegram', 'bot', 'commerce'], prices: [['Licence', '9900']], license: team.id },
    { store: school, owner: malika.id, title: 'Short-Form Storytelling', summary: 'Eight weeks from a blank camera roll to a repeatable format.', description: 'A practical course on hooks, pacing and editing for vertical video. Taught in Uzbek with English subtitles.', type: 'COURSE', cat: 'education', tags: ['video', 'course', 'creator'], prices: [['Course', '8900']] },
    { store: school, owner: malika.id, title: 'Creator Circle Membership', summary: 'A private community for creators, with monthly critiques.', description: 'Join the private circle: weekly prompts, monthly critiques and a channel for finding collaborators.', type: 'MEMBERSHIP', cat: 'community', tags: ['membership', 'community'], prices: [['Membership', '1200']] },
    { store: school, owner: malika.id, title: 'Reel Script Templates', summary: 'Thirty fill-in-the-blank script structures that hold attention.', description: 'Structures for tutorials, stories and reviews, with worked examples in Uzbek and Russian.', type: 'DIGITAL_DOWNLOAD', cat: 'media', tags: ['scripts', 'reels'], prices: [['Pack', '1400']] },
  ];

  const products: { id: string; title: string; variantId: string; store: string; owner: string; type: string }[] = [];
  const upload = async (ownerId: string, filename: string) => {
    const storageKey = `private/${ownerId}/${key('file')}.zip`;
    await storage.store.put(storageKey, zip, 'application/zip');
    return db.upload.create({ data: { ownerId, storageKey, filename, mime: 'application/zip', sizeBytes: zip.length, purpose: 'product' } });
  };
  for (const s of specs) {
    const p = await seller.createProduct(s.store.id, s.owner, {
      title: s.title, summary: s.summary, description: s.description, type: s.type, currency: 'USD', categoryId: cats.get(s.cat), tags: s.tags,
      licenseId: s.license ?? null, affiliateBps: s.affiliateBps ?? null,
      variants: s.prices.map(([name, priceMinor]) => ({ name, priceMinor, active: true })),
    });
    const version = await seller.addVersion(p.id, s.owner, '1.0.0', 'First release');
    const file = await upload(s.owner, `${p.slug}.zip`);
    await seller.attachAsset(p.id, s.owner, file.id, 'FILE', version.id);
    await seller.publish(p.id, s.owner);
    products.push({ id: p.id, title: s.title, variantId: p.variants[0]!.id, store: s.store.id, owner: s.owner, type: s.type });
  }
  await seller.createDiscount(studio.id, aziza.id, { code: 'BOSHLASH', kind: 'PERCENT', value: '1500' });
  const collaborator = products.find((p) => p.title === 'Reel Script Templates')!;
  await seller.addRevenueShare(collaborator.id, malika.id, { participantEmail: 'jasur@faith.dev', role: 'COLLABORATOR', bps: 2000 });

  // Courses and communities attach to the products sold above -------------------

  const courseProduct = products.find((p) => p.type === 'COURSE')!;
  const course = await creatorSvc.createCourse(malika.id, { title: 'Short-Form Storytelling', summary: 'From a blank camera roll to a repeatable format.', level: 'beginner', language: 'uz', productId: courseProduct.id });
  const s1 = await creatorSvc.addSection(course.id, malika.id, 'Hook va tuzilma');
  const s2 = await creatorSvc.addSection(course.id, malika.id, 'Tahrirlash');
  await creatorSvc.addLesson(s1.id, malika.id, { title: 'Birinchi uch soniya', body: 'Tomoshabin birinchi uch soniyada qaror qiladi. Bu darsda kuchli ochilish uchun uchta usulni koʻrib chiqamiz.', durationSec: 420, isPreview: true });
  await creatorSvc.addLesson(s1.id, malika.id, { title: 'Hikoya yoyi', body: 'Muammo, burilish, yechim: qisqa video uchun eng ishonchli tuzilma.', durationSec: 540, isPreview: false });
  await creatorSvc.addLesson(s2.id, malika.id, { title: 'Ritm va kesish', body: 'Tahrir ritmi diqqatni qanday ushlab turadi va qachon toʻxtash kerak.', durationSec: 610, isPreview: false });
  await creatorSvc.setCoursePublished(course.id, malika.id, true);
  const freeCourse = await creatorSvc.createCourse(aziza.id, { title: 'Brend asoslari', summary: 'Kichik jamoalar uchun bepul kirish kursi.', level: 'beginner', language: 'uz' });
  const fs1 = await creatorSvc.addSection(freeCourse.id, aziza.id, 'Boshlash');
  await creatorSvc.addLesson(fs1.id, aziza.id, { title: 'Brend nima?', body: 'Brend logotip emas, balki odamlar sizni qanday eslab qolishidir.', durationSec: 300, isPreview: true });
  await creatorSvc.setCoursePublished(freeCourse.id, aziza.id, true);

  const membership = products.find((p) => p.type === 'MEMBERSHIP')!;
  await creatorSvc.createCommunity(malika.id, { name: 'Creator Circle', description: 'A private community for working creators.', visibility: 'PRIVATE', productId: membership.id });
  const open = await creatorSvc.createCommunity(aziza.id, { name: 'Dizaynerlar klubi', description: 'Oʻzbekistondagi dizaynerlar uchun ochiq hamjamiyat.', visibility: 'PUBLIC' });
  await creatorSvc.createCommunity(root.id, { name: 'FAITH Pro Lounge', description: 'A space for Pro members.', visibility: 'PRIVATE', grantPlanKey: 'pro' });
  await creatorSvc.join(open.slug, talent.id);
  await creatorSvc.join(open.slug, malika.id);
  const post = await creatorSvc.post(open.slug, talent.id, { title: 'Portfolio koʻrib berasizmi?', body: 'Yangi portfoliomni tayyorladim, fikringizni bilmoqchiman.' });
  await creatorSvc.comment(post.id, aziza.id, 'Albatta! Keys tadqiqotlarni qisqartirsangiz kuchliroq boʻladi.');

  // Sales through the real checkout -------------------------------------------

  const sell = async (who: { id: string }, productIdx: number[]) => {
    for (const i of productIdx) await orders.addToCart(who.id, products[i]!.variantId, 1);
    const c = await orders.checkout(who.id, { idempotencyKey: key('checkout') });
    if (c.payment) await payments.simulate(c.payment.paymentId, who.id, 'success');
    return c.orderId;
  };
  const bought: string[] = [];
  bought.push(await sell(buyers[0]!, [0, 4]));
  bought.push(await sell(buyers[1]!, [0, 8]));
  bought.push(await sell(buyers[2]!, [1, 2, 3]));
  bought.push(await sell(buyers[3]!, [4]));
  bought.push(await sell(buyers[4]!, [6, 7]));
  bought.push(await sell(buyers[5]!, [8, 9, 10]));
  bought.push(await sell(buyers[1]!, [5]));
  bought.push(await sell(buyers[2]!, [6]));
  bought.push(await sell(buyers[3]!, [2, 10]));
  bought.push(await sell(buyers[0]!, [8]));

  const refundItem = await db.orderItem.findFirstOrThrow({ where: { orderId: bought[2]! } });
  const refund = await orders.requestRefund(buyers[2]!.id, bought[2]!, { orderItemId: refundItem.id, reason: 'The slide layouts did not suit my deck.', amountMinor: '1500' });
  await orders.decideRefund(refund.id, aziza.id, true, 'Sorry it did not fit.');
  const pendingItem = await db.orderItem.findFirstOrThrow({ where: { orderId: bought[6]! } });
  await orders.requestRefund(buyers[1]!.id, bought[6]!, { orderItemId: pendingItem.id, reason: 'I bought the wrong licence by mistake.' });

  const reviewable = await db.orderItem.findMany({ where: { orderId: { in: [bought[0]!, bought[1]!, bought[4]!] } } });
  const notes = ['Exactly what we needed for our launch.', 'Clear structure and well documented.', 'Saved me a week of work.', 'Very polished, worth the price.', 'Great start, a few things I would change.'];
  for (const [i, item] of reviewable.entries()) {
    const order = await db.order.findUniqueOrThrow({ where: { id: item.orderId } });
    await db.customerReview.create({ data: { productId: item.productId, userId: order.buyerId, orderItemId: item.id, rating: i % 4 === 3 ? 4 : 5, body: notes[i % notes.length]! } });
    await db.product.update({ where: { id: item.productId }, data: { ratingCount: { increment: 1 }, ratingSum: { increment: i % 4 === 3 ? 4 : 5 } } });
  }

  // Content Rewards -----------------------------------------------------------

  const rights = {
    usageRights: 'The brand may repost approved content on its own channels and in paid ads for the licence period.',
    creatorPermissions: 'You keep ownership of your content and may keep it on your own channels.',
    attribution: 'Tag the brand in the caption.',
    adDisclosure: 'Include #reklama or #ad at the start of the caption.',
    prohibitedContent: 'hate speech, misleading health claims, gambling, purchased views',
  };
  const campaignSpecs = [
    { orgId: silk.id, title: 'Ipak Yoʻli: birinchi qahva hikoyasi', summary: 'Share your first cup at our new Chilonzor roastery.', description: 'Visit the roastery, film your first cup and tell the story behind it. We want honest reactions, not scripts.', type: 'ORIGINAL_UGC' as const, budget: '500000', platforms: ['instagram', 'tiktok'] as ('instagram' | 'tiktok')[], rules: [{ metric: 'APPROVED_SUBMISSION' as const, unitSize: '1', rateMinor: '4000', minQualified: '0' }, { metric: 'VIEWS' as const, unitSize: '1000', rateMinor: '120', minQualified: '1000', capMinor: '20000' }] },
    { orgId: silk.id, title: 'Podcast clips: Toshkent tadbirkorlari', summary: 'Clip our founder interviews into verified-view shorts.', description: 'We supply long-form interviews. You find the moments worth sharing and cut them into vertical clips.', type: 'VIDEO_CLIPPING' as const, budget: '1200000', platforms: ['youtube', 'tiktok', 'instagram'] as ('youtube' | 'tiktok' | 'instagram')[], rules: [{ metric: 'VIEWS' as const, unitSize: '1000', rateMinor: '180', minQualified: '5000', capMinor: '50000' }] },
    { orgId: nur.id, title: 'Nur Telecom ilovasini sinab koʻring', summary: 'Test the new app, report what breaks, get paid per accepted report.', description: 'Install the beta, follow the test script and submit a screen recording of your session.', type: 'APP_TESTING' as const, budget: '300000', platforms: ['other'] as ('other')[], rules: [{ metric: 'APPROVED_SUBMISSION' as const, unitSize: '1', rateMinor: '2500', minQualified: '0' }], requiresApplication: true },
    { orgId: nur.id, title: 'Qualified sign-ups for Nur Pay', summary: 'Drive verified leads to the Nur Pay waitlist.', description: 'Use your tracking link. A lead counts once the person confirms their number.', type: 'VERIFIED_LEADS' as const, budget: '800000', platforms: ['instagram', 'youtube'] as ('instagram' | 'youtube')[], rules: [{ metric: 'LEADS' as const, unitSize: '1', rateMinor: '300', minQualified: '10', capMinor: '60000' }] },
  ];
  const campaigns = [];
  for (const c of campaignSpecs) {
    const created = await rewards.create(brandUser.id, {
      orgId: c.orgId, title: c.title, summary: c.summary, description: c.description, type: c.type, currency: 'USD', budgetMinor: c.budget,
      platforms: c.platforms, countries: ['Uzbekistan'], guidelines: 'Be honest, be yourself and follow the disclosure rules. Do not buy engagement.',
      requiresApplication: 'requiresApplication' in c, submissionDeadline: days(40), licenseDays: 90, territory: 'Central Asia', ...rights,
      requirements: [{ label: 'Minimum 15 seconds', required: true }, { label: 'Disclosure in the caption', required: true }],
      rules: c.rules,
    });
    const pay = await rewards.startFunding(created.id, brandUser.id, key('fund'));
    await payments.simulate(pay.paymentId, brandUser.id, 'success');
    await rewards.submitForReview(created.id, brandUser.id);
    await admin.moderateCampaign(moderator.id, created.id, true);
    campaigns.push(created);
  }

  const sub = (u: string) => ({ platform: 'instagram' as const, url: u, acceptedTerms: true as const, evidenceKeys: [] });
  const a = await rewards.submit(campaigns[0]!.slug, malika.id, { ...sub('https://www.instagram.com/reel/seedAAA1/'), note: 'Filmed at the roastery opening.' });
  const b = await rewards.submit(campaigns[0]!.slug, jasur.id, sub('https://www.instagram.com/reel/seedBBB2/'));
  const c = await rewards.submit(campaigns[0]!.slug, kamola.id, sub('https://www.instagram.com/reel/seedCCC3/'));
  const d = await rewards.submit(campaigns[1]!.slug, jasur.id, { platform: 'youtube', url: 'https://youtube.com/shorts/seedDDD4', acceptedTerms: true, evidenceKeys: [] });
  await rewards.submit(campaigns[1]!.slug, malika.id, { platform: 'tiktok', url: 'https://www.tiktok.com/@malika/video/71234', acceptedTerms: true, evidenceKeys: [] });
  await rewards.recordMetric(a.id, brandUser.id, { metric: 'VIEWS', value: '48200' }, false, 'SIMULATED');
  await rewards.recordMetric(d.id, brandUser.id, { metric: 'VIEWS', value: '215000' }, false, 'SIMULATED');
  await rewards.decide(a.id, brandUser.id, { decision: 'approve' });
  await rewards.decide(d.id, brandUser.id, { decision: 'approve' });
  await rewards.decide(b.id, brandUser.id, { decision: 'reject', reason: 'The #reklama disclosure is missing from the caption.' });
  await rewards.recordMetric(c.id, brandUser.id, { metric: 'VIEWS', value: '12900' }, false, 'SIMULATED');

  await db.creatorProfile.createMany({
    data: [
      { userId: malika.id, headline: 'Short-form storyteller and teacher', niches: ['education', 'storytelling'], socials: {} },
      { userId: jasur.id, headline: 'Podcast clipper with an eye for the moment', niches: ['clips', 'business'], socials: {} },
      { userId: kamola.id, headline: 'UGC for lifestyle brands', niches: ['ugc', 'beauty'], socials: {} },
    ],
  });
  await db.onboardingResponse.create({ data: { userId: jasur.id, persona: 'create', question: 'platforms', answer: ['youtube', 'tiktok'] } });

  // Jobs and freelance ---------------------------------------------------------

  const jobSpecs = [
    { orgId: silk.id, title: 'Brand Designer', description: 'Own our visual identity across packaging, retail and digital. You will work directly with the founders.', employmentType: 'FULL_TIME' as const, workplace: 'ONSITE' as const, experience: 'MID' as const, location: 'Tashkent', country: 'Uzbekistan', currency: 'USD', salaryMinMinor: '90000', salaryMaxMinor: '140000', skills: ['figma', 'branding', 'packaging'], languages: ['uz', 'ru'] },
    { orgId: nur.id, title: 'Senior Backend Engineer', description: 'Build the payment core of Nur Pay in TypeScript and PostgreSQL. Correctness matters more than speed here.', employmentType: 'FULL_TIME' as const, workplace: 'HYBRID' as const, experience: 'SENIOR' as const, location: 'Tashkent', country: 'Uzbekistan', currency: 'USD', salaryMinMinor: '250000', salaryMaxMinor: '380000', skills: ['typescript', 'postgresql', 'nestjs'], languages: ['en', 'ru'] },
    { orgId: nur.id, title: 'Product Designer', description: 'Shape the first version of our consumer app with a small team, from research to shipped screens.', employmentType: 'FULL_TIME' as const, workplace: 'REMOTE' as const, experience: 'MID' as const, country: 'Uzbekistan', currency: 'USD', salaryMinMinor: '150000', salaryMaxMinor: '220000', skills: ['figma', 'ux', 'prototyping'], languages: ['uz', 'en'] },
    { orgId: silk.id, title: 'Social Media Coordinator', description: 'Run our daily channels and work with creators on campaigns.', employmentType: 'PART_TIME' as const, workplace: 'REMOTE' as const, experience: 'ENTRY' as const, country: 'Uzbekistan', currency: 'USD', salaryMinMinor: '40000', salaryMaxMinor: '60000', skills: ['content', 'instagram'], languages: ['uz'] },
    { orgId: nur.id, title: 'Data Analyst Intern', description: 'Learn analytics on real product questions alongside senior analysts.', employmentType: 'INTERNSHIP' as const, workplace: 'HYBRID' as const, experience: 'ENTRY' as const, location: 'Tashkent', country: 'Uzbekistan', currency: 'USD', skills: ['sql', 'analytics'], languages: ['uz', 'en'] },
  ];
  const jobs = [];
  for (const j of jobSpecs) {
    const job = await work.postJob(brandUser.id, j);
    await admin.moderateJob(moderator.id, job.id, true);
    jobs.push(job);
  }
  await work.saveCandidate(talent.id, { headline: 'Product designer, five years in fintech', summary: 'I design calm, legible financial products.', skills: ['figma', 'ux', 'prototyping'], languages: ['uz', 'ru', 'en'], discoverable: true });
  await work.addPortfolio(talent.id, { title: 'Hamyon: a family budgeting app', description: 'From research to a shipped mobile app with 40k users.', url: 'https://example.com/hamyon' });
  const application = await work.apply(jobs[2]!.slug, talent.id, 'I have spent five years designing financial products and would love to help shape your first release.');
  await work.setApplicationStatus(application.id, brandUser.id, 'SHORTLISTED');

  await work.saveFreelancer(talent.id, { headline: 'Product designer for early teams', bio: 'I help founders turn rough flows into shippable screens.', hourlyRateMinor: '3500', currency: 'USD', skills: ['figma', 'ux'], available: true });
  const logoService = await work.createService(talent.id, {
    title: 'Mobile app UX audit', summary: 'A prioritised review of your app with annotated fixes.', description: 'I review your key flows, score them against usability heuristics and deliver an annotated Figma file with prioritised fixes.', currency: 'USD', tags: ['ux', 'audit', 'mobile'], publish: true,
    categoryId: cats.get('design'),
    packages: [
      { name: 'Essential', description: 'One core flow, annotated', priceMinor: '25000', deliveryDays: 4, revisions: 1 },
      { name: 'Complete', description: 'Up to five flows with a prioritised roadmap', priceMinor: '70000', deliveryDays: 10, revisions: 2 },
    ],
  });
  await work.saveFreelancer(malika.id, { headline: 'Video editor for brands', bio: 'Vertical edits that hold attention.', currency: 'USD', skills: ['video', 'editing'], available: true });
  const editing = await db.role.findUniqueOrThrow({ where: { key: 'freelancer' } });
  await db.userRole.create({ data: { userId: malika.id, roleId: editing.id } });
  await work.createService(malika.id, {
    title: 'Reels editing retainer', summary: 'Eight edited vertical videos a month.', description: 'Send raw footage, get back eight edited reels with captions and a clear hook.', currency: 'USD', tags: ['video', 'reels'], publish: true, categoryId: cats.get('media'),
    packages: [{ name: 'Monthly', description: 'Eight edited reels', priceMinor: '60000', deliveryDays: 30, revisions: 2 }],
  });
  const project = await work.requestProject(buyer.id, logoService.slug, logoService.packages[0]!.id, 'We need a review of the onboarding flow in our budgeting app.');
  await work.acceptProject(project.id, talent.id);

  // Apps ---------------------------------------------------------------------

  await dev.saveProfile(devUser.id, { name: 'Bekzod Labs', website: 'https://example.com', bio: 'Small tools for merchants.' });
  await dev.saveProfile(timur.id, { name: 'Tashkent Code Forge', bio: 'Developer tools for commerce.' });
  const appSpecs = [
    { owner: devUser.id, name: 'Sotuv Radar', tagline: 'Instant alerts for every sale', description: 'Sends each new order to your team channel, with the customer note and the product, so nobody misses a sale.', category: 'analytics' as const, permissions: ['read:orders', 'read:products'] as ('read:orders' | 'read:products')[] },
    { owner: devUser.id, name: 'Soliq Hisobot', tagline: 'Monthly sales summaries for your accountant', description: 'Exports a clean monthly sales summary you can hand to your accountant. It does not file anything for you.', category: 'finance' as const, permissions: ['read:orders'] as ('read:orders')[] },
    { owner: timur.id, name: 'Kupon Studio', tagline: 'Plan discount campaigns on a calendar', description: 'Lay out seasonal discounts on a calendar and see which ones overlap before they go live.', category: 'marketing' as const, permissions: ['read:products', 'read:store'] as ('read:products' | 'read:store')[] },
  ];
  for (const s of appSpecs) {
    const created = await dev.createApp(s.owner, { name: s.name, tagline: s.tagline, description: s.description, category: s.category, pricing: 'FREE', priceMinor: '0', currency: 'USD', screenshots: [] });
    const v = await dev.addVersion(created.id, s.owner, { version: '1.0.0', changelog: 'First release', permissions: s.permissions });
    await dev.submit(created.id, s.owner);
    await dev.review(v.id, moderator.id, true, 'Permissions match the described behaviour.');
    await dev.install(created.slug, buyer.id, s.permissions);
  }
  const pendingApp = await dev.createApp(devUser.id, { name: 'Mijoz Daftar', tagline: 'A simple CRM for small sellers', description: 'Keep notes on your customers in one place.', category: 'operations', pricing: 'FREE', priceMinor: '0', currency: 'USD', screenshots: [] });
  await dev.addVersion(pendingApp.id, devUser.id, { version: '0.9.0', permissions: ['read:customers', 'read:orders'] });
  await dev.submit(pendingApp.id, devUser.id);

  // Ads, tickets, Future Lab, messages -----------------------------------------

  const adProduct = products[4]!;
  const ad = await db.advertisement.create({ data: { placement: 'MARKETPLACE_TOP', title: 'Launch your SaaS this month', createdById: timur.id, productId: adProduct.id, currency: 'USD', budgetMinor: 25000n, status: 'DRAFT' } });
  const adPay = await payments.start({ purpose: 'ADVERTISING', payerId: timur.id, amountMinor: ad.budgetMinor, currency: 'USD', idempotencyKey: key('ad'), description: ad.title, adId: ad.id });
  await payments.simulate(adPay.paymentId, timur.id, 'success');
  await admin.moderateAd(moderator.id, ad.id, true);

  await db.supportTicket.create({ data: { userId: buyer.id, subject: 'Licence key for my team', body: 'Can I move my licence to a colleague?' } });
  await db.experiment.create({ data: { key: 'checkout-summary-copy', name: 'Clearer fee copy at checkout', hypothesis: 'Showing what the buyer pays with no extra fee line reduces drop-off.', variants: ['current', 'plain'], status: 'RUNNING' } });
  await db.conversation.create({
    data: {
      subject: 'Mobile app UX audit',
      participants: { create: [{ userId: buyer.id, lastReadAt: new Date() }, { userId: talent.id }] },
      messages: { create: [{ senderId: buyer.id, body: 'Salom! Bizning ilovamizning onboarding qismini koʻrib bera olasizmi?' }] },
    },
  });

  await drainOutbox(db, { batch: 500 });

  // Spread the sales across the past month so charts read like real activity.
  const paid = await db.order.findMany({ where: { paidAt: { not: null } }, orderBy: { createdAt: 'asc' } });
  for (const [i, o] of paid.entries()) {
    const at = days(-Math.round(((paid.length - i) / paid.length) * 27) - 1);
    await db.order.update({ where: { id: o.id }, data: { paidAt: at, createdAt: at } });
  }

  await db.platformSetting.upsert({ where: { key: 'platform.demoData' }, update: { value: true }, create: { key: 'platform.demoData', value: true } });

  await app.close();
  await compSampleAccounts(db);
  await db.$disconnect();
  console.log(`
FAITH demo data is ready. All data is fictional. Password for every account below: ${DEMO_PASSWORD}

  Super admin   admin@faith.dev
  Moderator     moderator@faith.dev
  Finance       finance@faith.dev
  Seller        seller@faith.dev
  Seller + dev  timur@faith.dev
  Creator       creator@faith.dev
  Brand         brand@faith.dev
  Developer     developer@faith.dev
  Job seeker    talent@faith.dev
  Buyer         buyer@faith.dev
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
