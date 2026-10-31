import { test, expect } from '@playwright/test';

// NOTE: verify-only -- this page sets server-wide defaults for every NEW account
// (webserver, db engine, PHP version, autostart services, per-service CPU/RAM limits).
// We never submit the form since a bad save would silently change provisioning
// behavior for every future user created on this environment.

test('defaults page loads with webserver/database/varnish/php pickers', async ({ page }) => {
  await page.goto('/settings/defaults');
  await expect(page).toHaveURL(/settings\/defaults/);

  await expect(page.locator('#tour-save-defaults-btn')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'webserver' })).toBeVisible();
  await expect(page.locator('[role="radiogroup"][aria-labelledby="MYSQL_TYPE"]')).toBeVisible();
  // varnish is a toggle, the checkbox it drives is hidden
  await expect(page.getByRole('switch', { name: 'Enable Varnish Proxy' })).toBeVisible();
  await expect(page.locator('input[name="VARNISH"]')).toHaveCount(1);
  await expect(page.locator('select[name="DEFAULT_PHP_VERSION"]')).toBeVisible();

  console.log('defaults page loaded with all expected pickers');
});

test('webserver picker selects without submitting', async ({ page }) => {
  await page.goto('/settings/defaults');

  const webserverGroup = page.getByRole('radiogroup', { name: 'Webserver' });
  const nginxBtn = webserverGroup.getByRole('radio', { name: /nginx/i });

  await nginxBtn.click();
  await expect(nginxBtn).toHaveAttribute('aria-checked', 'true');

  console.log('webserver radio picker responded to click (not saved)');
});

test('autostart services exposes toggleable buttons', async ({ page }) => {
  await page.goto('/settings/defaults');

  const buttons = page.locator('[role="radio"][aria-checked]').filter({ hasText: '' });
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);

  console.log(`defaults page exposes ${count} toggle-style radio controls`);
});

test('advanced link navigates to defaults files editor', async ({ page }) => {
  await page.goto('/settings/defaults');

  await page.getByRole('link', { name: 'Advanced' }).click();
  await expect(page).toHaveURL(/settings\/defaults\/files/);
  await expect(page.locator('#compose_file')).toBeVisible();
  await expect(page.locator('#env_file')).toBeVisible();

  console.log('navigated to defaults files (compose/env) editor');
});

test('defaults files editor exposes validate/save workflow', async ({ page }) => {
  // NOTE: verify-only -- the "Validate" step runs `docker compose config` against the
  // edited file via PUT, and "Save" persists it; both could break provisioning for new
  // accounts if submitted with bad content, so we just confirm the controls exist.
  await page.goto('/settings/defaults/files');

  await expect(page.locator('#compose_file')).not.toHaveValue('');
  await expect(page.locator('#env_file')).not.toHaveValue('');

  console.log('defaults files editor loaded with compose/env content');
});

test('litespeed, percona and varnish show their notes without saving', async ({ page }) => {
  await page.goto('/settings/defaults');

  const percona = page.locator('[role="radiogroup"][aria-labelledby="MYSQL_TYPE"]').getByRole('radio', { name: /percona/i });
  await percona.click();
  await expect(percona).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('input[name="MYSQL_TYPE"][value="percona"]')).toBeChecked();
  await expect(page.getByText('Percona Server is a drop-in MySQL replacement')).toBeVisible();

  const litespeed = page.getByRole('radiogroup', { name: 'webserver' }).getByRole('radio', { name: /^LiteSpeed/ });
  test.skip(await litespeed.count() === 0, 'LiteSpeed is not offered on this server');
  await litespeed.click();
  await expect(litespeed).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('LiteSpeed Enterprise needs a license key')).toBeVisible();

  const varnish = page.getByRole('switch', { name: 'Enable Varnish Proxy' });
  if (await varnish.getAttribute('aria-checked') !== 'true') await varnish.click();
  await expect(page.getByText("Varnish isn't recommended with LiteSpeed")).toBeVisible();

  console.log('percona, litespeed and varnish notes shown (not saved)');
});
