import { IntlScope } from '@/components/auth/scope';
import { AppShell } from '@/components/layout/app-shell';
import { redirect } from '@/i18n/navigation';
import { getMe } from '@/lib/api';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [me, locale] = await Promise.all([getMe(), getLocale()]);
  if (!me) return redirect({ href: '/login?next=/app', locale });
  if (!me.onboarded) return redirect({ href: '/onboarding', locale });
  return <AppShell me={me}><IntlScope ns={['app', 'auth']}>{children}</IntlScope></AppShell>;
}
