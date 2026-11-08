import { IntlScope } from '@/components/auth/scope';
import { LocaleSwitcher } from '@/components/layout/controls';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { FaithLogo } from '@/components/ui/logo';
import { redirect } from '@/i18n/navigation';
import { getMe } from '@/lib/api';
import { getLocale } from 'next-intl/server';

export default async function OnboardingPage() {
  const [me, locale] = await Promise.all([getMe(), getLocale()]);
  if (!me) return redirect({ href: '/login', locale });
  return (
    <div className="min-h-svh">
      <div className="flex items-center justify-between p-4 sm:p-6"><FaithLogo /><LocaleSwitcher persist /></div>
      <main id="main" className="mx-auto max-w-3xl px-4 pt-4 pb-20 sm:px-6">
        <IntlScope ns={['onboarding']}><OnboardingStepper /></IntlScope>
      </main>
    </div>
  );
}
