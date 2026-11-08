import { DEFAULT_LOCALE, LOCALES } from '@faith/config';
import { defineRouting } from 'next-intl/routing';

/** Uzbek is the default and has no URL prefix; every other language lives under /{locale}. */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeDetection: false,
});
