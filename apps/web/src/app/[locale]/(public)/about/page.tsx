import { FaithLockup } from '@/components/ui/logo';
import { LinkButton } from '@/components/ui/primitives';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('about.title') };
}

export default async function AboutPage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <FaithLockup height={64} />
      <h1 className="tracking-display mt-10 text-[length:var(--text-title)] leading-[1.06] font-semibold">{t('about.title')}</h1>
      <div className="prose-faith mt-6 text-lg text-muted">
        <p>{t('about.p1')}</p>
        <p>{t('about.p2')}</p>
        <p>{t('about.p3')}</p>
      </div>
      <LinkButton href="/register" size="lg" className="mt-6">{t('home.ctaStart')}</LinkButton>
    </div>
  );
}
