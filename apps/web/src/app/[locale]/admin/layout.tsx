import { IntlScope } from '@/components/auth/scope';
import { AdminShell } from '@/components/layout/app-shell';
import { redirect } from '@/i18n/navigation';
import { getMe } from '@/lib/api';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

/** This check only avoids rendering a useless shell. Every admin API route enforces its own. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [me, locale] = await Promise.all([getMe(), getLocale()]);
  if (!me) return redirect({ href: '/login?next=/admin', locale });
  if (!me.permissions.includes('admin.access')) notFound();
  return <AdminShell me={me}><IntlScope ns={['admin', 'app']}>{children}</IntlScope></AdminShell>;
}
