#!/usr/bin/env node
/** Development helper: screenshot a URL at a viewport. node scripts/shot.mjs <url> <out.png> [width] [height] [wait] [--full] [--dark] */
import { chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function localChromium() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  const base = join(homedir(), 'AppData/Local/ms-playwright');
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const exe = dir && join(base, dir, 'chrome-win64', 'chrome.exe');
  return exe && existsSync(exe) ? exe : undefined;
}
const [url, out, w = '1440', h = '900', wait = '3500'] = process.argv.slice(2);
const full = process.argv.includes('--full');
const browser = await chromium.launch({ executablePath: localChromium(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: process.argv.includes('--dark') ? 'dark' : 'light', storageState: process.env.SHOT_STATE });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(+wait);
if (full) {
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: out, fullPage: full });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(JSON.stringify({ overflow, errors: errors.slice(0, 6) }));
await browser.close();
