import { test, expect } from '@playwright/test';

test('resellers page loads with table', async ({ page }) => {
  await page.goto('/resellers');
  await expect(page).toHaveURL(/resellers/);
  await expect(page.locator('#exiting_users')).toBeVisible();

  console.log('resellers page loaded');
});

test('create a new reseller', async ({ page }) => {
  await page.goto('/resellers');

  // reseller accounts are gated behind a feature flag; enable it first if needed
  const enableBtn = page.getByRole('button', { name: 'Enable Resellers' });
  if (await enableBtn.isVisible().catch(() => false)) {
    await enableBtn.click();
    await expect(enableBtn).toBeHidden({ timeout: 10_000 });
  }

  await page.locator('#tour-create-reseller-btn').click();

  const testUsername = `tstreseller${Date.now() % 100000}`;
  await page.locator('#username').fill(testUsername);
  await page.locator('#password').fill('TestPassword123');
  await page.getByRole('button', { name: 'Create' }).click();

  const row = page.locator('#exiting_users tbody tr').filter({ hasText: testUsername });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText('Active')).toBeVisible();

  console.log(`created test reseller "${testUsername}"`);
});

test('edit plans & limits link navigates to update page', async ({ page }) => {
  await page.goto('/resellers');

  const menuBtn = page.locator('#exiting_users tbody tr:not([data-cluster-node]) button.account-menu-btn').first();
  test.skip(await menuBtn.count() === 0, 'No resellers to inspect');

  const username = (await menuBtn.getAttribute('data-user'))!;
  // scroll first, account_menu.js closes the menu on any scroll and Playwright scrolls smoothly while clicking
  await menuBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await menuBtn.click();

  const dropdown = page.locator('#account-menu');
  await expect(
    dropdown.getByRole('link', { name: 'Edit Plans & Limits' })
  ).toHaveAttribute('href', `/resellers/update/${username}`);

  console.log(`verified edit plans & limits link for "${username}"`);
});

test('delete reseller (runs last)', async ({ page }) => {
  await page.goto('/resellers');

  // only ever delete a reseller this suite created
  const menuBtn = page.locator('#exiting_users tbody tr:not([data-cluster-node]) button.account-menu-btn[data-user^="tstreseller"]').first();
  test.skip(await menuBtn.count() === 0, 'No resellers to delete');

  const username = (await menuBtn.getAttribute('data-user'))!;
  // scroll first, account_menu.js closes the menu on any scroll and Playwright scrolls smoothly while clicking
  await menuBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await menuBtn.click();

  const dropdown = page.locator('#account-menu');
  await expect(dropdown).toBeVisible();

  await dropdown.getByRole('button', { name: 'Delete' }).click();

  await expect(page.locator(`button.account-menu-btn[data-user="${username}"]`)).toHaveCount(0);

  console.log(`deleted reseller "${username}"`);
});
