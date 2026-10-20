import { test, expect } from '@playwright/test';

// the account settings and active sessions specs right before this one end the shared session, so log in here
test.use({ storageState: { cookies: [], origins: [] } });

test('logout', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Username' }).fill(process.env.PANEL_USERNAME!);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.PANEL_PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/.*dashboard/);

  await page.locator('#user-btn-info').click();
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/.*login/);

  // validate
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/.*login/);

  console.log('logout terminated session');
});
