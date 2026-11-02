import { test, expect } from '@playwright/test';

// /databases: every user's databases per engine, export downloads a dump, import isn't run

for (const [engine, path] of [['MySQL', '/databases'], ['MongoDB', '/databases/mongodb'], ['PostgreSQL', '/databases/postgresql']]) {
  test(`${engine} databases page loads`, async ({ page }) => {
    // the list is cached, refresh reads the users' databases now
    await page.goto(`${path}?refresh=1`);
    await expect(page.getByRole('heading', { name: 'Databases', level: 1 })).toBeVisible();
    await expect(page.getByText('Unable to read users from the database.')).toHaveCount(0);
    await expect(page.getByPlaceholder('Search by database/owner…')).toBeVisible();

    const problems = await page.getByText("Couldn't list databases for").count();
    const rows = await page.locator('table tbody tr:has(a[href^="/users/"])').count();
    console.log(`${engine}: ${rows} databases, ${problems} users that couldn't be listed`);
  });
}

test('search hides databases that do not match', async ({ page }) => {
  await page.goto('/databases?refresh=1');
  const rows = page.locator('table tbody tr:has(a[href^="/users/"])');
  const count = await rows.count();
  test.skip(count === 0, 'No MySQL databases on this server');

  await page.getByPlaceholder('Search by database/owner…').fill('no-such-db-xyz');
  await expect(page.locator('table tbody tr:has(a[href^="/users/"]):visible')).toHaveCount(0);
  await page.getByPlaceholder('Search by database/owner…').fill('');
  await expect(page.locator('table tbody tr:has(a[href^="/users/"]):visible')).toHaveCount(count);
});

test('export downloads an sql dump', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/databases?refresh=1');
  const row = page.locator('table tbody tr:has(form[action="/databases/export"])').first();
  test.skip(await row.count() === 0, 'No MySQL databases on this server');

  const form = row.locator('form[action="/databases/export"]');
  const name = await form.locator('input[name="database"]').inputValue();
  await row.getByRole('button', { name: /More actions for/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 90_000 }),
    form.getByRole('menuitem', { name: 'Export as .sql', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toContain(name);
  console.log(`exported ${download.suggestedFilename()}`);
});

test('import dialog opens for a database and closes without importing', async ({ page }) => {
  await page.goto('/databases?refresh=1');
  const row = page.locator('table tbody tr:has(form[action="/databases/export"])').first();
  test.skip(await row.count() === 0, 'No MySQL databases on this server');

  await row.getByRole('button', { name: /More actions for/ }).click();
  await row.getByRole('menuitem', { name: 'Import', exact: true }).click();
  const dialog = page.locator('div.fixed:has(h3:text("Import into"))');
  await expect(dialog.getByRole('heading', { name: /Import into/ })).toBeVisible();
  // without a file nothing is sent
  await dialog.getByRole('button', { name: 'Import' }).click();
  await expect(dialog.getByText('Choose a .sql or .sql.gz file.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('a database takes its own export back through import', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/databases?refresh=1');
  const row = page.locator('table tbody tr:has(form[action="/databases/export"])').first();
  test.skip(await row.count() === 0, 'No MySQL databases on this server');

  // the same dump goes back in, so the database ends up as it was
  const form = row.locator('form[action="/databases/export"]');
  const name = await form.locator('input[name="database"]').inputValue();
  await row.getByRole('button', { name: /More actions for/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 90_000 }),
    form.getByRole('menuitem', { name: 'Export as .sql.gz' }).click(),
  ]);
  const file = await download.path();

  await row.getByRole('button', { name: /More actions for/ }).click();
  await row.getByRole('menuitem', { name: 'Import', exact: true }).click();
  const dialog = page.locator('div.fixed:has(h3:text("Import into"))');
  await dialog.locator('input[type="file"]').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/gzip', buffer: require('fs').readFileSync(file) });
  const imported = page.waitForResponse(r => r.url().includes('/databases/import'), { timeout: 150_000 });
  await dialog.getByRole('button', { name: 'Import' }).click();
  expect((await imported).status()).toBe(200);
  // a successful import reloads the page, a failed one leaves the error in the dialog
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('table tbody tr', { hasText: name }).first()).toBeVisible();
  console.log(`imported ${download.suggestedFilename()} back into ${name}`);
});
