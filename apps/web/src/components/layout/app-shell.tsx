import { Link } from '@/i18n/navigation';
import { getMeta } from '@/lib/api';
import type { Me } from '@/lib/types';
import {
  BarChart3, Bell, BookOpen, Bot, Briefcase, Code2, CreditCard, FileCheck2, FolderKanban, Heart, KeyRound, Layers, Library,
  LayoutDashboard, Megaphone, MessageSquare, Package, Plus, Receipt, ScrollText, Search, Settings, ShieldCheck, Sparkles, Store,
  Users, Wallet, Webhook, Workflow, type LucideIcon, FlaskConical, LifeBuoy, Gavel,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { RouteTransition } from '../motion/fx';
import { FaithLogo } from '../ui/logo';
import { CartLink, CommandPalette, LocaleSwitcher, NotificationLink, ThemeToggle, UserAvatarMenu, WorkspaceSwitcher } from './controls';
import { SidebarDrawer, SidebarLink } from './sidebar';

type Item = { href: string; key: string; icon: LucideIcon; exact?: boolean };

const WORKSPACE_ITEMS: Record<string, Item[]> = {
  buyer: [
    { href: '/app', key: 'overview', icon: LayoutDashboard, exact: true }, { href: '/app/explore', key: 'discover', icon: Search },
    { href: '/app/orders', key: 'orders', icon: Receipt }, { href: '/app/library', key: 'library', icon: Library }, { href: '/app/wishlist', key: 'wishlist', icon: Heart },
  ],
  seller: [
    { href: '/app/seller', key: 'overview', icon: LayoutDashboard, exact: true }, { href: '/app/seller/store', key: 'store', icon: Store },
    { href: '/app/seller/products', key: 'products', icon: Package }, { href: '/app/seller/orders', key: 'orders', icon: Receipt },
    { href: '/app/seller/customers', key: 'customers', icon: Users }, { href: '/app/seller/analytics', key: 'analytics', icon: BarChart3 },
    { href: '/app/seller/earnings', key: 'earnings', icon: Wallet }, { href: '/app/seller/growth', key: 'growth', icon: Megaphone },
  ],
  creator: [
    { href: '/app/creator', key: 'overview', icon: LayoutDashboard, exact: true }, { href: '/app/creator/content', key: 'content', icon: Layers },
    { href: '/app/creator/campaigns', key: 'campaigns', icon: Megaphone }, { href: '/app/creator/submissions', key: 'submissions', icon: FileCheck2 },
    { href: '/app/creator/earnings', key: 'earnings', icon: Wallet }, { href: '/app/creator/courses', key: 'courses', icon: BookOpen },
    { href: '/app/creator/community', key: 'community', icon: Users },
  ],
  work: [
    { href: '/app/work', key: 'overview', icon: LayoutDashboard, exact: true }, { href: '/app/work/applications', key: 'applications', icon: FileCheck2 },
    { href: '/app/work/portfolio', key: 'portfolio', icon: FolderKanban },
  ],
  freelance: [
    { href: '/app/freelance', key: 'overview', icon: LayoutDashboard, exact: true }, { href: '/app/freelance/services', key: 'services', icon: Briefcase },
    { href: '/app/freelance/projects', key: 'projects', icon: FolderKanban },
  ],
  brand: [
    { href: '/app/brand', key: 'overview', icon: LayoutDashboard, exact: true }, { href: '/app/brand/campaigns', key: 'campaigns', icon: Megaphone },
    { href: '/app/brand/campaigns/new', key: 'newCampaign', icon: Plus, exact: true }, { href: '/app/brand/creators', key: 'creators', icon: Users },
    { href: '/app/brand/analytics', key: 'analytics', icon: BarChart3 }, { href: '/app/brand/budget', key: 'budget', icon: Wallet },
    { href: '/app/brand/hiring', key: 'hiring', icon: Briefcase },
  ],
  developer: [
    { href: '/app/developer', key: 'overview', icon: LayoutDashboard, exact: true }, { href: '/app/developer/apps', key: 'apps', icon: Code2 },
    { href: '/app/developer/keys', key: 'keys', icon: KeyRound }, { href: '/app/developer/webhooks', key: 'webhooks', icon: Webhook },
    { href: '/app/developer/analytics', key: 'analytics', icon: BarChart3 },
  ],
};

const SHARED: Item[] = [
  { href: '/app/messages', key: 'messages', icon: MessageSquare }, { href: '/app/notifications', key: 'notifications', icon: Bell },
  { href: '/app/ai', key: 'ai', icon: Sparkles }, { href: '/app/automations', key: 'automations', icon: Workflow },
  { href: '/app/billing', key: 'billing', icon: CreditCard }, { href: '/app/settings', key: 'settings', icon: Settings },
];

const ADMIN_ITEMS: (Item & { permission: string })[] = [
  { href: '/admin', key: 'overview', icon: LayoutDashboard, exact: true, permission: 'admin.finance.read' },
  { href: '/admin/users', key: 'users', icon: Users, permission: 'admin.users.read' },
  { href: '/admin/marketplace', key: 'marketplace', icon: Store, permission: 'admin.marketplace.moderate' },
  { href: '/admin/rewards', key: 'rewards', icon: Megaphone, permission: 'admin.rewards.moderate' },
  { href: '/admin/finance', key: 'finance', icon: Wallet, permission: 'admin.finance.read' },
  { href: '/admin/apps', key: 'apps', icon: Code2, permission: 'admin.apps.review' },
  { href: '/admin/moderation', key: 'moderation', icon: Gavel, permission: 'admin.jobs.moderate' },
  { href: '/admin/support', key: 'support', icon: LifeBuoy, permission: 'admin.support' },
  { href: '/admin/settings', key: 'settings', icon: Settings, permission: 'admin.settings.write' },
  { href: '/admin/lab', key: 'lab', icon: FlaskConical, permission: 'admin.flags.write' },
  { href: '/admin/audit', key: 'audit', icon: ScrollText, permission: 'admin.audit.read' },
];

function Topbar({ me, cartLabel, notificationsLabel, drawer }: { me: Me; cartLabel: string; notificationsLabel: string; drawer: ReactNode }) {
  return (
    <header className="vt-topbar sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-bg/75 px-3 backdrop-blur-xl backdrop-saturate-150 sm:px-5">
      {drawer}
      <div className="ms-auto flex items-center gap-1">
        <CommandPalette />
        <LocaleSwitcher persist />
        <ThemeToggle className="hidden sm:grid" />
        <CartLink count={me.cartCount} label={cartLabel} />
        <NotificationLink count={me.unreadNotifications} label={notificationsLabel} />
        <span className="ms-1.5"><UserAvatarMenu name={me.profile?.displayName ?? me.email} email={me.email} isStaff={me.permissions.includes('admin.access')} /></span>
      </div>
    </header>
  );
}

export async function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const [t, meta] = await Promise.all([getTranslations(), getMeta()]);
  const active = me.activeWorkspace === 'admin' ? 'buyer' : me.activeWorkspace;
  const items = WORKSPACE_ITEMS[active] ?? WORKSPACE_ITEMS.buyer!;
  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/" aria-label={t('nav.home')} className="px-2 pt-1.5"><FaithLogo /></Link>
      <WorkspaceSwitcher active={active} workspaces={me.workspaces} />
      <nav aria-label={t('nav.workspace')} className="flex-1 overflow-y-auto">
        <ul className="space-y-0.5">
          {items.map((i) => <li key={i.href}><SidebarLink href={i.href} exact={i.exact} label={t(`nav.items.${i.key}`)} icon={<i.icon size={16} strokeWidth={1.6} />} /></li>)}
        </ul>
        <p className="eyebrow mt-5 mb-1.5 px-2.5">{t('nav.tools')}</p>
        <ul className="space-y-0.5">
          {SHARED.map((i) => <li key={i.href}><SidebarLink href={i.href} label={t(`nav.items.${i.key}`)} icon={<i.icon size={16} strokeWidth={1.6} />} /></li>)}
        </ul>
      </nav>
      {me.plan.key === 'free' && (
        <Link href="/app/billing" className="hover-depth flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--neon)_25%,transparent)] bg-[color-mix(in_srgb,var(--neon)_6%,transparent)] p-2.5 text-[0.8125rem] text-ink">
          <Bot size={15} strokeWidth={1.6} />{t('nav.upgrade')}
        </Link>
      )}
    </div>
  );
  return (
    <div className="flex min-h-svh">
      <aside className="vt-sidebar sticky top-0 hidden h-svh w-60 shrink-0 border-e border-line bg-[linear-gradient(180deg,color-mix(in_srgb,var(--neon)_4%,var(--surface)),var(--surface)_30%)] lg:block">{sidebar}</aside>
      <div className="min-w-0 flex-1">
        <Topbar me={me} cartLabel={t('nav.cart')} notificationsLabel={t('nav.notifications')} drawer={<SidebarDrawer label={t('nav.menu')}>{sidebar}</SidebarDrawer>} />
        {(meta?.mockPayments || meta?.demoData) && <p data-testid="demo-banner" className="border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] bg-[color-mix(in_srgb,var(--neon)_7%,var(--bg))] px-5 py-1.5 font-mono text-[0.7rem] tracking-wide text-[color-mix(in_srgb,var(--neon)_75%,var(--text))]">{t('common.demoBanner')}</p>}
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"><RouteTransition>{children}</RouteTransition></main>
      </div>
    </div>
  );
}

