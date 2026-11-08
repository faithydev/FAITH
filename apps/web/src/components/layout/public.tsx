import { Link } from '@/i18n/navigation';
import { getMe, getMeta } from '@/lib/api';
import { Menu } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { FaithLockup, FaithLogo } from '../ui/logo';
import { LinkButton } from '../ui/primitives';
import { MobileNavigation, NavLinks, NavScrollFrame } from './mobile-nav';
import { CartLink, CommandPalette, LocaleSwitcher, MotionToggle, NotificationLink, ThemeToggle, UserAvatarMenu } from './controls';

export async function DemoBanner() {
  const [meta, t] = await Promise.all([getMeta(), getTranslations()]);
  if (!meta?.demoData && !meta?.mockPayments) return null;
  return (
    <div data-testid="demo-banner" className="border-b border-[color-mix(in_srgb,var(--neon)_22%,transparent)] bg-[color-mix(in_srgb,var(--neon)_9%,var(--bg))] px-4 py-1.5 text-center font-mono text-[0.7rem] tracking-wide text-[color-mix(in_srgb,var(--neon)_80%,var(--text))]">
      {t('common.demoBanner')}
    </div>
  );
}

export async function PrimaryNavigation({ overlay = false }: { overlay?: boolean }) {
  const [t, me] = await Promise.all([getTranslations(), getMe()]);
  const links = [
    { href: '/marketplace', label: t('nav.marketplace') }, { href: '/rewards', label: t('nav.rewards') }, { href: '/jobs', label: t('nav.jobs') },
    { href: '/services', label: t('nav.services') }, { href: '/courses', label: t('nav.courses') }, { href: '/apps', label: t('nav.apps') },
    { href: '/pricing', label: t('nav.pricing') },
  ];
  return (
    <NavScrollFrame overlay={overlay}>
      <DemoBanner />
      <nav aria-label={t('nav.primary')} className="mx-auto flex h-15 max-w-[92rem] items-center gap-3 px-3 sm:gap-5 sm:px-6 lg:px-8">
        <Link href="/" aria-label={t('nav.home')} className="shrink-0"><FaithLogo compact /></Link>
        <NavLinks links={links} />
        <div className="ms-auto flex items-center gap-1">
          <CommandPalette />
          <LocaleSwitcher persist={!!me} />
          <MotionToggle className="hidden sm:grid" />
          <ThemeToggle className="hidden sm:grid" />
          {me ? (
            <>
              <CartLink count={me.cartCount} label={t('nav.cart')} />
              <span className="hidden sm:block"><NotificationLink count={me.unreadNotifications} label={t('nav.notifications')} /></span>
              <span className="ms-1.5"><UserAvatarMenu name={me.profile?.displayName ?? me.email} email={me.email} isStaff={me.permissions.includes('admin.access')} /></span>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink sm:block">{t('nav.login')}</Link>
              <LinkButton href="/register" size="sm" arrow className="ms-1 hidden sm:inline-flex">{t('nav.register')}</LinkButton>
            </>
          )}
          <MobileNavigation
            label={t('nav.menu')} closeLabel={t('common.close')} icon={<Menu size={19} strokeWidth={1.7} />}
            links={[...links, ...(me ? [{ href: '/app', label: t('nav.dashboard') }] : [{ href: '/login', label: t('nav.login') }, { href: '/register', label: t('nav.register') }])]}
          />
        </div>
      </nav>
    </NavScrollFrame>
  );
}

export async function Footer() {
  const t = await getTranslations();
  const columns = [
    { title: t('footer.platform'), links: [['/marketplace', t('nav.marketplace')], ['/rewards', t('nav.rewards')], ['/jobs', t('nav.jobs')], ['/services', t('nav.services')], ['/creators', t('nav.creators')]] },
    { title: t('footer.build'), links: [['/developers', t('nav.developers')], ['/apps', t('nav.apps')], ['/pricing', t('nav.pricing')], ['/explore', t('nav.explore')]] },
    { title: t('footer.company'), links: [['/about', t('nav.about')], ['/help', t('nav.help')], ['/terms', t('nav.terms')], ['/privacy', t('nav.privacy')]] },
  ];
  return (
    <footer className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(50%_100%_at_50%_0%,color-mix(in_srgb,var(--neon)_9%,transparent),transparent)]" />
      <div className="relative mx-auto grid max-w-[92rem] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <FaithLockup height={44} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{t('brand.vision')}</p>
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="eyebrow mb-4">{c.title}</p>
            <ul className="space-y-2.5">
              {c.links.map(([href, label]) => <li key={href}><Link href={href!} className="text-sm text-muted transition-colors hover:text-neon">{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <p aria-hidden className="pointer-events-none relative -mb-[0.18em] select-none text-center font-display text-[clamp(4rem,19vw,17rem)] leading-none font-semibold tracking-[-0.06em] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--text)_16%,transparent),transparent_80%)] bg-clip-text text-transparent">FAITH</p>
      <div className="relative">
        <p className="mx-auto max-w-[92rem] px-4 py-5 font-mono text-[0.7rem] tracking-wide text-subtle sm:px-6 lg:px-8">{t('brand.tagline')}</p>
      </div>
    </footer>
  );
}
