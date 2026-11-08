import { VerifyEmail } from '@/components/auth/forms';
import { getTranslations } from 'next-intl/server';

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [t, { token }] = await Promise.all([getTranslations(), searchParams]);
  return (
    <>
      <h1 className="mb-6 font-display text-[1.7rem] leading-tight font-semibold tracking-tight">{t('auth.verifyTitle')}</h1>
      <VerifyEmail token={token} />
    </>
  );
}
