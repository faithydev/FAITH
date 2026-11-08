import { InteractiveSpotlight, MagneticButton, RevealOnScroll, StaggeredReveal } from '@/components/motion';
import { RouteTransition } from '@/components/motion/fx';
import { Footer, PrimaryNavigation } from '@/components/layout/public';
import { ProductCardView } from '@/components/commerce/product-card';
import { ThreeDEcosystem } from '@/components/three/ecosystem';
import { ThreeDHero } from '@/components/three/hero';
import { LinkButton } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { tryPublicApi } from '@/lib/api';
import { money, number, percent } from '@/lib/format';
import type { Campaign, Job, Paged, ProductCard } from '@/lib/types';
import { DEFAULT_COMMISSION_BPS, PERSONAS } from '@faith/config';
import { commissionFor } from '@faith/money';
import { ArrowUpRight } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

const ECOSYSTEM = ['creators', 'customers', 'developers', 'businesses', 'products', 'communities', 'rewards', 'applications'] as const;

/** "One identity. Infinite possibility." becomes two lines, the second one lit. Works in every script. */
function splitPhrase(text: string): [string, string] {
  const m = /^(.+?[.。．!！,，、])\s*(.+)$/u.exec(text);
  return m ? [m[1]!, m[2]!] : [text, ''];
}

/** Tagline words ("Create. Sell. Earn.") for the moving band. */
const words = (tagline: string) => tagline.split(/(?<=[.。．!！])\s*/u).map((w) => w.replace(/[.。．!！]$/u, '')).filter(Boolean);

