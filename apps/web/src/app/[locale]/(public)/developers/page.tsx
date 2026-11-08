import { Card, LinkButton, SectionTitle } from '@/components/ui/primitives';
import { API_SCOPES, WEBHOOK_EVENTS } from '@/lib/app-permissions';
import { getTranslations } from 'next-intl/server';

const code = `import { FaithClient, verifyWebhook } from '@faith/sdk';

const faith = new FaithClient({ apiKey: process.env.FAITH_API_KEY });
const { items } = await faith.products();

// In your webhook handler:
const event = verifyWebhook({
  body: rawBody,
  signature: req.headers['x-faith-signature'],
  timestamp: req.headers['x-faith-timestamp'],
  secret: process.env.FAITH_WEBHOOK_SECRET,
});`;

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('developers.title') };
}

export default async function DevelopersPage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <h1 className="tracking-display text-[length:var(--text-title)] font-semibold">{t('developers.title')}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t('developers.body')}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <LinkButton href="/app/developer">{t('developers.start')}</LinkButton>
        <LinkButton href="/apps" variant="secondary">{t('nav.apps')}</LinkButton>
      </div>
      <pre dir="ltr" className="mt-10 overflow-x-auto rounded-lg bg-black p-5 font-mono text-[0.8125rem] leading-relaxed text-[#D3D3D6]"><code>{code}</code></pre>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {(['keys', 'webhooks', 'sandbox'] as const).map((k) => (
          <Card key={k} className="p-5"><h2 className="font-sans font-semibold">{t(`developers.${k}Title`)}</h2><p className="mt-1.5 text-sm text-muted">{t(`developers.${k}Body`)}</p></Card>
        ))}
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section><SectionTitle title={t('app.developer.scopes')} /><ul className="space-y-1 font-mono text-[0.8125rem] text-muted">{API_SCOPES.map((s) => <li key={s}>{s}</li>)}</ul></section>
        <section><SectionTitle title={t('app.developer.events')} /><ul className="space-y-1 font-mono text-[0.8125rem] text-muted">{WEBHOOK_EVENTS.map((s) => <li key={s}>{s}</li>)}</ul></section>
      </div>
      <p className="mt-10 text-sm text-muted">{t('developers.security')}</p>
    </div>
  );
}
