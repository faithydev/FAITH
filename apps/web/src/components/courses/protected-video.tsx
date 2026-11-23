'use client';

import { cx } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { clientApi } from '@/lib/client';
import { ApiError } from '@/lib/errors';
import { AlertTriangle, LogIn, Maximize2, Minimize2, Monitor, Play, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

/** A watermark tile repeated over the whole frame, faint enough to watch through. */
function tile(text: string) {
  const safe = text.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='160'><text x='10' y='90' transform='rotate(-18 160 80)' fill='white' font-family='monospace' font-size='13'>${safe}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

type Strike = { strikes: number; limit: number; blockedUntil: string | null; exempt?: boolean };
/** Why the player stopped for good: this device was signed out, or the account was blocked. */
type Ended = 'replaced' | 'blocked' | null;

/** How often a playing video checks that this device is still the signed-in one. */
const HEARTBEAT_MS = 20_000;

/**
 * The player for lesson and VIP video. Paid video is protected as far as a web page can go:
 *  - only the browser's own player may fetch it (the server refuses download managers and
 *    pasted addresses), in slices, never cached;
 *  - the viewer's own name moves across the frame, so any leak points back to its source;
 *  - switching window or app, a screenshot key or a hidden tab pauses and blanks the frame;
 *  - each screenshot key is a warning, and the third within a week blocks the account for a day;
 *  - a sign-in on another device stops playback here within seconds;
 *  - no download button, picture-in-picture, casting or right-click menu.
 * A browser cannot see a screen recorder; in the FAITH desktop app the window is excluded from
 * screen capture by the operating system, so a recording shows nothing.
 * Free video plays without any of this.
 */
export function ProtectedVideo({ src, contentId, viewer, protect = true }: { src: string; contentId: string; viewer: string; protect?: boolean }) {
  const t = useTranslations();
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [shield, setShield] = useState(false);
  const [mark, setMark] = useState({ top: 12, left: 10 });
  const [full, setFull] = useState(false);
  const [fallbackFull, setFallbackFull] = useState(false);
  const [strike, setStrike] = useState<Strike | null>(null);
  const [ended, setEnded] = useState<Ended>(null);
  const stamp = `${viewer} · ${new Date().toISOString().slice(0, 10)}`;
  const posKey = `faith-lesson-pos:${contentId}`;

  const started = useRef(false);
  const lastSave = useRef(0);
  const lastReport = useRef(0);

  const stop = useCallback((why: Ended) => {
    video.current?.pause();
    video.current?.removeAttribute('src');
    video.current?.load();
    setEnded(why);
  }, []);

  /** Learns from an API error whether this device lost its session. */
  const sessionEnded = useCallback((e: unknown) => {
    if (!(e instanceof ApiError)) return false;
    const why: Ended = e.code === 'SESSION_REPLACED' ? 'replaced' : e.code === 'ACCOUNT_TEMP_BLOCKED' ? 'blocked' : null;
    if (why) stop(why);
    return !!why;
  }, [stop]);

  // Before the first play there is nothing on screen to protect, so switching away is left alone.
  const blank = useCallback(() => {
    const v = video.current;
    if (!v || !started.current) return;
    if (!v.paused) v.pause();
    setShield(true);
  }, []);

  const report = useCallback(async () => {
    const now = Date.now();
    if (now - lastReport.current < 5_000) return;
    lastReport.current = now;
    try {
      const r = await clientApi<Strike>('/protection/violations', { body: { kind: 'screenshot_key', contentId } });
      if (r.exempt) return;
      setStrike(r);
      if (r.blockedUntil) stop('blocked');
    } catch (e) {
      sessionEnded(e);
    }
  }, [contentId, stop, sessionEnded]);

  // Pause and blank whenever the page stops being the thing on screen.
  useEffect(() => {
    if (!protect) return;
    const onVisibility = () => { if (document.visibilityState === 'hidden') blank(); };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const screenshot = k === 'printscreen'
        || (e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(k))
        || (e.ctrlKey && e.shiftKey && k === 's')
        || (e.altKey && k === 'printscreen');
      if (screenshot) {
        blank();
        // Best effort: overwrite what a screenshot tool may have put on the clipboard.
        navigator.clipboard?.writeText('').catch(() => {});
        if (started.current) void report();
      }
    };
    window.addEventListener('blur', blank);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.removeEventListener('blur', blank);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, [blank, protect, report]);

  // While it plays, the player checks that this device is still the signed-in one.
  useEffect(() => {
    if (!protect) return;
    const id = window.setInterval(() => {
      if (!started.current || video.current?.paused) return;
      clientApi('/protection/status').catch(sessionEnded);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [protect, sessionEnded]);

  // The name wanders, so it cannot be cropped out of a recording.
  useEffect(() => {
    if (!protect) return;
    const id = window.setInterval(() => setMark({ top: 6 + Math.random() * 78, left: 4 + Math.random() * 62 }), 4500);
    return () => window.clearInterval(id);
  }, [protect]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    const el = frame.current!;
    if (document.fullscreenElement) return void document.exitFullscreen();
    // iPhone Safari cannot put an element fullscreen; the frame then fills the window instead.
    if (el.requestFullscreen) return void el.requestFullscreen().catch(() => setFallbackFull((v) => !v));
    setFallbackFull((v) => !v);
  }

  function restorePosition() {
    try {
      const at = Number(localStorage.getItem(posKey));
      if (at > 5 && video.current && at < video.current.duration - 5) video.current.currentTime = at;
    } catch { /* storage may be unavailable */ }
  }
  function savePosition() {
    const now = Date.now();
    if (now - lastSave.current < 3000 || !video.current) return;
    lastSave.current = now;
    try { localStorage.setItem(posKey, String(Math.floor(video.current.currentTime))); } catch { /* ignore */ }
  }
  /** A refused slice usually means the session ended; ask once to tell which. */
  function onError() {
    if (!protect || ended) return;
    clientApi('/protection/status').catch(sessionEnded);
  }

  return (
    <div className="mt-3">
      <div
        ref={frame} data-testid="protected-video"
        onContextMenu={(e) => e.preventDefault()}
        className={cx(
          'group relative overflow-hidden rounded-2xl border border-line bg-black select-none [-webkit-touch-callout:none]',
          fallbackFull && 'fixed inset-0 z-[200] rounded-none border-0',
          (full || fallbackFull) && 'flex items-center justify-center',
        )}
      >
        <video
          ref={video}
          src={src}
          controls preload="metadata" playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture disableRemotePlayback
          draggable={false}
          onLoadedMetadata={restorePosition}
          onTimeUpdate={savePosition}
          onError={onError}
          onPlay={() => { started.current = true; setShield(false); }}
          className={cx('block aspect-video w-full bg-black', (shield || ended) && 'invisible', (full || fallbackFull) && 'h-full max-h-full')}
        />
        {protect && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: tile(stamp) }} />
            <span
              aria-hidden data-testid="video-watermark"
              className="pointer-events-none absolute rounded bg-black/25 px-1.5 py-0.5 font-mono text-[0.7rem] text-white/55 transition-[top,left] duration-[1400ms] ease-in-out sm:text-xs"
              style={{ top: `${mark.top}%`, left: `${mark.left}%` }}
            >
              {stamp}
            </span>
          </>
        )}
        <button
          type="button" onClick={toggleFullscreen} aria-label={full || fallbackFull ? t('courses.video.exitFullscreen') : t('courses.video.fullscreen')}
          className="absolute end-2.5 top-2.5 rounded-lg bg-black/55 p-2 text-white/85 opacity-80 backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          {full || fallbackFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        {ended ? (
          <div role="alert" data-testid="video-ended" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-6 text-center">
            <ShieldAlert size={30} className="text-negative" />
            <p className="font-medium text-white">{ended === 'blocked' ? t('protect.blockedTitle') : t('protect.replacedTitle')}</p>
            <p className="max-w-sm text-sm text-white/60">{ended === 'blocked' ? t('protect.blockedBody') : t('protect.replacedBody')}</p>
            {ended === 'replaced' && <Link href="/login" className="fx-btn fx-primary fx-sm mt-1"><LogIn size={14} />{t('protect.signInAgain')}</Link>}
          </div>
        ) : shield && (
          <div role="status" data-testid="video-shield" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-6 text-center">
            {strike ? <AlertTriangle size={30} className="text-warning" /> : <ShieldCheck size={30} className="text-neon" />}
            <p className="font-medium text-white">{strike ? t('protect.strikeTitle', { count: strike.strikes, limit: strike.limit }) : t('courses.video.shieldTitle')}</p>
            <p className="max-w-sm text-sm text-white/60">{strike ? t('protect.strikeBody', { limit: strike.limit }) : t('courses.video.shieldBody')}</p>
            <button
              type="button" onClick={() => { setShield(false); void video.current?.play().catch(() => {}); }}
              className="fx-btn fx-primary fx-sm mt-1"
            >
              <Play size={14} />{t('courses.video.resume')}
            </button>
          </div>
        )}
      </div>
      {protect ? (
        <div className="mt-2 space-y-1 text-xs text-subtle">
          <p className="flex items-center gap-1.5"><ShieldCheck size={13} className="shrink-0" />{t('courses.video.note')}</p>
          <p className="flex items-center gap-1.5"><Monitor size={13} className="shrink-0" />{t('protect.appHint')} <Link href="/download" className="underline hover:text-ink">{t('protect.appLink')}</Link></p>
        </div>
      ) : <p className="mt-2 text-xs text-subtle">{t('protect.freeNote')}</p>}
    </div>
  );
}
