import { LoginForm } from '@/components/auth/forms';
import { tryPublicApi } from '@/lib/api';
import { ShieldAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('auth.loginTitle') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const [t, { next, reason }, providers] = await Promise.all([getTranslations(), searchParams, tryPublicApi<{ google: boolean; apple: boolean }>('/auth/providers', 60)]);
  return (
    <>
      <h1 className="font-display text-[1.7rem] leading-tight font-semibold tracking-tight">{t('auth.loginTitle')}</h1>
      <p className="mt-1.5 mb-6 text-sm text-white/55">{t('auth.loginBody')}</p>
      {(reason === 'replaced' || reason === 'blocked') && (
        <p role="alert" data-testid="login-reason" className="mb-5 flex gap-2.5 rounded-2xl border border-white/15 bg-white/[0.04] p-3.5 text-sm text-white/80">
          <ShieldAlert size={18} className="mt-px shrink-0 text-warning" />
          {reason === 'replaced' ? t('auth.replacedNotice') : t('auth.blockedNotice')}
        </p>
      )}
      <LoginForm next={next} oauth={providers ?? { google: false }} />
    </>
  );
}
