import { test, expect } from '@playwright/test';

test('update proxy and test restart needed msg', async ({ page }) => {
  test.setTimeout(300_000);

  const randomNum = Math.floor(Math.random() * 100000);
  const randomLink = `newlink${randomNum}`;

  // --- Update setting ---
  await page.goto('/settings/general');
  await expect(page).toHaveURL(/\/settings\/general/);

  const redirectInput = page.getByRole('textbox', { name: /openpanel/i });
  await redirectInput.fill(randomLink);
  await page.getByRole('button', { name: /save settings/i }).click();

  await expect(page.getByRole('alert')).toContainText(/settings updated/i);
  await expect(redirectInput).toHaveValue(randomLink);

  // --- Restart banner appears (only OpenAdmin is flagged) ---
  const restartBanner = page.getByRole('link', { name: /services? needs? restart/i });
  await expect(restartBanner).toBeVisible();
  await restartBanner.click();
  await expect(page).toHaveURL(/\/services/);

  // --- Restart OpenPanel: wait for the completion toast, not the banner ---
  const openpanelBtn = page
    .getByRole('row', { name: 'OpenPanel UI' })
    .getByRole('button', { name: 'Restart openpanel', exact: true })
    // a cluster master shows a column per server, the first one is this server
    .first();

  const openpanelStart = Date.now();
  await openpanelBtn.click();

  await expect(
    page.getByRole('alert').filter({ hasText: /successfully restarted service .openpanel./i })
  ).toBeVisible({ timeout: 120_000 });

  console.log(`OpenPanel restart took ${Math.round((Date.now() - openpanelStart) / 1000)}s`);

  await expect(async () => {
    await page.reload({ timeout: 5_000 });
    await expect(
      page.getByRole('row', { name: 'OpenAdmin UI' })
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000] });

  // The action lock only clears on a fresh page load
  await page.reload();

  // --- Restart OpenAdmin ---
  // Precondition: OpenAdmin is still flagged, so the banner disappearing
  // later can only mean the restart took effect.
  await expect(page.getByRole('link', { name: /1 service needs restart/i })).toBeVisible();

  await page
    .getByRole('row', { name: 'OpenAdmin UI' })
    .getByRole('button', { name: 'Restart admin', exact: true })
    .first()
    .click();
  await expect(page.getByRole('alert')).toContainText(/openadmin is restarting/i);

  await page.waitForTimeout(5_000)

  // Poll with reloads until OpenAdmin is back AND the flag has cleared.
  // While the service is down, reload/goto throws and toPass retries.
  const openadminStart = Date.now();
  await expect(async () => {
    await page.reload({ timeout: 5_000 });
    await expect(page.getByRole('row', { name: 'OpenAdmin UI' })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('link', { name: /needs? restart/i })).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 150_000, intervals: [2_000, 3_000, 5_000] });

  console.log(`OpenAdmin restart took ${Math.round((Date.now() - openadminStart) / 1000)}s`);
});
