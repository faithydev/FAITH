import { ApiError } from './errors';

/** Browser request. Goes through the same-origin rewrite so the session cookie applies. */
export async function clientApi<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'same-origin',
  });
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: { code: string; details?: unknown } } | null;
  throw new ApiError(res.status, body?.error?.code ?? 'INTERNAL', body?.error?.details);
}

export async function uploadFile(file: File, purpose: string) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/v1/uploads?purpose=${purpose}`, { method: 'POST', body: form, credentials: 'same-origin' });
  if (res.ok) return (await res.json()) as { id: string; storageKey: string; filename: string };
  const body = (await res.json().catch(() => null)) as { error?: { code: string } } | null;
  throw new ApiError(res.status, body?.error?.code ?? 'INTERNAL');
}

export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
