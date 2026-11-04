import { test, expect } from '@playwright/test';

// Covers modules/phpd/php_extensions.py — /php/extensions, /php/php<version>/extensions,
// /php/php<version>/available-extensions, /php/php<version>/install-extensions(/status)

async function openExtensionsSelector(page: any) {
  await page.goto('/php/extensions');
  await expect(page).toHaveURL(/php\/extensions/);
}

// Classic picks the version in a #php_version select, the new theme links each version as a chip
function versionPicker(page: any) {
  return page.locator('#php_version option').or(page.locator('a.op-chip[href$="/extensions"]'));
}

async function installedVersions(page: any): Promise<string[]> {
  return versionPicker(page).evaluateAll((els: Element[]) =>
    els.map(el => el instanceof HTMLOptionElement ? el.value : el.getAttribute('href')!.match(/\/php\/php(.+)\/extensions$/)![1]).filter(v => v !== '')
  );
}

test('extensions version selector page loads', async ({ page }) => {
  await openExtensionsSelector(page);
  await expect(page.getByRole('heading', { name: /PHP Extensions/i })).toBeVisible();

  await expect(page.locator('#php_version').or(page.locator('.op-chips'))).toBeVisible();
  const optionCount = await versionPicker(page).count();
  expect(optionCount).toBeGreaterThan(0);
});

test('select version navigates to per-version extensions page', async ({ page }) => {
  await openExtensionsSelector(page);

  const values = await installedVersions(page);

  if (values.length === 0) {
    test.skip(true, 'No PHP versions installed');
    return;
  }

  const version = values[0];
  if (await page.locator('#php_version').count()) {
    await page.locator('#php_version').selectOption(version);
    await page.click('#submit_version');
  } else {
    await page.locator(`a.op-chip[href="/php/php${version}/extensions"]`).click();
  }

  await expect(page).toHaveURL(new RegExp(`/php/php${version}/extensions`));
  await expect(page.locator('table')).toBeVisible();
  console.log(`extensions page for PHP ${version} loaded`);
});

test('toggle an extension enable/disable', async ({ page }) => {
  await openExtensionsSelector(page);

  const values = await installedVersions(page);

  if (values.length === 0) {
    test.skip(true, 'No PHP versions installed');
    return;
  }

  const version = values[0];
  await page.goto(`/php/php${version}/extensions`);

  const rows = page.locator('tbody tr');
  const rowCount = await rows.count();
  if (rowCount === 0) {
    test.skip(true, 'No extensions installed for this version');
    return;
  }

  const firstRow = rows.first();
  const statusCell = firstRow.locator('td').nth(1);
  const wasEnabled = (await statusCell.textContent())?.includes('Enabled') ?? false;
  const button = firstRow.locator('button[type="submit"]');
  const expectedLabel = wasEnabled ? 'Enable' : 'Disable';

  await Promise.all([
    page.waitForLoadState('load'),
    button.click(),
  ]);

  const toggled = page.locator('tbody tr').first().locator('td').nth(2).locator('button');
  await expect(toggled).toHaveText(expectedLabel);
  console.log(`extension toggle for PHP ${version} is working`);

  // toggle back, so the extension is as the sites on this version expect it
  await Promise.all([
    page.waitForLoadState('load'),
    toggled.click(),
  ]);
  await expect(page.locator('tbody tr').first().locator('td').nth(2).locator('button')).toHaveText(wasEnabled ? 'Disable' : 'Enable');
});

test('available extensions list loads in install modal', async ({ page }) => {
  await openExtensionsSelector(page);

  const values = await installedVersions(page);

  if (values.length === 0) {
    test.skip(true, 'No PHP versions installed');
    return;
  }

  const version = values[0];
  await page.goto(`/php/php${version}/extensions`);

  await Promise.all([
    page.waitForResponse(res => res.url().includes(`/php/php${version}/available-extensions`) && res.status() === 200),
    page.click('#open-install-modal'),
  ]);
  // the new theme's modal wrapper has no box of its own, only the fixed sheet inside it does
  await expect(page.locator('#available-extensions-list')).toBeVisible();

  const list = page.locator('#available-extensions-list');
  await expect(list).not.toContainText('Loading...');
  console.log(`available extensions list for PHP ${version} loaded`);

  await page.click('#cancel-install-modal');
  await expect(page.locator('#available-extensions-list')).toBeHidden();
});
