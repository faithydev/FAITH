'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, Card, fieldClass } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { toMinor } from '@faith/money';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

const TYPES = ['VIDEO_CLIPPING', 'ORIGINAL_UGC', 'VERIFIED_VIEWS', 'QUALIFIED_CLICKS', 'VERIFIED_LEADS', 'CONFIRMED_SALES', 'APP_TESTING', 'TASK_BOUNTY', 'HYBRID', 'RETAINER'];
const METRICS = ['APPROVED_SUBMISSION', 'VIEWS', 'CLICKS', 'LEADS', 'SALES'];
const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'other'];

type Rule = { metric: string; unitSize: string; rate: string; cap: string };

function Text({ name, label, required = true, area, ...rest }: { name: string; label: string; required?: boolean; area?: boolean } & React.ComponentProps<'input'>) {
  return (
    <div>
      <label htmlFor={name} className={fieldClass.label}>{label}</label>
      {area ? <textarea id={name} name={name} rows={3} required={required} className={fieldClass.input} /> : <input id={name} name={name} required={required} {...rest} className={fieldClass.input} />}
    </div>
  );
}

export function CampaignForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>(['youtube']);
  const [rules, setRules] = useState<Rule[]>([{ metric: 'VIEWS', unitSize: '1000', rate: '', cap: '' }]);
  const setRule = (i: number, patch: Partial<Rule>) => setRules((r) => r.map((x, j) => (i === j ? { ...x, ...patch } : x)));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '').trim();
    const currency = s('currency');
    setBusy(true);
    try {
      const body = {
        orgId: s('orgId'), title: s('title'), summary: s('summary'), description: s('description'), type: s('type'), currency,
        budgetMinor: toMinor(s('budget'), currency).toString(), platforms, countries: s('countries').split(',').map((c) => c.trim()).filter(Boolean),
        guidelines: s('guidelines'), requiresApplication: f.get('requiresApplication') === 'on', submissionDeadline: new Date(s('deadline')).toISOString(),
        usageRights: s('usageRights'), creatorPermissions: s('creatorPermissions'), attribution: s('attribution'), adDisclosure: s('adDisclosure'),
        licenseDays: s('licenseDays') ? Number(s('licenseDays')) : null, territory: s('territory') || null, prohibitedContent: s('prohibitedContent'),
        requirements: s('requirements').split('\n').map((l) => l.trim()).filter(Boolean).map((label) => ({ label })),
        rules: rules.map((r) => ({
          metric: r.metric, unitSize: r.metric === 'APPROVED_SUBMISSION' ? '1' : r.unitSize, rateMinor: toMinor(r.rate, currency).toString(),
          capMinor: r.cap ? toMinor(r.cap, currency).toString() : null,
        })),
      };
      const created = await clientApi<{ id: string }>('/rewards/brand/campaigns', { body });
      router.push(`/app/brand/campaigns/${created.id}`);
    } catch (err) {
      toast.error(err instanceof RangeError ? t('errors.invalid_amount') : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">{t('app.brand.sectionBasics')}</h2>
        <div>
          <label htmlFor="orgId" className={fieldClass.label}>{t('app.brand.organization')}</label>
          <select id="orgId" name="orgId" className={fieldClass.input}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </div>
        <div>
          <label htmlFor="type" className={fieldClass.label}>{t('app.brand.campaignType')}</label>
          <select id="type" name="type" defaultValue="VERIFIED_VIEWS" className={fieldClass.input}>{TYPES.map((x) => <option key={x} value={x}>{t(`rewards.types.${x}`)}</option>)}</select>
        </div>
        <div className="sm:col-span-2"><Text name="title" label={t('app.seller.productTitle')} /></div>
        <div className="sm:col-span-2"><Text name="summary" label={t('app.seller.summary')} /></div>
        <div className="sm:col-span-2"><Text name="description" label={t('app.seller.description')} area /></div>
        <div className="sm:col-span-2"><Text name="guidelines" label={t('rewards.guidelines')} area /></div>
        <div className="sm:col-span-2">
          <label htmlFor="requirements" className={fieldClass.label}>{t('rewards.requirements')}</label>
          <textarea id="requirements" name="requirements" rows={3} aria-describedby="req-hint" className={fieldClass.input} />
          <p id="req-hint" className="mt-1 text-xs text-muted">{t('app.brand.requirementsHint')}</p>
        </div>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">{t('app.brand.sectionAudience')}</h2>
        <fieldset className="sm:col-span-2">
          <legend className={fieldClass.label}>{t('app.brand.platforms')}</legend>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <label key={p} className="flex items-center gap-2 rounded-md border border-line-strong px-2.5 py-1.5 text-sm">
                <input type="checkbox" checked={platforms.includes(p)} onChange={(e) => setPlatforms((s) => (e.target.checked ? [...s, p] : s.filter((x) => x !== p)))} className="size-4 accent-[var(--accent)]" />{t(`rewards.platforms.${p}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Text name="countries" label={t('app.brand.countries')} required={false} placeholder="Uzbekistan, Kazakhstan" />
        <Text name="deadline" label={t('app.brand.deadline')} type="date" />
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2"><input type="checkbox" name="requiresApplication" className="size-4 accent-[var(--accent)]" />{t('app.brand.requireApplication')}</label>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">{t('app.brand.sectionRewards')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="currency" className={fieldClass.label}>{t('app.seller.currency')}</label>
            <select id="currency" name="currency" defaultValue="USD" className={fieldClass.input}>{['UZS', 'USD'].map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <Text name="budget" label={t('app.brand.budget')} inputMode="decimal" placeholder="1000.00" />
        </div>
        {rules.map((r, i) => (
          <div key={i} className="grid items-end gap-3 rounded-md border border-line p-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
            <div>
              <label htmlFor={`m${i}`} className={fieldClass.label}>{t('app.brand.metric')}</label>
              <select id={`m${i}`} value={r.metric} onChange={(e) => setRule(i, { metric: e.target.value })} className={fieldClass.input}>{METRICS.map((x) => <option key={x} value={x}>{t(`rewards.metrics.${x}`)}</option>)}</select>
            </div>
            <div>
              <label htmlFor={`u${i}`} className={fieldClass.label}>{t('app.brand.unit')}</label>
              <input id={`u${i}`} value={r.metric === 'APPROVED_SUBMISSION' ? '1' : r.unitSize} disabled={r.metric === 'APPROVED_SUBMISSION'} onChange={(e) => setRule(i, { unitSize: e.target.value })} inputMode="numeric" className={fieldClass.input} />
            </div>
            <div>
              <label htmlFor={`r${i}`} className={fieldClass.label}>{t('app.brand.rate')}</label>
              <input id={`r${i}`} value={r.rate} onChange={(e) => setRule(i, { rate: e.target.value })} required inputMode="decimal" className={fieldClass.input} />
            </div>
            <div>
              <label htmlFor={`c${i}`} className={fieldClass.label}>{t('app.brand.cap')}</label>
              <input id={`c${i}`} value={r.cap} onChange={(e) => setRule(i, { cap: e.target.value })} inputMode="decimal" className={fieldClass.input} />
            </div>
            <Button variant="ghost" aria-label={t('common.remove')} disabled={rules.length === 1} onClick={() => setRules((x) => x.filter((_, j) => j !== i))}><Trash2 size={15} /></Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setRules((r) => [...r, { metric: 'APPROVED_SUBMISSION', unitSize: '1', rate: '', cap: '' }])}><Plus size={14} />{t('app.brand.addRule')}</Button>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">{t('app.brand.sectionRights')}</h2>
        <div className="sm:col-span-2"><Text name="usageRights" label={t('rewards.usageRights')} area /></div>
        <div className="sm:col-span-2"><Text name="creatorPermissions" label={t('rewards.creatorPermissions')} area /></div>
        <Text name="attribution" label={t('rewards.attribution')} />
        <Text name="adDisclosure" label={t('rewards.adDisclosure')} />
        <Text name="licenseDays" label={t('rewards.licenseDays')} required={false} type="number" min={1} />
        <Text name="territory" label={t('rewards.territory')} required={false} />
        <div className="sm:col-span-2"><Text name="prohibitedContent" label={t('rewards.prohibited')} area /></div>
      </Card>

      <Button type="submit" size="lg" disabled={busy || platforms.length === 0}>{busy && <Loader2 size={15} className="animate-spin" />}{t('app.brand.saveDraft')}</Button>
    </form>
  );
}
