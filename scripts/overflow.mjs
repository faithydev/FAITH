#!/usr/bin/env node
/** Development helper: lists elements that stick out past the viewport. */
import { chromium } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const [url, w = '375'] = process.argv.slice(2);
const base = join(homedir(), 'AppData/Local/ms-playwright');
const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const browser = await chromium.launch({ executablePath: join(base, dir, 'chrome-win64', 'chrome.exe') });
const page = await browser.newPage({ viewport: { width: +w, height: 800 } });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const rows = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll('body *')].map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.right > vw + 1 && r.width > 0).slice(0, 14)
    .map(({ el, r }) => `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).slice(0, 70)} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
});
console.log(rows.join('\n') || 'no overflow');
await browser.close();
