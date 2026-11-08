import { LoginForm } from '@/components/auth/forms';
import { tryPublicApi } from '@/lib/api';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('auth.loginTitle') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [t, { next }, providers] = await Promise.all([getTranslations(), searchParams, tryPublicApi<{ google: boolean; apple: boolean }>('/auth/providers', 60)]);
  return (
    <>
      <h1 className="font-display text-[1.7rem] leading-tight font-semibold tracking-tight">{t('auth.loginTitle')}</h1>
      <p className="mt-1.5 mb-6 text-sm text-white/55">{t('auth.loginBody')}</p>
      <LoginForm next={next} oauth={providers ?? { google: false }} />
    </>
  );
}
