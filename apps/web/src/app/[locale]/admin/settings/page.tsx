import { ActionButton, AutoForm, FormDialog } from '@/components/ui/client';
import { Badge, buttonClass, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import { DEFAULT_COMMISSION_BPS, SETTING_KEYS } from '@/lib/settings-keys';
import { date, fileSize, percent } from '@/lib/format';
import { toMajorString } from '@faith/money';

type Plan = { key: string; name: string; monthlyMinor: string | null; yearlyMinor: string | null; currency: string; _count: { subscriptions: number } };
type Setting = { key: string; value: unknown };
type Flag = { key: string; description: string; enabled: boolean; rolloutPct: number };
type Backups = { enabled: boolean; keepDays: number; ownPassphrase: boolean; storage: string; items: { name: string; size: number; createdAt: string }[] };

export default async function AdminSettings() {
  const { t, m, me, locale } = await pageContext();
  const [plans, settings] = await Promise.all([api<Plan[]>('/admin/plans'), api<Setting[]>('/admin/settings')]);
  const canFlags = me.permissions.includes('admin.flags.write');
  const flags = canFlags ? await api<Flag[]>('/admin/flags') : [];
  // Backups hold everyone's data, so only founders (super admins) see this section.
  const canBackups = me.permissions.includes('admin.roles.write');
  const backups = canBackups ? await api<Backups>('/admin/backups').catch(() => null) : null;
  const value = <T,>(key: string, fallback: T) => (settings.find((s) => s.key === key)?.value as T) ?? fallback;
  const commission = value(SETTING_KEYS.commissionBps, DEFAULT_COMMISSION_BPS);
  const appCommission = value<number | null>(SETTING_KEYS.appCommissionBps, null);
  const canFinance = me.permissions.includes('admin.finance.write');
  const pro = plans.find((p) => p.key === 'pro');
  return (
    <>
      <PageHeader title={t('admin.nav.settings')} />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="p-5">
          <SectionTitle title={t('admin.proPricing')} />
          <p className="mb-3 text-sm text-muted">{t('admin.proPricingBody')}</p>
          {pro && (
            <>
              <p className="mb-3 text-sm">{t('admin.currentPrice', { monthly: pro.monthlyMinor ? m(pro.monthlyMinor, pro.currency) : '—', yearly: pro.yearlyMinor ? m(pro.yearlyMinor, pro.currency) : '—' })}</p>
              <AutoForm
                endpoint="/admin/plans/pro" method="PATCH" submitLabel={t('common.save')} success={t('common.saved')} extra={{ confirm: true, currency: pro.currency }}
                fields={[
                  { name: 'monthlyMinor', label: t('admin.monthlyPrice', { currency: pro.currency }), type: 'money', currency: pro.currency, defaultValue: pro.monthlyMinor ? toMajorString(BigInt(pro.monthlyMinor), pro.currency) : '' },
                  { name: 'yearlyMinor', label: t('admin.yearlyPrice', { currency: pro.currency }), type: 'money', currency: pro.currency, defaultValue: pro.yearlyMinor ? toMajorString(BigInt(pro.yearlyMinor), pro.currency) : '' },
                ]}
              />
            </>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle title={t('admin.commission')} />
          <p className="text-sm text-muted">{t('admin.commissionBody')}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt>{t('admin.saleCommission')}</dt><dd className="font-semibold">{percent(commission, locale)}</dd></div>
            <div className="flex justify-between"><dt>{t('admin.appCommission')}</dt><dd className="font-semibold">{appCommission === null ? t('admin.notSet') : percent(appCommission, locale)}</dd></div>
          </dl>
          {canFinance && (
            <div className="mt-4">
              <FormDialog
                trigger={t('admin.setAppCommission')} title={t('admin.setAppCommission')} description={t('admin.setAppCommissionBody')} triggerVariant="secondary"
                endpoint={`/admin/settings/${SETTING_KEYS.appCommissionBps}`} method="PUT" extra={{ confirm: true }} submitLabel={t('common.save')} success={t('common.saved')}
                fields={[{ name: 'value', label: t('admin.bps'), type: 'number', required: true, min: 0, max: 10000 }]}
              />
            </div>
          )}
        </Card>
      </div>
      {backups && (
        <section className="mt-8" data-testid="backups">
          <SectionTitle
            title={t('admin.backups.title')}
            action={<ActionButton endpoint="/admin/backups" label={t('admin.backups.now')} success={t('admin.backups.made')} variant="primary" />}
          />
          <Card className="p-5">
            <p className="text-sm text-muted">{t('admin.backups.body', { days: backups.keepDays })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={backups.enabled ? 'positive' : 'warning'}>{backups.enabled ? t('admin.backups.on') : t('admin.backups.off')}</Badge>
              <Badge>{backups.storage === 's3' ? 'Cloudflare R2' : t('admin.backups.localDisk')}</Badge>
            </div>
            <p className="mt-3 text-xs text-subtle">{backups.ownPassphrase ? t('admin.backups.keyOwn') : t('admin.backups.keyApp')}</p>
            {backups.items.length === 0 ? <p className="mt-4 text-sm text-muted">{t('admin.backups.empty')}</p> : (
              <ul className="mt-4 divide-y divide-line text-sm">
                {backups.items.map((b) => (
                  <li key={b.name} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0"><span className="font-medium">{date(b.createdAt, locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tashkent' })}</span><span className="block font-mono text-xs text-subtle">{b.name} · {fileSize(b.size)}</span></span>
                    <a href={`/api/v1/admin/backups/${b.name}`} download className={buttonClass('secondary', 'sm')}><Download aria-hidden className="size-4" />{t('admin.backups.download')}</a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}
      {canFlags && (
        <section className="mt-8">
          <SectionTitle title={t('admin.flags')} />
          <ul className="card divide-y divide-line">
            {flags.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                <span className="min-w-0"><code className="font-mono text-[0.8125rem]">{f.key}</code><span className="block text-xs text-muted">{f.description}</span></span>
                <span className="flex items-center gap-2">
                  <Badge tone={f.enabled ? 'positive' : 'neutral'}>{f.enabled ? `${t('common.on')} · ${f.rolloutPct}%` : t('common.off')}</Badge>
                  <ActionButton endpoint={`/admin/flags/${f.key}`} method="PATCH" body={f.enabled ? { enabled: false, rolloutPct: 0 } : { enabled: true, rolloutPct: 100 }} label={f.enabled ? t('admin.turnOff') : t('admin.turnOn')} confirm={{ title: t('admin.flagConfirm', { key: f.key }) }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
