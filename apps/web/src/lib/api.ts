import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Me, PlatformMeta } from './types';
import { ApiError } from './errors';

const BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000';

/**
 * How long a page waits for the API. A sleeping or slow API must never hold a whole page:
 * optional sections give up quickly and render without their data; pages that need the data
 * wait longer, then show their error state with a retry button.
 */
const OPTIONAL_MS = 4_000;
const REQUIRED_MS = 25_000;

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: { code: string } } | null;
  throw new ApiError(res.status, body?.error?.code ?? 'INTERNAL');
}

/** Signed-in request from a server component. Authorization is decided by the API. */
export async function api<T>(path: string): Promise<T> {
  const cookie = (await cookies()).toString();
  const res = await fetch(`${BASE}/v1${path}`, { headers: { cookie }, cache: 'no-store', signal: AbortSignal.timeout(REQUIRED_MS) });
  return parse<T>(res);
}

/** Public data, cached briefly. Cookies are not sent, so one person's view is never cached. */
export async function publicApi<T>(path: string, revalidate = 30, timeoutMs = REQUIRED_MS): Promise<T> {
  const res = await fetch(`${BASE}/v1${path}`, { next: { revalidate }, signal: AbortSignal.timeout(timeoutMs) });
  return parse<T>(res);
}

/** Public data that a page can render without, such as a landing page section. */
export async function tryPublicApi<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    return await publicApi<T>(path, revalidate, OPTIONAL_MS);
  } catch {
    return null;
  }
}

/** The signed-in person, or null. Deduplicated across one render. */
export const getMe = cache(async (): Promise<Me | null> => {
  const jar = await cookies();
  if (!jar.has('faith_session')) return null;
  try {
    return await api<Me>('/me');
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
});

export const getMeta = cache(async (): Promise<PlatformMeta | null> => tryPublicApi<PlatformMeta>('/health/meta', 15));
