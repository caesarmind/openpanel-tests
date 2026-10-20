import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function navigateToMySQLPage(page: any) {
  await page.goto(`/mysql`);
  await expect(page).toHaveURL(/mysql/);
}


async function getDatabaseCount(page: Page): Promise<number> {
  await page.goto('/dashboard');
  const text = await page
    .locator('#dashboard_usage_databases')
    .locator('p')
    .nth(1)
    .textContent();
  if (!text) throw new Error('Cannot read database count');
  const match = text.match(/(\d+)\s*\//);
  if (!match) throw new Error(`Cannot parse database count from: ${text}`);
  return parseInt(match[1], 10);
}


async function expectDatabaseInTable(page: Page, dbName: string) {
  const row = page.locator('tr', { hasText: dbName });
  await expect(row).toBeVisible();
}

async function expectDatabaseNotInTable(page: Page, dbName: string) {
  await expect(page.locator('tr', { hasText: dbName })).toHaveCount(0);
}

// drop a row (db or user) left behind by an earlier aborted run
async function deleteRowIfExists(page: Page, url: string, name: string) {
  await page.goto(url);
  const row = page.locator('tr', { hasText: name });
  if (!(await row.count())) return;
  await row.locator('button.btn-danger').click();
  const confirmButton = page.locator('button.btn-dark:visible');
  await expect(confirmButton.first()).toBeVisible();
  await confirmButton.first().click();
  await expect(page.locator('body')).toContainText(/successfully deleted/i);
}





// ACCESS
test('list databases', async ({ page }) => {
  await navigateToMySQLPage(page);
  // app installs earlier in the suite create databases, so the empty state isn't guaranteed
  await expect(page.locator('body')).toContainText(/create your first database|total databases:\s*\d+/i, { timeout: 20000 });
  console.log('mysql initialized');
});



test('create database', async ({ page }) => {
  await deleteRowIfExists(page, '/mysql', 'stefan_baza');

  // 1. Check dashboard count FIRST, before going anywhere else
  const initialCount = await getDatabaseCount(page);
  let expectedCount = initialCount;

  // 2. Now navigate to MySQL and perform the action
  await navigateToMySQLPage(page);
  await page.locator('a[href="/mysql/new"]').first().click();
  await page.getByRole('textbox', { name: 'Database Name' }).fill('stefan_baza');
  await page.getByRole('button', { name: 'Create Database' }).click();
  await expect(page.locator('body')).toContainText(/successfully created a database/i);

  // 3. Validate in the table (still on MySQL page)
  await expectDatabaseInTable(page, 'stefan_baza');
  expectedCount++;

  // 4. Go back to dashboard and verify count incremented
  await page.goto('/dashboard');
  await expect.poll(async () => getDatabaseCount(page)).toBe(expectedCount);

  console.log('database created + validated');
});



test('show system databases', async ({ page }) => {
  await navigateToMySQLPage(page);

  await page.getByText('Show system databases').click();
  await expect(page.locator('body')).toContainText(/information_schema/i);

  console.log('show system databases working');
});



test('show database sizes', async ({ page }) => {
  await navigateToMySQLPage(page);

  const showSizesCheckbox = page.locator('#showSizesCheckbox');
  await showSizesCheckbox.check();
  await expect(page.locator('#size-column-header')).toBeVisible();
  await page.locator('#display-size').selectOption('mb');
  await expect(page.locator('#size_unit')).toHaveText('(MB)');

  console.log('show database sizes working');
});



test('phpmyadmin auto-login', async ({ page }) => {
  await page.goto(`/phpmyadmin?route=/database/structure&server=1&db=stefan_baza`);
  // wait up to 30sec and expect: http://185.193.66.252:32797/index.php?server=1&route=%2Fdatabase%2Fstructure&db=stefan_baza
  await expect(page.locator('body')).toContainText(/stefan_baza/i, { timeout: 30000 });

  console.log('phpmyadmin auto-login is working');
});


test('list users', async ({ page }) => {
  await page.goto(`/mysql/users`);
  await expect(page).toHaveURL(/.*mysql\/users/);
  await expect(page.locator('body')).toContainText(/no users yet|total users:\s*\d+/i);

  console.log('users page accessible');
});


test('show system users', async ({ page }) => {
  await page.goto(`/mysql/users`);

  await page.getByText('Show system users').click();
  // mariadb has healthcheck, mysql has infoschema
  await expect(page.locator('body')).toContainText(/healthcheck|infoschema/i);

  console.log('show system users working');
});


test('create user', async ({ page }) => {
  await deleteRowIfExists(page, '/mysql/users', 'stefan_user');
  await page.goto(`/mysql/users`);

  await page.locator('a[href="/mysql/user"]').first().click();
  await expect(page).toHaveURL(/.*mysql\/user/);

  await page.getByRole('textbox', { name: 'Username*' }).fill('stefan_user');
  await page.getByRole('textbox', { name: 'Password*' }).fill('stefan94');
  await page.getByRole('button', { name: 'Create User' }).click();

  await expect(page.locator('body')).toContainText(/successfully created a database user stefan_user/i);

  await page.getByRole('link', { name: 'Back to Users' }).click();
  await expect(page).toHaveURL(/.*mysql\/users/);
  await expect(page.locator('body')).toContainText(/stefan_user/i);
  
  console.log('user created');
});





test('change password', async ({ page }) => {
  await page.goto('/mysql/users');

  const firstRow = page.locator('#users-table tbody tr:visible').first();
  const username = (await firstRow.locator('[data-sort-col="username"]').innerText()).trim();

  await firstRow.getByRole('link', { name: 'Change Password' }).click();
  await expect(page).toHaveURL(/.*mysql\/password/);
  // the generate button only works once the page's script has run
  await page.waitForLoadState('load');
  await page.locator('#generatePassword').click();
  await page.getByRole('button', { name: 'Change Password' }).click();

  await expect(page).toHaveURL(/.*mysql\/users/);
  await expect(page.locator('body')).toContainText(
    `successfully changed password for user ${username}`,
    { ignoreCase: true }
  );

  console.log('change password working');
});




test('grant CREATE ROUTE privilege', async ({ page }) => {
  await page.goto(`/mysql/users`);

  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/mysql/info') && resp.status() === 200),
    page.getByRole('link', { name: 'Assign User to Database' }).click(),
  ]);

  await expect(page).toHaveURL(/.*mysql\/assign/);

  await page.locator('select[name="db_user"]').selectOption('stefan_user');
  // picking the database loads the user's current privileges, which resets every checkbox, so wait for it before ticking any
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/mysql/privileges/')),
    page.locator('select[name="database_name"]').selectOption('stefan_baza'),
  ]);

  await page.getByRole('checkbox', { name: 'ALTER', exact: true }).check();
  await page.getByRole('checkbox', { name: 'CREATE ROUTINE' }).check();
  await page.getByRole('button', { name: 'Make Changes' }).click();

  await expect(page.locator('body')).toContainText(
    /Privileges granted successfully for user\s+'.+?'\s+on database\s+'.+?'/i
  );
});



