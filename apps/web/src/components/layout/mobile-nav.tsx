'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { ReactNode, useEffect, useState } from 'react';
import { cx } from '../ui/primitives';

/** Top-level links. The current section carries a neon underline that slides in. */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-0.5 xl:flex">
      {links.map((l) => {
        const on = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <li key={l.href}>
            <Link href={l.href} aria-current={on ? 'page' : undefined} className={cx('group relative rounded-full px-3 py-1.5 text-[0.84rem] transition-colors', on ? 'text-ink' : 'text-muted hover:text-ink')}>
              {l.label}
              <span aria-hidden className={cx('absolute inset-x-3 -bottom-0.5 h-px origin-center bg-neon shadow-[0_0_10px_var(--neon)] transition-transform duration-500 ease-[var(--ease-out)]', on ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-60')} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Transparent over the hero, then solid once the page scrolls. */
export function NavScrollFrame({ overlay, children }: { overlay: boolean; children: ReactNode }) {
  const [solid, setSolid] = useState(!overlay);
  useEffect(() => {
    if (!overlay) return;
    const update = () => setSolid(window.scrollY > window.innerHeight - 80);
    update();
    addEventListener('scroll', update, { passive: true });
    return () => removeEventListener('scroll', update);
  }, [overlay]);
  return (
    <header
      data-theme={overlay && !solid ? 'dark' : undefined}
      className={cx('vt-header z-70 w-full transition-[background-color,border-color,backdrop-filter] duration-500', overlay ? 'fixed inset-x-0 top-0' : 'sticky top-0', solid ? 'border-b border-line bg-bg/75 backdrop-blur-xl backdrop-saturate-150' : 'border-b border-transparent bg-transparent text-white')}
    >
      {children}
    </header>
  );
}

export function MobileNavigation({ links, label, closeLabel, icon }: { links: { href: string; label: string }[]; label: string; closeLabel: string; icon: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label={label} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink xl:hidden">{icon}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="animate-rise fixed inset-y-0 end-0 z-90 w-[min(20rem,86vw)] overflow-y-auto border-s border-line bg-bg/95 p-5 shadow-3 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="font-display font-semibold">{label}</Dialog.Title>
            <Dialog.Description className="sr-only">{label}</Dialog.Description>
            <Dialog.Close aria-label={closeLabel} className="grid size-9 place-items-center rounded-md text-muted hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <ul className="space-y-0.5">
            {links.map((l) => (
              <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-[0.95rem] hover:bg-surface-2">{l.label}</Link></li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
