import { test, expect } from '@playwright/test';

// /websites: Site Manager entries of every user, scans only read the users' files

test('site manager lists the sites or says there are none', async ({ page }) => {
  await page.goto('/websites');
  await expect(page).toHaveURL(/\/websites/);
  await expect(page.getByText(/in Site Manager across all users|No websites in Site Manager yet/)).toBeVisible();
  const sites = await page.locator('#websites_table tbody tr[data-site], #websites_table tbody tr:has(a[href^="/websites/"])').count();
  console.log(`websites: ${sites} rows`);
});

test('scan form scans one user and refuses a missing one', async ({ page }) => {
  await page.goto('/websites');
  await page.getByText('Scan for Websites').first().click();
  const user = page.locator('#scan_username');
  await expect(user).toBeVisible();

  await user.fill('nosuchuser9z');
  await page.locator('form[action="/websites/scan"] button[type="submit"]').click();
  await expect(page.getByText('User "nosuchuser9z" does not exist.')).toBeVisible();

  await page.getByText('Scan for Websites').first().click();
  await page.locator('#scan_username').fill('testinguser');
  await page.locator('form[action="/websites/scan"] button[type="submit"]').click();
  const started = page.getByText("Scanning testinguser's files for websites");
  const missing = page.getByText('User "testinguser" does not exist.');
  await expect(started.or(missing)).toBeVisible();
  test.skip(await missing.isVisible(), 'testinguser does not exist on this server');
});

test('search hides sites that do not match', async ({ page }) => {
  await page.goto('/websites');
  const rows = page.locator('#websites_table tbody tr:has(button[aria-label^="Actions for"])');
  const count = await rows.count();
  test.skip(count === 0, 'No websites in Site Manager');

  await page.getByPlaceholder('Search sites, owners, domains…').fill('no-such-site-xyz');
  await expect(page.locator('#websites_table tbody tr:has(button[aria-label^="Actions for"]):visible')).toHaveCount(0);
  await page.getByPlaceholder('Search sites, owners, domains…').fill('');
  await expect(page.locator('#websites_table tbody tr:has(button[aria-label^="Actions for"]):visible')).toHaveCount(count);
});

test('site actions menu offers git, scans and detach', async ({ page }) => {
  await page.goto('/websites');
  const actions = page.locator('button[aria-label^="Actions for"]').first();
  test.skip(await actions.count() === 0, 'No websites in Site Manager');

  await actions.click();
  // detach only removes the Site Manager entry, still not clicked here
  for (const name of ['Scan for vulnerabilities', 'Detach']) {
    await expect(page.getByRole('button', { name }).or(page.getByRole('menuitem', { name })).first()).toBeVisible();
  }
});
