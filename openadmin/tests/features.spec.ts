import { test, expect } from '@playwright/test';

function randomName() {
  return `feature-${Math.random().toString(36).substring(2, 10)}`;
}

let featureSetName: string;

test('list sets', async ({ page }) => {
  await page.goto(`/features/`);
  await expect(page).toHaveURL(/features/);
  await expect(page.getByText('Create a new feature set')).toBeVisible();
  await expect(page.locator('body')).toContainText('default');

  console.log(`default features are listed`);
});

test('create a set', async ({ page }) => {
  featureSetName = randomName();

  await page.goto(`/features/`);
  await page.getByRole('textbox').fill(featureSetName);
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('feature set created successfully')).toBeVisible();

  console.log(`created feature set: ${featureSetName}`);
});



// helper
const assertAllToggles = async (page, expected: 'true' | 'false') => {
  const rows = page.locator('tbody tr');
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const toggle = rows.nth(i).locator('button[type="button"]');
    await expect(toggle).toHaveAttribute('aria-checked', expected);
  }
};

test('edit features', async ({ page }) => {
  await page.goto(`/features/`);
  await expect(page).toHaveURL(/features/);

  const select = page.getByLabel('Manage feature set:');
  await expect(select).toBeVisible();

  const firstFeature = await select.locator('option').evaluateAll(opts =>
    opts.find(o =>
      (o.value || o.textContent || '').startsWith('feature-')
    )?.value
  );

  if (!firstFeature) {
    throw new Error('No feature-* option found in dropdown');
  }

  await select.selectOption(firstFeature);

  await expect(page).toHaveURL(new RegExp(`features/${firstFeature}`));

  const rows = page.locator('tbody tr');
  const count = await rows.count();

  const selectedIndexes = new Set<number>();

  while (selectedIndexes.size < 3 && selectedIndexes.size < count) {
    selectedIndexes.add(Math.floor(Math.random() * count));
  }

  const selectedRows: any[] = [];

  for (const index of selectedIndexes) {
    const row = rows.nth(index);

    const name = await row
      .locator('td')
      .nth(1)
      .locator('span.font-medium')
      .innerText();

    const toggle = row.locator('button[type="button"]');

    const before = await toggle.getAttribute('aria-checked');

    if (before !== 'true') {
      await toggle.click();
    }

    selectedRows.push({ row, toggle, name });
  }

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('features updated successfully')).toBeVisible();

  for (const item of selectedRows) {
    await expect(item.toggle).toHaveAttribute('aria-checked', 'true');
  }

  console.log('Enabled features:', selectedRows.map(f => f.name));
  console.log('editing features is working');
});





test('enable all features', async ({ page }) => {
  await page.goto(`/features/`);
  await expect(page).toHaveURL(/features/);

  const select = page.getByLabel('Manage feature set:');
  await expect(select).toBeVisible();

  const firstFeature = await select.locator('option').evaluateAll(opts =>
    opts.find(o =>
      (o.value || o.textContent || '').startsWith('feature-')
    )?.value
  );

  if (!firstFeature) {
    throw new Error('No feature-* option found in dropdown');
  }

  await select.selectOption(firstFeature);

  await expect(page).toHaveURL(new RegExp(`features/${firstFeature}`));

  await page.getByRole('button', { name: 'Enable All' }).click();
  await page.getByRole('button', { name: 'Save' }).click();  
  
  await expect(page.getByText('features updated successfully')).toBeVisible();
  await assertAllToggles(page, 'true');
  console.log('enable all features is working');
});


test('disable all features', async ({ page }) => {
  await page.goto(`/features/`);
  await expect(page).toHaveURL(/features/);

  const select = page.getByLabel('Manage feature set:');
  await expect(select).toBeVisible();

  const firstFeature = await select.locator('option').evaluateAll(opts =>
    opts.find(o =>
      (o.value || o.textContent || '').startsWith('feature-')
    )?.value
  );

  if (!firstFeature) {
    throw new Error('No feature-* option found in dropdown');
  }

  await select.selectOption(firstFeature);

  await expect(page).toHaveURL(new RegExp(`features/${firstFeature}`));

  await page.getByRole('button', { name: 'Disable All' }).click();
  await page.getByRole('button', { name: 'Save' }).click();  
  
  await expect(page.getByText('features updated successfully')).toBeVisible();
  await assertAllToggles(page, 'false');
  console.log('enable all features is working');
});


test('delete a set', async ({ page }) => {
  await page.goto(`/features/`);
  await expect(page).toHaveURL(/features/);

  const select = page.getByLabel('Manage feature set:');
  await expect(select).toBeVisible();

  const firstFeature = await select.locator('option').evaluateAll(opts =>
    opts.find(o =>
      (o.value || o.textContent || '').startsWith('feature-')
    )?.value
  );

  if (!firstFeature) {
    throw new Error('No feature-* option found in dropdown');
  }

  await select.selectOption(firstFeature);

  await expect(page).toHaveURL(new RegExp(`features/${firstFeature}`));
  
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('deleted successfully')).toBeVisible();

  console.log('deleting features is working');
});



test('prevent delete default set', async ({ page }) => {
  await page.goto(`/features\/default/`);
  await expect(page).toHaveURL(/features\/default/);
  
  await expect(page.getByText('delete')).toBeHidden();
  console.log('deleting default feature set is not permited');
});

