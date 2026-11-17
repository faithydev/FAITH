import { FaithMark } from '@/components/ui/logo';
import { buttonClass, Card } from '@/components/ui/primitives';
import { DESKTOP } from '@/lib/desktop';
import { AppWindow, Download, MonitorDown, RefreshCw, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('download.title'), description: t('download.body') };
}

export default async function DownloadPage() {
  const t = await getTranslations();
  const features = [
    { icon: ShieldCheck, title: t('download.protectTitle'), body: t('download.protectBody') },
    { icon: RefreshCw, title: t('download.freshTitle'), body: t('download.freshBody') },
    { icon: AppWindow, title: t('download.windowTitle'), body: t('download.windowBody') },
  ];
  const steps = [t('download.step1'), t('download.step2'), t('download.step3')];

  return (
    <div className="mx-auto max-w-6xl overflow-x-clip px-4 py-14 sm:px-6 lg:py-20">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="eyebrow mb-3">{t('download.eyebrow')}</p>
          <h1 className="tracking-display text-[length:var(--text-title)] leading-[1.06] font-semibold">{t('download.title')}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{t('download.body')}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {/* Plain links: these are files on GitHub, not pages of this site. */}
            <a href={DESKTOP.installer.url} className={buttonClass('primary', 'lg')} data-testid="download-installer">
              <Download aria-hidden className="size-4.5" />{t('download.installer')}
            </a>
            <a href={DESKTOP.portable.url} className={buttonClass('secondary', 'lg')} data-testid="download-portable">
              <MonitorDown aria-hidden className="size-4.5" />{t('download.portable')}
            </a>
          </div>
          <ul className="mt-4 space-y-1 text-sm text-muted">
            <li>{t('download.installerNote', { size: DESKTOP.installer.size })}</li>
            <li>{t('download.portableNote', { size: DESKTOP.portable.size })}</li>
          </ul>
          <p className="mt-5 font-mono text-xs tracking-wide text-subtle">
            {t('download.requirements')} · {t('download.version', { version: DESKTOP.version })} ·{' '}
            <a href={DESKTOP.releases} className="underline-offset-4 transition-colors hover:text-neon hover:underline" rel="noopener">{t('download.releases')}</a>
          </p>
        </div>

        {/* A drawn app window: no screenshot needed, and it stays sharp at every size. */}
        <div aria-hidden className="relative mx-auto w-full max-w-md">
          <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(50%_50%_at_50%_60%,color-mix(in_srgb,var(--neon)_16%,transparent),transparent_70%)]" />
          <Card className="relative overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <FaithMark size={14} />
              <span className="text-xs font-medium text-muted">FAITH</span>
              <span className="ms-auto flex gap-3 text-subtle">
                <span className="h-px w-2.5 self-center bg-current" />
                <span className="size-2.5 rounded-[2px] border border-current" />
                <span className="text-[0.7rem] leading-none">✕</span>
              </span>
            </div>
            <div className="grid aspect-[4/3] place-items-center bg-[radial-gradient(70%_60%_at_50%_120%,color-mix(in_srgb,var(--neon)_20%,transparent),transparent_70%)]">
              <div className="grid justify-items-center gap-5">
                <FaithMark size={84} />
                <span className="h-0.5 w-28 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full w-2/5 rounded-full bg-neon shadow-[0_0_12px_var(--neon)]" />
                </span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold">{t('download.featuresTitle')}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-6">
              <Icon aria-hidden size={22} strokeWidth={1.6} className="text-accent" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <h2 className="font-display text-2xl font-semibold">{t('download.stepsTitle')}</h2>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,var(--neon)_45%,transparent)] font-mono text-sm text-accent">{i + 1}</span>
              <p className="pt-1 text-muted">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-16 text-sm text-subtle">{t('download.otherDevices')}</p>
    </div>
  );
}
