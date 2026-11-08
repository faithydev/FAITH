#!/usr/bin/env node
/**
 * Draws a cover image for every product that has none: black, neon green and glass, with a
 * motif for the product type (a code window, a dashboard, a course player...). The same slug
 * always gives the same image. Files go to local storage under public/covers and the product's
 * coverKey points at them. Development helper; run after `pnpm bootstrap` or `pnpm showcase`.
 *
 *   node scripts/covers.mjs          only products without a cover
 *   node scripts/covers.mjs --all    redraw every product
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(join(root, 'packages/database/package.json'));
const { createPrismaClient } = require('./dist/index.js');
const sharp = createRequire(join(root, 'package.json'))('sharp');

const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]));
const storageDir = resolve(root, env.STORAGE_DIR || '.dev/storage');
const db = createPrismaClient(env.DATABASE_URL);

const W = 1200;
const H = 750;
const NEON = '#00FF66';
const MINT = '#7DFFB2';

function rng(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** A frosted panel: translucent fill, hairline border, light along the top edge. */
const glass = (x, y, w, h, r = 22, extra = '') =>
  `<g ${extra}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#glassFill)" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>` +
  `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${Math.min(60, h / 3)}" rx="${r}" fill="url(#glassTop)"/></g>`;

const dots = (x, y) => [0, 1, 2].map((i) => `<circle cx="${x + i * 22}" cy="${y}" r="6" fill="${i === 2 ? NEON : 'rgba(255,255,255,0.25)'}"/>`).join('');