test('grant NO privileges', async ({ page }) => {
  await page.goto('/mysql/users');

  await Promise.all([
    page.waitForResponse(resp =>
      resp.url().includes('/mysql/info') && resp.status() === 200
    ),
    page.getByRole('link', { name: 'Assign User to Database' }).click(),
  ]);

  await expect(page).toHaveURL(/.*mysql\/assign/);

  await page.locator('select[name="db_user"]').selectOption('stefan_user');

  await Promise.all([
    page.locator('select[name="database_name"]').selectOption('stefan_baza'),
  ]);

  await page.getByRole('link', { name: 'Back to Databases' }).click();
  await expect(page).toHaveURL(/.*mysql/);

  await expect(page.locator('body')).toContainText(/stefan_user/i);

  await page.getByRole('link', { name: 'stefan_user' }).click();

  await expect(page.locator('select[name="db_user"]')).toHaveValue('stefan_user');
  
  const privilegeCheckboxes = page.locator('input[name="privileges"]');

  for (let i = 0; i < await privilegeCheckboxes.count(); i++) {
    const checkbox = privilegeCheckboxes.nth(i);
  
    if (await checkbox.isChecked()) {
      await checkbox.uncheck({ force: true });
    }
  
    await expect(checkbox).not.toBeChecked();
  }

  await page.getByRole('button', { name: 'Make Changes' }).click();

  await expect(page.locator('body')).toContainText(
    /at least one privilege must be selected/i
  );

  console.log('granting no privileges does show error');
});



