import { test, expect } from '@playwright/test';
import { openSiteTab } from '../site-tabs';
import { ensureDomains } from '../helpers';

const DOMAIN = 'n8n.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

const APP_NAME = 'n8naplikacija';
const OWNER_EMAIL = `admin@${DOMAIN}`;
const OWNER_PASSWORD = 'Op3nP4nel_t3st!';

test.describe.configure({ mode: 'serial' });

test.describe('n8n autoinstaller', () => {

  test('1. install app', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);

    await page.goto('/n8n/install');

    await page.locator('#service_name').fill(APP_NAME);
    await page.locator('#domain_id').selectOption({ label: DOMAIN });
    await page.locator('#owner_email').fill(OWNER_EMAIL);
    await page.locator('#owner_password').fill(OWNER_PASSWORD);

    await expect.poll(() => page.locator('#version option').count(), { timeout: 30000 }).toBeGreaterThan(0);

    const installResponse = page.waitForResponse(
      r => r.url().includes('/n8n/install') && r.request().method() === 'POST',
      { timeout: 7 * 60 * 1000 },
    );
    await page.locator('#installButton').click();

    await expect(page.getByText(/setup completed/i)).toBeVisible({ timeout: 7 * 60 * 1000 });

    // owner creation is best-effort in the installer and only reported in the stream, so check it here
    const log = await (await installResponse).text();
    expect(log, log).toContain('n8n owner account created');
  });

  test('2. verify app appears on /sites', async ({ page }) => {
    await page.goto('/sites');

    const row = page.getByRole('row').filter({ hasText: DOMAIN });
    await expect(row).toBeVisible();

    await row.getByRole('link', { name: 'Manage', exact: true }).click();
    await expect(page).toHaveURL(`/website?domain=${DOMAIN}`);
  });

  test('3. owner can log into n8n', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    // owner was created by the installer, so n8n should skip /setup and show the sign-in form
    await expect(async () => {
      await page.goto(`https://${DOMAIN}/signin`);
      await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 150000 });

    await page.locator('input[type="email"]').fill(OWNER_EMAIL);
    await page.locator('input[type="password"]').fill(OWNER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).not.toHaveURL(/signin/, { timeout: 30000 });
    console.log('n8n autoinstaller is fully working');
  });

  test('4. remove app', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);
    await openSiteTab(page, 'remove');

    await page.getByRole('button', { name: 'Delete Application' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.getByRole('row').filter({ hasText: DOMAIN })).toHaveCount(0);

    console.log('n8n app removal is working');
  });

});
