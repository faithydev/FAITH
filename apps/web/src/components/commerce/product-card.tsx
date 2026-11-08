import { Cover } from '@/components/ui/cover';
import { Badge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { fileUrl, money, rating } from '@/lib/format';
import type { ProductCard } from '@/lib/types';
import { Star } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';

/** Server-rendered card. `sponsored` shows the advertising label; it never changes rank. */
export async function ProductCardView({ product: p, sponsored }: { product: ProductCard; sponsored?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const score = rating(p.ratingSum, p.ratingCount);
  return (
    <Link href={`/marketplace/${p.slug}`} className="card hover-depth group flex flex-col overflow-hidden" data-testid="product-card">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        {p.coverKey
          ? <Image src={fileUrl(p.coverKey)} alt="" fill sizes="(max-width: 640px) 100vw, 25vw" unoptimized className="object-cover" />
          : <Cover seed={p.slug} />}
        {sponsored && <span className="absolute start-2 top-2"><Badge tone="warning" className="bg-surface!">{t('common.sponsored')}</Badge></span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-subtle">{p.store.name}</p>
        <h3 className="mt-1 line-clamp-2 font-sans text-[0.95rem] font-semibold">{p.title}</h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
          <span className="font-semibold tabular-nums">{money(p.priceFromMinor, p.currency, locale)}</span>
          {score && <span className="flex items-center gap-1 text-xs text-muted"><Star size={12} className="fill-current" />{score}</span>}
        </div>
      </div>
    </Link>
  );
}
