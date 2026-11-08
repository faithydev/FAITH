import { ActionButton, AutoForm, FormDialog } from '@/components/ui/client';
import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import { DEFAULT_COMMISSION_BPS, SETTING_KEYS } from '@/lib/settings-keys';
import { percent } from '@/lib/format';
import { toMajorString } from '@faith/money';

type Plan = { key: string; name: string; monthlyMinor: string | null; yearlyMinor: string | null; currency: string; _count: { subscriptions: number } };
type Setting = { key: string; value: unknown };
type Flag = { key: string; description: string; enabled: boolean; rolloutPct: number };

export default async function AdminSettings() {
  const { t, m, me, locale } = await pageContext();
  const [plans, settings] = await Promise.all([api<Plan[]>('/admin/plans'), api<Setting[]>('/admin/settings')]);
  const canFlags = me.permissions.includes('admin.flags.write');
  const flags = canFlags ? await api<Flag[]>('/admin/flags') : [];
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
