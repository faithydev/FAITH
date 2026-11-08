import { LoadingPage } from '@/components/ui/primitives';
import { getTranslations } from 'next-intl/server';

export default async function Loading() {
  const t = await getTranslations();
  return <LoadingPage label={t('common.loading')} />;
}
