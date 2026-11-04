import { test, expect, type Page } from '@playwright/test';
import { generate } from 'otplib';
import { withProjectPage } from '../../helpers';

const USERNAME = process.env.PANEL_USERNAME;
const PASSWORD = process.env.PANEL_PASSWORD;

// turns 2FA off, or cancels a setup a stopped run left pending (that page shows Cancel instead of enable)
async function reset2fa(page: Page) {
  await page.goto('/account/2fa');
  const disable = page.locator('button:has-text("Click to disable 2FA")');
  const cancel = page.locator('button:has-text("Click to Cancel")');
  if (await disable.isVisible()) await disable.click();
  else if (await cancel.isVisible()) await cancel.click();
  else return;
  await expect(page.getByText('2FA is currently disabled')).toBeVisible();
  await expect(page.locator('button:has-text("Click to enable 2FA")')).toBeVisible();
}

test.beforeAll(async ({ browser }, testInfo) => {
  await withProjectPage(browser, testInfo, reset2fa);
});

// left enabled, every login after this spec would stop at the 2FA prompt
test.afterAll(async ({ browser }, testInfo) => {
  await withProjectPage(browser, testInfo, reset2fa);
});

// ENABLE
test('enable 2FA', async ({ page }) => {
  await page.goto(`/account/2fa`);
  await expect(page.locator('#twofa_code')).not.toBeVisible();
  await expect(page.getByText('2FA is currently disabled')).toBeVisible();
  await page.click('button:has-text("Click to enable 2FA")');
  await page.click('#showLink');
  const secretEl = page.locator('#initiallyhiddencode');
  await expect(secretEl).toBeVisible();
  const totpSecret = (await secretEl.textContent())!.trim();
  expect(totpSecret.length).toBeGreaterThan(10);
  console.log('Captured TOTP secret:', totpSecret);
  await page.goto(`/account/2fa`);
  // the old page has a Step 2 tab, the new one a Next button on step 1
  const step2Tab = page.locator('#dashboard-styled-tab').or(page.getByRole('button', { name: 'Next', exact: true })).first();
  if (await step2Tab.isVisible()) {
    await step2Tab.click();
  }
  // fill the 6-digit code BEFORE confirming
  const otpInput = page.getByRole('textbox', {
    name: 'Enter the 6-digit code from your app to confirm',
  });
  await expect(otpInput).toBeVisible();
  await otpInput.fill(await generate({ secret: totpSecret }));
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('2FA is currently enabled')).toBeVisible();
  // VERIFY dashboard shows 2FA enabled
  await page.goto(`/dashboard`);
  const dashboardTwofa = page.locator('#dashboard_twofa_content');
  await expect(dashboardTwofa).toBeVisible();
  await expect(dashboardTwofa.locator('b')).toHaveText('enabled');
  // TEST with incorrect
  await page.goto(`/login`);
  await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME!);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('#twofa_code')).toBeVisible();
  await page.fill('#twofa_code', '000000');
  await page.click('button[type="submit"]');
  // the new login page shows the error under the code field
  await expect(page.locator('.bg-red-50, .bg-red-500\\/10, #twofa-error')).toBeVisible();
  await expect(page.locator('#twofa_code')).toBeVisible();
  // test with correct
  await page.goto(`/login`);
  await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME!);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('#twofa_code')).toBeVisible();
  const totpToken = await generate({ secret: totpSecret });
  await page.fill('#twofa_code', totpToken);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
});

test('disable 2FA', async ({ page }) => {
  await page.goto(`/account/2fa`);
  await page.click('button:has-text("Click to disable 2FA")');
  await expect(page.getByText('2FA is currently disabled')).toBeVisible();
  // VERIFY dashboard shows 2FA disabled
  await page.goto(`/dashboard`);
  const dashboardTwofa = page.locator('#dashboard_twofa_content');
  await expect(dashboardTwofa).toBeVisible();
  await expect(dashboardTwofa.locator('b')).toHaveText('disabled');
  await page.goto(`/login`);
  await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME!);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/.*dashboard/);
});
