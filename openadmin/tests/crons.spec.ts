import { test, expect } from '@playwright/test';

test('manage crons', async ({ page }) => {
  await page.goto('/server/crons');
  await expect(page).toHaveURL(/server\/crons/);

  const saveButton = page.getByRole('button', { name: /save/i });
  const successToast = page.getByText('Cron jobs updated successfully');

  const rows = page.locator('tbody tr').filter({
    has: page.locator('input[name$="_schedule_0"]'),
    });
  const rowCount = await rows.count();

  const nextValue = (val: string) => {
    if (val === '*') return '1';
    if (val.startsWith('*/')) return `*/${parseInt(val.slice(2)) + 1}`;
    if (/^\d+$/.test(val)) return String(Number(val) + 1);
    return '1';
  };

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);

    const firstInput = row.locator('input[name$="_schedule_0"]');

    const originalValue = await firstInput.inputValue();
    const updatedValue = nextValue(originalValue);

    // EDIT
    await firstInput.fill(updatedValue);
    await saveButton.click();
    await expect(successToast).toBeVisible();
    await expect(firstInput).toHaveValue(updatedValue);

    // REVERT
    await firstInput.fill(originalValue);
    await saveButton.click();
    await expect(successToast).toBeVisible();
    await expect(firstInput).toHaveValue(originalValue);
  }
});

test('every job carries its command so a save edits the right line', async ({ page }) => {
  await page.goto('/server/crons');
  const rows = page.locator('#crons_table tbody tr[id]');
  test.skip(await rows.count() === 0, 'no cron jobs on this server');

  for (const row of await rows.all()) {
    const line = await row.getAttribute('id');
    const command = await row.locator(`input[name="${line}_command"]`).inputValue();
    expect(command.trim()).not.toBe('');
    await expect(row).toContainText(command.trim().split(/\s+/).slice(0, 2).join(' '));
  }
});
