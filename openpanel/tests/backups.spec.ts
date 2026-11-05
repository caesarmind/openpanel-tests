import { test, expect } from '@playwright/test';


test('access backups page', async ({ page }) => {
  await page.goto('/backups');
  await expect(page).toHaveURL(/backups/);
  await expect(page.locator('body')).toContainText(/backup/i);
  console.log('backups page accessible');
});


test('access backup settings', async ({ page }) => {
  await page.goto('/backups/settings');
  await expect(page).toHaveURL(/backups\/settings/);
  await expect(page.locator('body')).toContainText(/backup/i);
  console.log('backup settings page accessible');
});


test('save backup settings', async ({ page }) => {
  await page.goto('/backups/settings');
  // the new page has the same submit in its header and its save bar
  await page.getByRole('button', { name: 'Save settings' }).first().click();
  await expect(page.locator('body')).toContainText(/saved|success|updated/i);
  console.log('backup settings saved');
});


test('access backup destination', async ({ page }) => {
  await page.goto('/backups/destination');
  await expect(page).toHaveURL(/backups\/destination/);
  await expect(page.locator('body')).toContainText(/destination|remote|local|storage/i);
  console.log('backup destination page accessible');
});


test('list backups from destination', async ({ page }) => {
  await page.goto('/backups/list');
  await expect(page).toHaveURL(/backups\/list/);
  await expect(page.locator('body')).toContainText(/backup|no backups|list/i);
  console.log('backup list page accessible');
});
