import { test, expect } from '@playwright/test';

// /plans/resellers: limit templates for reseller accounts, the package made here is deleted at the end

const NAME = `tstrp${Date.now() % 100000}`;

test.describe.configure({ mode: 'serial' });

test('reseller packages page loads', async ({ page }) => {
  await page.goto('/plans/resellers');
  await expect(page.getByRole('heading', { name: 'Reseller Packages' })).toBeVisible();
  await expect(page.getByPlaceholder('Search by package name...')).toBeVisible();
});

test('create, edit and delete a reseller package', async ({ page }) => {
  await page.goto('/plans/resellers');
  await page.getByText('Create New', { exact: true }).click();
  await page.locator('#rp_name').fill(NAME);
  await page.locator('#rp_description').fill('playwright package');
  await page.locator('#rp_max_accounts').fill('3');
  await page.locator('#rp_max_disk_gb').fill('5');
  await page.locator('form:has(#rp_name)').getByRole('button', { name: 'Create' }).click();

  const row = page.locator('tbody tr', { has: page.locator(`a[href="/plans/resellers/${NAME}"]`) });
  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(1)).toHaveText('3');
  await expect(row.locator('td').nth(2)).toHaveText('5 GB');

  // a second package with the same name is refused
  await page.getByText('Create New', { exact: true }).click();
  await page.locator('#rp_name').fill(NAME);
  await page.locator('form:has(#rp_name)').getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(`Reseller package '${NAME}' already exists.`)).toBeVisible();

  await page.goto(`/plans/resellers/${NAME}`);
  await page.locator('#rp_max_accounts').fill('4');
  await page.locator('form:has(#rp_name)').getByRole('button', { name: 'Save' }).click();
  await page.goto('/plans/resellers');
  await expect(row.locator('td').nth(1)).toHaveText('4');

  page.once('dialog', d => d.accept());
  await row.locator(`#rp-${NAME}`).click();
  await page.locator(`#dropdown-rp-${NAME}`).getByRole('button', { name: 'Delete' }).click();
  await expect(row).toHaveCount(0);
});
