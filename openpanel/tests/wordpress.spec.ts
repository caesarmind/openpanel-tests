import { test, expect } from '@playwright/test';
import { openSiteTab } from '../site-tabs';

const domain = 'wp.tests.openpanel.org';

const WP_ADMIN = {
  url: `https://${domain}/wp-admin`,
  username: 'admin',
  password: 'b67sf97sfs3sedf45',
};

test.setTimeout(5 * 60 * 1000);


test('list wordpress sites', async ({ page }) => {
  await page.goto('/wordpress');
  await expect(page).toHaveURL(/wordpress/);
  await expect(page.locator('body')).toContainText(/install wordpress|no wordpress sites|wordpress/i, { timeout: 20000 });
  console.log('wordpress list page accessible');
});


test('install wordpress', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);

  await page.goto('/wordpress/install');
  await expect(page).toHaveURL(/wordpress\/install/);

  await page.locator('#domain_id').selectOption({ label: domain });

  await page.locator('#website_name').fill('My Site');
  await page.locator('#site_description').fill('another site testing');

  await page.locator('#admin_email').fill(`admin@${domain}`);
  await page.locator('#admin_username').fill(WP_ADMIN.username);
  await page.locator('#admin_password').fill(WP_ADMIN.password);

  await page.locator('#installButton').click();

  await expect(page.getByText(/WordPress installation completed!/i)).toBeVisible({ timeout: 30000 });
  console.log('wordpress install completed');

  await page.goto('/wordpress');
  await expect(page.locator('body')).toContainText(domain, { timeout: 20000 });
  console.log('wordpress site appears in list');

  await page.goto(`http://${domain}`);
  await expect(page.locator('body')).toContainText('Hello world!');
  console.log('wordpress install is working');
});


test.describe.serial('wp-admin tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WP_ADMIN.url, { waitUntil: 'domcontentloaded' });
    await page.fill('#user_login', WP_ADMIN.username);
    await page.fill('#user_pass', WP_ADMIN.password);
    await Promise.all([
      page.waitForURL(/wp-admin/, { timeout: 30000 }),
      page.click('#wp-submit'),
    ]);
    await expect(page.locator('#wpadminbar')).toBeVisible({ timeout: 30000 });
  });

  test('wp-admin - upgrade wordpress core', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    await page.goto(`${WP_ADMIN.url}/update-core.php`, { waitUntil: 'domcontentloaded' });

    const upgradeButton = page.locator('input#upgrade[name="upgrade"]');
    if (await upgradeButton.count()) {
      await expect(upgradeButton).toBeVisible();
      console.log('WordPress core update available, clicking update button...');
      await Promise.all([
        page.waitForURL(/update\.php|update-core\.php/, { timeout: 5 * 60 * 1000 }),
        upgradeButton.click(),
      ]);
      await expect(page.locator('body')).toContainText(
        /WordPress has been updated|Update Complete|Welcome to WordPress|Success/i,
        { timeout: 5 * 60 * 1000 }
      );
      console.log('WordPress core update completed');
    } else {
      console.log('WordPress core already up to date');
    }
  });

test('wp-admin - install scrollchart plugin', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  await page.goto(`${WP_ADMIN.url}/plugin-install.php`, { waitUntil: 'domcontentloaded' });

  await page.fill('#search-plugins', 'Scrollchart');
  await page.keyboard.press('Enter');

  const scrollchartCard = page
    .locator('.plugin-card')
    .filter({ hasText: 'Scrollchart' })
    .first();

  await expect(scrollchartCard).toBeVisible({ timeout: 60000 });

  const installButton = scrollchartCard.locator('.install-now');

  if (await installButton.count()) {
    console.log('Installing Scrollchart plugin...');
    await installButton.click();

    await expect(scrollchartCard).toContainText(/Installed|Activate/i, {
      timeout: 60000,
    });
  } else {
    console.log('Plugin may already be installed.');
  }

  await page.goto(`${WP_ADMIN.url}/plugins.php`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body')).toContainText('Scrollchart', {
    timeout: 30000,
  });

  console.log('SUCCESS: Scrollchart found on Installed Plugins page');
});

