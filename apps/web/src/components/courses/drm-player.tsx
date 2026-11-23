'use client';

import { useErrorMessage } from '@/components/ui/client';
import { Link } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { ApiError } from '@/lib/errors';
import { AlertTriangle, Loader2, LogIn, Play, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

type Playback = { status: 'uploading' | 'processing' | 'ready' | 'failed'; playerUrl: string | null };
type Strike = { strikes: number; limit: number; blockedUntil: string | null; exempt?: boolean };
type State =
  | { kind: 'idle' } | { kind: 'loading' } | { kind: 'processing' } | { kind: 'unsupported' } | { kind: 'error'; message: string }
  | { kind: 'playing'; url: string } | { kind: 'ended'; why: 'replaced' | 'blocked' };

const HEARTBEAT_MS = 20_000;

/** Can this browser play DRM video at all? Embedded app windows without a DRM module cannot. */
async function drmSupported() {
  if (typeof navigator.requestMediaKeySystemAccess !== 'function') return false;
  const config = [{ initDataTypes: ['cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] }];
  for (const system of ['com.widevine.alpha', 'com.apple.fps', 'com.apple.fps.1_0', 'com.microsoft.playready']) {
    try {
      await navigator.requestMediaKeySystemAccess(system, config);
      return true;
    } catch { /* try the next one */ }
  }
  // Safari reports FairPlay through its own API rather than this one.
  return typeof (window as unknown as { WebKitMediaKeys?: unknown }).WebKitMediaKeys !== 'undefined';
}

/**
 * Paid video under DRM. The picture is decrypted only inside the browser's protected module
 * (Widevine, FairPlay), so developer tools, download managers and saved network traffic hold
 * nothing playable. The player address is issued per viewer, lasts five minutes, and carries the
 * viewer's name as a moving watermark drawn by the provider. FAITH adds the same account rules as
 * for its own player: a sign-in elsewhere stops playback, and screenshot keys count as warnings.
 */
export function DrmPlayer({ endpoint, contentId }: { endpoint: string; contentId: string }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [strike, setStrike] = useState<Strike | null>(null);
  const lastReport = useRef(0);

  const ended = useCallback((e: unknown) => {
    if (!(e instanceof ApiError)) return false;
    const why = e.code === 'SESSION_REPLACED' ? 'replaced' : e.code === 'ACCOUNT_TEMP_BLOCKED' ? 'blocked' : null;
    if (why) setState({ kind: 'ended', why });
    return !!why;
  }, []);

  async function open() {
    setState({ kind: 'loading' });
    if (!(await drmSupported())) return setState({ kind: 'unsupported' });
    try {
      const p = await clientApi<Playback>(endpoint);
      if (p.status === 'ready' && p.playerUrl) setState({ kind: 'playing', url: p.playerUrl });
      else if (p.status === 'failed') setState({ kind: 'error', message: t('protect.drmFailed') });
      else setState({ kind: 'processing' });
    } catch (e) {
      if (!ended(e)) setState({ kind: 'error', message: errorMessage(e) });
    }
  }

  const playing = state.kind === 'playing';

  // While the player is open, this device must still be the signed-in one.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => { clientApi('/protection/status').catch(ended); }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [playing, ended]);

  // A screenshot key while the player is open is a warning; the third within a week blocks the account.
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k !== 'printscreen' && !(e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(k))) return;
      navigator.clipboard?.writeText('').catch(() => {});
      if (Date.now() - lastReport.current < 5_000) return;
      lastReport.current = Date.now();
      clientApi<Strike>('/protection/violations', { body: { kind: 'screenshot_key', contentId } })
        .then((r) => {
          if (r.exempt) return;
          setStrike(r);
          if (r.blockedUntil) setState({ kind: 'ended', why: 'blocked' });
        })
        .catch(ended);
    };
    window.addEventListener('keyup', onKey, true);
    return () => window.removeEventListener('keyup', onKey, true);
  }, [playing, contentId, ended]);

  return (
    <div className="mt-3" data-testid="drm-player">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line bg-black" onContextMenu={(e) => e.preventDefault()}>
        {state.kind === 'playing' ? (
          <iframe
            src={state.url} title={t('protect.drmTitle')}
            allow="encrypted-media; fullscreen; autoplay" allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state.kind === 'ended' ? (
              <>
                <ShieldAlert size={30} className="text-negative" />
                <p className="font-medium text-white">{state.why === 'blocked' ? t('protect.blockedTitle') : t('protect.replacedTitle')}</p>
                <p className="max-w-sm text-sm text-white/60">{state.why === 'blocked' ? t('protect.blockedBody') : t('protect.replacedBody')}</p>
                {state.why === 'replaced' && <Link href="/login" className="fx-btn fx-primary fx-sm mt-1"><LogIn size={14} />{t('protect.signInAgain')}</Link>}
              </>
            ) : state.kind === 'processing' ? (
              <>
                <Loader2 size={26} className="animate-spin text-neon" />
                <p className="max-w-sm text-sm text-white/70">{t('protect.drmProcessing')}</p>
                <button type="button" onClick={open} className="fx-btn fx-ghost fx-sm"><RefreshCw size={14} />{t('protect.drmRetry')}</button>
              </>
            ) : state.kind === 'unsupported' || state.kind === 'error' ? (
              <>
                <AlertTriangle size={26} className="text-warning" />
                <p className="max-w-sm text-sm text-white/70">{state.kind === 'unsupported' ? t('protect.drmUnsupported') : state.message}</p>
                <button type="button" onClick={open} className="fx-btn fx-ghost fx-sm"><RefreshCw size={14} />{t('protect.drmRetry')}</button>
              </>
            ) : (
              <button type="button" onClick={open} disabled={state.kind === 'loading'} className="fx-btn fx-primary fx-md" data-testid="drm-play">
                {state.kind === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}{t('protect.drmPlay')}
              </button>
            )}
          </div>
        )}
      </div>
      {strike && state.kind === 'playing' && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle size={13} className="mt-px shrink-0" />{t('protect.strikeTitle', { count: strike.strikes, limit: strike.limit })}. {t('protect.strikeBody', { limit: strike.limit })}
        </p>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle"><ShieldCheck size={13} className="shrink-0" />{t('protect.drmNote')}</p>
    </div>
  );
}
