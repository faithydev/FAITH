'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { Menu } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { ReactNode, useEffect, useState } from 'react';
import { cx } from '../ui/primitives';

export function SidebarLink({ href, label, icon, exact }: { href: string; label: string; icon: ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const on = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={on ? 'page' : undefined} className={cx('side-link group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-[background-color,color] duration-200', on ? 'bg-[color-mix(in_srgb,var(--neon)_9%,transparent)] font-medium text-ink [&>svg]:text-neon' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
      {icon}<span className="truncate">{label}</span>
    </Link>
  );
}

export function SidebarDrawer({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label={label} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink lg:hidden"><Menu size={19} strokeWidth={1.7} /></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="animate-rise fixed inset-y-2 start-2 z-90 w-[min(17rem,84vw)] overflow-hidden rounded-[22px] border border-line bg-surface/85 shadow-3 backdrop-blur-2xl">
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <Dialog.Description className="sr-only">{label}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
