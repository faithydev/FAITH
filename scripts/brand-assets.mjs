#!/usr/bin/env node
/**
 * Derives every logo variant from the two supplied originals. Nothing is redrawn:
 * each output is the original artwork, trimmed and with its white background
 * converted to transparency. Regenerate with `pnpm brand:assets`.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'public-assets/brand/source');
const out = join(root, 'apps/web/public/brand');
const icons = join(root, 'apps/web/public/icons');
mkdirSync(out, { recursive: true });
mkdirSync(icons, { recursive: true });

/** Returns raw RGBA where alpha comes from darkness. `tone` fixes the ink colour. */
async function toAlpha(input, { tone, keepShading = false }) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.alloc(info.width * info.height * 4);
  // Pixels at or below `solid` are fully opaque; above it they fade to clear at white.
  const solid = 72;
  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
    const l = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    const a = l <= solid ? 255 : Math.max(0, Math.round((255 * (250 - l)) / (250 - solid)));
    const shade = keepShading ? Math.min(l, solid) : 0;
    const v = tone === 'white' ? 255 - shade : shade;
    px[o] = px[o + 1] = px[o + 2] = v;
    px[o + 3] = a;
  }
  return { px, width: info.width, height: info.height };
}

/** Bounding box of visible ink. */
function bbox({ px, width, height }) {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (px[(y * width + x) * 4 + 3] > 24) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const raw = ({ px, width, height }) => sharp(px, { raw: { width, height, channels: 4 } });

async function variants(file, name, region) {
  for (const [tone, suffix] of [['black', 'black'], ['white', 'white']]) {
    const img = await toAlpha(join(src, file), { tone, keepShading: name === 'faith-mark' });
    const box = region ? region(bbox(img), img) : bbox(img);
    await raw(img).extract(box).png({ compressionLevel: 9 }).toFile(join(out, `${name}-${suffix}.png`));
    await raw(img).extract(box).webp({ lossless: true }).toFile(join(out, `${name}-${suffix}.webp`));
    if (suffix === 'black') console.log(name, box);
  }
}

await variants('faith-mark-original.webp', 'faith-mark');
await variants('faith-wordmark-original.webp', 'faith-lockup');

// Wordmark only: the top line of the lockup, cropped (not redrawn) so it stays legible
// at navigation sizes, where the "AGENCY GROUP" line would be under 6px tall.
const lockup = await toAlpha(join(src, 'faith-wordmark-original.webp'), { tone: 'black' });
const b = bbox(lockup);
let gapStart = null;
for (let y = b.top + 20; y < b.top + b.height; y++) {
  let ink = 0;
  for (let x = b.left; x < b.left + b.width; x++) if (lockup.px[(y * lockup.width + x) * 4 + 3] > 24) ink++;
  if (ink === 0) { gapStart = y; break; }
}
if (gapStart == null) throw new Error('Could not locate the gap between wordmark and sub-line');
const nameBox = { left: b.left, top: b.top, width: b.width, height: gapStart - b.top };
for (const tone of ['black', 'white']) {
  const img = await toAlpha(join(src, 'faith-wordmark-original.webp'), { tone });
  await raw(img).extract(nameBox).png({ compressionLevel: 9 }).toFile(join(out, `faith-wordmark-${tone}.png`));
  await raw(img).extract(nameBox).webp({ lossless: true }).toFile(join(out, `faith-wordmark-${tone}.webp`));
}
console.log('faith-wordmark', nameBox);

// App icons: the mark centred on an ink tile.
const markWhite = await sharp(join(out, 'faith-mark-white.png')).toBuffer();
async function icon(size, pad, file, radius = 0) {
  const inner = Math.round(size * (1 - pad * 2));
  const fg = await sharp(markWhite).resize(inner, inner, { fit: 'inside' }).toBuffer();
  const mask = radius
    ? Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/></svg>`)
    : null;
  let base = sharp({ create: { width: size, height: size, channels: 4, background: { r: 11, g: 11, b: 12, alpha: 1 } } })
    .composite([{ input: fg, gravity: 'centre' }]);
  let buf = await base.png().toBuffer();
  if (mask) buf = await sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  await sharp(buf).png({ compressionLevel: 9 }).toFile(join(icons, file));
}
await icon(32, 0.16, 'favicon-32.png', 7);
await icon(180, 0.2, 'apple-touch-icon.png');
await icon(192, 0.2, 'icon-192.png');
await icon(512, 0.2, 'icon-512.png');
await icon(512, 0.28, 'icon-maskable-512.png');
console.log('done');
