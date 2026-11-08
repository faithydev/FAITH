'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../motion/preference';

export type Quality = 'high' | 'medium' | 'low';
export type SceneSupport = { state: 'pending' } | { state: 'static'; reason: 'webgl' | 'motion' } | { state: 'ready'; quality: Quality };

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function pickQuality(): Quality {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const small = window.innerWidth < 768;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData || cores <= 2 || memory <= 2) return 'low';
  if (small || cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

/** Decides what a device gets: a live scene at some quality, or the static artwork. */
export function useSceneSupport(): SceneSupport {
  const reduced = useReducedMotion();
  const [support, set] = useState<SceneSupport>({ state: 'pending' });
  useEffect(() => {
    // `?webgl=off` lets the fallback be exercised on any machine.
    const forced = new URLSearchParams(location.search).get('webgl') === 'off';
    if (forced || !hasWebGL()) return set({ state: 'static', reason: 'webgl' });
    // Follows the site motion setting, which follows the system unless the visitor overrides it.
    set(reduced ? { state: 'static', reason: 'motion' } : { state: 'ready', quality: pickQuality() });
  }, [reduced]);
  return support;
}

/** True while the element is on screen and the tab is visible, so hidden scenes cost nothing. */
export function useActive<T extends Element>() {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(!!e?.isIntersecting), { rootMargin: '120px' });
    io.observe(node);
    const vis = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return [ref, onScreen && tabVisible] as const;
}
