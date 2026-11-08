import { LinkButton } from '@/components/ui/primitives';
import { FaithMark } from '@/components/ui/logo';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main id="main" className="grid min-h-svh place-items-center p-6 text-center">
      <div>
        <FaithMark size={40} className="mx-auto" />
        <h1 className="mt-6 text-2xl font-semibold">{t('common.notFoundTitle')}</h1>
        <p className="mt-2 text-muted">{t('common.notFoundBody')}</p>
        <LinkButton href="/" className="mt-6">{t('nav.home')}</LinkButton>
      </div>
    </main>
  );
}
