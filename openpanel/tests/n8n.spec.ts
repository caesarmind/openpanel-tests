import { test, expect } from '@playwright/test';
import { deleteApplication, manageSite } from '../site-tabs';
import { ensureDomains, clickInstall, wizardField } from '../helpers';

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
    await page.locator('#domain_id').selectOption({ label: DOMAIN });

    await (await wizardField(page, '#service_name')).fill(APP_NAME);
    await (await wizardField(page, '#owner_email')).fill(OWNER_EMAIL);
    await (await wizardField(page, '#owner_password')).fill(OWNER_PASSWORD);

    await expect.poll(() => page.locator('#version option').count(), { timeout: 30000 }).toBeGreaterThan(0);

    const installResponse = page.waitForResponse(
      r => r.url().includes('/n8n/install') && r.request().method() === 'POST',
      { timeout: 7 * 60 * 1000 },
    );
    await clickInstall(page);

    // the new wizard keeps that line in its collapsed install log and says "... is installed" on its done screen
    await expect(page.getByText(/setup completed/i).and(page.locator(':visible')).or(page.locator('.op-iw-page h1', { hasText: /is installed/i })).first()).toBeVisible({ timeout: 7 * 60 * 1000 });

    // owner creation is best-effort in the installer and only reported in the stream, so check it here
    const log = await (await installResponse).text();
    expect(log, log).toContain('n8n owner account created');
  });

  test('2. verify app appears on /sites', async ({ page }) => {
    await page.goto('/sites');

    const row = page.getByRole('row').filter({ hasText: DOMAIN });
    await expect(row).toBeVisible();

    await manageSite(row);
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
    await deleteApplication(page);

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.getByRole('row').filter({ hasText: DOMAIN })).toHaveCount(0);

    console.log('n8n app removal is working');
  });

});
