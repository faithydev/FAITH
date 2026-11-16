'use client';

import { cx } from '@/components/ui/primitives';
import { Maximize2, Minimize2, Play, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ProtectedVideoLabels = { shieldTitle: string; shieldBody: string; resume: string; fullscreen: string; exitFullscreen: string; note: string };

/** A watermark tile repeated over the whole frame, faint enough to watch through. */
function tile(text: string) {
  const safe = text.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='160'><text x='10' y='90' transform='rotate(-18 160 80)' fill='white' font-family='monospace' font-size='13'>${safe}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/**
 * The lesson player for paid courses. A browser cannot stop every screen recorder (only
 * hardware DRM can blank a recording; that is on the roadmap), so the player does what a web
 * page can:
 *  - the video streams in slices from a same-origin, signed-in, never-cached route;
 *  - the viewer's own name moves across the frame, so any leak points back to its source;
 *  - switching window or app, a screenshot shortcut or a hidden tab pauses and blanks the frame;
 *  - no download button, no picture-in-picture, no casting, no right-click menu;
 *  - fullscreen keeps the watermark, because the frame goes fullscreen, not the bare video.
 */
export function ProtectedVideo({ lessonId, viewer, labels }: { lessonId: string; viewer: string; labels: ProtectedVideoLabels }) {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [shield, setShield] = useState(false);
  const [mark, setMark] = useState({ top: 12, left: 10 });
  const [full, setFull] = useState(false);
  const [fallbackFull, setFallbackFull] = useState(false);
  const stamp = `${viewer} · ${new Date().toISOString().slice(0, 10)}`;
  const posKey = `faith-lesson-pos:${lessonId}`;

  const started = useRef(false);
  const lastSave = useRef(0);

  // Before the first play there is nothing on screen to protect, so switching away is left alone.
  const blank = useCallback(() => {
    const v = video.current;
    if (!v || !started.current) return;
    if (!v.paused) v.pause();
    setShield(true);
  }, []);

  // Pause and blank whenever the page stops being the thing on screen.
  useEffect(() => {
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
  }, [blank]);

  // The name wanders, so it cannot be cropped out of a recording.
  useEffect(() => {
    const id = window.setInterval(() => setMark({ top: 6 + Math.random() * 78, left: 4 + Math.random() * 62 }), 4500);
    return () => window.clearInterval(id);
  }, []);

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
          src={`/api/v1/lessons/${lessonId}/stream`}
          controls preload="metadata" playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture disableRemotePlayback
          draggable={false}
          onLoadedMetadata={restorePosition}
          onTimeUpdate={savePosition}
          onPlay={() => { started.current = true; setShield(false); }}
          className={cx('block aspect-video w-full bg-black', shield && 'invisible', (full || fallbackFull) && 'h-full max-h-full')}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: tile(stamp) }} />
        <span
          aria-hidden data-testid="video-watermark"
          className="pointer-events-none absolute rounded bg-black/25 px-1.5 py-0.5 font-mono text-[0.7rem] text-white/55 transition-[top,left] duration-[1400ms] ease-in-out sm:text-xs"
          style={{ top: `${mark.top}%`, left: `${mark.left}%` }}
        >
          {stamp}
        </span>
        <button
          type="button" onClick={toggleFullscreen} aria-label={full || fallbackFull ? labels.exitFullscreen : labels.fullscreen}
          className="absolute end-2.5 top-2.5 rounded-lg bg-black/55 p-2 text-white/85 opacity-80 backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          {full || fallbackFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        {shield && (
          <div role="status" data-testid="video-shield" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-6 text-center">
            <ShieldCheck size={30} className="text-neon" />
            <p className="font-medium text-white">{labels.shieldTitle}</p>
            <p className="max-w-sm text-sm text-white/60">{labels.shieldBody}</p>
            <button
              type="button" onClick={() => { setShield(false); void video.current?.play().catch(() => {}); }}
              className="fx-btn fx-primary fx-sm mt-1"
            >
              <Play size={14} />{labels.resume}
            </button>
          </div>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle"><ShieldCheck size={13} />{labels.note}</p>
    </div>
  );
}