test('grant ALL PRIVILEGES', async ({ page }) => {
  await page.goto('/mysql/users');

  await Promise.all([
    page.waitForResponse(resp =>
      resp.url().includes('/mysql/info') && resp.status() === 200
    ),
    page.getByRole('link', { name: 'Assign User to Database' }).click(),
  ]);

  await expect(page).toHaveURL(/.*mysql\/assign/);

  await page.locator('select[name="db_user"]').selectOption('stefan_user');

  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/mysql/privileges/')),
    page.locator('select[name="database_name"]').selectOption('stefan_baza'),
  ]);

  await page.getByRole('checkbox', { name: 'ALTER', exact: true }).check();
  await page.getByRole('checkbox', { name: 'ALL PRIVILEGES' }).check();

  await page.getByRole('button', { name: 'Make Changes' }).click();

  await expect(page.locator('body')).toContainText(
    /Privileges granted successfully for user\s+'.+?'\s+on database\s+'.+?'/i
  );

  await page.goto('/mysql/users');
  await expect(page.locator('#users-table')).toContainText('stefan_user');

  console.log('assign user to database is working');
});



test('revoke privileges', async ({ page }) => {
  await page.goto('/mysql/users');

  // Open Remove User from Database page
  await page.locator('a[href="/mysql/remove"]').click();

  await expect(page).toHaveURL(/\/mysql\/remove/);

  // Select user and database
  await page.locator('select[name="db_user"]').selectOption('stefan_user');
  await page.locator('select[name="database_name"]').selectOption('stefan_baza');

  // Remove user from database
  await page.getByRole('button', {
    name: 'Remove User from Database'
  }).click();

  // Verify success message
  await expect(page.locator('body')).toContainText(
    /successfully revoked all privileges for user/i
  );

  // Verify user is no longer associated with the database
  await expect(page.locator('#databases-table')).not.toContainText(
    'stefan_user'
  );
});



test('database wizard', async ({ page }) => {
  await page.goto('/mysql/wizard');
  await expect(page).toHaveURL(/.*mysql\/wizard/);

  await page.locator('#dbname').fill('proba');
  await page.locator('#username').fill('novi_user');
  await page.locator('#password').fill('stefan456g7dsd');

  await page.locator('#createAndAssign').click();

  await expect(page.locator('body')).toContainText(/setup complete/i, {
    timeout: 30000,
  });

  await page.getByRole('link', { name: /view databases/i }).click();
  await expect(page).toHaveURL(/.*mysql/);

  const row = page.locator('#databases-table tr', { hasText: 'proba' });

  await expect(row).toBeVisible();
  await expect(row).toContainText(/proba/i);
  await expect(row).toContainText(/novi_user/i);

  console.log('mysql database wizard is working');
});


test('remote access', async ({ page }) => {
  await page.goto('/mysql/remote-mysql');

  const statusText = page.locator('dd p.text-lg.font-semibold');
  await expect(statusText).toHaveText('Disabled');

  const redBars = page.locator('dd .bg-red-500').first();
  await expect(redBars).toBeVisible();

  const localServerText = await page.locator('#local_server').textContent();
  expect(localServerText?.toLowerCase()).toMatch(/mysql|mariadb/);

  await expect(page.locator('#local_port')).toHaveText('3306');

  const remoteServerText = await page.locator('#remote_server').textContent();
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  expect(remoteServerText?.trim()).toMatch(ipv4Regex);

  const parts = remoteServerText!.trim().split('.').map(Number);
  expect(parts[0]).not.toBe(127);
  expect(parts[0]).not.toBe(10);
  expect(!(parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)).toBe(true);
  expect(!(parts[0] === 192 && parts[1] === 168)).toBe(true);

  const remotePortText = await page.locator('#remote_port').textContent();
  const remotePortNum = parseInt(remotePortText ?? '0', 10);
  expect(remotePortNum).toBeGreaterThanOrEqual(32768);
  expect(remotePortNum).toBeLessThanOrEqual(65535);

  // 1. ON
  const enableBtn = page.locator('dd button', { hasText: 'Click to Enable' });
  await enableBtn.click();
  await expect(page.locator('text=Remote MySQL access is now enabled')).toBeVisible();
  await expect(statusText).toHaveText('Enabled');
  const greenBars = page.locator('dd .bg-emerald-500').first();
  await expect(greenBars).toBeVisible();
  console.log('remote access is enabled');

  // 2. TEST
  await page.waitForTimeout(10000); // allow container to restart
  const response = await page.request.post('https://api.openpanel.com/remote-mysql/', {
    form: {
      host: remoteServerText?.trim(),
      port: remotePortText?.trim(),
      username: 'novi_user',
      password: 'stefan456g7dsd',
      database: 'proba',
    }
  });

  const text = await response.text();
  expect(text).toMatch(/Connection successful/i);
  console.log('connectin established from a remote server');

  // 3. OFF
  await page.goto('/mysql/remote-mysql');
  const disableBtn = page.locator('dd button', { hasText: 'Click to Disable' });
  await disableBtn.click();
  await expect(page.locator('text=Remote MySQL access is now disabled')).toBeVisible();
  await expect(statusText).toHaveText('Disabled');
  await expect(redBars).toBeVisible();
  console.log('remote access is disabled');
    // Wait for MySQL container to finish restarting before next test
  await page.waitForTimeout(10000);//TODO smisliti pametnije resenje
});



