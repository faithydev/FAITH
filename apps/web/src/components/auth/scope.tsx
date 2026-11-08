import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

/** Sends one dictionary section to client components, so pages only ship the text they use. */
export async function IntlScope({ ns, children }: { ns: string[]; children: ReactNode }) {
  const messages = await getMessages();
  const picked = Object.fromEntries(['common', 'errors', 'status', 'nav', ...ns].map((n) => [n, messages[n]]));
  return <NextIntlClientProvider messages={picked}>{children}</NextIntlClientProvider>;
}