test('wp-admin - install nexusslash theme', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  await page.goto(`${WP_ADMIN.url}/theme-install.php?search=nexusslash`, {
    waitUntil: 'networkidle',
  });

  const nexusslashTheme = page.locator('.theme[data-slug="nexusslash"]').first();

  await expect(nexusslashTheme).toBeVisible({ timeout: 60000 });
  await expect(nexusslashTheme.locator('.theme-name')).toHaveText(/NexusSlash/i);

  const installButton = nexusslashTheme.locator(
    'a.theme-install[data-slug="nexusslash"]'
  );

  if (await installButton.count()) {
    console.log('Installing NexusSlash theme...');

    await installButton.click();

    // Wait for the Install button to become Activate
    const activateButton = nexusslashTheme.locator(
      'a.activate, a.theme-activate, .button.activate'
    );

    await expect(activateButton).toBeVisible({
      timeout: 20000,
    });

    console.log('NexusSlash installation completed.');
  } else {
    console.log('NexusSlash theme may already be installed.');
  }

  await page.goto(`${WP_ADMIN.url}/themes.php`, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page.locator('body')).toContainText(/NexusSlash/i, {
    timeout: 30000,
  });

  console.log('SUCCESS: NexusSlash found on Installed Themes page');
});
});

test('wordpress security hardening page', async ({ page }) => {
  await page.goto(`/wordpress/secure/${domain}`);
  await expect(page).toHaveURL(/wordpress\/secure/);
  await expect(page.locator('body')).toContainText('[]');
  console.log('wordpress security page accessible');
});


test('wordpress vulnerability scan', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  await page.goto(`/json/wp_vulnerability/${domain}`);
  await expect(page.locator('body')).toContainText(/core_version_|plugin_|theme_/i, { timeout: 30000 });
  console.log('wordpress vulnerability scan page working');
});


test('wp-cli check update preferences check', async ({ page }) => {
  await page.goto(`/wordpress/wp-cli/update_info?domain=${domain}&docroot=/var/www/html/wp.tests.openpanel.org`);  
  await expect(page.locator('body')).toContainText(/WP_AUTO_UPDATE_CORE|WP_AUTO_UPDATE_PLUGINS|WP_AUTO_UPDATE_THEMES/i, { timeout: 30000 });
  console.log('wp-cli update check working');
});


test('generate backup', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  await page.goto(`/website?domain=${domain}`);

  // route is POST-only and needs the csrf header
  const result = await page.evaluate(async (d) => {
    const res = await fetch(`/wordpress/backup/run/${d}?docroot=/var/www/html/${d}&backup_database=true&backup_files=true`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': (window as any).csrf_token },
    });
    return { status: res.status, body: await res.text() };
  }, domain);

  expect(result.status, result.body).toBe(200);
  expect(result.body).toContain('Backup completed successfully!');
  console.log('wordpress backup generated');
});


test('list backup', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  await page.goto(`/wordpress/backup/get_dates/${domain}?docroot=/var/www/html/wp.tests.openpanel.org`);
  await expect(page.locator('body')).toContainText(/hasFilesBackup|hasDbBackup|date/i, { timeout: 2 * 60 * 1000 });
  console.log('wordpress backup available');
});


test('wordpress reload data', async ({ page }) => {
  await page.goto('/wordpress/reload_data');
  // should return JSON or redirect back
  const body = await page.locator('body').textContent();
  expect(body).toBeTruthy();
  console.log('wordpress reload data working');
});


// TODO: cover wp-manager tabs: security, updates, debugging, backup, clone, remove

