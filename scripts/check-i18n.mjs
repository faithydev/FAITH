#!/usr/bin/env node
/**
 * Keeps the eight dictionaries honest. Fails if a key used in code is missing, if a locale's keys
 * differ from English, if a value still equals the English text where it should be translated, or
 * if ICU placeholders do not match.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'apps/web/src/messages');
const src = join(root, 'apps/web/src');
const locales = ['uz', 'ru', 'en', 'tr', 'kk', 'ar', 'zh', 'es'];

const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? flatten(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]);
const load = (l) => new Map(flatten(JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8'))));

const files = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
});

const en = load('en');
const used = new Set();
const prefixes = new Set();
for (const file of files(src)) {
  if (file.includes(`${join('src', 'messages')}`)) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]);
  for (const m of text.matchAll(/\bt\(\s*`([^`$]*)\$\{/g)) prefixes.add(m[1]);
  for (const m of text.matchAll(/\bt\.has\(\s*`([^`$]*)\$\{/g)) prefixes.add(m[1]);
  for (const m of text.matchAll(/`([a-zA-Z.]+\.)\$\{/g)) if (en.size && [...en.keys()].some((k) => k.startsWith(m[1]))) prefixes.add(m[1]);
}

let failed = false;
const report = (title, items) => {
  if (!items.length) return;
  failed = true;
  console.error(`\n${title} (${items.length}):`);
  for (const i of items.slice(0, 60)) console.error(`  ${i}`);
  if (items.length > 60) console.error(`  ... and ${items.length - 60} more`);
};

report('Used in code but missing from en.json', [...used].filter((k) => !en.has(k)).sort());
const unused = [...en.keys()].filter((k) => !used.has(k) && ![...prefixes].some((p) => k.startsWith(p)));
if (process.argv.includes('--unused')) report('In en.json but never used', unused.sort());

const placeholders = (v) => [...v.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort().join(',');
// Brand names, product names, and short strings that are the same word in several languages.
const allowSame = /^(brand\.name|app\.roles\.admin|admin\.totalUsers|.*\.(FAITH|url|code))$/;

for (const l of locales.filter((x) => x !== 'en')) {
  let map;
  try {
    map = load(l);
  } catch (e) {
    report(`${l}: dictionary unreadable`, [e.message]);
    continue;
  }
  report(`${l}: missing keys`, [...en.keys()].filter((k) => !map.has(k)));
  report(`${l}: extra keys`, [...map.keys()].filter((k) => !en.has(k)));
  report(`${l}: placeholder mismatch`, [...en].filter(([k, v]) => map.has(k) && placeholders(v) !== placeholders(map.get(k))).map(([k]) => k));
  const same = [...en].filter(([k, v]) => map.get(k) === v && v.length > 12 && !allowSame.test(k)).map(([k]) => k);
  report(`${l}: still identical to English`, same);
}

console.log(`${en.size} keys in ${locales.length} locales, ${used.size} static references in code.`);
if (failed) process.exit(1);
console.log('i18n OK');