export async function AdminShell({ me, children }: { me: Me; children: ReactNode }) {
  const t = await getTranslations();
  const items = ADMIN_ITEMS.filter((i) => me.permissions.includes(i.permission));
  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/" aria-label={t('nav.home')} className="px-2 pt-1.5"><FaithLogo /></Link>
      <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-[0.7rem] tracking-wide text-muted uppercase"><ShieldCheck size={14} className="text-neon" />{t('admin.console')}</p>
      <nav aria-label={t('admin.console')} className="flex-1 overflow-y-auto">
        <ul className="space-y-0.5">
          {items.map((i) => <li key={i.href}><SidebarLink href={i.href} exact={i.exact} label={t(`admin.nav.${i.key}`)} icon={<i.icon size={16} strokeWidth={1.6} />} /></li>)}
        </ul>
      </nav>
      <Link href="/app" className="px-2.5 py-2 text-[0.8125rem] text-muted hover:text-ink">{t('admin.exit')}</Link>
    </div>
  );
  return (
    <div className="flex min-h-svh">
      <aside className="vt-sidebar sticky top-0 hidden h-svh w-60 shrink-0 border-e border-line bg-[linear-gradient(180deg,color-mix(in_srgb,var(--neon)_4%,var(--surface)),var(--surface)_30%)] lg:block">{sidebar}</aside>
      <div className="min-w-0 flex-1">
        <Topbar me={me} cartLabel={t('nav.cart')} notificationsLabel={t('nav.notifications')} drawer={<SidebarDrawer label={t('nav.menu')}>{sidebar}</SidebarDrawer>} />
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"><RouteTransition>{children}</RouteTransition></main>
      </div>
    </div>
  );
}
