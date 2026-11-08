'use client';

import { cx } from '@/components/ui/primitives';
import { fileUrl } from '@/lib/format';
import Image from 'next/image';
import { useState } from 'react';

/** Product images: a large view and a strip of previews to switch it. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return null;
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-surface-2">
        <Image key={images[active]} src={fileUrl(images[active]!)} alt={title} fill unoptimized priority className="object-cover animate-[route-in_0.35s_ease-out]" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((key, i) => (
            <button
              key={key} type="button" onClick={() => setActive(i)} aria-label={`${title} ${i + 1}`} aria-current={i === active}
              className={cx('relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-lg border transition', i === active ? 'border-[color-mix(in_srgb,var(--neon)_70%,transparent)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--neon)_20%,transparent)]' : 'border-line opacity-70 hover:opacity-100')}
            >
              <Image src={fileUrl(key)} alt="" fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
