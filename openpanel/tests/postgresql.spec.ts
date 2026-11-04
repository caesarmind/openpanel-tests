import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bulkRun, bulkSelect, bulkSelectAllAndClear } from '../helpers';

// after the config test restarts postgres the page shows an "initializing" row and refreshes itself until it's back
async function waitForPostgres(page: any) {
  await expect(
    page.getByText(/still initializing/i)
  ).toHaveCount(0, { timeout: 90000 });
  // toggling remote access recreates the container, until it's running and healthy again the lists come back empty, so wait and reload
  const state = async () => {
    const s = await (await page.request.get('/postgresql/users?output=json')).json();
    return `${s.container_state}/${s.health_status}`;
  };
  if ((await state()) !== 'running/healthy') {
    // the health check can stay at starting for a minute or two, longer than a plain test's 30s
    test.info().setTimeout(test.info().timeout + 120000);
    await expect.poll(state, { timeout: 120000, intervals: [3000] }).toBe('running/healthy');
    await page.reload();
  }
}

async function navigateToPostgreSQLPage(page: any) {
  await page.goto('/postgresql');
  await expect(page).toHaveURL(/postgresql/);
  await waitForPostgres(page);
}

// a fresh account installs PostgreSQL in the background on the first visit, /postgresql/new sends you back to the list until it's ready
async function openNewDatabaseForm(page: any) {
  await expect(async () => {
    await page.goto('/postgresql/new');
    await expect(page.getByRole('textbox', { name: 'Database Name' })).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 8 * 60_000, intervals: [10_000] });
}

// the new form's alpine model clears a name typed before it started, so type again until it sticks and Create is enabled
async function fillDatabaseName(page: any, name: string) {
  const nameInput = page.getByRole('textbox', { name: 'Database Name' });
  await expect(async () => {
    await nameInput.fill(name);
    await expect(nameInput).toHaveValue(name, { timeout: 1000 });
    await expect(page.getByRole('button', { name: 'Create Database' })).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
}

async function expectDatabaseInTable(page: any, dbName: string) {
  const row = page.locator('tr', { hasText: dbName });
  await expect(row).toBeVisible();
}

async function expectDatabaseNotInTable(page: any, dbName: string) {
  await expect(page.locator('tr', { hasText: dbName })).toHaveCount(0);
}

// the old rows have a delete button that turns into a btn-dark confirm, the new ones keep delete in the row's actions menu behind a browser confirm
async function deleteRow(page: any, row: any) {
  const direct = row.locator('button.btn-danger');
  if (await direct.count()) {
    await direct.click();
    const confirmButton = page.locator('button.btn-dark:visible');
    await expect(confirmButton.first()).toBeVisible();
    await confirmButton.first().click();
    return;
  }
  await row.getByRole('button', { name: /^Actions/ }).click();
  page.once('dialog', (dialog: any) => dialog.accept());
  await row.locator('.op-menu button.is-danger').click();
}

// drop a row (db or user) left behind by an earlier aborted run
async function deleteRowIfExists(page: any, url: string, name: string) {
  await page.goto(url);
  await waitForPostgres(page);
  const row = page.locator('tr').filter({ has: page.getByText(name, { exact: true }) });
  if (!(await row.count())) return;
  await deleteRow(page, row);
  await expect(page.locator('body')).toContainText(/successfully deleted/i);
}

// the new user form's labels have a space before the *, both themes use these ids
async function fillNewUser(page: any, name: string, password: string) {
  await page.locator('#username').fill(name);
  await page.locator('#password').fill(password);
}


// ACCESS
test('list databases', async ({ page }) => {
  await navigateToPostgreSQLPage(page);
  await expect(page.locator('body')).toContainText(/create your first database|no databases|total databases:\s*\d+/i, { timeout: 25000 });
  console.log('postgresql initialized');
});


test('create database', async ({ page }) => {
  // the first page load waits for a fresh account's PostgreSQL to be installed and started
  test.setTimeout(10 * 60_000);
  await navigateToPostgreSQLPage(page);
  await openNewDatabaseForm(page);
  await deleteRowIfExists(page, '/postgresql', 'stefan_psql');
  await openNewDatabaseForm(page);
  await fillDatabaseName(page, 'stefan_psql');
  await page.getByRole('button', { name: 'Create Database' }).click();
  await expect(page.locator('body')).toContainText(/successfully created/i, { timeout: 25000 });
  // the new create page stays on a done screen
  await navigateToPostgreSQLPage(page);
  await expectDatabaseInTable(page, 'stefan_psql');
  console.log('postgresql database created');
});


test('list users', async ({ page }) => {
  await page.goto('/postgresql/users');
  await expect(page).toHaveURL(/postgresql\/users/);
  await expect(page.locator('body')).toContainText(/no users yet|users/i);
  console.log('postgresql users page accessible');
});


test('create user', async ({ page }) => {
  await deleteRowIfExists(page, '/postgresql/users', 'stefan_psql_user');
  await page.goto('/postgresql/user');
  await expect(page).toHaveURL(/postgresql\/user/);
  await fillNewUser(page, 'stefan_psql_user', 'stefan94');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.locator('body')).toContainText(/successfully created.*stefan_psql_user/i);
  // the new page shows the credentials once with a View Users link
  await page.getByRole('link', { name: 'Back to Users' }).or(page.getByRole('link', { name: 'View Users' })).click();
  await expect(page).toHaveURL(/postgresql\/users/);
  await expect(page.locator('body')).toContainText(/stefan_psql_user/i);
  console.log('postgresql user created');
});


test('change password', async ({ page }) => {
  await page.goto('/postgresql/users');
  // this spec's own user, the new row keeps Change Password in its actions menu
  const row = page.locator('tr').filter({ has: page.getByText('stefan_psql_user', { exact: true }) });
  const changeLink = row.getByRole('link', { name: 'Change Password' });
  if (!(await changeLink.isVisible())) await row.getByRole('button', { name: /^Actions/ }).click();
  await changeLink.click();
  await expect(page).toHaveURL(/postgresql\/password/);
  // the generate button only works once the page's script has run
  await page.waitForLoadState('load');
  await page.locator('#generatePassword').click();
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page).toHaveURL(/postgresql\/users/);
  await expect(page.locator('body')).toContainText(/successfully changed password/i);
  console.log('postgresql change password working');
});