test('wp manager data', async ({ page }) => {
  await page.goto('/website?domain=wp.tests.openpanel.org');

  // WP version (e.g. 6.5.2)
  const wpVersion = await page.locator('#wp-version').textContent();
  expect(wpVersion).toMatch(/\b\d+\.\d+(\.\d+)?\b/);

  // PHP version (e.g. 8.1.12)
  const phpVersion = await page.locator('#php-version').textContent();
  expect(phpVersion).toMatch(/\b\d+\.\d+(\.\d+)?\b/);

  // MySQL / MariaDB version (e.g. 10.6.12-MariaDB or 8.0.36)
  const mysqlVersion = await page.locator('#mysql-version').textContent();
  expect(mysqlVersion).toMatch(/\b(\d+\.\d+(\.\d+)?)([-\w]*)\b/i);

  // Created date
  const createdDate = await page.locator('#created_date').textContent();
  expect(createdDate?.trim().length).toBeGreaterThan(0);

  // files size (e.g. 83M, 1.2 GB, 512KB)
  const filesSize = await page.locator('#filesSize').textContent();
  expect(filesSize).toMatch(/\b\d+(\.\d+)?\s?(K|M|G|T)?B?\b/i);

  // db size (e.g. 0.78 MB)
  const databaseSize = await page.locator('#databaseSize').textContent();
  expect(databaseSize).toMatch(/\b\d+(\.\d+)?\s?(K|M|G|T)?B\b/i);

  // db logins
  // localhost means the socket, accounts that have it mounted use that instead of the mysql/mariadb service name
  await expect(page.locator('#database-host')).toHaveText(/localhost|mysql|mariadb/i);
  const selectors = [
    '#database-table-prefix',
    '#database-password',
    '#database-name',
    '#wp_cache_type'
  ];

  for (const selector of selectors) {
    const text = await page.locator(selector).textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  }

  console.log('wp manager options are functional');
});


test('live preview', async ({ page }) => {
  await page.goto('/website?domain=wp.tests.openpanel.org');

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Live Preview' }).click();

  const previewPage = await popupPromise;
  await previewPage.waitForLoadState();
  await expect(previewPage.locator('body')).toContainText('Hello world!');

  console.log('live preview is working');
});


test('wp-admin autologin', async ({ page }) => {
  await page.goto('/website?domain=wp.tests.openpanel.org');

  const popupPromise = page.waitForEvent('popup');
  await page.locator('#login_button_text').click();

  const previewPage = await popupPromise;
  await previewPage.waitForLoadState();
  await expect(previewPage.locator('body')).toContainText('admin');

  console.log('wp-admin login is working');
});


