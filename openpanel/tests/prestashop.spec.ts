import { test, expect } from '@playwright/test';
import { openSiteTab } from '../site-tabs';

const DOMAIN = 'prestashop.tests.openpanel.org';
const ADMIN_EMAIL = `admin@${DOMAIN}`;

test.setTimeout(15 * 60 * 1000);

test.describe.configure({ mode: 'serial' });

test.describe('PrestaShop autoinstaller', () => {

  test('1. install app', async ({ page }) => {
    await page.goto('/prestashop/install');

    await page.locator('#domain_id').selectOption({ label: DOMAIN });
    await page.locator('#admin_email').fill(ADMIN_EMAIL);
    // admin_firstname, admin_lastname, admin_password and db_* fields are pre-filled by the page's own JS

    await page.locator('#installButton').click();

    await expect(page.getByText(/installation completed/i)).toBeVisible({ timeout: 13 * 60 * 1000 });
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

    const timeout = 90000;
    const start = Date.now();
    let response;

    while (Date.now() - start < timeout) {
      response = await page.goto(url).catch(() => null);
      if (response && response.ok()) break;
      await page.waitForTimeout(1000);
    }

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/prestashop/i);
    console.log('PrestaShop autoinstaller is fully working');
  });

  test('4. admin auto-login link generation works', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);

    await page.locator('#prestashop_login_button').click();
    await expect(page.getByText(/auto-login link/i)).toBeVisible({ timeout: 15000 });

    console.log('prestashop admin login link generation is working');
  });

  test('5. remove app', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);
    await openSiteTab(page, 'remove');

    await page.getByRole('button', { name: 'Delete Application' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.locator(`tr[id="site-row-${DOMAIN}"]`)).not.toBeVisible();

    console.log('prestashop uninstall is working');
  });

});
