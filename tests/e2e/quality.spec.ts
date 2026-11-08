import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { LOCALES } from '../../packages/config/src/index';
import { login, url } from './helpers';

const PUBLIC = ['/', '/explore', '/marketplace', '/rewards', '/jobs', '/services', '/courses', '/communities', '/creators', '/apps', '/pricing', '/about', '/developers', '/help', '/terms', '/privacy', '/login', '/register', '/forgot-password'];
const ROLES: Record<string, string[]> = {
  'buyer@faith.dev': ['/app', '/app/explore', '/app/orders', '/app/library', '/app/wishlist', '/app/messages', '/app/notifications', '/app/settings', '/app/billing', '/app/ai', '/app/automations', '/cart'],
  'seller@faith.dev': ['/app/seller', '/app/seller/store', '/app/seller/products', '/app/seller/products/new', '/app/seller/orders', '/app/seller/customers', '/app/seller/analytics', '/app/seller/earnings', '/app/seller/growth'],
  'creator@faith.dev': ['/app/creator', '/app/creator/content', '/app/creator/campaigns', '/app/creator/submissions', '/app/creator/earnings', '/app/creator/courses', '/app/creator/community'],
  'brand@faith.dev': ['/app/brand', '/app/brand/campaigns', '/app/brand/campaigns/new', '/app/brand/creators', '/app/brand/analytics', '/app/brand/budget', '/app/brand/hiring'],
  'talent@faith.dev': ['/app/work', '/app/work/applications', '/app/work/portfolio', '/app/freelance', '/app/freelance/services', '/app/freelance/projects'],
  'developer@faith.dev': ['/app/developer', '/app/developer/apps', '/app/developer/apps/new', '/app/developer/keys', '/app/developer/webhooks', '/app/developer/analytics'],
  'admin@faith.dev': ['/admin', '/admin/users', '/admin/marketplace', '/admin/rewards', '/admin/finance', '/admin/apps', '/admin/moderation', '/admin/support', '/admin/settings', '/admin/lab', '/admin/audit'],
};

const WIDTHS = [375, 768, 1440, 1920];

test.describe('every page, at every width', () => {
  for (const width of WIDTHS) {
    test(`public pages at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PUBLIC) {
        const res = await page.goto(url(path), { waitUntil: 'domcontentloaded' });
        expect(res?.status(), path).toBe(200);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  for (const [email, paths] of Object.entries(ROLES)) {
    test(`${email} workspace`, async ({ page }) => {
      test.setTimeout(240_000);
      await login(page, email);
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of paths) {
          const res = await page.goto(url(path), { waitUntil: 'domcontentloaded' });
          expect(res?.status(), path).toBe(200);
          await expect(page.getByRole('heading', { name: 'This page could not load' }), path).toHaveCount(0);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0);
        }
      }
    });
  }
});

test.describe('three.js', () => {
  test('draws a live canvas and keeps three.js off the critical flows', async ({ page }) => {
    // three.js marks its canvases with data-engine; that is the heavy library this rule is about.
    const threeCanvas = page.locator('canvas[data-engine^="three.js"]');
    await page.goto(url('/'));
    await expect(threeCanvas.first()).toBeVisible();
    await page.goto(url('/marketplace'));
    await expect(page.locator('canvas')).toHaveCount(0);
    // Sign-in has only a small decorative shader: no three.js, hidden from assistive tech, never in the way.
    await page.goto(url('/login'));
    await expect(threeCanvas).toHaveCount(0);
    const backdrop = page.locator('canvas').first();
    await expect(backdrop.locator('xpath=ancestor::*[@aria-hidden="true"][1]')).toHaveCount(1);
    expect(await backdrop.evaluate((c) => getComputedStyle(c.parentElement!).pointerEvents)).toBe('none');
    await page.getByLabel('Email', { exact: true }).fill('someone@example.com');
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('someone@example.com');
  });

  test('sign-in works without WebGL', async ({ page }) => {
    await page.goto(url('/login?webgl=off'));
    await expect(page.getByTestId('auth-fallback')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeEnabled();
  });

  test('falls back to static art when WebGL is unavailable', async ({ page }) => {
    await page.goto(url('/?webgl=off'));
    await expect(page.getByTestId('hero-fallback')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('tab', { name: 'Developers' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('Publish apps');
  });

  test('respects reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(url('/'));
    await expect(page.getByTestId('hero-fallback')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await context.close();
  });

  test('a visitor can turn motion on even when the system reduces it', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(url('/'));
    // Calm by default: the economy shows still shapes, not the live story.
    await expect(page.getByTestId('ecosystem-fallback')).toBeAttached();
    await page.getByTestId('motion-toggle').click();
    await expect(page.getByTestId('ecosystem-story')).toBeAttached();
    await expect(page.locator('canvas[data-engine^="three.js"]').first()).toBeVisible();
    // The choice is remembered on this device.
    await page.reload();
    await expect(page.getByTestId('ecosystem-story')).toBeAttached();
    await context.close();
  });

  test('the ecosystem works by keyboard', async ({ page }) => {
    await page.goto(url('/?webgl=off'));
    const tab = page.getByRole('tab', { name: 'Rewards' });
    await tab.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tabpanel')).toContainText('Brands fund campaigns');
  });
});

test.describe('languages', () => {
  for (const locale of LOCALES) {
    test(`${locale} renders with the right direction`, async ({ page }) => {
      const prefix = locale === 'uz' ? '' : `/${locale}`;
      const res = await page.goto(`${prefix}/marketplace`);
      expect(res?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('Uzbek is the default language', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uz');
  });

  test('switching language keeps you on the page', async ({ page }) => {
    await page.goto(url('/pricing'));
    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('menuitem', { name: 'Русский' }).click();
    await page.waitForURL(/\/ru\/pricing/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });
});

test.describe('accessibility', () => {
  for (const path of ['/', '/marketplace', '/login', '/register', '/pricing', '/rewards']) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(url(path));
      await page.waitForTimeout(600);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('canvas').analyze();
      const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
      expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
});