test('general options', async ({ page }) => {
  const domain = 'wp.tests.openpanel.org';
  const websiteUrl = `/website?domain=${domain}`;

  const newBlogName = 'Test Blog Name';
  const newBlogDescription = 'Test Blog Description';
  const newAdminEmail = 'test@example.com';

  const expectedSuccessToast = 'General options edited successfully';

  // Open website settings
  await page.goto(websiteUrl);
  await openSiteTab(page, 'settings');

  // General settings locators
  const blogName = page.locator('#blogname');
  const blogDescription = page.locator('#blogdescription');
  const adminEmail = page.locator('#admin_email');

  const usersCanRegister = page.locator('#users_can_register');
  const blogPublic = page.locator('#blog_public');
  const defaultPingStatus = page.locator('#default_ping_status');

  // Wait until settings are loaded
  await expect(blogName).toBeVisible();
  await expect(blogDescription).toBeVisible();
  await expect(adminEmail).toBeVisible();

  // Update text values
  await blogName.fill(newBlogName);
  await blogDescription.fill(newBlogDescription);
  await adminEmail.fill(newAdminEmail);

  // Toggle checkboxes and remember expected states
  const expectedUsersCanRegister = !(await usersCanRegister.isChecked());
  const expectedBlogPublic = !(await blogPublic.isChecked());
  const expectedDefaultPingStatus = !(await defaultPingStatus.isChecked());

  await usersCanRegister.click();
  await blogPublic.click();
  await defaultPingStatus.click();

  // Verify checkbox state changed before saving
  await expect(usersCanRegister).toBeChecked({
    checked: expectedUsersCanRegister,
  });

  await expect(blogPublic).toBeChecked({
    checked: expectedBlogPublic,
  });

  await expect(defaultPingStatus).toBeChecked({
    checked: expectedDefaultPingStatus,
  });

  // Start waiting for backend response BEFORE clicking Save
  const saveResponsePromise = page.waitForResponse(
    response =>
      response.url().includes('/wordpress/wp-cli/update_site_information') &&
      response.request().method() === 'GET',
    { timeout: 30_000 }
  );

  // Save
  await page.locator('#saveGeneralBtn').click();

  // Verify loading toast appears
  const loadingToast = page.getByText(
    'Saving general settings... Please wait.',
    { exact: true }
  );

  await expect(loadingToast).toBeVisible({
    timeout: 5_000,
  });

  // Wait for backend operation
  const saveResponse = await saveResponsePromise;

  expect(
    saveResponse.ok(),
    `Save request failed with HTTP ${saveResponse.status()}`
  ).toBeTruthy();

  const saveResult = await saveResponse.json();

  expect(saveResult.error).toBeFalsy();

  // Verify backend returned exactly the expected success message
  expect(saveResult.message).toBe(expectedSuccessToast);

  // Verify the SUCCESS TOAST itself appears with the exact expected text
  const successToast = page.getByText(expectedSuccessToast, {
    exact: true,
  });

  await expect(successToast).toBeVisible({
    timeout: 15_000,
  });

  // Optional extra assertion:
  // make sure the actual visible text is exactly what we expect
  await expect(successToast).toHaveText(expectedSuccessToast);

  // Reload to verify persistence
  await page.goto(websiteUrl);
  await openSiteTab(page, 'settings');

  // Wait until saved values are loaded again
  await expect(blogName).toHaveValue(newBlogName, {
    timeout: 20_000,
  });

  // Verify persisted text values
  await expect(blogDescription).toHaveValue(newBlogDescription);
  await expect(adminEmail).toHaveValue(newAdminEmail);

  // Verify persisted checkbox states
  await expect(usersCanRegister).toBeChecked({
    checked: expectedUsersCanRegister,
  });

  await expect(blogPublic).toBeChecked({
    checked: expectedBlogPublic,
  });

  await expect(defaultPingStatus).toBeChecked({
    checked: expectedDefaultPingStatus,
  });

  console.log('general options are working');
});


test('maintenance mode', async ({ page }) => {
  await page.goto('/website?domain=wp.tests.openpanel.org');
  await openSiteTab(page, 'maintenance');

  // Wait for the status span to appear and get its text
  await page.waitForSelector('#current_maintenance_mode_status span');
  const statusText = await page.locator('#current_maintenance_mode_status span').innerText();
  const wasEnabled = statusText.trim().toLowerCase() === 'enabled';

  // --- Round 1: toggle to the opposite state and verify ---
  await expect(page.locator('#runMaintenance_action')).toHaveAttribute('data-action', wasEnabled ? 'disable' : 'enable');
  await page.locator('#runMaintenance_action').click();

  if (wasEnabled) {
    await expect(page.getByText('Maintenance mode is now disabled.')).toBeVisible();
  } else {
    await expect(page.getByText('Maintenance mode is now enabled.')).toBeVisible();
  }

  await page.waitForTimeout(5000);

  const randomUri = `https://wp.tests.openpanel.org?${Math.random().toString(36).slice(2)}`;
  await page.goto(randomUri);

  if (wasEnabled) {
    await expect(page.locator('body')).toContainText('Hello world!');
  } else {
    await expect(page.locator('body')).toContainText('Briefly unavailable for scheduled maintenance.');
  }

  // --- Round 2: toggle back to original state and verify ---
  await page.goto('/website?domain=wp.tests.openpanel.org');
  await openSiteTab(page, 'maintenance');
  // the button only gets its enable/disable action once the status has loaded
  await expect(page.locator('#runMaintenance_action')).toHaveAttribute('data-action', wasEnabled ? 'enable' : 'disable');
  await page.locator('#runMaintenance_action').click();

  if (wasEnabled) {
    await expect(page.getByText('Maintenance mode is now enabled.')).toBeVisible();
  } else {
    await expect(page.getByText('Maintenance mode is now disabled.')).toBeVisible();
  }

  await page.waitForTimeout(5000);

  const randomUri2 = `https://wp.tests.openpanel.org?${Math.random().toString(36).slice(2)}`;
  await page.goto(randomUri2);

  if (wasEnabled) {
    await expect(page.locator('body')).toContainText('Briefly unavailable for scheduled maintenance.');
  } else {
    await expect(page.locator('body')).toContainText('Hello world!');
  }

  console.log('maintenance mode on/off is working');
});