test('assign user to database', async ({ page }) => {
  await page.goto('/postgresql/users');

  await page.getByRole('link', { name: 'Assign User to Database' }).click();

  await expect(page).toHaveURL(/postgresql\/assign/);
  await expect(
    page.getByRole('heading', { name: 'Assign User to Database' })
  ).toBeVisible();

  const userSelect = page.locator('select[name="db_user"]');
  const databaseSelect = page.locator('select[name="database_name"]');

  // Wait until the required options are available
  await expect(
    userSelect.locator('option[value="stefan_psql_user"]')
  ).toHaveCount(1);

  await expect(
    databaseSelect.locator('option[value="stefan_psql"]')
  ).toHaveCount(1);

  await userSelect.selectOption('stefan_psql_user');
  await databaseSelect.selectOption('stefan_psql');

  // the new submit button just says Assign
  await page.getByRole('button', { name: 'Assign User to Database' }).or(page.getByRole('button', { name: 'Assign', exact: true })).click();

  await expect(page.locator('body')).toContainText(
    /Successfully added a user/i
  );

  console.log('postgresql user assigned to database');
});

test('revoke user from database', async ({ page }) => {
  await page.goto('/postgresql/users');

  // the classic sidebar has a Remove User link too
  await page.locator('main').getByRole('link', { name: /Remove User/i }).click();

  await expect(page).toHaveURL(/postgresql\/remove/);

  await expect(
    page.getByRole('heading', { name: 'Remove User access from Database' })
  ).toBeVisible();

  const userSelect = page.locator('select[name="db_user"]');
  const databaseSelect = page.locator('select[name="database_name"]');

  // Wait for refreshData() to populate the selects
  await expect(
    userSelect.locator('option[value="stefan_psql_user"]')
  ).toHaveCount(1);

  await expect(
    databaseSelect.locator('option[value="stefan_psql"]')
  ).toHaveCount(1);

  await userSelect.selectOption('stefan_psql_user');
  await databaseSelect.selectOption('stefan_psql');

  await page
    .getByRole('button', { name: 'Remove User from Database' })
    .click();

  await expect(page.locator('body')).toContainText(
    /successfully revoked|removed/i
  );

  console.log('postgresql user revoked from database');
});


