import { DownloadButton } from '@/components/commerce/download-button';
import { Card, EmptyState, LinkButton, PageHeader } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { fileSize } from '@/lib/format';
import { pageContext } from '@/lib/page';
import type { LibraryItem } from '@/lib/types';

export default async function LibraryPage() {
  const { t, d } = await pageContext();
  const items = await api<LibraryItem[]>('/library');
  return (
    <>
      <PageHeader title={t('app.library.title')} description={t('app.library.body')} />
      {items.length === 0 ? (
        <EmptyState title={t('app.library.emptyTitle')} description={t('app.library.emptyBody')} action={<LinkButton href="/marketplace">{t('cart.browse')}</LinkButton>} />
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <Card key={e.id} className="p-4 sm:p-5" data-testid="library-item">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/marketplace/${e.product.slug}`} className="font-semibold hover:underline">{e.product.title}</Link>
                  <p className="mt-0.5 text-xs text-muted">{t('app.library.granted', { date: d(e.grantedAt) })}</p>
                </div>
                <div className="flex gap-2">
                  {e.product.course && <LinkButton size="sm" variant="secondary" href={`/courses/${e.product.course.slug}`}>{t('app.library.openCourse')}</LinkButton>}
                  {e.product.community && <LinkButton size="sm" variant="secondary" href={`/communities/${e.product.community.slug}`}>{t('app.library.openCommunity')}</LinkButton>}
                </div>
              </div>
              {e.product.assets.length > 0 && (
                <ul className="mt-3 divide-y divide-line rounded-md border border-line">
                  {e.product.assets.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{a.filename} <span className="text-xs text-subtle">{fileSize(a.sizeBytes)}</span></span>
                      <DownloadButton entitlementId={e.id} assetId={a.id} label={t('app.library.download')} />
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted">{t('app.library.licence')}</summary>
                <p className="mt-2 font-mono text-xs break-all">{e.licenseKey}</p>
                {e.licenseTerms?.terms && <p className="mt-1.5 text-xs text-muted">{e.licenseTerms.terms}</p>}
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