export default async function HomePage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const [products, campaigns, jobs] = await Promise.all([
    tryPublicApi<Paged<ProductCard>>('/marketplace/products?pageSize=4&sort=popular', 60),
    tryPublicApi<Paged<Campaign>>('/rewards/campaigns?pageSize=3', 60),
    tryPublicApi<Paged<Job>>('/jobs?pageSize=1', 60),
  ]);
  const sale = 10_000n;
  const fee = commissionFor(sale, DEFAULT_COMMISSION_BPS);
  const stats = [
    { value: products?.total, label: t('home.statProducts') },
    { value: campaigns?.total, label: t('home.statCampaigns') },
    { value: jobs?.total, label: t('home.statJobs') },
  ].filter((s) => s.value !== undefined);
  const [lead, lit] = splitPhrase(t('brand.philosophy'));
  const band = words(t('brand.tagline'));

  return (
    <>
      <PrimaryNavigation overlay />
      <main id="main">
        <RouteTransition>
          <ThreeDHero>
            <div className="mx-auto w-full max-w-[92rem] px-4 pt-36 pb-12 sm:px-6 sm:pb-16 lg:px-8">
              <p className="eyebrow animate-rise text-white/60!">{t('brand.tagline')}</p>
              <h1 className="tracking-display mt-6 max-w-[14ch] text-[length:var(--text-display)] leading-[0.95] font-semibold">
                <span className="animate-rise block" style={{ '--rise-delay': '80ms' } as React.CSSProperties}>{lead}</span>
                {lit && <span className="animate-rise text-neon block pb-[0.08em]" style={{ '--rise-delay': '220ms' } as React.CSSProperties}>{lit}</span>}
              </h1>
              <p className="animate-rise mt-7 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg" style={{ '--rise-delay': '360ms' } as React.CSSProperties}>{t('brand.vision')}</p>
              <div className="animate-rise mt-9 flex flex-wrap items-center gap-3" style={{ '--rise-delay': '480ms' } as React.CSSProperties}>
                <MagneticButton><LinkButton href="/register" size="lg" arrow>{t('home.ctaStart')}</LinkButton></MagneticButton>
                <LinkButton href="/explore" size="lg" variant="secondary">{t('home.ctaExplore')}</LinkButton>
              </div>
              {stats.length > 0 && (
                <dl className="animate-rise mt-14 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10" style={{ '--rise-delay': '600ms' } as React.CSSProperties}>
                  {stats.map((s) => (
                    <div key={s.label} className="bg-black/70 px-4 py-3.5 backdrop-blur-md sm:px-5">
                      <dt className="font-mono text-[0.68rem] tracking-wide text-white/45 uppercase [:lang(ar)_&]:normal-case [:lang(zh)_&]:normal-case">{s.label}</dt>
                      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{number(s.value!, locale)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </ThreeDHero>

          {band.length > 1 && (
            <div aria-hidden className="marquee-frame overflow-hidden border-y border-line bg-black py-5" data-theme="dark">
              <div className="marquee">
                {[0, 1].map((copy) => (
                  <div key={copy} className="flex shrink-0 items-center">
                    {[...band, ...band].map((w, i) => (
                      <span key={`${copy}-${i}`} className="flex items-center font-display text-[clamp(2rem,5vw,4.2rem)] leading-none font-semibold tracking-[-0.04em]">
                        <span className={i % 2 ? 'text-white' : 'text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.4)]'}>{w}</span>
                        <span className="mx-8 size-2.5 rounded-full bg-neon shadow-[0_0_16px_var(--neon)]" />
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <section className="relative">
            <div className="mx-auto max-w-[92rem] px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
              <RevealOnScroll className="max-w-3xl">
                <p className="eyebrow">{t('home.identityEyebrow')}</p>
                <h2 className="tracking-display mt-4 text-[length:var(--text-title)] leading-[1.02] font-semibold">{t('home.identityTitle')}</h2>
                <p className="mt-5 text-lg leading-relaxed text-muted">{t('home.identityBody')}</p>
              </RevealOnScroll>
              <StaggeredReveal className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" step={55}>
                {PERSONAS.map((p, i) => (
                  <div key={p} className="card hover-depth group h-full p-5">
                    <span className="font-mono text-[0.7rem] text-subtle transition-colors group-hover:text-neon">{String(i + 1).padStart(2, '0')}</span>
                    <p className="mt-6 font-display text-lg font-semibold tracking-tight">{t(`onboarding.personas.${p}.title`)}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`onboarding.personas.${p}.body`)}</p>
                  </div>
                ))}
              </StaggeredReveal>
            </div>
          </section>

          <section className="relative">
            <div className="mx-auto max-w-[92rem] px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
              <RevealOnScroll className="mb-10 max-w-2xl">
                <p className="eyebrow">{t('home.ecosystemEyebrow')}</p>
                <h2 className="tracking-display mt-4 text-[length:var(--text-title)] leading-[1.02] font-semibold">{t('home.ecosystemTitle')}</h2>
              </RevealOnScroll>
              <ThreeDEcosystem label={t('home.ecosystemEyebrow')} nodes={ECOSYSTEM.map((key) => ({ key, title: t(`home.ecosystem.${key}.title`), body: t(`home.ecosystem.${key}.body`) }))} />
            </div>
          </section>

          <section data-theme="dark" className="relative overflow-hidden bg-black text-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_85%_10%,rgba(0,255,102,0.12),transparent_70%)]" />
            <div aria-hidden className="h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,102,0.5),transparent)]" />
            <div className="relative mx-auto max-w-[92rem] px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
              <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-end">
                <RevealOnScroll>
                  <p className="eyebrow text-white/50!">{t('home.rewardsEyebrow')}</p>
                  <h2 className="tracking-display mt-4 text-[length:var(--text-title)] leading-[1.02] font-semibold">{t('home.rewardsTitle')}</h2>
                  <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/65">{t('home.rewardsBody')}</p>
                  <LinkButton href="/rewards" size="lg" arrow className="mt-8">{t('home.rewardsCta')}</LinkButton>
                </RevealOnScroll>
                <ol className="grid gap-3 sm:grid-cols-2">
                  {(['fund', 'create', 'review', 'earn'] as const).map((step, i) => (
                    <li key={step} className="hover-depth rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                      <span className="grid size-8 place-items-center rounded-full border border-[rgba(0,255,102,0.35)] font-mono text-xs text-neon shadow-[0_0_18px_-4px_rgba(0,255,102,0.6)]">{i + 1}</span>
                      <p className="mt-5 font-display font-semibold">{t(`home.rewardsSteps.${step}.title`)}</p>
                      <p className="mt-1 text-sm text-white/60">{t(`home.rewardsSteps.${step}.body`)}</p>
                    </li>
                  ))}
                </ol>
              </div>
              {campaigns && campaigns.items.length > 0 && (
                <div className="mt-14 grid gap-3 md:grid-cols-3">
                  {campaigns.items.map((c) => (
                    <Link key={c.id} href={`/rewards/${c.slug}`} className="hover-depth group rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-white/20">
                      <p className="font-mono text-[0.7rem] tracking-wide text-white/45 uppercase">{c.org.name}</p>
                      <p className="mt-3 font-display text-lg font-semibold">{c.title}</p>
                      <p className="mt-6 flex items-center justify-between text-sm">
                        <span className="font-display text-xl font-semibold text-neon tabular-nums">{money(c.budgetMinor, c.currency, locale)}</span>
                        <ArrowUpRight size={18} className="flip-rtl text-white/40 transition-[color,translate] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neon" />
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="relative">
            <div className="mx-auto grid max-w-[92rem] gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-32">
              <RevealOnScroll>
                <p className="eyebrow">{t('home.feeEyebrow')}</p>
                <p className="tracking-display text-neon mt-4 font-display text-[clamp(5.5rem,17vw,12rem)] leading-[0.9] font-semibold">{percent(DEFAULT_COMMISSION_BPS, locale)}</p>
                <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">{t('home.feeTitle')}</h2>
                <p className="mt-2 max-w-md leading-relaxed text-muted">{t('home.feeBody')}</p>
              </RevealOnScroll>
              <RevealOnScroll delay={120}>
                <InteractiveSpotlight className="card p-6 sm:p-8">
                  <dl className="relative space-y-4 text-[0.95rem]">
                    <div className="flex justify-between gap-4"><dt className="text-muted">{t('home.feeSale')}</dt><dd className="font-semibold tabular-nums">{money(sale, 'USD', locale)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">{t('home.feePlatform')}</dt><dd className="tabular-nums text-muted">−{money(fee, 'USD', locale)}</dd></div>
                    <div className="flex items-end justify-between gap-4 border-t border-line pt-4"><dt className="font-medium">{t('home.feeYou')}</dt><dd className="font-display text-3xl font-semibold tabular-nums">{money(sale - fee, 'USD', locale)}</dd></div>
                  </dl>
                  <p className="relative mt-5 text-xs text-subtle">{t('home.feeNote')}</p>
                </InteractiveSpotlight>
              </RevealOnScroll>
            </div>
          </section>

          {products && products.items.length > 0 && (
            <section className="relative">
              <div className="mx-auto max-w-[92rem] px-4 pb-24 sm:px-6 lg:px-8">
                <div className="mb-8 flex items-end justify-between gap-4">
                  <h2 className="tracking-display text-[length:var(--text-heading)] font-semibold">{t('home.marketTitle')}</h2>
                  <LinkButton href="/marketplace" variant="ghost" size="sm" arrow className="shrink-0">{t('common.viewAll')}</LinkButton>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {products.items.map((p) => <ProductCardView key={p.id} product={p} />)}
                </div>
              </div>
            </section>
          )}

          <section className="relative">
            <div className="mx-auto grid max-w-[92rem] grid-cols-[minmax(0,1fr)] gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:pb-32">
              <RevealOnScroll className="min-w-0">
                <p className="eyebrow">{t('home.devEyebrow')}</p>
                <h2 className="tracking-display mt-4 text-[length:var(--text-title)] leading-[1.02] font-semibold">{t('home.devTitle')}</h2>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">{t('home.devBody')}</p>
                <LinkButton href="/developers" variant="secondary" size="lg" arrow className="mt-8">{t('home.devCta')}</LinkButton>
              </RevealOnScroll>
              <RevealOnScroll delay={120} className="min-w-0">
                <div data-theme="dark" className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_40px_90px_-40px_rgba(0,255,102,0.35)]">
                  <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                    <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-neon shadow-[0_0_10px_var(--neon)]" />
                    <span className="ms-3 font-mono text-[0.7rem] text-white/40">order-notifier.ts</span>
                  </div>
                  <pre dir="ltr" className="overflow-x-auto p-5 font-mono text-[0.8125rem] leading-relaxed text-white/75"><code>
                    <span className="text-[#7DFFB2]">import</span>{' { FaithClient, verifyWebhook } '}<span className="text-[#7DFFB2]">from</span> <span className="text-neon">{`'@faith/sdk'`}</span>{';\n\n'}
                    <span className="text-[#7DFFB2]">const</span>{' faith = '}<span className="text-[#7DFFB2]">new</span>{' FaithClient({ apiKey });\n'}
                    <span className="text-[#7DFFB2]">const</span>{' { items } = '}<span className="text-[#7DFFB2]">await</span>{' faith.orders();\n\n'}
                    <span className="text-[#7DFFB2]">const</span>{' event = verifyWebhook({\n  body, signature, timestamp, secret,\n});'}
                  </code></pre>
                </div>
              </RevealOnScroll>
            </div>
          </section>

          <section data-theme="dark" className="relative overflow-hidden bg-black text-white">
            <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-50 [mask:radial-gradient(60%_70%_at_50%_100%,#000,transparent)]" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(55%_80%_at_50%_100%,rgba(0,255,102,0.22),transparent_70%)]" />
            <RevealOnScroll className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:px-6 lg:py-36">
              <p className="eyebrow justify-center text-white/50!">{t('brand.tagline')}</p>
              <h2 className="tracking-display mt-5 text-[length:var(--text-title)] leading-[1.02] font-semibold">
                {lead} {lit && <span className="text-neon">{lit}</span>}
              </h2>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <LinkButton href="/register" size="lg" arrow>{t('home.ctaStart')}</LinkButton>
                <LinkButton href="/pricing" size="lg" variant="secondary">{t('nav.pricing')}</LinkButton>
              </div>
            </RevealOnScroll>
          </section>
        </RouteTransition>
      </main>
      <Footer />
    </>
  );
}
