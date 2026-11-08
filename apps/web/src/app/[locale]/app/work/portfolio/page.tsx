import { ActionButton, FormDialog } from '@/components/ui/client';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';

type Item = { id: string; title: string; description: string | null; url: string | null };

export default async function PortfolioPage() {
  const { t } = await pageContext();
  const items = await api<Item[]>('/work/portfolio');
  return (
    <>
      <PageHeader
        title={t('nav.items.portfolio')}
        actions={
          <FormDialog
            trigger={t('common.add')} title={t('app.work.addProject')} endpoint="/work/portfolio" submitLabel={t('common.add')} success={t('common.saved')}
            fields={[
              { name: 'title', label: t('app.seller.productTitle'), required: true },
              { name: 'description', label: t('app.seller.description'), type: 'textarea' },
              { name: 'url', label: t('app.work.link'), type: 'url' },
            ]}
          />
        }
      />
      {items.length === 0 ? <EmptyState title={t('app.work.noPortfolio')} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <Card key={i.id} className="flex flex-col p-5">
              <p className="font-medium">{i.title}</p>
              {i.description && <p className="mt-1 text-sm text-muted">{i.description}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="truncate text-sm text-accent hover:underline">{i.url}</a> : <span />}
                <ActionButton endpoint={`/work/portfolio/${i.id}`} method="DELETE" label={t('common.remove')} variant="ghost" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
