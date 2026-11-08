import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'FaithDemo2026!';
export const LOCALE = 'en';
export const url = (path: string) => `/${LOCALE}${path}`;

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto(url('/login'));
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL(/\/(app|admin|onboarding)/);
}

/** Registers through the UI, using the labelled development mailbox to confirm the email. */
export async function register(page: Page, name = 'Playwright Person') {
  const [first, ...rest] = name.split(' ');
  const email = `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.faith`;
  await page.goto(url('/register'));
  await page.getByLabel('First name').fill(first!);
  if (rest.length) await page.getByLabel('Last name').fill(rest.join(' '));
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByTestId('check-email')).toBeVisible();
  await page.getByRole('link', { name: 'Open the emailed link' }).click();
  await page.waitForURL(/onboarding/);
  return email;
}

export async function onboard(page: Page, personas: string[]) {
  for (const p of personas) await page.getByTestId(`persona-${p}`).click();
  for (let i = 0; i < 8; i++) {
    const next = page.getByTestId('onboarding-next');
    const finishing = (await next.textContent())?.includes('Finish');
    await next.click();
    if (finishing) break;
  }
  await page.waitForURL(/\/app/);
}

export const api = (request: APIRequestContext) => request;
