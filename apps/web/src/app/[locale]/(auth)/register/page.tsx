import { RegisterForm } from '@/components/auth/forms';
import { getMeta, tryPublicApi } from '@/lib/api';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('auth.registerTitle') };
}

export default async function RegisterPage() {
  const [t, providers, meta] = await Promise.all([getTranslations(), tryPublicApi<{ google: boolean }>('/auth/providers', 60), getMeta()]);
  return (
    <>
      <h1 className="font-display text-[1.7rem] leading-tight font-semibold tracking-tight">{t('auth.registerTitle')}</h1>
      <p className="mt-1.5 mb-6 text-sm text-white/55">{t('auth.registerBody')}</p>
      <RegisterForm oauth={providers ?? { google: false }} demo={!!meta?.publicDemo} />
    </>
  );
}
