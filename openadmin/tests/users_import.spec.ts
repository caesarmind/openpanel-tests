import { test, expect } from '@playwright/test';

// NOTE: verify-only -- submitting this form for real either restores a full
// account backup (`opencli user-restore`) or clones and runs a third-party
// cPanel/CyberPanel-to-OpenPanel migration script, both of which create a
// real hosting account and its containers. The form is never submitted.

test('import account page loads with backup type selector and file picker', async ({ page }) => {
  await page.goto('/user/import');
  await expect(page).toHaveURL(/user\/import/);

  await expect(page.getByRole('heading', { name: 'Import Account from backup' })).toBeVisible();
  await expect(page.locator('#path')).toBeVisible();

  // cPanel and CyberPanel show as logos, so their radios are found by value
  await expect(page.getByRole('radio', { name: 'OpenPanel' })).toBeVisible();
  for (const value of ['cpanel', 'cyberpanel']) {
    await expect(page.locator(`input[type="radio"][name="backup_type"][value="${value}"]`)).toBeVisible();
  }

  await expect(page.locator('#tour-import-view-logs')).toHaveAttribute('href', '/import/cpanel');

  console.log('import account page loaded with backup type selector and file picker');
});

test('selecting a non-OpenPanel backup type reveals plan selection', async ({ page }) => {
  await page.goto('/user/import');

  const cyberpanelRadio = page.locator('input[type="radio"][name="backup_type"][value="cyberpanel"]');
  await cyberpanelRadio.check();
  await expect(cyberpanelRadio).toBeChecked();

  const planRadios = page.locator('#tour-import-plan');
  const hasPlanSection = (await planRadios.count()) > 0;
  test.skip(!hasPlanSection, 'No hosting plans configured on this environment');

  await expect(planRadios).toBeVisible();
  console.log('selecting CyberPanel backup type revealed the plan selector');
});

test('account imports log page lists past import runs or the empty state', async ({ page }) => {
  await page.goto('/import/openpanel');
  await expect(page).toHaveURL(/import\/openpanel/);

  await expect(page.getByRole('heading', { name: 'Account Imports' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Import Account', exact: true }).last()
  ).toBeVisible();

  const rows = page.locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') });
  const count = await rows.count();
  if (count === 0) {
    await expect(page.getByText('No log files found.')).toBeVisible();
    console.log('account imports page shows empty state');
    return;
  }

  await rows.first().getByRole('button').click();
  await expect(page.locator('#logContent')).not.toHaveText('Loading...', { timeout: 10_000 });
  console.log(`account imports page listed ${count} log row(s), opened first log's content`);
});
