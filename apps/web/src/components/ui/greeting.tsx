'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Key = 'greeting' | 'greetMorning' | 'greetAfternoon' | 'greetEvening';

/**
 * "Good afternoon, Aziza", in the visitor's own time of day. The server does not know the
 * visitor's clock, so the neutral greeting renders first and the timed one replaces it.
 */
export function Greeting({ name }: { name: string }) {
  const t = useTranslations();
  const [key, setKey] = useState<Key>('greeting');
  useEffect(() => {
    const h = new Date().getHours();
    setKey(h >= 5 && h < 12 ? 'greetMorning' : h >= 12 && h < 18 ? 'greetAfternoon' : 'greetEvening');
  }, []);
  return <>{t(`app.home.${key}`, { name })}</>;
}
