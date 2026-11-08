import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { login, onboard, register, url } from './helpers';

// A minimal valid ZIP, so the upload passes content sniffing on the server.
function zipFile() {
  const path = join(mkdtempSync(join(tmpdir(), 'faith-e2e-')), 'pack.zip');
  writeFileSync(path, Buffer.from('504b050600000000000000000000000000000000000000', 'hex'));
  return path;
}

test('a new person registers, picks roles and switches workspace', async ({ page }) => {
  await register(page);
  await onboard(page, ['sell', 'create']);
  await expect(page).toHaveURL(/\/app/);
  await page.getByTestId('workspace-switcher').click();
  await page.getByRole('menuitem', { name: 'Creator' }).click();
  await page.waitForURL(/\/app\/creator/);
  await expect(page.getByRole('heading', { name: 'Creator Studio' })).toBeVisible();
});

test('a person can skip onboarding and just explore', async ({ page }) => {
  await register(page);
  await page.getByTestId('onboarding-skip').click();
  await page.waitForURL(/\/app/);
  // The greeting follows the visitor's time of day.
  await expect(page.getByRole('heading', { name: /^(Hello|Good (morning|afternoon|evening)),/ })).toBeVisible();
});

test('seller publishes, buyer pays, refund reverses access', async ({ page, browser }) => {
  const title = `E2E Pack ${Date.now()}`;

  await register(page, 'Seller Person');
  await onboard(page, ['sell']);
  await page.goto(url('/app/seller'));
  await page.getByLabel('Store name').fill(`E2E Store ${Date.now()}`);
  await page.getByRole('button', { name: 'Open store' }).click();
  await page.getByRole('link', { name: 'New product' }).first().click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Summary').fill('A pack built by the end-to-end test.');
  await page.getByLabel('Description').fill('Everything a test needs.');
  await page.getByLabel('Price in USD').fill('100.00');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL(/\/app\/seller\/products\/[a-z0-9]+/);
  await page.getByTestId('file-input').setInputFiles(zipFile());
  await expect(page.getByText('.zip').first()).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByTestId('product-status')).toHaveText('Published');

  const buyerContext = await browser.newContext();
  const buyer = await buyerContext.newPage();
  await login(buyer, 'buyer@faith.dev');
  await buyer.goto(url(`/marketplace?q=${encodeURIComponent(title)}`));
  await buyer.getByTestId('product-card').first().click();
  await expect(buyer.getByTestId('product-price')).toHaveText('$100.00');
  await buyer.getByTestId('add-to-cart').click();
  await buyer.waitForURL(/\/cart/);
  await buyer.getByTestId('checkout').click();
  await buyer.waitForURL(/checkout\/simulator/);
  await expect(buyer.getByText('SIMULATED PAYMENT')).toBeVisible();
  await buyer.getByTestId('simulate-success').click();
  await buyer.getByTestId('payment-continue').click();
  await buyer.waitForURL(/\/app\/orders/);
  await buyer.getByRole('link').filter({ hasText: /^F-/ }).first().click();
  await expect(buyer.getByTestId('order-status')).toHaveText('Paid');

  await buyer.goto(url('/app/library'));
  await expect(buyer.getByTestId('library-item').filter({ hasText: title })).toBeVisible();

  await page.goto(url('/app/seller/orders'));
  await expect(page.getByRole('cell', { name: '-$3.50' }).or(page.getByRole('cell', { name: '−$3.50' }))).toBeVisible();
  await expect(page.getByRole('cell', { name: '$96.50' })).toBeVisible();

  await buyer.goto(url('/app/orders'));
  await buyer.getByRole('link').filter({ hasText: /^F-/ }).first().click();
  await buyer.getByRole('button', { name: 'Request a refund' }).click();
  await buyer.getByLabel('Reason').fill('Testing the refund path.');
  await buyer.getByRole('dialog').getByRole('button', { name: 'Request a refund' }).click();
  await expect(buyer.getByText('Refund requested').first()).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Refund requests')).toHaveCount(0);

  await buyer.goto(url('/app/library'));
  await expect(buyer.getByTestId('library-item').filter({ hasText: title })).toHaveCount(0);
  await buyerContext.close();
});

