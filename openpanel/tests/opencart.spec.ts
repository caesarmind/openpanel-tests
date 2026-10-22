import { test, expect } from '@playwright/test';
import { openSiteTab } from '../site-tabs';
import { ensureDomains, runInstaller } from '../helpers';

const DOMAIN = 'opencart.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

const ADMIN_EMAIL = `admin@${DOMAIN}`;

test.setTimeout(12 * 60 * 1000);

test.describe.configure({ mode: 'serial' });

test.describe('OpenCart autoinstaller', () => {

  test('1. install app', async ({ page }) => {
    await page.goto('/opencart/install');

    await page.locator('#domain_id').selectOption({ label: DOMAIN });
    await page.locator('#admin_email').fill(ADMIN_EMAIL);
    // admin_username, admin_password and db_* fields are pre-filled by the page's own JS

    await runInstaller(page, 'opencart', 10 * 60 * 1000);
  });

  test('2. verify app appears on /sites', async ({ page }) => {
    await page.goto('/sites');

    const row = page.locator(`tr[id="site-row-${DOMAIN}"]`);
    await expect(row).toBeVisible();

    await row.getByRole('link', { name: 'Manage', exact: true }).click();
    await expect(page).toHaveURL(`/website?domain=${DOMAIN}`);
  });

  test('3. verify app is responding', async ({ page }) => {
    const url = `https://${DOMAIN}/`;
    await page.goto(url);

    const locator = page.getByText(/your store/i);
    const timeout = 90000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await locator.first().isVisible().catch(() => false)) break;
      await page.waitForTimeout(1000);
      await page.reload();
    }

    await expect(locator.first()).toBeVisible();
    console.log('OpenCart autoinstaller is fully working');
  });

  test('4. admin auto-login link generation works', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);

    await page.locator('#opencart_login_button').click();
    await expect(page.getByText(/auto-login link/i)).toBeVisible({ timeout: 15000 });

    console.log('opencart admin login link generation is working');
  });

  test('5. remove app', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);
    await openSiteTab(page, 'remove');

    await page.getByRole('button', { name: 'Delete Application' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.locator(`tr[id="site-row-${DOMAIN}"]`)).not.toBeVisible();

    console.log('opencart uninstall is working');
  });

});
