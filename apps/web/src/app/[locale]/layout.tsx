import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import '@fontsource-variable/onest/index.css';
import '@fontsource-variable/alexandria/index.css';
import '../globals.css';
import { NavProgress, PointerFx } from '@/components/motion/fx';
import { Toaster } from '@/components/ui/client';
import { routing } from '@/i18n/routing';
import { RTL_LOCALES, Locale } from '@faith/config';
import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    metadataBase: new URL(SITE),
    title: { default: `FAITH: ${t('brand.philosophy')}`, template: '%s · FAITH' },
    description: t('brand.vision'),
    icons: { icon: '/icons/favicon-32.png', apple: '/icons/apple-touch-icon.png' },
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, l === routing.defaultLocale ? '/' : `/${l}`])),
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#000000',
};

/** Runs before paint. FAITH is black by default; light is an explicit choice, kept per device. */
const themeScript = `(function(){try{var s=localStorage.getItem('faith-theme');document.documentElement.dataset.theme=s==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}})()`;

/** Same moment: motion follows the system's reduce-motion setting unless the visitor chose otherwise. */
const motionScript = `(function(){var m='auto';try{var v=localStorage.getItem('faith-motion');if(v==='on'||v==='off')m=v}catch(e){}var os=window.matchMedia('(prefers-reduced-motion: reduce)').matches;var r=document.documentElement;r.dataset.motion=m;r.dataset.reduced=String(m==='off'||(m==='auto'&&os))})()`;

const CLIENT_NAMESPACES = ['common', 'errors', 'status', 'nav'] as const;

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const clientMessages = Object.fromEntries(CLIENT_NAMESPACES.map((n) => [n, messages[n]]));
  return (
    <html lang={locale} data-theme="dark" dir={RTL_LOCALES.includes(locale as Locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
      </head>
      <body>
        <NextIntlClientProvider messages={clientMessages}>
          <Suspense fallback={null}><NavProgress /></Suspense>
          <PointerFx />
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