test('a brand runs a campaign and a creator gets paid', async ({ page, browser }) => {
  const title = `E2E Campaign ${Date.now()}`;
  await login(page, 'brand@faith.dev');
  await page.goto(url('/app/brand/campaigns/new'));
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Summary').fill('Created by the end-to-end test.');
  await page.getByLabel('Description').fill('Make a short video.');
  await page.getByLabel('Creative guidelines').fill('Be honest.');
  await page.getByLabel('Deadline').fill(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  await page.getByLabel('Budget').fill('500.00');
  await page.getByLabel('Paid for').selectOption('APPROVED_SUBMISSION');
  await page.getByLabel('Rate').fill('25.00');
  await page.getByLabel('Usage rights').fill('Brand may repost for 30 days.');
  await page.getByLabel('Your permissions').fill('You keep ownership.');
  await page.getByLabel('Attribution').fill('Tag the brand.');
  await page.getByLabel('Advertising disclosure').fill('Include #ad.');
  await page.getByLabel('Prohibited content').fill('Hate speech.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL(/\/app\/brand\/campaigns\/[a-z0-9]+$/);

  await page.getByRole('button', { name: /^Fund/ }).click();
  await page.waitForURL(/checkout\/simulator/);
  await page.getByTestId('simulate-success').click();
  await page.getByTestId('payment-continue').click();
  await page.waitForURL(/\/app\/brand\/campaigns/);
  await page.getByRole('link', { name: title }).click();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByTestId('campaign-status')).toHaveText('In review');
  const campaignUrl = page.url();

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, 'moderator@faith.dev');
  await admin.goto(url('/admin/rewards'));
  await admin.getByRole('listitem').filter({ hasText: title }).getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByRole('listitem').filter({ hasText: title })).toHaveCount(0);
  await adminContext.close();

  const creatorContext = await browser.newContext();
  const creator = await creatorContext.newPage();
  await login(creator, 'kamola@faith.dev');
  // Public listings are cached briefly, so search for this exact campaign.
  await creator.goto(url(`/rewards?q=${encodeURIComponent(title)}`));
  await creator.getByTestId('campaign-card').filter({ hasText: title }).click();
  await creator.getByLabel('Link to your content').fill(`https://youtube.com/watch?v=e2e${Date.now()}`);
  await creator.getByLabel(/I have read the rights/).check();
  await creator.getByRole('button', { name: 'Submit content' }).click();
  await creator.waitForURL(/\/app\/creator\/submissions/);
  await expect(creator.getByTestId('submission').filter({ hasText: title })).toContainText('Submitted');

  await page.goto(campaignUrl);
  await page.getByTestId('review-submission').first().getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByTestId('review-submission').first()).toContainText('Approved');

  await creator.reload();
  await expect(creator.getByTestId('submission').filter({ hasText: title })).toContainText('$25.00');
  await creatorContext.close();
});

test('a job seeker applies and a developer submits an app', async ({ page, browser }) => {
  await register(page, 'Journey Seeker');
  await onboard(page, ['job']);
  await page.goto(url('/jobs'));
  await page.getByTestId('job-card').filter({ hasText: 'Brand Designer' }).click();
  await page.getByLabel('Cover letter').fill('I would love to work on your brand.');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Application sent').first()).toBeVisible();

  const devContext = await browser.newContext();
  const dev = await devContext.newPage();
  await login(dev, 'developer@faith.dev');
  await dev.goto(url('/app/developer/apps/new'));
  await dev.getByLabel('Title').fill(`E2E App ${Date.now()}`);
  await dev.getByLabel('Tagline').fill('Built by a test');
  await dev.getByLabel('Description').fill('A test application.');
  await dev.getByRole('button', { name: 'Save draft' }).click();
  await dev.waitForURL(/\/app\/developer\/apps\/[a-z0-9]+$/);
  await dev.getByRole('button', { name: 'New version' }).click();
  await dev.getByLabel('Version', { exact: true }).fill('1.0.0');
  await dev.getByRole('dialog').getByLabel('Read your orders').check();
  await dev.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await dev.getByRole('button', { name: 'Submit for review' }).click();
  await expect(dev.getByTestId('app-status')).toHaveText('In review');
  await devContext.close();
});

test('Free to Pro through the simulator at the set price', async ({ page }) => {
  // Pro is $11.99 a month, set in the reference data.
  await login(page, 'admin@faith.dev');
  await page.goto(url('/admin/settings'));
  await expect(page.getByText(/Now: \$11.99 monthly/)).toBeVisible();

  await register(page, 'Upgrading Person');
  await page.getByTestId('onboarding-skip').click();
  await page.waitForURL(/\/app/);
  await page.goto(url('/app/billing'));
  await expect(page.getByTestId('current-plan')).toHaveText('Free');
  await page.getByRole('button', { name: /a month/ }).click();
  await page.waitForURL(/checkout\/simulator/);
  await page.getByTestId('simulate-success').click();
  await page.getByTestId('payment-continue').click();
  await page.waitForURL(/\/app\/billing/);
  await expect(page.getByTestId('current-plan')).toHaveText('Pro');
});

test('an ordinary person cannot reach administration', async ({ page }) => {
  await login(page, 'buyer@faith.dev');
  const res = await page.goto(url('/admin'));
  expect(res?.status()).toBe(404);
  const api = await page.request.get('/api/v1/admin/overview');
  expect(api.status()).toBe(403);
});
