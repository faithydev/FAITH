'use client';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { LOCALE_LABELS, LOCALES, Locale } from '@faith/config';
import { Command } from 'cmdk';
import { Bell, Check, ChevronsUpDown, Globe, LogOut, Moon, Search, ShoppingBag, Sun, User, Zap, ZapOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DropdownMenu, Dialog } from 'radix-ui';
import { useEffect, useRef, useState, useTransition } from 'react';
import { cx } from '../ui/primitives';
import { toast } from '../ui/client';
import { setMotion, useReducedMotion } from '../motion/preference';

const menuClass = 'animate-rise z-80 min-w-44 rounded-xl border border-line-strong bg-surface/95 p-1 shadow-3 backdrop-blur-xl';
const itemClass = 'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-highlighted:bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] data-highlighted:text-ink';
const iconButton = 'grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink';

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('faith-theme', next); } catch { /* storage may be unavailable */ }
  };
  return (
    <button onClick={toggle} aria-label={t('nav.toggleTheme')} className={cx(iconButton, className)}>
      <Sun size={17} strokeWidth={1.6} className="hidden dark:block" /><Moon size={17} strokeWidth={1.6} className="dark:hidden" />
    </button>
  );
}

/**
 * Turns the site's animation on or off for this device. It starts from the system setting, so a
 * computer with "animation effects" switched off sees a calm site until the visitor opts in here.
 */
export function MotionToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const reduced = useReducedMotion();
  return (
    <button
      type="button" onClick={() => setMotion(reduced ? 'on' : 'off')} aria-pressed={!reduced} aria-label={t('nav.toggleMotion')} title={t('nav.toggleMotion')}
      data-testid="motion-toggle" className={cx(iconButton, !reduced && 'text-neon hover:text-neon', className)}
    >
      {reduced ? <ZapOff size={17} strokeWidth={1.6} /> : <Zap size={17} strokeWidth={1.6} />}
    </button>
  );
}