test('database wizard', async ({ page }) => {
  await deleteRowIfExists(page, '/postgresql', 'psql_proba');
  await deleteRowIfExists(page, '/postgresql/users', 'psql_novi_user');
  await page.goto('/postgresql/wizard');
  await expect(page).toHaveURL(/postgresql\/wizard/);
  await page.locator('input[name="database_name"]').fill('psql_proba');
  await page.locator('input[name="db_user"]').fill('psql_novi_user');
  await page.locator('#password').fill('stefan456g7dsd');
  // both themes give the submit button this id, the new one is labelled Create
  await page.locator('#createAndAssign').click();
  // the new wizard ends on a Setup complete page with a link back to the list
  await expect(page.getByText('Successfully created database').or(page.getByText(/^setup complete$/i))).toBeVisible();
  const viewDatabases = page.getByRole('link', { name: /view databases/i });
  if (await viewDatabases.count()) await viewDatabases.click();
  await expect(page).toHaveURL(/postgresql/);
  const row = page.locator('#databases-table tr', { hasText: 'psql_proba' });
  await expect(row).toContainText(/psql_proba/i);
  console.log('postgresql database wizard is working');
});


test('processlist', async ({ page }) => {
  await page.goto('/postgresql/processlist');
  await expect(page).toHaveURL(/postgresql\/processlist/);
  await expect(page.locator('body')).toContainText(/state|query|pid/i);
  console.log('postgresql processlist is working');
});


test('configuration editor', async ({ page }) => {
  await page.goto('/postgresql/configuration');
  await expect(page).toHaveURL(/postgresql\/configuration/);
  await expect(page.locator('body')).toContainText(/max_connections|shared_buffers/i);
  await page.locator('#max_connections').fill('110');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('body')).toContainText(/configuration was edited|restarted/i);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#max_connections')).toHaveValue('110');
  console.log('postgresql configuration is saved');
});


test('remote access', async ({ page }) => {
  await page.goto('/postgresql/remote-postgresql');

  // old page: a dd with status bars, new page: a status pill and button in the toggle form
  const statusText = page.locator('dd p.text-lg.font-semibold, form:has(> input[name="action"]) > .op-status');
  await expect(statusText).toHaveText('Disabled');

  // ON
  const enableBtn = page.locator('dd button, form:has(> input[name="action"]) > button', { hasText: 'Click to Enable' });
  await enableBtn.click();
  await expect(page.locator('text=Remote PostgreSQL access is now enabled')).toBeVisible();
  await expect(statusText).toHaveText('Enabled');
  console.log('postgresql remote access enabled');

  // OFF
  await page.goto('/postgresql/remote-postgresql');
  const disableBtn = page.locator('dd button, form:has(> input[name="action"]) > button', { hasText: 'Click to Disable' });
  await disableBtn.click();
  await expect(page.locator('text=Remote PostgreSQL access is now disabled')).toBeVisible();
  await expect(statusText).toHaveText('Disabled');
  console.log('postgresql remote access disabled');
});


// IMPORT
test('import', async ({ page }) => {
  const tempFilePath = path.join(os.tmpdir(), 'test-psql-import.sql');
  const sqlContent = `
DROP TABLE IF EXISTS users;
CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(50));
INSERT INTO users VALUES (1, 'John');
`;
  fs.writeFileSync(tempFilePath, sqlContent);

  await page.goto('/postgresql/import/stefan_psql');
  await expect(page).toHaveURL(/postgresql\/import\/stefan_psql/);
  const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/postgresql/info') && resp.status() === 200),
      // the general import page is the one that loads /postgresql/info, the sidebar link to it only exists in some menus
      page.goto('/postgresql/import'),
    ]);
  await page.locator('select[name="database_name"]').selectOption('stefan_psql');
  await page.locator('input[name="db_file"]').setInputFiles(tempFilePath);
  // the new button just says Import
  await page.getByRole('button', { name: 'Upload & Import' }).or(page.getByRole('button', { name: 'Import', exact: true })).click();
  await expect(page.locator('body')).toContainText(/successfully imported|import.*success/i);
  console.log('postgresql import working');
});


