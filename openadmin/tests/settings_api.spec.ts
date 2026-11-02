import { test, expect } from '@playwright/test';

test('api settings page renders branch matching current state', async ({ page }) => {
  await page.goto('/settings/api');
  await expect(page).toHaveURL(/settings\/api/);

  const disabledByBasicAuth = page.getByText('API Access is Disabled because BasicAuth is enabled');
  const disabled = page.getByText('API Access Disabled');
  // with API access on the page shows the Swagger UI explorer
  const enabledForm = page.locator('#swagger-ui-container');

  if (await disabledByBasicAuth.isVisible().catch(() => false)) {
    console.log('api settings: disabled because basic auth is enabled');
  } else if (await enabledForm.isVisible().catch(() => false)) {
    await expect(page.getByRole('button', { name: 'Disable API access' })).toBeVisible();
    console.log('api settings: API access currently enabled, tester form shown');
  } else {
    await expect(disabled).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable API access' })).toBeVisible();
    console.log('api settings: API access currently disabled');
  }
});

test('api explorer loads the endpoint list', async ({ page }) => {
  await page.goto('/settings/api');

  const explorer = page.locator('#swagger-ui-container');
  test.skip(!(await explorer.isVisible().catch(() => false)), 'API access not currently enabled on this environment');

  await expect(explorer.locator('.opblock').first()).toBeVisible({ timeout: 15_000 });
  console.log(`api explorer lists ${await explorer.locator('.opblock').count()} operations`);
});

test('api explorer sends a safe GET request and shows the response', async ({ page }) => {
  await page.goto('/settings/api');

  const explorer = page.locator('#swagger-ui-container');
  test.skip(!(await explorer.isVisible().catch(() => false)), 'API access not currently enabled on this environment');

  // any GET operation will do, it only reads
  const op = explorer.locator('.opblock.opblock-get').first();
  await expect(op).toBeVisible({ timeout: 15_000 });
  await op.locator('.opblock-summary').click();
  await op.getByRole('button', { name: 'Try it out' }).click();
  const params = op.locator('.parameters input:visible, .parameters select:visible');
  test.skip((await params.count()) > 0, 'first GET operation needs parameters');
  await op.getByRole('button', { name: 'Execute' }).click();
  await expect(op.locator('.responses-wrapper .live-responses-table .response-col_status').first()).toBeVisible({ timeout: 15_000 });
  console.log('api explorer executed a GET request and showed the response');
});
