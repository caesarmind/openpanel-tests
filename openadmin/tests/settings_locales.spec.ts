import { test, expect } from '@playwright/test';

test('locales page loads with table', async ({ page }) => {
  await page.goto('/settings/locales');
  await expect(page).toHaveURL(/settings\/locales/);
  await expect(page.locator('#tour-locales-table')).toBeVisible();

  console.log('locales page loaded');
});

test('search filters the locales table', async ({ page }) => {
  await page.goto('/settings/locales');

  const rows = page.locator('#tour-locales-table tbody tr:not([data-cluster-node])');
  const count = await rows.count();
  test.skip(count === 0, 'No locales available on this environment');

  const firstLocale = (await rows.first().locator('td').nth(1).innerText()).trim();
  await page.locator('input[x-model="searchQuery"]').fill(firstLocale);
  await page.waitForTimeout(150);

  await expect(rows.filter({ hasText: firstLocale }).first()).toBeVisible();
  console.log(`search filtered locales table to "${firstLocale}"`);
});

test('set a different installed locale as default, then revert', async ({ page }) => {
  await page.goto('/settings/locales');

  // rows of other cluster members are left out, the change is made on this server
  const setDefaultButtons = page.locator('#tour-locales-table tbody tr:not([data-cluster-node])').getByRole('button', { name: 'Set as Default' });
  const count = await setDefaultButtons.count();
  test.skip(count === 0, 'Only one (or zero) installed locale available');

  const rows = page.locator('#tour-locales-table tbody tr:not([data-cluster-node])');

  // Find default row specifically by matching exact 'Default' badge text in the cell
  const defaultRow = rows.filter({
    has: page.getByText('Default', { exact: true })
  });
  // the code like en-us is the one exact thing in the row, column positions move with the checkbox and Server columns
  const originalLocale = ((await defaultRow.first().innerText()).match(/\b[a-z]{2}-[a-z]{2}\b/) || [''])[0];
  expect(originalLocale).not.toBe('');

  const firstNonDefaultButton = setDefaultButtons.first();
  test.skip((await setDefaultButtons.count()) === 0, 'Only one installed locale on this server');
  await firstNonDefaultButton.click();

  // Assert that the original locale row no longer has the 'Default' badge
  await expect(
    rows.filter({ hasText: originalLocale }).getByText('Default', { exact: true })
  ).toBeHidden();

  // Find the "Set as Default" button for the original locale row
  const restoreButton = rows
    .filter({ hasText: originalLocale })
    .getByRole('button', { name: 'Set as Default' })
    .first();

  await expect(restoreButton).toBeVisible();
  await restoreButton.click();

  // Assert that the original locale restored its 'Default' badge
  await expect(
    rows.filter({ hasText: originalLocale }).getByText('Default', { exact: true })
  ).toBeVisible();

  console.log(`switched default locale away from "${originalLocale}" and back`);
});

test('install button present for non-installed locales (not clicked)', async ({ page }) => {
  // NOTE: verify-only -- installing a locale is a real, possibly slow package operation;
  // we don't want every test run to install/download locale files on the host.
  await page.goto('/settings/locales');

  const installButtons = page.getByRole('button', { name: /Install/ });
  const count = await installButtons.count();
  test.skip(count === 0, 'All locales already installed on this environment');

  await expect(installButtons.first()).toBeVisible();
  console.log(`found ${count} not-yet-installed locales with an Install action`);
});