test('delete user', async ({ page }) => {
  await page.goto('/postgresql/users');
  await waitForPostgres(page);
  await expect(page.locator('tr').filter({ has: page.getByText('stefan_psql_user', { exact: true }) })).toBeVisible();
  await deleteRowIfExists(page, '/postgresql/users', 'stefan_psql_user');
  await page.goto('/postgresql/users');
  await expect(page.locator('tr').filter({ has: page.getByText('stefan_psql_user', { exact: true }) })).toHaveCount(0);

  // wizard leftovers
  await deleteRowIfExists(page, '/postgresql/users', 'psql_novi_user');
  console.log('postgresql delete user is working');
});


test('delete database', async ({ page }) => {
  test.setTimeout(120000);

  await navigateToPostgreSQLPage(page);

  const dbName = 'stefan_psql';
  const row = page.locator('tr', { hasText: dbName });

  await expect(row).toBeVisible();
  await deleteRow(page, row);

  await expect(page.locator('body')).toContainText(/successfully deleted/i);
  await expectDatabaseNotInTable(page, dbName);

  // wizard leftovers
  await deleteRowIfExists(page, '/postgresql', 'psql_proba');

  console.log('postgresql database deleted');
});


test('bulk actions', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const dbs = ['pgbulka', 'pgbulkb'];
  const users = ['pgbulkua', 'pgbulkub'];
  const row = (name: string) => page.locator('tr').filter({ has: page.getByText(name, { exact: true }) });

  for (const db of dbs) {
    await deleteRowIfExists(page, '/postgresql', db);
    await navigateToPostgreSQLPage(page);
    await page.getByRole('link', { name: 'New Database' }).click();
    await fillDatabaseName(page, db);
    await page.getByRole('button', { name: 'Create Database' }).click();
    await expect(page.locator('body')).toContainText(/successfully created/i, { timeout: 25000 });
  }
  for (const user of users) {
    await deleteRowIfExists(page, '/postgresql/users', user);
    await page.goto('/postgresql/user');
    await fillNewUser(page, user, 'stefan94bulk');
    await page.getByRole('button', { name: 'Create User' }).click();
    await expect(page.locator('body')).toContainText(new RegExp(`successfully created.*${user}`, 'i'));
  }

  // databases page
  await navigateToPostgreSQLPage(page);
  await bulkSelectAllAndClear(page);

  await bulkSelect(page, dbs, '#databases-table tbody tr');
  await bulkRun(page, 'assign', users[0]);
  await waitForPostgres(page);
  for (const db of dbs) await expect(row(db)).toContainText(users[0]);

  await bulkSelect(page, dbs, '#databases-table tbody tr');
  await bulkRun(page, 'unassign', users[0]);
  await waitForPostgres(page);
  for (const db of dbs) await expect(row(db)).not.toContainText(users[0]);

  await bulkSelect(page, dbs, '#databases-table tbody tr');
  await bulkRun(page, 'export', '/var/www/html/');

  await bulkSelect(page, dbs, '#databases-table tbody tr');
  await bulkRun(page, 'delete');
  await waitForPostgres(page);
  for (const db of dbs) await expect(row(db)).toHaveCount(0);

  // users page
  await page.goto('/postgresql/users');
  await waitForPostgres(page);
  await bulkSelect(page, users, '#users-table tbody tr');
  await bulkRun(page, 'password', 'N3wBulkPass94');

  await bulkSelect(page, users, '#users-table tbody tr');
  await bulkRun(page, 'delete');
  for (const user of users) await expect(row(user)).toHaveCount(0);
});
