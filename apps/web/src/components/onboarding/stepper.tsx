'use client';

import { toast, useErrorMessage } from '@/components/ui/client';
import { Button, cx, fieldClass } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { ONBOARDING_QUESTIONS, OnboardingQuestion, Persona, PERSONAS } from '@faith/config';
import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Answers = Record<string, Record<string, string | string[]>>;

/** Asks what brings someone here, then only the questions those answers call for. */
export function OnboardingStepper() {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [selected, setSelected] = useState<Persona[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const followUps = selected.filter((p) => ONBOARDING_QUESTIONS[p]);
  const total = 1 + followUps.length;
  const toggle = (p: Persona) => setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  const setAnswer = (persona: string, key: string, value: string | string[]) =>
    setAnswers((a) => ({ ...a, [persona]: { ...a[persona], [key]: value } }));

  async function finish(personas: Persona[]) {
    setBusy(true);
    try {
      await clientApi('/onboarding', { body: { personas, answers } });
      router.replace('/app');
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  const persona = step > 0 ? followUps[step - 1] : undefined;
  const last = step === total - 1;

  return (
    <div>
      <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label={t('onboarding.progress', { step: step + 1, total })} className="mb-8 flex gap-1.5">
        {Array.from({ length: total }, (_, i) => <span key={i} className={cx('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-surface-3')} />)}
      </div>

      {step === 0 ? (
        <>
          <h1 className="tracking-display text-3xl font-semibold sm:text-4xl">{t('onboarding.title')}</h1>
          <p className="mt-2 text-muted">{t('onboarding.body')}</p>
          <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {PERSONAS.map((p) => {
              const on = selected.includes(p);
              return (
                <button key={p} type="button" aria-pressed={on} data-testid={`persona-${p}`} onClick={() => toggle(p)} className={cx('flex items-start gap-3 rounded-lg border p-4 text-start transition-colors', on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong')}>
                  <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm border', on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong')}>{on && <Check size={13} />}</span>
                  <span>
                    <span className="block font-medium">{t(`onboarding.personas.${p}.title`)}</span>
                    <span className="mt-0.5 block text-sm text-muted">{t(`onboarding.personas.${p}.body`)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="eyebrow">{t(`onboarding.personas.${persona!}.title`)}</p>
          <h1 className="tracking-display mt-2 text-2xl font-semibold sm:text-3xl">{t('onboarding.followUpTitle')}</h1>
          <div className="mt-7 space-y-6">
            {(ONBOARDING_QUESTIONS[persona!] ?? []).map((q) => (
              <Question key={q.key} q={q} value={answers[persona!]?.[q.key]} onChange={(v) => setAnswer(persona!, q.key, v)} />
            ))}
          </div>
        </>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" disabled={busy} data-testid="onboarding-skip" onClick={() => finish([])}>{t('onboarding.skip')}</Button>
        <div className="flex gap-2">
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>{t('common.back')}</Button>}
          <Button size="lg" disabled={busy || selected.length === 0} data-testid="onboarding-next" onClick={() => (last ? finish(selected) : setStep(step + 1))}>
            {busy && <Loader2 size={15} className="animate-spin" />}{last ? t('onboarding.finish') : t('common.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Question({ q, value, onChange }: { q: OnboardingQuestion; value?: string | string[]; onChange: (v: string | string[]) => void }) {
  const t = useTranslations();
  const label = t(`onboarding.questions.${q.key}`);
  if (q.kind === 'text') {
    return (
      <div>
        <label htmlFor={q.key} className={fieldClass.label}>{label}</label>
        <input id={q.key} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} maxLength={200} className={fieldClass.input} />
      </div>
    );
  }
  const selected = q.kind === 'multi' ? ((value as string[]) ?? []) : [value as string];
  return (
    <fieldset>
      <legend className={fieldClass.label}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {q.options?.map((o) => {
          const on = selected.includes(o);
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => onChange(q.kind === 'multi' ? (on ? selected.filter((x) => x !== o) : [...selected, o]) : o)} className={cx('rounded-md border px-3 py-1.5 text-sm transition-colors', on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong hover:bg-surface-2')}>
              {t(`onboarding.options.${o}`)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
