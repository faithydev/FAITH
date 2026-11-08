import { AutoForm } from '@/components/ui/client';
import { Card, LinkButton, SectionTitle } from '@/components/ui/primitives';
import { getMe } from '@/lib/api';
import { getTranslations } from 'next-intl/server';

const FAQ = ['fee', 'refund', 'payout', 'verify', 'languages'] as const;

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('help.title') };
}

export default async function HelpPage() {
  const [t, me] = await Promise.all([getTranslations(), getMe()]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="tracking-display text-[length:var(--text-title)] font-semibold">{t('help.title')}</h1>
      <div className="mt-8 divide-y divide-line border-y border-line">
        {FAQ.map((q) => (
          <details key={q} className="group py-4">
            <summary className="cursor-pointer font-medium">{t(`help.q.${q}`)}</summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t(`help.a.${q}`)}</p>
          </details>
        ))}
      </div>
      <Card className="mt-10 p-5">
        <SectionTitle title={t('help.contact')} />
        {me ? (
          <AutoForm
            endpoint="/support/tickets" submitLabel={t('help.send')} success={t('help.sent')} resetOnSuccess
            fields={[{ name: 'subject', label: t('admin.subject'), required: true }, { name: 'body', label: t('app.seller.description'), type: 'textarea', required: true }]}
          />
        ) : <LinkButton href="/login?next=/help" variant="secondary">{t('nav.login')}</LinkButton>}
      </Card>
    </div>
  );
}
