import { test, expect } from '@playwright/test';

// "Drop Swap" isn't clicked, swapoff on a busy server can run it out of memory

test('swap page loads with current usage, devices table, and controls', async ({ page }) => {
  await page.goto('/server/swap');
  await expect(page).toHaveURL(/server\/swap/);

  await expect(page.getByRole('heading', { name: 'Swap', level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Total$/ })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Used$/ })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Free$/ })).toBeVisible();

  const rows = page.locator('tbody tr');
  const count = await rows.count();
  if (count === 1 && (await rows.first().locator('td[colspan]').count()) > 0) {
    await expect(page.getByText('No swap devices are currently active.')).toBeVisible();
    console.log('swap page loaded, no active swap devices');
  } else {
    await expect(page.locator('thead').getByText('Priority', { exact: true })).toBeVisible();
    console.log(`swap page loaded with ${count} active swap device(s)`);
  }

  const sizeInput = page.locator('#swap_size_gb');
  await expect(sizeInput).toBeVisible();
  await expect(sizeInput).toHaveAttribute('min', '0.125');
  const prefilled = await sizeInput.inputValue();
  expect(parseFloat(prefilled)).toBeGreaterThan(0);

  await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drop Swap' })).toBeVisible();

  console.log('swap page loaded with allocation and drop controls');
});

test('a size under 128 MB is refused before anything runs', async ({ page }) => {
  await page.goto('/server/swap');
  await page.locator('#swap_size_gb').fill('0.05');
  let posted = false;
  page.on('request', r => { if (r.url().includes('/server/swap/action/')) posted = true; });
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Enter a swap size of at least 0.125 GB.')).toBeVisible();
  expect(posted).toBeFalsy();
});

test('applying the current size recreates the swap file', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/server/swap');
  // with swap in use the file can't be recreated safely mid-run
  const used = await page.locator('tbody tr td:nth-child(4)').allInnerTexts();
  test.skip(used.some(u => parseInt(u) > 0), 'swap is in use');
  test.skip(used.length === 0, 'no swap file to recreate');

  const size = await page.locator('#swap_size_gb').inputValue();
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Apply' }).click();
  // the panel asks in its own dialog, not window.confirm
  await page.locator('[role="alertdialog"] [data-act="ok"], [role="dialog"] [data-act="ok"]').click();
  await expect(page.getByText(`Resizing swap to ${size} GB…`)).toBeVisible();

  const done = page.waitForResponse(async r => r.url().endsWith('/server/swap/action-status') && (await r.json()).done, { timeout: 150_000 });
  const status = await (await done).json();
  expect(status.success, status.message).toBeTruthy();
  await page.waitForLoadState('load');
  await expect(page.locator('#swap_size_gb')).toHaveValue(size, { timeout: 15_000 });
  console.log(`swap recreated at ${size} GB: ${status.message}`);
});
