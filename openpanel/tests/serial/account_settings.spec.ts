import { test, expect, type Page } from '@playwright/test';
import { AUTH_FILE, AUTH_FILE_MODERN, saveLogin } from '../../helpers';

const USERNAME = process.env.PANEL_USERNAME!;
const PASSWORD = process.env.PANEL_PASSWORD!;

async function login(page: Page, password: string) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/.*dashboard/);
}

async function setPassword(page: Page, password: string) {
  await page.goto('/account');
  await page.locator('#password').fill(password);
  await page.locator('#confirm_password').fill(password);
  await page.locator('#save-button').click();
  await expect(page.locator('body')).toContainText(/has been changed successfully/i);
}

test('email address', async ({ page }) => {
  await page.goto('/account');

  const newEmail = `user_${Date.now()}@openpanel.org`;

  const emailInput = page.locator('#email');
  await emailInput.fill(newEmail);
  await page.getByRole('button', { name: 'Update' }).click();

  await expect(page.locator('body')).toContainText(/has been changed successfully/i);
  await expect(emailInput).toHaveValue(newEmail);

  console.log(`email changed to: ${newEmail}`);
});




// TODO: username change



test.describe('password', () => {
  // a password change ends every session of the account, so this logs in on its own
  test.use({ storageState: { cookies: [], origins: [] } });

  test('password', async ({ page, browser }) => {
    const newPassword = 'novipassword';

    await login(page, PASSWORD);

    // CHANGE
    await setPassword(page, newPassword);

    try {
      await page.goto('/files');
      await expect(page).toHaveURL(/.*login/);

      // TEST LOGIN
      await login(page, newPassword);

      console.log(`password changed and login successful`);
    } finally {
      // REVERT, also when the login check failed, or nothing after this can log in
      await page.goto('/account');
      if (/\/login/.test(page.url())) await login(page, newPassword);
      await setPassword(page, PASSWORD);

      // the saved logins the other specs start from were ended too
      await saveLogin(browser, 'classic', AUTH_FILE);
      await saveLogin(browser, 'modern', AUTH_FILE_MODERN);
    }
  });
});
