import { test as setup, expect } from '@playwright/test';
import path from 'path';

export const AUTH_FILE = path.join(__dirname, '../.auth/session.json');
// same login with the modern menu (menu_style cookie), used by the tests-modern project
export const AUTH_FILE_MODERN = path.join(__dirname, '../.auth/session-modern.json');

const BASE_URL = process.env.BASE_URL;
const USERNAME = process.env.PANEL_USERNAME;
const PASSWORD = process.env.PANEL_PASSWORD;

// one login per menu style, so a spec that logs out or ends sessions in one project can't log out the other
setup('authenticate', async ({ browser }) => {
  if (!BASE_URL || !USERNAME || !PASSWORD) {
    throw new Error('BASE_URL, USERNAME and PASSWORD must be set in .env');
  }

  for (const [style, file] of [['classic', AUTH_FILE], ['modern', AUTH_FILE_MODERN]] as const) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    // pin the menu style, so the admin's default menu_style can't change what a project tests
    await context.addCookies([{ name: 'menu_style', value: style, url: BASE_URL }]);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME);
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/.*dashboard/);
    // a fresh account gets the setup wizard and tour over the dashboard, which blocks clicks in every spec
    await page.evaluate(async () => {
      const headers = { 'X-CSRF-Token': (window as any).csrf_token || '' };
      await fetch('/dashboard/onboarding/complete', { method: 'POST', headers });
      await fetch('/dashboard/tour/complete', { method: 'POST', headers });
    });
    await context.storageState({ path: file });
    await context.close();
  }
});
