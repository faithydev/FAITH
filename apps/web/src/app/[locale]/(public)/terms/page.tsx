import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('legal.termsTitle') };
}

export default async function TermsPage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="tracking-display text-4xl font-semibold">{t('legal.termsTitle')}</h1>
      <p className="mt-4 rounded-md border border-dashed border-line-strong p-3 text-sm text-muted">{t('legal.draft')}</p>
      <div className="prose-faith mt-6 text-muted">
        <p>{t('legal.terms1')}</p>
        <p>{t('legal.terms2')}</p>
        <p>{t('legal.terms3')}</p>
      </div>
    </div>
  );
}
