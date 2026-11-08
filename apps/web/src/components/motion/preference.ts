'use client';

import { useSyncExternalStore } from 'react';

/**
 * Motion preference. FAITH follows the operating system's "reduce motion" setting by default,
 * and a person can override it on the site in either direction (stored per device). The result
 * is written to <html data-reduced>, which CSS and every animated component read, so one switch
 * turns the whole site's motion on or off at once.
 */
export type MotionPref = 'auto' | 'on' | 'off';

const KEY = 'faith-motion';
const EVENT = 'faith-motion';
const query = () => window.matchMedia('(prefers-reduced-motion: reduce)');

export function readPref(): MotionPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Recomputes <html data-reduced> from the stored choice and the system setting. */
export function applyMotion() {
  const pref = readPref();
  const reduced = pref === 'off' || (pref === 'auto' && query().matches);
  const root = document.documentElement;
  root.dataset.motion = pref;
  root.dataset.reduced = String(reduced);
}

export function setMotion(pref: MotionPref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* storage may be unavailable; the choice then lasts for this page only */ }
  applyMotion();
  window.dispatchEvent(new Event(EVENT));
}

export const isReduced = () => typeof document !== 'undefined' && document.documentElement.dataset.reduced === 'true';

function subscribe(onChange: () => void) {
  const media = query();
  const onSystem = () => { applyMotion(); onChange(); };
  media.addEventListener('change', onSystem);
  window.addEventListener(EVENT, onChange);
  return () => { media.removeEventListener('change', onSystem); window.removeEventListener(EVENT, onChange); };
}

/** True when motion should be reduced. Re-renders when the system setting or the site toggle changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, isReduced, () => false);
}
