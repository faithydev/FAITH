import { clientApi } from './client';
import { ApiError } from './errors';

type Ticket = { id: string; uploadUrl: string; fields: Record<string, string> };

/**
 * Uploads a paid video to the DRM provider. FAITH asks the provider for a one-time upload address,
 * the browser sends the file there directly (it never passes through FAITH's server, so size is
 * not limited by it), and the provider then encrypts it. Returns the provider's video id.
 */
export async function uploadDrmVideo(file: File, onProgress: (fraction: number) => void): Promise<string> {
  const ticket = await clientApi<Ticket>('/drm/videos', { body: { title: file.name } });
  await new Promise<void>((resolve, reject) => {
    const form = new FormData();
    // Every signed field first; S3 requires the file to come last.
    for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', ticket.uploadUrl);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, 'DRM_UPLOAD_FAILED')));
    xhr.onerror = () => reject(new ApiError(0, 'DRM_UPLOAD_FAILED'));
    xhr.send(form);
  });
  return ticket.id;
}
