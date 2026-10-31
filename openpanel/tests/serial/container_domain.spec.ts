import { test, expect } from '@playwright/test';
import { ensureDomains } from '../../helpers';

// a custom container behind a domain from /containers/new, and the domain serving its PHP site again once the container is deleted
// serial: adding and removing the proxy reloads the webserver

const DOMAIN = 'container.tests.openpanel.org';
const SERVICE = 'whoamiapp';
const PHP_MARKER = 'PHP site of the container test';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

test.describe.configure({ mode: 'serial' });

test.describe('custom container on a domain', () => {

  const site = async (page): Promise<string> => {
    try {
      const res = await page.request.get(`https://${DOMAIN}/`, { failOnStatusCode: false, timeout: 10000 });
      return res.status() === 200 ? await res.text() : '';
    } catch {
      return '';
    }
  };

  test('1. domain serves php', async ({ page }) => {
    test.setTimeout(3 * 60_000);
    await page.goto(`/file-manager/edit-file/${DOMAIN}/index.php?editor=text&new=true`);
    await page.locator('#editor-text').fill(`<?php echo '${PHP_MARKER} ' . PHP_VERSION;`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/saved|success/i).first()).toBeVisible();
    await expect.poll(() => site(page), { timeout: 90_000 }).toContain(PHP_MARKER);
  });

  test('2. container added with the domain is served there', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await page.goto('/containers/new');
    await page.locator('#image').fill('traefik/whoami:latest');
    await page.locator('#service_name').fill(SERVICE);
    await page.locator('#cpu').fill('0.5');
    await page.locator('#ram_amount').fill('1');
    await page.locator('#domain').selectOption(DOMAIN);
    await page.locator('#port').fill('80');
    await Promise.all([
      page.waitForURL(url => !url.pathname.startsWith('/containers/new'), { timeout: 180_000 }),
      page.locator('main button[type="submit"]').click(),
    ]);
    // whoami answers with the request it got, the php page is gone while it's attached
    await expect.poll(() => site(page), { timeout: 120_000, intervals: [3000] }).toContain('Hostname:');
  });

  test('3. deleting the container gives the domain its php site back', async ({ page }) => {
    test.setTimeout(4 * 60_000);
    await page.goto(`/containers/delete/${SERVICE}`);
    await Promise.all([
      page.waitForURL(url => !url.pathname.startsWith('/containers/delete'), { timeout: 120_000 }),
      page.getByRole('button', { name: /Delete Service/i }).click(),
    ]);
    await expect.poll(() => site(page), { timeout: 120_000, intervals: [3000] }).toContain(PHP_MARKER);
  });
});