const MOTIFS = {
  SOURCE_CODE(r) {
    const lines = Array.from({ length: 9 }, (_, i) => {
      const indent = [0, 40, 40, 80, 80, 40, 0, 40, 0][i];
      const w = 120 + r() * 260;
      const lit = i % 3 === 1;
      return `<rect x="${360 + indent}" y="${230 + i * 36}" width="${w}" height="12" rx="6" fill="${lit ? NEON : 'rgba(255,255,255,0.32)'}" opacity="${lit ? 0.9 : 1}"/>`;
    }).join('');
    return glass(310, 160, 580, 430) + dots(345, 195) + lines +
      `<text x="250" y="420" font-family="monospace" font-size="150" fill="${NEON}" opacity="0.18">{</text><text x="880" y="420" font-family="monospace" font-size="150" fill="${NEON}" opacity="0.18">}</text>`;
  },
  WEBSITE_TEMPLATE(r) {
    return glass(260, 140, 680, 470) + dots(295, 175) +
      `<rect x="295" y="215" width="610" height="150" rx="14" fill="url(#neonFade)"/>` +
      `<rect x="325" y="250" width="${200 + r() * 120}" height="22" rx="8" fill="#fff" opacity="0.9"/><rect x="325" y="288" width="160" height="12" rx="6" fill="#fff" opacity="0.4"/>` +
      `<rect x="325" y="320" width="110" height="28" rx="14" fill="${NEON}"/>` +
      [0, 1, 2].map((i) => `<rect x="${295 + i * 210}" y="390" width="190" height="180" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>`).join('');
  },
  SAAS_ACCESS(r) {
    const bars = Array.from({ length: 10 }, (_, i) => {
      const h = 40 + (i / 9) * 150 + r() * 50;
      return `<rect x="${340 + i * 52}" y="${540 - h}" width="30" height="${h}" rx="6" fill="url(#barFill)" opacity="${i === 9 ? 1 : 0.75}"/>`;
    }).join('');
    return glass(290, 170, 620, 420) + `<rect x="330" y="210" width="140" height="14" rx="7" fill="#fff" opacity="0.8"/><text x="330" y="280" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="48" fill="#fff">+${Math.round(120 + r() * 300)}%</text>` + bars +
      glass(820, 120, 220, 130, 18) + `<circle cx="870" cy="185" r="26" fill="none" stroke="${NEON}" stroke-width="8" stroke-dasharray="120 200"/><rect x="915" y="170" width="90" height="12" rx="6" fill="#fff" opacity="0.7"/><rect x="915" y="192" width="60" height="10" rx="5" fill="#fff" opacity="0.35"/>`;
  },
  DESIGN_TEMPLATE(r) {
    const swatches = [NEON, MINT, '#FFFFFF', '#1E1E1E', '#00A844'].map((c, i) => `<circle cx="${430 + i * 70}" cy="520" r="24" fill="${c}" stroke="rgba(255,255,255,0.2)"/>`).join('');
    return glass(330, 210, 420, 300, 24, 'transform="rotate(-9 540 360)" opacity="0.55"') + glass(400, 170, 420, 300, 24, 'transform="rotate(4 610 320)" opacity="0.8"') + glass(450, 150, 420, 300) +
      `<text x="490" y="330" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="120" fill="#fff">Aa</text><rect x="690" y="215" width="140" height="140" rx="18" fill="url(#neonFade)"/>` + swatches +
      `<rect x="490" y="390" width="${150 + r() * 120}" height="14" rx="7" fill="#fff" opacity="0.4"/>`;
  },
  DIGITAL_DOWNLOAD(r) {
    return [2, 1, 0].map((i) => glass(440 + i * 34, 150 + i * 26, 300, 380, 20, `opacity="${1 - i * 0.25}"`)).join('') +
      `<rect x="480" y="210" width="${130 + r() * 80}" height="14" rx="7" fill="#fff" opacity="0.7"/><rect x="480" y="240" width="120" height="10" rx="5" fill="#fff" opacity="0.3"/>` +
      `<circle cx="590" cy="410" r="62" fill="rgba(0,255,102,0.12)" stroke="${NEON}" stroke-width="3"/><path d="M590 370 V440 M560 412 L590 442 L620 412" stroke="${NEON}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  COURSE(r) {
    const progress = 0.35 + r() * 0.5;
    return glass(300, 150, 600, 380) + `<circle cx="600" cy="320" r="70" fill="rgba(0,255,102,0.14)" stroke="${NEON}" stroke-width="3"/><path d="M580 285 L635 320 L580 355 Z" fill="${NEON}"/>` +
      `<rect x="340" y="480" width="520" height="8" rx="4" fill="rgba(255,255,255,0.15)"/><rect x="340" y="480" width="${520 * progress}" height="8" rx="4" fill="${NEON}"/>` +
      [0, 1, 2].map((i) => `<rect x="${340 + i * 180}" y="560" width="160" height="70" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)"/>`).join('');
  },
  MEMBERSHIP(r) {
    const ring = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + r();
      return `<circle cx="${600 + Math.cos(a) * 210}" cy="${375 + Math.sin(a) * 150}" r="38" fill="rgba(255,255,255,0.08)" stroke="${i % 3 === 0 ? NEON : 'rgba(255,255,255,0.3)'}" stroke-width="3"/>` +
        `<line x1="600" y1="375" x2="${600 + Math.cos(a) * 172}" y2="${375 + Math.sin(a) * 122}" stroke="rgba(0,255,102,0.35)" stroke-width="2"/>`;
    }).join('');
    return ring + `<circle cx="600" cy="375" r="70" fill="url(#neonFade)" stroke="${NEON}" stroke-width="3"/><circle cx="600" cy="352" r="19" fill="#000" opacity="0.75"/><path d="M562 418 Q562 384 600 384 Q638 384 638 418 Z" fill="#000" opacity="0.75"/>`;
  },
  DIGITAL_LICENSE() {
    return glass(400, 160, 400, 430) + `<path d="M600 230 L700 270 V370 Q700 450 600 500 Q500 450 500 370 V270 Z" fill="rgba(0,255,102,0.1)" stroke="${NEON}" stroke-width="4"/><path d="M560 365 L590 395 L645 335" stroke="${NEON}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  SERVICE(r) { return MOTIFS.MEMBERSHIP(r); },
};

function cover(slug, type) {
  const r = rng(slug);
  const gx = 250 + r() * 700;
  const gy = 150 + r() * 300;
  const motif = (MOTIFS[type] ?? MOTIFS.DIGITAL_DOWNLOAD)(r);
  const grid = Array.from({ length: 13 }, (_, i) => `<line x1="${-200 + i * 133}" y1="${H}" x2="${600 + (i - 6) * 40}" y2="560" stroke="rgba(0,255,102,0.12)"/>`).join('') +
    Array.from({ length: 5 }, (_, i) => `<line x1="0" y1="${600 + i * i * 9}" x2="${W}" y2="${600 + i * i * 9}" stroke="rgba(0,255,102,${0.06 + i * 0.02})"/>`).join('');
  const stars = Array.from({ length: 70 }, () => `<circle cx="${r() * W}" cy="${r() * H}" r="${0.6 + r() * 1.4}" fill="#fff" opacity="${0.1 + r() * 0.35}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="${gx / W}" cy="${gy / H}" r="0.6"><stop offset="0" stop-color="${NEON}" stop-opacity="0.32"/><stop offset="0.45" stop-color="#00A844" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="glassFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.1"/><stop offset="1" stop-color="#fff" stop-opacity="0.03"/></linearGradient>
    <linearGradient id="glassTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="neonFade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NEON}" stop-opacity="0.85"/><stop offset="1" stop-color="#003D19" stop-opacity="0.6"/></linearGradient>
    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NEON}"/><stop offset="1" stop-color="${NEON}" stop-opacity="0.25"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="40"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#000"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${stars}
  ${grid}
  <ellipse cx="600" cy="380" rx="320" ry="200" fill="${NEON}" opacity="0.07" filter="url(#soft)"/>
  ${motif}
</svg>`;
}

const all = process.argv.includes('--all');
const products = await db.product.findMany({ where: all ? {} : { coverKey: null }, select: { id: true, slug: true, type: true } });
mkdirSync(join(storageDir, 'public', 'covers'), { recursive: true });
for (const p of products) {
  const key = `public/covers/${p.slug}.webp`;
  await sharp(Buffer.from(cover(p.slug, p.type))).webp({ quality: 86 }).toFile(join(storageDir, key));
  await db.product.update({ where: { id: p.id }, data: { coverKey: key } });
}
console.log(`[faith] drew ${products.length} covers into ${join(storageDir, 'public', 'covers')}`);
await db.$disconnect();
