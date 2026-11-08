'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { X } from 'lucide-react';

/** Sign up / Sign in switch with a sliding pill, and the close button that leads home. */
export function AuthChrome({ signUp, signIn, close, label }: { signUp: string; signIn: string; close: string; label: string }) {
  const pathname = usePathname();
  const active = pathname.startsWith('/register') ? 0 : pathname.startsWith('/login') ? 1 : -1;
  return (
    <div className="mb-7 flex items-center justify-between gap-3">
      {active >= 0 ? (
        <nav aria-label={label} className="auth-tabs" data-active={active}>
          <i aria-hidden />
          <Link href="/register" aria-current={active === 0 ? 'page' : undefined}>{signUp}</Link>
          <Link href="/login" aria-current={active === 1 ? 'page' : undefined}>{signIn}</Link>
        </nav>
      ) : <span />}
      <Link href="/" aria-label={close} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/70 ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.12] hover:text-white">
        <X size={17} strokeWidth={1.8} />
      </Link>
    </div>
  );
}
