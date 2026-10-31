import { test, expect } from '@playwright/test';

// the export tab only renders on an Enterprise license, so every test here skips without it
// the transfer form is never submitted, it SSHes the whole account to a remote server

test('export tab (Enterprise only) offers backup and transfer modes', async ({ page }) => {
  await page.goto('/users/testinguser');
  await expect(page).toHaveURL(/users\/testinguser/);

  const nav = page.getByRole('navigation', { name: 'core navigation links' });
  const exportLink = nav.getByText('Export', { exact: true });
  const hasExportTab = (await exportLink.count()) > 0;
  test.skip(!hasExportTab, 'Export tab not present (non-Enterprise license, or testinguser missing)');

  await exportLink.click();
  await expect(page).toHaveURL(/#export/);
  await expect(page.getByRole('button', { name: 'Generate full account backup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Transfer to another server' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Generate full account backup' })).toBeVisible();

  console.log('export tab loaded with backup/transfer mode toggle');
});

test('backup mode shows existing backups or the empty state, without generating one', async ({ page }) => {
  await page.goto('/users/testinguser#export');

  const generateBtn = page.getByRole('button', { name: /Generate Backup|Backup in progress/ });
  const hasExportTab = (await generateBtn.count()) > 0;
  test.skip(!hasExportTab, 'Export tab not present (non-Enterprise license, or testinguser missing)');

  await expect(generateBtn).toBeVisible({ timeout: 10_000 });

  const emptyState = page.getByText('No backups found. Generate the first one above.');
  const table = page.locator('table').filter({ hasText: 'Filename' });

  const hasBackups = await table.isVisible().catch(() => false);
  if (!hasBackups) {
    await expect(emptyState).toBeVisible();
    console.log('backup mode shows empty state (no backups generated yet)');
    return;
  }

  await expect(table.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  console.log('backup mode lists existing backup archive(s)');
});

test('transfer mode exposes the SSH transfer form fields', async ({ page }) => {
  await page.goto('/users/testinguser#export');

  const transferModeBtn = page.getByRole('button', { name: 'Transfer to another server' });
  const hasExportTab = (await transferModeBtn.count()) > 0;
  test.skip(!hasExportTab, 'Export tab not present (non-Enterprise license, or testinguser missing)');

  await transferModeBtn.click();

  const form = page.locator('#transfer-form');
  await expect(form).toBeVisible();
  await expect(form.locator('#server')).toBeVisible();
  await expect(form.locator('#port')).toBeVisible();
  await expect(form.locator('#username')).toBeVisible();
  await expect(form).toHaveAttribute('action', '/import/transfer/');

  console.log('transfer mode form fields present, action targets /import/transfer/');
});

test('generate, download and delete a full account backup', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  await page.goto('/users/testinguser#export');
  const generate = page.getByRole('button', { name: 'Generate Backup' });
  test.skip(await page.getByRole('button', { name: /Generate Backup|Backup in progress/ }).count() === 0, 'Export tab not present (non-Enterprise license, or testinguser missing)');
  test.skip(await page.getByText('Backup in progress…').isVisible(), 'a backup of testinguser is already running');

  const rows = page.locator('table', { hasText: 'Filename' }).locator('tbody tr');
  await expect(generate).toBeVisible({ timeout: 10_000 });
  const before = await rows.count();

  await generate.click();
  await expect(page.getByText('Backup started.')).toBeVisible();
  // the tab polls every 5s while it runs and lists the archive when it's done
  await expect(page.getByText('Backup in progress…')).toBeHidden({ timeout: 14 * 60_000 });
  await expect(rows).toHaveCount(before + 1, { timeout: 30_000 });

  const names = await rows.locator('td:first-child').allInnerTexts();
  const newest = names.map(n => n.trim()).sort().pop()!;
  const row = rows.filter({ hasText: newest });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    row.getByRole('link', { name: 'Download' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(newest);

  page.once('dialog', d => d.accept());
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Backup deleted.')).toBeVisible();
  await expect(rows).toHaveCount(before);
  console.log(`generated, downloaded and deleted ${newest}`);
});
