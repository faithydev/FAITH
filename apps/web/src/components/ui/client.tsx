'use client';

import { useRouter } from '@/i18n/navigation';
import { clientApi, newKey } from '@/lib/client';
import { ApiError } from '@/lib/errors';
import { toMinor } from '@faith/money';
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import { ReactNode, useId, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { create } from 'zustand';
import { Button, cx, fieldClass } from './primitives';

// --- Toasts -----------------------------------------------------------------

type Toast = { id: number; tone: 'success' | 'error'; message: string };
const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToasts.getState().push({ tone: 'success', message }),
  error: (message: string) => useToasts.getState().push({ tone: 'error', message }),
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  const t = useTranslations();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-100 flex flex-col items-center gap-2 sm:inset-x-auto sm:end-5 sm:bottom-5 sm:items-end">
      {toasts.map((x) => (
        <div key={x.id} role="status" className="animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border border-line-strong bg-surface/90 p-3.5 text-sm shadow-3 backdrop-blur-xl">
          {x.tone === 'success' ? <CheckCircle2 size={17} className="mt-px shrink-0 text-positive" /> : <XCircle size={17} className="mt-px shrink-0 text-negative" />}
          <span className="min-w-0 flex-1">{x.message}</span>
          <button onClick={() => dismiss(x.id)} aria-label={t('common.dismiss')} className="text-subtle hover:text-ink"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/** Turns an API error code into a sentence in the reader's language. */
export function useErrorMessage() {
  const t = useTranslations();
  return (e: unknown) => {
    const code = e instanceof ApiError ? e.code : 'INTERNAL';
    const key = `errors.${code}`;
    return t.has(key) ? t(key) : t('errors.INTERNAL');
  };
}

// --- Modal ------------------------------------------------------------------

export function Modal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: ReactNode }) {
  const t = useTranslations();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-90 bg-black/65 backdrop-blur-sm" />
        <Dialog.Content aria-describedby={description ? undefined : undefined} className="animate-rise fixed inset-x-3 top-[8vh] z-90 mx-auto max-h-[84vh] max-w-lg overflow-y-auto rounded-[22px] border border-line-strong shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] bg-surface p-5 shadow-3 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label={t('common.close')} className="text-subtle hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type ConfirmSpec = { title: string; body?: string; confirmLabel?: string; danger?: boolean };

export function ConfirmDialog({ open, onOpenChange, spec, onConfirm, busy }: { open: boolean; onOpenChange: (v: boolean) => void; spec: ConfirmSpec; onConfirm: () => void; busy?: boolean }) {
  const t = useTranslations();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={spec.title} description={spec.body}>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
        <Button variant={spec.danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
          {busy && <Loader2 size={15} className="animate-spin" />}{spec.confirmLabel ?? t('common.confirm')}
        </Button>
      </div>
    </Modal>
  );
}

// --- Action button ----------------------------------------------------------

type ActionProps = {
  endpoint: string; method?: string; body?: unknown; label: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; className?: string;
  confirm?: ConfirmSpec; success?: string; redirectTo?: string; followPayment?: boolean; idempotent?: boolean; ariaLabel?: string;
};

/** Any single-click server action. Authorization and validation stay on the API. */
export function ActionButton({ endpoint, method = 'POST', body, label, variant = 'secondary', size = 'sm', className, confirm, success, redirectTo, followPayment, idempotent, ariaLabel }: ActionProps) {
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState(false);
  const [, startTransition] = useTransition();

  async function run() {
    setPending(true);
    try {
      const payload = idempotent ? { ...(body as object), idempotencyKey: newKey() } : body;
      const res = await clientApi<{ redirectUrl?: string | null; payment?: { redirectUrl?: string | null } }>(endpoint, { method, body: payload ?? (method === 'POST' ? {} : undefined) });
      setAsking(false);
      if (success) toast.success(success);
      const pay = res?.redirectUrl ?? res?.payment?.redirectUrl;
      if (followPayment && pay) return router.push(pay);
      if (redirectTo) return router.push(redirectTo);
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button variant={variant} size={size} className={className} disabled={pending} aria-label={ariaLabel} onClick={() => (confirm ? setAsking(true) : run())}>
        {pending && <Loader2 size={14} className="animate-spin" />}{label}
      </Button>
      {confirm && <ConfirmDialog open={asking} onOpenChange={setAsking} spec={confirm} onConfirm={run} busy={pending} />}
    </>
  );
}

// --- Forms ------------------------------------------------------------------

export type FieldSpec = {
  name: string; label: string;
  type?: 'text' | 'email' | 'password' | 'url' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'money' | 'tags' | 'checkboxes';
  required?: boolean; placeholder?: string; hint?: string; rows?: number; autoComplete?: string; min?: number; max?: number; minLength?: number;
  options?: { value: string; label: string }[]; defaultValue?: string | number | boolean | string[];
  /** For `money`: a fixed currency, or the name of the field holding one. */
  currency?: string; currencyField?: string;
};

const inputClass = fieldClass.input;

function buildValue(f: FieldSpec, raw: unknown, all: Record<string, unknown>): unknown {
  if (f.type === 'money') {
    if (raw === '' || raw === undefined) return undefined;
    const currency = f.currency ?? String(all[f.currencyField ?? 'currency'] ?? 'USD');
    return toMinor(String(raw).replace(',', '.'), currency).toString();
  }
  if (f.type === 'number') return raw === '' || raw === undefined ? undefined : Number(raw);
  if (f.type === 'tags') return String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (f.type === 'checkbox') return !!raw;
  if (raw === '') return undefined;
  return raw;
}

export type AutoFormProps = {
  endpoint: string; method?: string; fields: FieldSpec[]; submitLabel: string; extra?: Record<string, unknown>;
  success?: string; redirectTo?: string; resetOnSuccess?: boolean; idempotent?: boolean; followPayment?: boolean; className?: string; columns?: 1 | 2;
  /** Show the response body after success, for secrets that appear only once. */
  revealField?: string; revealTitle?: string;
  /** Called once the work is finished, so a dialog can close and uncover the updated page. */
  onDone?: () => void;
};

/** Declarative form, so server components can describe one without passing functions. */
export function AutoForm({ endpoint, method = 'POST', fields, submitLabel, extra, success, redirectTo, resetOnSuccess, idempotent, followPayment, className, columns = 1, revealField, revealTitle, onDone }: AutoFormProps) {
  const router = useRouter();
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const [reveal, setReveal] = useState<string | null>(null);
  const uid = useId();
  const defaults = Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'checkbox' ? false : f.type === 'checkboxes' ? [] : '')]));
  const form = useForm<Record<string, unknown>>({ defaultValues: defaults });
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = form;

  async function submit(values: Record<string, unknown>) {
    let body: Record<string, unknown>;
    try {
      body = { ...extra, ...Object.fromEntries(fields.map((f) => [f.name, buildValue(f, values[f.name], { ...extra, ...values })])) };
    } catch {
      toast.error(t('errors.invalid_amount'));
      return;
    }
    if (idempotent) body.idempotencyKey = newKey();
    try {
      const res = await clientApi<Record<string, string> & { redirectUrl?: string | null }>(endpoint, { method, body });
      if (success) toast.success(success);
      if (resetOnSuccess) reset();
      if (revealField && res?.[revealField]) return setReveal(res[revealField]);
      onDone?.();
      if (followPayment && res?.redirectUrl) return router.push(res.redirectUrl);
      if (redirectTo) return router.push(redirectTo.replace(/\{(\w+)\}/g, (_, k: string) => res?.[k] ?? ''));
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VALIDATION' && Array.isArray(e.details)) {
        for (const d of e.details as { path: string; message: string }[]) {
          if (fields.some((f) => f.name === d.path)) setError(d.path, { message: t('errors.VALIDATION') });
        }
      }
      toast.error(errorMessage(e));
    }
  }

  if (reveal) {
    return (
      <div className="rounded-md border border-line-strong bg-surface-2 p-4">
        <p className="text-sm font-medium">{revealTitle}</p>
        <code className="mt-2 block break-all rounded-sm bg-surface p-2.5 font-mono text-[0.8125rem]">{reveal}</code>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setReveal(null); router.refresh(); onDone?.(); }}>{t('common.done')}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} className={cx('grid gap-4', columns === 2 && 'sm:grid-cols-2', className)} noValidate={false}>
      {fields.map((f) => {
        const id = `${uid}-${f.name}`;
        const err = errors[f.name]?.message as string | undefined;
        const describedBy = err ? `${id}-err` : f.hint ? `${id}-hint` : undefined;
        const wide = f.type === 'textarea' || f.type === 'checkboxes' || f.type === 'checkbox';
        const rules = { required: f.required };
        if (f.type === 'checkbox') {
          return (
            <label key={f.name} className={cx('flex items-start gap-2.5 text-sm', columns === 2 && 'sm:col-span-2')}>
              <input type="checkbox" {...register(f.name, rules)} required={f.required} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>{f.label}{f.hint && <span className="mt-0.5 block text-xs text-muted">{f.hint}</span>}</span>
            </label>
          );
        }
        return (
          <div key={f.name} className={cx(wide && columns === 2 && 'sm:col-span-2')}>
            <label htmlFor={id} className={fieldClass.label}>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea id={id} rows={f.rows ?? 4} placeholder={f.placeholder} aria-describedby={describedBy} aria-invalid={!!err} required={f.required} {...register(f.name, rules)} className={inputClass} />
            ) : f.type === 'select' ? (
              <select id={id} aria-describedby={describedBy} required={f.required} {...register(f.name, rules)} className={inputClass}>
                {!f.required && <option value="">{t('common.none')}</option>}
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === 'checkboxes' ? (
              <div className="flex flex-wrap gap-2">
                {f.options?.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 rounded-md border border-line-strong px-2.5 py-1.5 text-sm">
                    <input type="checkbox" value={o.value} {...register(f.name)} className="size-4 accent-[var(--accent)]" />{o.label}
                  </label>
                ))}
              </div>
            ) : (
              <input
                id={id}
                type={f.type === 'money' ? 'text' : f.type === 'tags' ? 'text' : (f.type ?? 'text')}
                inputMode={f.type === 'money' ? 'decimal' : undefined}
                placeholder={f.placeholder} autoComplete={f.autoComplete} min={f.min} max={f.max} minLength={f.minLength}
                aria-describedby={describedBy} aria-invalid={!!err} required={f.required}
                {...register(f.name, rules)} className={inputClass}
              />
            )}
            {f.hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{f.hint}</p>}
            {err && <p id={`${id}-err`} className="mt-1 text-xs text-negative">{err}</p>}
          </div>
        );
      })}
      <div className={cx(columns === 2 && 'sm:col-span-2')}>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}{submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Button that opens a form in a dialog, for quick edits. */
export function FormDialog({ trigger, title, description, triggerVariant = 'primary', triggerSize = 'sm', ...form }: AutoFormProps & { trigger: string; title: string; description?: string; triggerVariant?: 'primary' | 'secondary' | 'ghost'; triggerSize?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>{trigger}</Button>
      <Modal open={open} onOpenChange={setOpen} title={title} description={description}>
        <AutoForm {...form} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
