import { test, expect } from '@playwright/test';

// /domains/config: a user's main webserver config, saved back unchanged so the user's sites keep working

test('picking a domain opens its owner\'s main webserver config', async ({ page }) => {
  await page.goto('/domains/config');
  await expect(page.getByRole('heading', { name: 'Edit Main Webserver Configuration' })).toBeVisible();
  const select = page.locator('#domains');
  test.skip(await select.count() === 0, 'No domains on this server');

  const option = select.locator('option[data-username]').first();
  const username = (await option.getAttribute('data-username'))!;
  await select.selectOption((await option.getAttribute('value'))!);
  await expect(page).toHaveURL(new RegExp(`/domains/config/${username}$`));
  await expect(page.getByText(`Edit main configuration file for ${username}`)).toBeVisible();
  expect((await page.locator('#conf_content').inputValue()).trim()).not.toBe('');
});

test('an empty config is refused and the saved one is kept', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/domains/config');
  const option = page.locator('#domains option[data-username]').first();
  test.skip(await option.count() === 0, 'No domains on this server');
  const username = (await option.getAttribute('data-username'))!;

  await page.goto(`/domains/config/${username}`);
  const original = await page.locator('#conf_content').inputValue();

  await page.locator('#conf_content').fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(`Main configuration file for ${username} can't be empty, nothing was saved.`)).toBeVisible();
  await page.goto(`/domains/config/${username}`);
  await expect(page.locator('#conf_content')).toHaveValue(original);

  // the same content saved again restarts the webserver with nothing changed
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(new RegExp(`Main configuration file for ${username} saved successfully and \\w+ restarted\\.`))).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#conf_content')).toHaveValue(original);
});
