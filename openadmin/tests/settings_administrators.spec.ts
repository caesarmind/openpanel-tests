import { test, expect } from '@playwright/test';

test('administrators page loads with table', async ({ page }) => {
  await page.goto('/administrators');
  await expect(page).toHaveURL(/administrators/);
  await expect(page.locator('#exiting_users')).toBeVisible();

  console.log('administrators page loaded');
});

test('search filters the administrators table', async ({ page }) => {
  await page.goto('/administrators');

  const rows = page.locator('#exiting_users tbody tr:not([data-cluster-node])');
  const count = await rows.count();
  test.skip(count === 0, 'No administrators to search');

  const firstUsername = (await rows.first().locator('td').first().innerText()).trim();
  await page.locator('input[x-model="searchQuery"]').fill(firstUsername);
  await page.waitForTimeout(150);

  const matchedRow = rows.filter({ hasText: firstUsername });
  await expect(matchedRow.first()).toBeVisible();
  console.log(`search filtered administrators table to "${firstUsername}"`);
});

test('create, inspect, and delete a new administrator (Enterprise only)', async ({ page }) => {
  await page.goto('/administrators');

  const createBtn = page.locator('#tour-create-admin-btn');
  const isEnterprise = await createBtn.isVisible().catch(() => false);
  test.skip(!isEnterprise, 'Create administrator is an Enterprise-only feature, not available on this license');

  await createBtn.click();

  const testUsername = `tstadmin${Date.now() % 100000}`;
  await page.locator('#username').fill(testUsername);
  await page.locator('#password').fill('TestPassword123');
  await page.getByRole('button', { name: 'Create' }).click();

  // the create button is shown regardless of license tier, but the server
  // still hard-enforces a single-administrator limit on non-Enterprise
  // licenses -- treat that as an expected, environment-specific outcome.
  const licenseLimitError = page.getByText(/only one administrator account/i);
  // one menu button per row carries the username, that's the exact match
  const row = page.locator('#exiting_users tbody tr:not([data-cluster-node])').filter({ has: page.locator(`button.account-menu-btn[data-user="${testUsername}"]`) });

  await expect(row.or(licenseLimitError).first()).toBeVisible({ timeout: 15_000 });

  test.skip(
    await licenseLimitError.isVisible().catch(() => false),
    'License only supports a single Administrator account'
  );

  await expect(row).toBeVisible();
  await expect(row.getByText('Active')).toBeVisible();
  await expect(row.getByText('Admin', { exact: true })).toBeVisible();

  // delete the test administrator we just created
  // scroll first, account_menu.js closes the menu on any scroll and Playwright scrolls smoothly while clicking
  await row.locator('button.account-menu-btn').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await row.locator('button.account-menu-btn').click();
  const dropdown = page.locator('#account-menu');
  await expect(dropdown).toBeVisible();
  await dropdown.getByRole('button', { name: 'Delete' }).click();

  await expect(page.locator(`button.account-menu-btn[data-user="${testUsername}"]`)).toHaveCount(0);
  console.log(`created and deleted test administrator "${testUsername}"`);
});

test('rename and change-password links navigate to dedicated pages', async ({ page }) => {
  await page.goto('/administrators');

  // Target a row that has an edit action button
  const menuBtn = page.locator('#exiting_users tbody tr:not([data-cluster-node]) button.account-menu-btn').first();
  test.skip(await menuBtn.count() === 0, 'No editable administrators available');

  const username = (await menuBtn.getAttribute('data-user'))!;
  // scroll first, account_menu.js closes the menu on any scroll and Playwright scrolls smoothly while clicking
  await menuBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await menuBtn.click();

  const dropdown = page.locator('#account-menu');
  await expect(dropdown.getByRole('link', { name: 'Rename' })).toHaveAttribute('href', `/administrators/rename/${username}`);
  await expect(dropdown.getByRole('link', { name: 'Change Password' })).toHaveAttribute('href', `/administrators/password/${username}`);

  console.log(`verified rename/password links for "${username}"`);
});
