import { test, expect } from '@playwright/test';

// logs in on its own and only ends that login, the shared session the other specs run on stays valid
test.use({ storageState: { cookies: [], origins: [] } });

test('logout', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Username' }).fill(process.env.PANEL_USERNAME!);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.PANEL_PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/.*dashboard/);

  // under load the menu's script can bind after the first click, so open it until the link shows
  const signOut = page.getByRole('link', { name: 'Sign out' });
  await expect(async () => {
    if (!(await signOut.isVisible())) await page.locator('#user-btn-info').click();
    await expect(signOut).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await signOut.click();
  await expect(page).toHaveURL(/.*login/);

  // validate
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/.*login/);

  console.log('logout terminated session');
});
