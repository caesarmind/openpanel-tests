import { test, expect } from '@playwright/test';
import { deleteApplication, manageSite } from '../site-tabs';
import { ensureDomains, runInstaller, wizardField } from '../helpers';

const DOMAIN = 'matomo.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

const ADMIN_EMAIL = `admin@${DOMAIN}`;

test.setTimeout(12 * 60 * 1000);

test.describe.configure({ mode: 'serial' });

test.describe('Matomo autoinstaller', () => {

  test('1. install app', async ({ page }) => {
    await page.goto('/matomo/install');
    await page.locator('#domain_id').selectOption({ label: DOMAIN });

    await (await wizardField(page, '#admin_email')).fill(ADMIN_EMAIL);
    // admin_login, admin_password and db_* fields are pre-filled by the page's own JS

    await runInstaller(page, 'matomo', 10 * 60 * 1000);
  });

  test('2. verify app appears on /sites', async ({ page }) => {
    await page.goto('/sites');

    const row = page.locator(`tr[id="site-row-${DOMAIN}"]`);
    await expect(row).toBeVisible();

    await manageSite(row);
    await expect(page).toHaveURL(`/website?domain=${DOMAIN}`);
  });

  test('3. verify app is responding', async ({ page }) => {
    const url = `https://${DOMAIN}/`;
    await page.goto(url);

    const timeout = 90000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await page.title().then(t => /matomo/i.test(t)).catch(() => false)) break;
      await page.waitForTimeout(1000);
      await page.reload();
    }

    await expect(page).toHaveTitle(/matomo/i);
    console.log('Matomo autoinstaller is fully working');
  });

  test('4. admin auto-login link generation works', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);

    await page.locator('#matomo_login_button').click();
    await expect(page.getByText(/auto-login link/i)).toBeVisible({ timeout: 15000 });

    console.log('matomo admin login link generation is working');
  });

  test('5. remove app', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);
    await deleteApplication(page);

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.locator(`tr[id="site-row-${DOMAIN}"]`)).not.toBeVisible();

    console.log('matomo uninstall is working');
  });

});
