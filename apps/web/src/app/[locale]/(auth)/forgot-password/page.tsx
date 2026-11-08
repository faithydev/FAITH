import { ForgotForm } from '@/components/auth/forms';
import { getTranslations } from 'next-intl/server';

export default async function ForgotPasswordPage() {
  const t = await getTranslations();
  return (
    <>
      <h1 className="font-display text-[1.7rem] leading-tight font-semibold tracking-tight">{t('auth.forgotTitle')}</h1>
      <p className="mt-1.5 mb-6 text-sm text-white/55">{t('auth.forgotBody')}</p>
      <ForgotForm />
    </>
  );
}
