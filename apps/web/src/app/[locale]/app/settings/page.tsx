import { ActionButton, AutoForm, FormDialog } from '@/components/ui/client';
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { TwoFactorPanel } from '@/components/settings/two-factor';
import { api } from '@/lib/api';
import { localeTag } from '@/lib/format';
import { pageContext } from '@/lib/page';
import { PERSONA_ROLE, PERSONAS, supportedCurrencies } from './personas';

type SessionRow = { id: string; userAgent: string | null; ipAddress: string | null; lastSeenAt: string; current: boolean };

export default async function SettingsPage() {
  const { t, me, d, locale } = await pageContext();
  const sessions = await api<SessionRow[]>('/auth/sessions');
  const currencyNames = new Intl.DisplayNames([localeTag(locale)], { type: 'currency' });
  const missing = PERSONAS.filter((p) => !me.roles.includes(PERSONA_ROLE[p]));
  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <Card className="mb-6 flex flex-wrap items-center gap-4 p-5" data-testid="badge-card">
        {me.badge && me.badge.status !== 'REJECTED' && me.badge.status !== 'REVOKED'
          ? <VerifiedBadge kind={me.badge.kind} label={t(`badges.kinds.${me.badge.kind}`)} size={64} className={me.badge.status === 'PENDING' ? 'opacity-45 grayscale' : undefined} />
          : <VerifiedBadge kind="customer" label="" size={64} className="opacity-25 grayscale" />}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">
            {me.badge?.status === 'VERIFIED' ? `${t('badges.verified')} · ${t(`badges.kinds.${me.badge.kind}`)}` : t('app.badge.title')}
          </p>
          <p className="text-sm text-muted">
            {me.badge?.status === 'VERIFIED' ? t('app.badge.verified')
              : me.badge?.status === 'PENDING' ? t('app.badge.pending', { date: d(me.badge.grantAt) })
              : me.badge?.status === 'REJECTED' ? t('app.badge.rejected')
              : me.badge?.status === 'REVOKED' ? t('app.badge.revoked')
              : t('app.badge.none')}
          </p>
        </div>
        {!me.pro && <LinkButton href="/app/billing" variant="primary" size="sm" arrow>{t('app.badge.getPro')}</LinkButton>}
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title={t('app.settings.profile')} />
          <AutoForm
            endpoint="/me/profile" method="PATCH" submitLabel={t('common.save')} success={t('common.saved')}
            fields={[
              { name: 'displayName', label: t('app.settings.displayName'), required: true, defaultValue: me.profile?.displayName },
              { name: 'username', label: t('app.settings.username'), required: true, defaultValue: me.profile?.username },
              { name: 'bio', label: t('app.settings.bio'), type: 'textarea', rows: 3, defaultValue: me.profile?.bio ?? '' },
              { name: 'country', label: t('app.settings.country'), defaultValue: me.profile?.country ?? '' },
              { name: 'recommendationsConsent', label: t('app.settings.consent'), hint: t('app.settings.consentHint'), type: 'checkbox', defaultValue: me.profile?.recommendationsConsent ?? true },
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card className="p-5" id="roles">
            <SectionTitle title={t('app.settings.roles')} />
            <div className="mb-4 flex flex-wrap gap-1.5">{me.roles.map((r) => <Badge key={r}>{t(`app.roles.${r}`)}</Badge>)}</div>
            {missing.length > 0 && (
              <>
                <p className="mb-2 text-sm text-muted">{t('app.settings.addRoleBody')}</p>
                <div className="flex flex-wrap gap-2">
                  {missing.map((p) => <ActionButton key={p} endpoint="/me/roles" body={{ persona: p }} label={t(`onboarding.personas.${p}.title`)} success={t('common.saved')} />)}
                </div>
              </>
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle title={t('app.settings.preferences')} />
            <AutoForm
              endpoint="/me/preferences" method="PATCH" submitLabel={t('common.save')} success={t('common.saved')}
              fields={[{ name: 'currency', label: t('app.settings.currency'), type: 'select', required: true, defaultValue: me.currency, options: supportedCurrencies().map((c) => ({ value: c, label: `${c} · ${currencyNames.of(c) ?? c}` })) }]}
            />
          </Card>
          <Card className="p-5">
            <SectionTitle title={t('app.settings.security')} />
            <TwoFactorPanel enabled={me.twoFactor} />
            <div className="mt-4 border-t border-line pt-4">
              <FormDialog
                trigger={t('app.settings.changePassword')} title={t('app.settings.changePassword')} triggerVariant="secondary"
                endpoint="/auth/change-password" submitLabel={t('common.save')} success={t('common.saved')}
                fields={[
                  { name: 'current', label: t('app.settings.currentPassword'), type: 'password', required: true, autoComplete: 'current-password' },
                  { name: 'next', label: t('auth.newPassword'), type: 'password', required: true, minLength: 10, autoComplete: 'new-password' },
                ]}
              />
            </div>
          </Card>
        </div>
      </div>
      <section className="mt-8">
        <SectionTitle title={t('app.settings.sessions')} />
        <ul className="card divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{s.userAgent ?? t('app.settings.unknownDevice')}</span>
                <span className="text-xs text-muted">{s.ipAddress} · {d(s.lastSeenAt)}</span>
              </span>
              {s.current ? <Badge tone="positive">{t('app.settings.thisDevice')}</Badge> : <ActionButton endpoint={`/auth/sessions/${s.id}`} method="DELETE" label={t('app.settings.revoke')} />}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <SectionTitle title={t('app.settings.dangerZone')} />
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="max-w-lg text-sm text-muted">{t('app.settings.deleteBody')}</p>
          <FormDialog
            trigger={t('app.settings.delete')} title={t('app.settings.delete')} description={t('app.settings.deleteBody')} triggerVariant="secondary"
            endpoint="/auth/delete-account" extra={{ confirm: 'DELETE' }} submitLabel={t('app.settings.deleteConfirm')} redirectTo="/"
            fields={[{ name: 'password', label: t('auth.password'), type: 'password', required: true, autoComplete: 'current-password' }]}
          />
        </Card>
      </section>
    </>
  );
}
