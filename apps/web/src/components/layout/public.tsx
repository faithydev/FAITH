import { Link } from '@/i18n/navigation';
import { getMe } from '@/lib/api';
import { Menu } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { FaithLockup, FaithLogo, FaithWordmark } from '../ui/logo';
import { LinkButton } from '../ui/primitives';
import { MobileNavigation, NavLinks, NavScrollFrame } from './mobile-nav';
import { CurrencySwitcher } from '../money/currency';
import { CartLink, CommandPalette, LocaleSwitcher, MotionToggle, NotificationLink, ThemeToggle, UserAvatarMenu } from './controls';

export async function PrimaryNavigation({ overlay = false }: { overlay?: boolean }) {
  const [t, me] = await Promise.all([getTranslations(), getMe()]);
  const links = [
    // Courses and services lead: they are what FAITH is for. Products follow.
    { href: '/courses', label: t('nav.courses') }, { href: '/services', label: t('nav.services') }, { href: '/marketplace', label: t('nav.marketplace') },
    { href: '/jobs', label: t('nav.jobs') }, { href: '/rewards', label: t('nav.rewards') }, { href: '/apps', label: t('nav.apps') },
    { href: '/pricing', label: t('nav.pricing') },
  ];
  return (
    <NavScrollFrame overlay={overlay}>
      <nav aria-label={t('nav.primary')} className="mx-auto flex h-15 max-w-[92rem] items-center gap-3 px-3 sm:gap-5 sm:px-6 lg:px-8">
        <Link href="/" aria-label={t('nav.home')} className="shrink-0"><FaithLogo compact /></Link>
        <NavLinks links={links} />
        <div className="ms-auto flex items-center gap-1">
          <CommandPalette />
          <CurrencySwitcher persist={!!me} />
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
    { title: t('footer.platform'), links: [['/courses', t('nav.courses')], ['/services', t('nav.services')], ['/marketplace', t('nav.marketplace')], ['/jobs', t('nav.jobs')], ['/rewards', t('nav.rewards')], ['/creators', t('nav.creators')], ['/leaderboard', t('nav.leaderboard')]] },
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
      {/* The official wordmark, large and fading into the page; the artwork itself is untouched. */}
      <div aria-hidden className="pointer-events-none relative flex justify-center px-4 pt-6 opacity-[0.2] select-none [mask-image:linear-gradient(180deg,#000_25%,transparent_100%)]">
        <FaithWordmark height={161} className="h-auto w-[min(90vw,60rem)]" />
      </div>
      <div className="relative">
        <p className="mx-auto max-w-[92rem] px-4 py-5 font-mono text-[0.7rem] tracking-wide text-subtle sm:px-6 lg:px-8">{t('brand.tagline')}</p>
      </div>
    </footer>
  );
}
