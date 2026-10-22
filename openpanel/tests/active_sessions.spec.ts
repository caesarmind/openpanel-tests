import { test, expect } from '@playwright/test';

test('active sessions: search, activity logs, terminate session', async ({ page, request, browser }) => {

  const ipResponse = await request.get('https://ip.openpanel.com/');
  const ip = (await ipResponse.text()).trim();

  expect(ip).toBeTruthy();


  await page.goto('/account/sessions');

  const table = page.locator('#sessions-table');
  const searchInput = page.locator('[x-model="searchQuery"]');


  const visibleRows = table.locator('tbody tr:visible');


  const ipCell = table.locator('tbody tr', {
    hasText: ip,
  });


  if (await ipCell.count()) {
    await expect(ipCell.first()).toBeVisible();
  }


  await searchInput.fill('randomsearch');


  await page.waitForTimeout(300);

  await expect(visibleRows).toHaveCount(0);


  await searchInput.fill(ip);

  await page.waitForTimeout(300);

  const ipRows = table.locator('tbody tr', { hasText: ip });
  await expect(ipRows.first()).toBeVisible();
  await expect(ipRows.count()).resolves.toBeGreaterThan(0);


  const activityLink = ipRows.first().getByRole('link', {
    name: /view activity logs/i,
  });

  await activityLink.click();

  await expect(page).toHaveURL(new RegExp(`/account/activity\\?search=${ip}`));


  await page.goBack();
  await expect(page).toHaveURL(/\/account\/sessions/);


  // terminate a throwaway login, not the shared session this project (or the other menu project) runs on
  const extra = await browser.newContext({ ignoreHTTPSErrors: true });
  const extraPage = await extra.newPage();
  await extraPage.goto(`${process.env.BASE_URL}/login`);
  await extraPage.getByRole('textbox', { name: 'Username' }).fill(process.env.PANEL_USERNAME!);
  await extraPage.getByRole('textbox', { name: 'Password' }).fill(process.env.PANEL_PASSWORD!);
  await extraPage.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(extraPage).toHaveURL(/.*dashboard/);

  // other workers log in too, so take the token from the row the throwaway login sees as its own
  await extraPage.goto(`${process.env.BASE_URL}/account/sessions`);
  const throwawayAction = await extraPage.locator('#sessions-table tbody tr', { hasText: 'This session' })
    .locator('form').getAttribute('action');
  expect(throwawayAction).toBeTruthy();

  await page.reload();
  await table.locator(`form[action="${throwawayAction}"]`).getByRole('button', { name: /terminate/i }).click();

  await expect(
    page.getByText('Session terminated successfully.')
  ).toBeVisible();

  // the throwaway login is logged out now
  await extraPage.goto(`${process.env.BASE_URL}/dashboard`);
  await expect(extraPage).toHaveURL(/.*login/);
  await extra.close();
});