test('processlist', async ({ page }) => {
  await page.goto(`/mysql/processlist`);
  await expect(page).toHaveURL(/.*mysql\/processlist/);
  await expect(page.locator('body')).toContainText(/host/i);
  await expect(page.locator('body')).toContainText(/state/i);
  console.log('processlist is working');
});



test('configuration editor', async ({ page }) => {
  await page.goto(`/mysql/configuration`);
  await expect(page).toHaveURL(/.*mysql\/configuration/);
  await expect(page.locator('body')).toContainText(/max_allowed_packet/i);
  await expect(page.locator('body')).toContainText(/log_error_verbosity/i);
  await page.locator('#interactive_timeout').fill('90');
  await page.locator('#wait_timeout').fill('300');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('body')).toContainText(/configuration updated and service restarted/i);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#interactive_timeout')).toHaveValue('90');
  await expect(page.locator('#wait_timeout')).toHaveValue('300');
  console.log('mysql configuration is saved');
  // Wait for MySQL container to finish restarting before next test
  await page.waitForTimeout(10000);//TODO smisliti pametnije resenje
});


// IMPORT
test('import', async ({ page }) => {
  test.setTimeout(90000);

  const tempFilePath = path.join(os.tmpdir(), 'test-import.sql');

  const sqlContent = `
DROP TABLE IF EXISTS users;
CREATE TABLE users (id INT, name VARCHAR(50));
INSERT INTO users VALUES (1, 'John');
`;

  fs.writeFileSync(tempFilePath, sqlContent);

  await page.goto(`/mysql/import/proba`);
  
  await expect(async () => {
    const options = await page.locator('select[name="database_name"] option').count();
    expect(options).toBeGreaterThan(1);
  }).toPass({ timeout: 5000 });

  await expect(page).toHaveURL(/.*mysql\/import\/proba/);

  await page.locator('select[name="database_name"]').selectOption('proba');
  await page.locator('input[name="db_file"]').setInputFiles(tempFilePath);

  await page.getByRole('button', { name: /Upload & Import/i }).click();
  await expect(page.locator('body')).toContainText(/Successfully imported from test-import.sql file to database: proba/i);

  await navigateToMySQLPage(page);

  const showSizesCheckbox = page.locator('#showSizesCheckbox');
  await showSizesCheckbox.check();
  await expect(page.locator('#size-column-header')).toBeVisible();
  await page.locator('#display-size').selectOption('mb');
  
  const row = page.locator('#databases-table tr', { hasText: 'proba' });
  const sizeCell = row.locator('td.db_size_cell');
  // sizes are fetched after the checkbox is ticked
  await expect.poll(async () => parseFloat((await sizeCell.textContent())?.trim() || ''), { timeout: 30000 }).toBeGreaterThan(0);

  console.log('mysql import working');
});


