'use client';

import { Button, cx } from '@/components/ui/primitives';
import { useErrorMessage } from '@/components/ui/client';
import { Link, useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { ApiError } from '@/lib/errors';
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, MailCheck, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';

type FieldProps = React.ComponentProps<'input'> & { label: string; icon?: ReactNode; trailing?: ReactNode; hint?: string };

/** The label is the placeholder on screen, as in the reference, and stays a real label for assistive tech. */
function Field({ label, icon, trailing, hint, className, ...p }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="relative">
        {icon && <span aria-hidden className="pointer-events-none absolute inset-y-0 start-3.5 grid place-items-center text-white/40">{icon}</span>}
        <input id={id} placeholder={label} aria-describedby={hintId} {...p} className={cx('fx-input h-11', !!icon && 'has-icon', !!trailing && 'has-trailing')} />
        {trailing}
      </div>
      {hint && <p id={hintId} className="mt-1.5 ps-1 text-xs text-white/45">{hint}</p>}
    </div>
  );
}

function PasswordField(p: Omit<FieldProps, 'type' | 'icon' | 'trailing'>) {
  const t = useTranslations();
  const [shown, setShown] = useState(false);
  return (
    <Field
      {...p}
      type={shown ? 'text' : 'password'}
      icon={<LockKeyhole size={16} strokeWidth={1.7} />}
      trailing={(
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={shown} className="absolute inset-y-0 end-1.5 my-auto grid size-8 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white">
          {shown ? <EyeOff size={16} strokeWidth={1.7} /> : <Eye size={16} strokeWidth={1.7} />}
        </button>
      )}
    />
  );
}

function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--negative)_35%,transparent)] bg-[color-mix(in_srgb,var(--negative)_10%,transparent)] px-3.5 py-2.5 text-sm text-negative">{message}</p> : null;
}

function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy} arrow={!busy}>
      {busy && <Loader2 size={16} className="animate-spin" />}{children}
    </Button>
  );
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    <path fill="#34A853" d="M3.5 7.5l3.2 2.3C7.6 7.9 9.6 6.4 12 6.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 8.3 2.4 5.1 4.5 3.5 7.5z" opacity=".001" />
    <path fill="#4285F4" d="M21.2 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.4-1.1 2.5-2.3 3.3l3.1 2.4c1.8-1.7 3-4.2 3-8z" />
    <path fill="#FBBC05" d="M6.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L3.2 7.3C2.7 8.7 2.4 10.3 2.4 12s.3 3.3.8 4.7l3.2-2.4z" />
    <path fill="#34A853" d="M12 21.6c2.6 0 4.8-.9 6.3-2.4l-3.1-2.4c-.8.6-1.9 1-3.2 1-2.4 0-4.5-1.6-5.2-3.9l-3.2 2.4c1.6 3.2 4.8 5.3 8.4 5.3z" />
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="currentColor">
    <path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.8-1.1-2.8-4.2zM14 5.3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
  </svg>
);

const providerClass = 'flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.045] text-sm text-white/85 transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.045]';

/**
 * Social sign-in. A provider is a live link only when it is configured on the server; until
 * then its button is visibly disabled and the line below says so. Apple has no adapter yet.
 */
function Providers({ google }: { google: boolean }) {
  const t = useTranslations();
  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3 text-[0.68rem] font-medium tracking-[0.14em] text-white/40 uppercase [:lang(ar)_&]:tracking-normal [:lang(zh)_&]:tracking-normal">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/12 rtl:bg-gradient-to-l" />{t('auth.orContinueWith')}<span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/12 rtl:bg-gradient-to-r" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {google
          ? <a href="/api/v1/auth/oauth/google/start" aria-label={t('auth.continueGoogle')} className={providerClass}><GoogleIcon /></a>
          : <button type="button" disabled aria-label={`Google: ${t('auth.providerOff')}`} className={providerClass}><GoogleIcon /></button>}
        <button type="button" disabled aria-label={`Apple: ${t('auth.providerOff')}`} className={providerClass}><AppleIcon /></button>
      </div>
      <p className="mt-3 text-center text-xs text-white/40">{google ? t('auth.appleOff') : t('auth.providersOff')}</p>
    </div>
  );
}

export function LoginForm({ next, oauth }: { next?: string; oauth: { google: boolean } }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await clientApi('/auth/login', { body: { email: f.get('email'), password: f.get('password'), totp: f.get('totp') || undefined } });
      // Only same-site paths are followed, so a crafted link cannot redirect off FAITH.
      const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
      router.push(safe);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOTP_REQUIRED') setNeedTotp(true);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <Field label={t('auth.email')} name="email" type="email" autoComplete="email" required icon={<Mail size={16} strokeWidth={1.7} />} />
        <PasswordField label={t('auth.password')} name="password" autoComplete="current-password" required />
        {needTotp && <Field label={t('auth.totp')} name="totp" inputMode="numeric" autoComplete="one-time-code" required autoFocus icon={<KeyRound size={16} strokeWidth={1.7} />} />}
        <p className="text-end text-[0.8125rem]"><Link href="/forgot-password" className="text-white/55 transition-colors hover:text-neon">{t('auth.forgotLink')}</Link></p>
        <Submit busy={busy}>{t('auth.loginCta')}</Submit>
      </form>
      <Providers google={oauth.google} />
    </>
  );
}

