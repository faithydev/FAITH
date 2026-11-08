import { AICommandPanel } from '@/components/ai/panel';
import { Badge, PageHeader, SectionTitle, SimulatedNotice } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Status = { provider: string; live: boolean; capabilities: { key: string; pro: boolean }[] };
type History = { id: string; capability: string; actionClass: string; status: string; createdAt: string };

export default async function AiPage() {
  const { t, me, d, status: label, locale } = await pageContext();
  const [status, history] = await Promise.all([api<Status>('/ai/status'), api<History[]>('/ai/history')]);
  const isPro = me.features.includes('ai.businessTools');
  return (
    <>
      <PageHeader title={t('app.ai.title')} description={t('app.ai.body')} />
      {!status.live && <div className="mb-5"><SimulatedNotice>{t('app.ai.demoNotice')}</SimulatedNotice></div>}
      <AICommandPanel capabilities={status.capabilities.map((c) => ({ key: c.key, label: t(`app.ai.capabilities.${c.key}`), locked: c.pro && !isPro }))} locale={locale} />
      <section className="mt-10">
        <SectionTitle title={t('app.ai.history')} />
        {history.length === 0 ? <p className="text-sm text-muted">{t('app.ai.noHistory')}</p> : (
          <ul className="card divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>{t.has(`app.ai.capabilities.${h.capability}`) ? t(`app.ai.capabilities.${h.capability}`) : h.capability}</span>
                <span className="flex items-center gap-2"><Badge>{t(`app.ai.classes.${h.actionClass}`)}</Badge><Badge>{label(h.status)}</Badge><span className="text-xs text-subtle">{d(h.createdAt)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
