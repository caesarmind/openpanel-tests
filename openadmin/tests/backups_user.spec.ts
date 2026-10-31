import { test, expect } from '@playwright/test';

// NOTE: the Schedule dropdown on the Settings tab rewrites the real,
// server-wide `opencli docker-backup` cron entry -- switching it to
// Daily/Weekly/Monthly would turn on (or off) centrally-scheduled backups
// for every hosting user on this environment, so that form is never
// submitted here, only read. "Run Backup Now" shells out to `opencli
// docker-backup` for every user and is not clicked either. The Configuration
// tab's default backup.env is scoped to newly-provisioned users only (no
// effect on any existing user), so Restore Default + Save IS exercised for
// real, mirroring the same pattern already used for the domain/file
// templates editors.

test('user backups page loads with Settings/Configuration/Runs tabs and a schedule badge', async ({ page }) => {
  await page.goto('/backups/user');
  await expect(page).toHaveURL(/backups\/user/);

  await expect(page.getByRole('heading', { name: 'User Backups' })).toBeVisible();
  for (const tab of ['Settings', 'Configuration', 'Runs']) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  }

  const badge = page.locator('dt:has-text("Schedule:") + span');
  await expect(badge).toBeVisible();
  console.log(`user backups page loaded with schedule badge "${(await badge.innerText()).trim()}"`);
});

test('settings tab shows the current schedule choice', async ({ page }) => {
  await page.goto('/backups/user#settings');

  const select = page.locator('#schedule_choice');
  await expect(select).toBeVisible();

  const value = await select.inputValue();
  expect(['disabled', 'daily', 'weekly', 'monthly']).toContain(value);
  console.log(`settings tab shows schedule choice "${value}" (not changed)`);
});

test('configuration tab restores and saves the default backup.env', async ({ page }) => {
  await page.goto('/backups/user#configuration');
  await page.getByRole('tab', { name: 'Configuration' }).click();

  // the raw backup.env sits behind the Advanced toggle, the tab opens on the form
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  const textarea = page.locator('#backup_env');
  await expect(textarea).toBeVisible();

  const restoreButton = page.getByRole('button', { name: 'Restore Default' });
  await expect(restoreButton).toBeVisible();
  await restoreButton.click();

  await expect(async () => {
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(0);
  }).toPass({ timeout: 10000 });

  await page.locator('form:has(#backup_env)').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText(/Saved/);

  console.log('configuration tab restored default backup.env and saved it');
});

test('runs tab shows run log or the empty state, gated Run Backup Now by schedule', async ({ page }) => {
  await page.goto('/backups/user#settings');
  const scheduleChoice = await page.locator('#schedule_choice').inputValue();

  await page.goto('/backups/user#runs');
  await page.getByRole('tab', { name: 'Runs' }).click();

  const runButton = page.getByRole('button', { name: 'Run Backup Now' });
  if (scheduleChoice === 'disabled') {
    await expect(runButton).toBeDisabled();
    await expect(page.getByText(/Only available in Admin Configured mode/)).toBeVisible();
  } else {
    await expect(runButton).toBeEnabled();
  }

  const log = page.locator('pre');
  const hasLog = (await log.count()) > 0;
  if (!hasLog) {
    await expect(page.getByText('No backup runs recorded yet.')).toBeVisible();
    console.log('runs tab shows empty state');
    return;
  }
  console.log('runs tab shows run log output');
});
