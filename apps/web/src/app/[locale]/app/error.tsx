'use client';

import { Button, ErrorState } from '@/components/ui/primitives';
import { useTranslations } from 'next-intl';

export default function AppError({ reset }: { reset: () => void }) {
  const t = useTranslations();
  return <ErrorState title={t('common.errorTitle')} description={t('common.errorBody')} action={<Button variant="secondary" onClick={reset}>{t('common.retry')}</Button>} />;
}
