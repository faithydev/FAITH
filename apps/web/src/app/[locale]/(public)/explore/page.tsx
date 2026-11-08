import { Link } from '@/i18n/navigation';
import { ArrowUpRight, BookOpen, Briefcase, Code2, Megaphone, Store, Users, Wrench, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const AREAS = [
  { href: '/marketplace', key: 'marketplace', icon: Store }, { href: '/rewards', key: 'rewards', icon: Megaphone },
  { href: '/jobs', key: 'jobs', icon: Briefcase }, { href: '/services', key: 'services', icon: Wrench },
  { href: '/courses', key: 'courses', icon: BookOpen }, { href: '/communities', key: 'communities', icon: Users },
  { href: '/creators', key: 'creators', icon: Sparkles }, { href: '/apps', key: 'apps', icon: Code2 },
] as const;

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('nav.explore') };
}

export default async function ExplorePublicPage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="tracking-display text-[length:var(--text-title)] font-semibold">{t('explore.title')}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t('explore.body')}</p>
      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
        {AREAS.map((a) => (
          <Link key={a.href} href={a.href} className="group bg-surface p-6 transition-colors hover:bg-surface-2">
            <div className="flex items-center justify-between"><a.icon size={20} strokeWidth={1.5} /><ArrowUpRight size={16} className="flip-rtl text-subtle transition-colors group-hover:text-ink" /></div>
            <h2 className="mt-8 font-sans text-[1.05rem] font-semibold">{t(`explore.areas.${a.key}.title`)}</h2>
            <p className="mt-1 text-sm text-muted">{t(`explore.areas.${a.key}.body`)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
