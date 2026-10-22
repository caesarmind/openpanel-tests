import { test, expect } from '@playwright/test';
import { ensureDomains } from '../helpers';

// read-only use of the shared domain, the spec only adds a broken script to it
const DOMAIN = 'shared.tests.openpanel.org';
const MARKER = `pw_undefined_function_${process.env.TEST_RUN_ID || Date.now()}`;

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

test('error logs page loads', async ({ page }) => {
  await page.goto('/error-logs');
  await expect(page).toHaveURL(/error-logs/);
  await expect(page.locator('select[name="domain"]')).toBeVisible();
  await expect(page.locator('select[name="service"]')).toBeVisible();
});

test('a php error shows up and can be copied and downloaded', async ({ page, context }) => {
  test.setTimeout(3 * 60_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // a fatal error the php-fpm/webserver logs pick up
  await page.goto(`/file-manager/edit-file/${DOMAIN}/pw-error.php?editor=text&new=true`);
  await page.locator('#editor-text').fill(`<?php ${MARKER}();`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/saved|success/i).first()).toBeVisible();

  const row = page.locator('#errorLogsTable tbody tr', { hasText: MARKER }).first();
  await expect(async () => {
    await page.request.get(`https://${DOMAIN}/pw-error.php?${Date.now()}`, { failOnStatusCode: false, timeout: 15_000 }).catch(() => {});
    await page.goto(`/error-logs?domain=${DOMAIN}`);
    await expect(row).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 120_000, intervals: [5000] });

  await row.locator('input.bulk-select-box').check();
  const bar = page.locator('#bulk-actions-bar');
  await expect(bar).toContainText('1 selected');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    bar.locator('[data-bulk-action="download"]').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^error-logs-.*\.txt$/);
  const fs = await import('fs');
  expect(fs.readFileSync((await download.path())!, 'utf8')).toContain(MARKER);

  await bar.locator('[data-bulk-action="copy"]').click();
  await expect(page.getByText('Copied to clipboard.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(MARKER);
});