type Mail = { id: string; text: string; subject: string };

/** Shown only with the development mail adapter, where no real email is ever sent. */
function DevMailbox({ email }: { email: string }) {
  const t = useTranslations();
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    void clientApi<Mail[]>(`/auth/dev/mailbox?to=${encodeURIComponent(email)}`).then((rows) => {
      const url = rows[0] ? /https?:\S+/.exec(rows[0].text)?.[0] : null;
      if (url) setLink(new URL(url).pathname + new URL(url).search);
    }).catch(() => {});
  }, [email]);
  if (!link) return null;
  return (
    <div className="mt-5 rounded-xl border border-dashed border-white/15 p-3.5 text-sm">
      <p className="font-medium">{t('auth.devMailbox')}</p>
      <p className="mt-1 text-white/55">{t('auth.devMailboxBody')}</p>
      <a href={link} className="mt-2 inline-block font-medium text-neon underline underline-offset-4">{t('auth.devMailboxLink')}</a>
    </div>
  );
}

export function RegisterForm({ oauth }: { oauth: { google: boolean } }) {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email')).trim().toLowerCase();
    const displayName = [f.get('firstName'), f.get('lastName')].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
    setBusy(true);
    setError(null);
    try {
      await clientApi('/auth/register', { body: { email, password: f.get('password'), displayName, locale } });
      setSentTo(email);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div data-testid="check-email" className="animate-rise">
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--neon)_12%,transparent)] text-neon ring-1 ring-[color-mix(in_srgb,var(--neon)_30%,transparent)]"><MailCheck size={22} strokeWidth={1.6} /></span>
        <h2 className="font-display text-xl font-semibold tracking-tight">{t('auth.checkEmailTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{t('auth.checkEmailBody', { email: sentTo })}</p>
        <DevMailbox email={sentTo} />
      </div>
    );
  }
  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('auth.firstName')} name="firstName" autoComplete="given-name" required minLength={1} maxLength={60} icon={<UserRound size={16} strokeWidth={1.7} />} />
          <Field label={t('auth.lastName')} name="lastName" autoComplete="family-name" maxLength={60} />
        </div>
        <Field label={t('auth.email')} name="email" type="email" autoComplete="email" required icon={<Mail size={16} strokeWidth={1.7} />} />
        <PasswordField label={t('auth.password')} name="password" autoComplete="new-password" required minLength={10} hint={t('auth.passwordHint')} />
        <Submit busy={busy}>{t('auth.registerCta')}</Submit>
      </form>
      <Providers google={oauth.google} />
      <p className="mt-6 text-center text-xs leading-relaxed text-white/45">
        {t.rich('auth.agree', {
          terms: (c) => <Link href="/terms" className="text-white/75 underline-offset-4 hover:text-neon hover:underline">{c}</Link>,
          privacy: (c) => <Link href="/privacy" className="text-white/75 underline-offset-4 hover:text-neon hover:underline">{c}</Link>,
        })}
      </p>
    </>
  );
}

export function VerifyEmail({ token }: { token?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(token ? null : t('errors.INVALID_TOKEN'));
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    clientApi('/auth/verify-email', { body: { token } })
      .then(() => { router.replace('/onboarding'); router.refresh(); })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [token, router, errorMessage]);
  return error ? <FormError message={error} /> : <p role="status" className="flex items-center gap-2 text-sm text-white/60"><Loader2 size={16} className="animate-spin text-neon" />{t('auth.verifying')}</p>;
}

export function ForgotForm() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim().toLowerCase();
    setBusy(true);
    try {
      await clientApi('/auth/forgot-password', { body: { email } });
      setSent(email);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  if (sent) return <div className="animate-rise"><p className="text-sm text-white/65">{t('auth.resetSent')}</p><DevMailbox email={sent} /></div>;
  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <Field label={t('auth.email')} name="email" type="email" autoComplete="email" required icon={<Mail size={16} strokeWidth={1.7} />} />
      <Submit busy={busy}>{t('auth.sendReset')}</Submit>
      <p className="pt-2 text-center text-[0.8125rem]"><Link href="/login" className="text-white/55 hover:text-neon">{t('auth.signIn')}</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await clientApi('/auth/reset-password', { body: { token, password: new FormData(e.currentTarget).get('password') } });
      router.replace('/login');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <PasswordField label={t('auth.newPassword')} name="password" autoComplete="new-password" required minLength={10} hint={t('auth.passwordHint')} />
      <Submit busy={busy}>{t('auth.setPassword')}</Submit>
    </form>
  );
}