test('cache flush', async ({ page }) => {
  await page.goto('/website?domain=wp.tests.openpanel.org');

  await page.getByRole('button', { name: 'Purge WP Cache' }).click();
  await expect(page.getByText(/Cache flushed successfully/)).toBeVisible({ timeout: 10000 });

  console.log('flush wp cache is working');
});


test('live visitors count', async ({ page }) => {
  await page.goto('/website?domain=wp.tests.openpanel.org');

  // 1. Get initial value
  const initialText = await page.locator('#visitors_data').innerText();
  const initialValue = parseInt(initialText, 10);

  // 2. Trigger a real request
  await page.request.get('https://wp.tests.openpanel.org');

  // 3. Reload page
  await page.goto('/website?domain=wp.tests.openpanel.org');

  // 4. Wait up to 60s for value to change
  await page.waitForFunction(
    (selector, oldValue) => {
      const el = document.querySelector(selector);
      if (!el) return false;

      const current = parseInt(el.textContent || '0', 10);
      return current !== oldValue;
    },
    '#visitors_data',
    initialValue,
    { timeout: 60_000 }
  );

  console.log('live visitor counter is working');
});


test('waf on/off', async ({ page }) => {
  await page.goto('/website?domain=wp.tests.openpanel.org');

  await page.locator('#waf_toggle_btn').click();
  const message = await page.getByText(/Firewall for wp\.tests\.openpanel\.org is now (On|Off)/).innerText();
  const isOn = message.includes('On');

  await page.waitForTimeout(5000);

  const response = await page.request.get('https://wp.tests.openpanel.org');

  if (isOn) {
    // WAF ON
    expect([403, 406, 409, 422]).toContain(response.status());
  } else {
    // WAF OFF
    expect(response.status()).toBe(200);
  }
  console.log('wp manager firewall on/off is working as expected!');
});


test('wp remove', async ({ page }) => {
  await page.goto('/website?domain=wp.tests.openpanel.org');

  await page.locator('a#remove-tab').click();

  // Match despite the icon glyph being part of the accessible name
  const uninstallButton = page.getByRole('button', {
    name: /Uninstall WordPress/,
  });

  await expect(uninstallButton).toBeVisible();
  await uninstallButton.click();

  const confirmButton = page.getByRole('button', {
    name: /Confirm Uninstall/,
  });

  await expect(confirmButton).toBeVisible();
  await confirmButton.click();

  await expect(
    page.getByText('WordPress uninstalled successfully!', { exact: true })
  ).toBeVisible({ timeout: 30_000 });

  await page.goto('/sites');

  await expect(
    page.locator('tr[id="site-row-wp.tests.openpanel.org"]')
  ).toHaveCount(0);

  console.log('website uninstall is working');
});

  // 6. install again and test detach
  // TODO: remove files


