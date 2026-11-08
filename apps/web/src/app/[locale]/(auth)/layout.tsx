import { AuthBackdrop } from '@/components/auth/backdrop';
import { AuthChrome } from '@/components/auth/chrome';
import { IntlScope } from '@/components/auth/scope';
import { LocaleSwitcher, MotionToggle } from '@/components/layout/controls';
import { RouteTransition } from '@/components/motion/fx';
import { FaithLogo } from '@/components/ui/logo';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

/** Black glass over a lit horizon. Always dark, whatever the site theme, like the reference. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <div data-theme="dark" className="relative isolate flex min-h-svh flex-col bg-black text-white">
      <AuthBackdrop />
      <header className="vt-header relative z-10 flex items-center justify-between p-4 sm:p-6">
        <Link href="/" aria-label={t('nav.home')}><FaithLogo tone="light" /></Link>
        <div className="flex items-center gap-1"><MotionToggle /><LocaleSwitcher /></div>
      </header>
      <main id="main" className="relative z-10 flex flex-1 items-center justify-center px-3 pb-12 sm:px-4">
        <div className="auth-card animate-rise w-full max-w-[26rem] p-5 sm:p-7">
          <IntlScope ns={['auth']}>
            <AuthChrome signUp={t('auth.signUp')} signIn={t('auth.signIn')} close={t('common.close')} label={t('auth.loginTitle')} />
            <RouteTransition>{children}</RouteTransition>
          </IntlScope>
        </div>
      </main>
    </div>
  );
}
