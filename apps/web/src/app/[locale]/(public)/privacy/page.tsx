import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('legal.privacyTitle') };
}

export default async function PrivacyPage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="tracking-display text-4xl font-semibold">{t('legal.privacyTitle')}</h1>
      <p className="mt-4 rounded-md border border-dashed border-line-strong p-3 text-sm text-muted">{t('legal.draft')}</p>
      <div className="prose-faith mt-6 text-muted">
        <p>{t('legal.privacy1')}</p>
        <p>{t('legal.privacy2')}</p>
        <p>{t('legal.privacy3')}</p>
      </div>
    </div>
  );
}
