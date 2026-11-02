import { test, expect } from '@playwright/test';

// NOTE: "Run Backup Now" and "Restore" shell out to `opencli backup` (a real,
// potentially slow archive/restore of the system config) and "Delete" removes
// a real backup archive -- none of these are clicked. The Settings tab's
// destination/retention save is a plain config-file write with no side
// effect on any running service, so it IS exercised for real, but the test
// restores the original values afterward.

test('system backups page loads with Backups/Runs/Settings tabs', async ({ page }) => {
  await page.goto('/backups/system');
  await expect(page).toHaveURL(/backups\/system/);

  await expect(page.getByRole('heading', { name: 'System Backups' })).toBeVisible();
  for (const tab of ['Backups', 'Runs', 'Settings']) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Run Backup Now' })).toBeVisible();

  console.log('system backups page loaded with all three tabs and the Run Backup Now control');
});

test('backups tab lists archives or shows the empty state', async ({ page }) => {
  await page.goto('/backups/system#backups');

  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  if (count === 0) {
    await expect(page.getByText(/No backups found/)).toBeVisible();
    console.log('backups tab shows empty state');
    return;
  }

  await expect(page.getByRole('button', { name: 'Restore' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' }).first()).toBeVisible();
  console.log(`backups tab listed ${count} archive row(s)`);
});

test('search filters the backups table', async ({ page }) => {
  await page.goto('/backups/system#backups');

  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  test.skip(count === 0, 'No backup archives on this environment');

  const name = (await rows.first().locator('td').nth(0).innerText()).trim();
  await page.locator('input[placeholder="Search backups…\"]').fill(name);
  await page.waitForTimeout(150);

  await expect(rows.filter({ hasText: name }).first()).toBeVisible();
  console.log(`search filtered backups table to "${name}"`);
});

test('runs tab lists run history or shows the empty state', async ({ page }) => {
  await page.goto('/backups/system#runs');
  await page.getByRole('tab', { name: 'Runs' }).click();
  await expect(page).toHaveURL(/#runs/);

  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  if (count === 0) {
    await expect(page.getByText('No backup runs recorded yet.')).toBeVisible();
    console.log('runs tab shows empty state');
    return;
  }

  await expect(page.locator('thead').getByText('Duration', { exact: true })).toBeVisible();
  console.log(`runs tab listed ${count} run row(s)`);
});

test('settings tab saves and restores destination and retention', async ({ page }) => {
  await page.goto('/backups/system#settings');
  await page.getByRole('tab', { name: 'Settings' }).click();

  const destinationInput = page.locator('#destination');
  const retentionInput = page.locator('#retention_days');

  const originalDestination = await destinationInput.inputValue();
  const originalRetention = await retentionInput.inputValue();

  await destinationInput.fill('/etc/openpanel/backups/system-e2e-test');
  await retentionInput.fill('14');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alert')).toContainText(/Backup settings saved/);
  await expect(destinationInput).toHaveValue('/etc/openpanel/backups/system-e2e-test');
  await expect(retentionInput).toHaveValue('14');

  // restore original values
  await destinationInput.fill(originalDestination);
  await retentionInput.fill(originalRetention);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toContainText(/Backup settings saved/);

  console.log('settings tab saved and restored destination/retention');
});