test('export', async ({ page }) => {
  test.setTimeout(90000);

  const dbName = 'proba';

  await navigateToMySQLPage(page);

  const row = page.locator('#databases-table tbody tr', {
    has: page.locator('td', { hasText: dbName }),
  });

  await expect(row).toBeVisible();

  async function openExportDropdown() {
    const exportButton = row.locator('button[title="Export"]');
    const exportBox = row.locator('.export-section');

    await row.scrollIntoViewIfNeeded();

    if (!(await exportBox.isVisible())) {
      await expect(exportButton).toBeVisible();
      await exportButton.click();
      await expect(exportBox).toBeVisible();
    }

    return exportBox;
  }

  async function closeExportDropdown() {
    const exportBox = row.locator('.export-section');

    if (await exportBox.isVisible()) {
      await page.keyboard.press('Escape');
      await expect(exportBox).toBeHidden();
    }
  }

  async function selectExportOption(
    exportBox: any,
    name: 'export_format' | 'export_destination',
    value: string
  ) {
    const radio = exportBox.locator(`input[name="${name}"][value="${value}"]`);

    await radio.evaluate((el: HTMLInputElement) => {
      el.checked = true;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(radio).toBeChecked();
  }

  // 1. .sql to browser
  let exportBox = await openExportDropdown();

  await selectExportOption(exportBox, 'export_format', 'sql');
  await selectExportOption(exportBox, 'export_destination', 'browser');

  const [download1] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    exportBox.getByRole('button', { name: /^Export$/ }).click(),
  ]);

  expect(download1.suggestedFilename()).toMatch(/proba.*\.sql$/);

  // 2. .sql.gz to browser
  exportBox = await openExportDropdown();

  await selectExportOption(exportBox, 'export_format', 'gzip');
  await selectExportOption(exportBox, 'export_destination', 'browser');

  const [download2] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    exportBox.getByRole('button', { name: /^Export$/ }).click(),
  ]);

  expect(download2.suggestedFilename()).toMatch(/proba.*\.sql\.gz$/);

  // 3. .sql to files
  exportBox = await openExportDropdown();

  await selectExportOption(exportBox, 'export_format', 'sql');
  await selectExportOption(exportBox, 'export_destination', 'files');

  await expect(exportBox.locator('input[x-model="relativePath"]')).toBeVisible();

  const [response3] = await Promise.all([
    page.waitForResponse(resp =>
      resp.url().includes('/mysql/export') &&
      resp.request().method() === 'POST'
    ),
    exportBox.getByRole('button', { name: /^Export$/ }).click(),
  ]);

  expect(response3.status()).toBeLessThan(500);
  await expect(page.getByText(/Database '.*' exported to .*/)).toBeVisible();

  await closeExportDropdown();

  // 4. .sql.gz to files
  exportBox = await openExportDropdown();

  await selectExportOption(exportBox, 'export_format', 'gzip');
  await selectExportOption(exportBox, 'export_destination', 'files');

  await expect(exportBox.locator('input[x-model="relativePath"]')).toBeVisible();

  const [response4] = await Promise.all([
    page.waitForResponse(resp =>
      resp.url().includes('/mysql/export') &&
      resp.request().method() === 'POST'
    ),
    exportBox.getByRole('button', { name: /^Export$/ }).click(),
  ]);

  expect(response4.status()).toBeLessThan(500);
  await expect(page.getByText(/Database '.*' exported to .*/)).toBeVisible();

  // 5. check if files created
  const filesResponse = await page.goto('/files?output=json');
  expect(filesResponse).not.toBeNull();

  const filesData = await filesResponse!.json();
  const fileNames = filesData.files_info.map((f: any) => f.Name);
  
  const sqlFile = fileNames.find((n: string) =>
    n.match(/proba.*\.sql$/) && !n.endsWith('.gz')
  );
  
  const gzFile = fileNames.find((n: string) =>
    n.match(/proba.*\.sql\.gz$/)
  );

  expect(sqlFile).toBeTruthy();
  expect(gzFile).toBeTruthy();

  console.log('✓ export files found in /files:', sqlFile, gzFile);
});


test('delete user', async ({ page }) => {
  await page.goto(`/mysql/users`);

  // scope to our user, the wizard adds others
  const row = page.locator('tr', { hasText: 'stefan_user' });
  await expect(row).toBeVisible();
  await row.locator('button.btn-danger').click();

  const confirmButton = page.locator('button.btn-dark:visible');
  await expect(confirmButton.first()).toBeVisible();
  await confirmButton.first().click();

  await expect(page.locator('body')).toContainText(/successfully deleted/i);
  await page.goto(`/mysql/users`);
  await expect(page.locator('tr', { hasText: 'stefan_user' })).toHaveCount(0);
  console.log('delete user is working');
});


test('delete database', async ({ page }) => {
  await navigateToMySQLPage(page);

  const initialCount = await getDatabaseCount(page);
  let expectedCount = initialCount;

  await navigateToMySQLPage(page);
  const dbName = 'stefan_baza';
  const row = page.locator('tr', { hasText: dbName });
  const deleteButton = row.locator('button.btn-danger');

  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  const confirmButton = page.locator('button.btn-dark');
  await expect(confirmButton).toBeVisible();
  await confirmButton.click();

  await expect(page.locator('body')).toContainText(/successfully deleted/i);

  // table should NOT contain DB anymore
  await expectDatabaseNotInTable(page, dbName);

  expectedCount--;

  // dashboard validation
  await page.goto('/dashboard');

  await expect.poll(async () => {return await getDatabaseCount(page)}).toBe(expectedCount);

  console.log('database deleted + validated');
});
