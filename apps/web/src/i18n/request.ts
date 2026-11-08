import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'Asia/Tashkent',
    // A missing key is a bug the i18n check should catch, never English shown in another language.
    getMessageFallback: ({ key }) => key,
    onError: (error) => {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] ${error.message}`);
    },
  };
});
