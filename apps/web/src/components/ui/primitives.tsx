import { Link } from '@/i18n/navigation';
import type { ComponentProps, ReactNode } from 'react';
import { ArrowRight, ChevronRight, Inbox, TriangleAlert } from 'lucide-react';

export const cx = (...v: (string | false | null | undefined)[]) => v.filter(Boolean).join(' ');

export const fieldClass = {
  input: 'fx-input',
  label: 'mb-1.5 block text-[0.8125rem] font-medium text-muted',
};

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/** Every button shares one light effect; variants only change how much light rests in it. */
export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra?: string) => cx('fx-btn', `fx-${variant}`, `fx-${size}`, extra);

const Arrow = () => <ArrowRight size={16} strokeWidth={1.8} aria-hidden className="fx-arrow flip-rtl" />;

export function Button({ variant, size, className, arrow, children, ...p }: ComponentProps<'button'> & { variant?: Variant; size?: Size; arrow?: boolean }) {
  return <button type="button" {...p} className={buttonClass(variant, size, className)}>{children}{arrow && <Arrow />}</button>;
}

export function LinkButton({ variant, size, className, arrow, children, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; arrow?: boolean }) {
  return <Link {...p} className={buttonClass(variant, size, className)}>{children}{arrow && <Arrow />}</Link>;
}

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  positive: 'bg-[color-mix(in_srgb,var(--positive)_13%,transparent)] text-positive',
  warning: 'bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-warning',
  negative: 'bg-[color-mix(in_srgb,var(--negative)_13%,transparent)] text-negative',
  accent: 'bg-accent-soft text-accent',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

const STATUS_TONES: Record<string, Tone> = {
  PAID: 'positive', PUBLISHED: 'positive', ACTIVE: 'positive', APPROVED: 'positive', OPEN: 'positive', COMPLETED: 'positive', SUCCEEDED: 'positive', PROCESSED: 'positive', DELIVERED: 'positive', VISIBLE: 'positive', HIRED: 'positive', RESOLVED: 'positive', SHIPPED: 'positive', RUNNING: 'accent', CONFIRMED: 'negative',
  PENDING: 'warning', PENDING_PAYMENT: 'warning', REQUESTED: 'warning', SUBMITTED: 'warning', IN_REVIEW: 'warning', PENDING_REVIEW: 'warning', APPLIED: 'warning', APPEALED: 'warning', PARTIALLY_REFUNDED: 'warning', REVIEWING: 'warning', SHORTLISTED: 'accent', INTERVIEW: 'accent', OFFER: 'accent', PAUSED: 'warning', PAST_DUE: 'warning', DISPUTED: 'warning', CHANGES_REQUESTED: 'warning',
  REJECTED: 'negative', FAILED: 'negative', PAYMENT_FAILED: 'negative', SUSPENDED: 'negative', REVOKED: 'negative', REVERSED: 'negative', HIGH: 'negative', BANNED: 'negative', ROLLED_BACK: 'negative', DENIED: 'negative',
};

/** Status label. `label` comes from the dictionary, so the badge stays translated. */
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{label}</Badge>;
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div {...p} className={cx('card', className)} />;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A number that matters, with an optional icon. Lifts toward the pointer like the glass reference. */
export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="lift min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[0.8125rem] text-muted">{label}</p>
        {icon && <span aria-hidden className="stat-icon shrink-0">{icon}</span>}
      </div>
      <p className="mt-2 truncate font-display text-[1.7rem] font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-subtle">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-14 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-md bg-surface-2 text-subtle">{icon ?? <Inbox size={20} strokeWidth={1.5} />}</span>
      <h3 className="text-[0.95rem] font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-lg border border-line-strong px-6 py-14 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-md bg-surface-2 text-negative"><TriangleAlert size={20} strokeWidth={1.5} /></span>
      <h3 className="text-[0.95rem] font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />;
}

export function LoadingPage({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-72" />
    </div>
  );
}

export type Crumb = { label: string; href?: string };
export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-5 flex flex-wrap items-center gap-1 text-[0.8125rem] text-muted">
      {items.map((c, i) => (
        <span key={c.label} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={13} className="flip-rtl text-subtle" aria-hidden />}
          {c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span aria-current="page" className="text-ink">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export type Column<T> = { header: string; cell: (row: T) => ReactNode; align?: 'start' | 'end'; className?: string };

/** Semantic table. Wide tables scroll inside their own frame, never the page. */
export function DataTable<T>({ rows, columns, rowKey, caption }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; caption: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-start">
            {columns.map((c) => (
              <th key={c.header} scope="col" className={cx('px-4 py-2.5 text-xs font-medium whitespace-nowrap text-subtle', c.align === 'end' ? 'text-end' : 'text-start')}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line last:border-0 hover:bg-surface-2/50">
              {columns.map((c) => (
                <td key={c.header} className={cx('px-4 py-3 align-middle', c.align === 'end' && 'text-end', c.className)}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, hrefFor, labels }: { page: number; pages: number; hrefFor: (p: number) => string; labels: { previous: string; next: string; page: string } }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={labels.page} className="mt-6 flex items-center justify-between gap-3 text-sm">
      {page > 1 ? <LinkButton variant="secondary" size="sm" href={hrefFor(page - 1)}>{labels.previous}</LinkButton> : <span />}
      <span className="text-muted tabular-nums">{page} / {pages}</span>
      {page < pages ? <LinkButton variant="secondary" size="sm" href={hrefFor(page + 1)}>{labels.next}</LinkButton> : <span />}
    </nav>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[0.95rem] font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function SimulatedNotice({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-line-strong bg-surface-2 px-3 py-2 text-[0.8125rem] text-muted">{children}</p>;
}
