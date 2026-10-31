import { test, expect } from '@playwright/test';

test('create domain', async ({ page }) => {
  await page.goto('/domains');
  await expect(page).toHaveURL(/domains/);

  await page.getByText('Add Domain', { exact: true }).first().click();

  await page.locator('#domain').fill('example.test.rs');
  await page.locator('#username').fill('testinguser');
  // aa-users deletes testinguser at its end, and on a cluster master other servers' users show as "name (server)"
  const owner = page.getByRole('listitem').filter({ hasText: /^\s*testinguser\s*$/ });
  await page.waitForTimeout(1_500);
  test.skip((await owner.count()) === 0, 'testinguser does not exist on this server');
  await owner.first().click();

  await page.getByRole('button', { name: 'Add Domain' }).click();

  // Verify the domain was added
  await expect(page.getByRole('link', { name: 'example.test.rs' })).toBeVisible();
});