export function LocaleSwitcher({ className, persist }: { className?: string; persist?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [, start] = useTransition();
  const pick = (next: Locale) => {
    if (persist) void clientApi('/me/preferences', { method: 'PATCH', body: { locale: next } }).catch(() => {});
    const search = typeof window === 'undefined' ? '' : window.location.search;
    start(() => router.replace(`${pathname}${search}`, { locale: next }));
  };
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger aria-label={t('nav.language')} className={cx('flex h-9 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] text-muted transition-colors hover:bg-surface-2 hover:text-ink', className)}>
        <Globe size={16} strokeWidth={1.6} /><span className="uppercase">{locale}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={menuClass}>
          {LOCALES.map((l) => (
            <DropdownMenu.Item key={l} onSelect={() => pick(l)} className={itemClass} lang={l}>
              <span className="w-4">{l === locale && <Check size={14} />}</span>{LOCALE_LABELS[l]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function CartLink({ count, label }: { count: number; label: string }) {
  return (
    <Link href="/cart" aria-label={label} className={cx(iconButton, 'relative')}>
      <ShoppingBag size={17} strokeWidth={1.6} />
      {count > 0 && <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-on-primary">{count}</span>}
    </Link>
  );
}

export function NotificationLink({ count, label }: { count: number; label: string }) {
  return (
    <Link href="/app/notifications" aria-label={label} className={cx(iconButton, 'relative')}>
      <Bell size={17} strokeWidth={1.6} />
      {count > 0 && <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-accent" />}
    </Link>
  );
}

export function UserAvatarMenu({ name, email, isStaff }: { name: string; email: string; isStaff: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const logout = async () => {
    await clientApi('/auth/logout', { method: 'POST', body: {} });
    router.push('/');
    router.refresh();
  };
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger aria-label={t('nav.account')} className="grid size-8 place-items-center rounded-full bg-primary text-[0.6875rem] font-semibold text-on-primary">{initials}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={cx(menuClass, 'min-w-56')}>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={itemClass}><Link href="/app"><User size={15} />{t('nav.dashboard')}</Link></DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}><Link href="/app/settings">{t('nav.settings')}</Link></DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}><Link href="/app/billing">{t('nav.billing')}</Link></DropdownMenu.Item>
          {isStaff && <DropdownMenu.Item asChild className={itemClass}><Link href="/admin">{t('nav.admin')}</Link></DropdownMenu.Item>}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={logout} className={itemClass}><LogOut size={15} />{t('nav.logout')}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const WORKSPACE_HOME: Record<string, string> = {
  buyer: '/app', seller: '/app/seller', creator: '/app/creator', work: '/app/work', freelance: '/app/freelance',
  brand: '/app/brand', developer: '/app/developer', admin: '/admin',
};

export function WorkspaceSwitcher({ active, workspaces }: { active: string; workspaces: string[] }) {
  const t = useTranslations();
  const router = useRouter();
  const pick = async (w: string) => {
    try {
      await clientApi('/me/preferences', { method: 'PATCH', body: { activeWorkspace: w } });
      router.push(WORKSPACE_HOME[w] ?? '/app');
      router.refresh();
    } catch {
      toast.error(t('errors.INTERNAL'));
    }
  };
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger data-testid="workspace-switcher" className="flex w-full items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-start text-sm hover:border-line-strong">
        <span className="min-w-0">
          <span className="block text-[0.6875rem] text-subtle">{t('nav.workspace')}</span>
          <span className="block truncate font-medium">{t(`nav.workspaces.${active}`)}</span>
        </span>
        <ChevronsUpDown size={14} className="shrink-0 text-subtle" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={cx(menuClass, 'w-(--radix-dropdown-menu-trigger-width)')}>
          {workspaces.map((w) => (
            <DropdownMenu.Item key={w} onSelect={() => pick(w)} className={itemClass}>
              <span className="w-4">{w === active && <Check size={14} />}</span>{t(`nav.workspaces.${w}`)}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={itemClass}><Link href="/app/settings#roles"><span className="w-4" />{t('nav.addRole')}</Link></DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type Results = { products: { slug: string; title: string }[]; jobs: { slug: string; title: string }[]; services: { slug: string; title: string }[]; campaigns: { slug: string; title: string }[]; apps: { slug: string; name: string }[] };

/** Global search and quick navigation. ⌘K or Ctrl+K from anywhere. */
export function CommandPalette({ dark }: { dark?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return setResults(null);
    timer.current = setTimeout(() => {
      void clientApi<Results>(`/search?q=${encodeURIComponent(q)}`).then(setResults).catch(() => setResults(null));
    }, 180);
    return () => clearTimeout(timer.current);
  }, [q]);

  const go = (href: string) => { setOpen(false); setQ(''); router.push(href); };
  const group = (heading: string, rows: { key: string; label: string; href: string }[]) => rows.length > 0 && (
    <Command.Group heading={heading} className="px-1 py-1 text-xs text-subtle [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5">
      {rows.map((r) => (
        <Command.Item key={r.key} value={`${heading}-${r.key}`} onSelect={() => go(r.href)} className="cursor-pointer rounded-sm px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-surface-2">{r.label}</Command.Item>
      ))}
    </Command.Group>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t('nav.search')} className={cx('flex h-9 items-center gap-2 rounded-md border px-2.5 text-[0.8125rem]', dark ? 'border-white/15 text-white/70 hover:border-white/30' : 'border-line text-muted hover:border-line-strong')}>
        <Search size={15} strokeWidth={1.7} /><span className="hidden lg:inline">{t('nav.search')}</span><kbd className="hidden rounded-xs border border-current/30 px-1 font-sans text-[0.625rem] lg:inline">⌘K</kbd>
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-90 bg-black/65 backdrop-blur-sm" />
          <Dialog.Content className="animate-rise fixed inset-x-3 top-[12vh] z-90 mx-auto max-w-xl overflow-hidden rounded-[22px] border border-line-strong bg-surface shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
            <Dialog.Title className="sr-only">{t('nav.search')}</Dialog.Title>
            <Dialog.Description className="sr-only">{t('nav.searchHint')}</Dialog.Description>
            <Command shouldFilter={false} label={t('nav.search')}>
              <Command.Input value={q} onValueChange={setQ} placeholder={t('nav.searchHint')} className="w-full border-b border-line bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-subtle" />
              <Command.List className="max-h-[50vh] overflow-y-auto p-1">
                {q.trim().length >= 2 && results && <Command.Empty className="p-6 text-center text-sm text-muted">{t('common.noResults')}</Command.Empty>}
                {group(t('nav.marketplace'), (results?.products ?? []).map((p) => ({ key: p.slug, label: p.title, href: `/marketplace/${p.slug}` })))}
                {group(t('nav.rewards'), (results?.campaigns ?? []).map((p) => ({ key: p.slug, label: p.title, href: `/rewards/${p.slug}` })))}
                {group(t('nav.jobs'), (results?.jobs ?? []).map((p) => ({ key: p.slug, label: p.title, href: `/jobs/${p.slug}` })))}
                {group(t('nav.services'), (results?.services ?? []).map((p) => ({ key: p.slug, label: p.title, href: `/services/${p.slug}` })))}
                {group(t('nav.apps'), (results?.apps ?? []).map((p) => ({ key: p.slug, label: p.name, href: `/apps/${p.slug}` })))}
                {!results && group(t('nav.quickLinks'), [
                  { key: 'm', label: t('nav.marketplace'), href: '/marketplace' }, { key: 'r', label: t('nav.rewards'), href: '/rewards' },
                  { key: 'j', label: t('nav.jobs'), href: '/jobs' }, { key: 'a', label: t('nav.apps'), href: '/apps' }, { key: 'd', label: t('nav.dashboard'), href: '/app' },
                ])}
              </Command.List>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
