import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function navigateToMongoDBPage(page: any) {
  await page.goto('/mongodb');
  await expect(page).toHaveURL(/mongodb/);
}

async function expectDatabaseInTable(page: any, dbName: string) {
  const row = page.locator('tr', { hasText: dbName });
  await expect(row).toBeVisible();
}

async function expectDatabaseNotInTable(page: any, dbName: string) {
  await expect(page.locator('tr', { hasText: dbName })).toHaveCount(0);
}


// ACCESS
test('list databases', async ({ page }) => {
  await navigateToMongoDBPage(page);
  // empty state on a fresh account, otherwise the table with its counter
  await expect(page.locator('body')).toContainText(/create your first database|no databases|total databases:\s*\d+/i, { timeout: 25000 });
  console.log('mongodb initialized');
});


test('create database', async ({ page }) => {
  // a fresh account's MongoDB was only just started by the list test, the form sends us back until it answers
  await expect(async () => {
    await navigateToMongoDBPage(page);
    await page.getByRole('link', { name: 'New Database' }).click();
    await expect(page.getByRole('textbox', { name: 'Database Name' })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 120_000, intervals: [5000] });
  await page.getByRole('textbox', { name: 'Database Name' }).fill('stefan_mongo');
  await page.getByRole('button', { name: 'Create Database' }).click();
  await expect(page.locator('body')).toContainText(/successfully created/i, { timeout: 25000 });
  await expectDatabaseInTable(page, 'stefan_mongo');
  console.log('mongodb database created');
});


test('list users', async ({ page }) => {
  await page.goto('/mongodb/users');
  await expect(page).toHaveURL(/mongodb\/users/);
  await expect(page.locator('body')).toContainText(/users/i);
  console.log('mongodb users page accessible');
});


test('create user', async ({ page }) => {
  await page.goto('/mongodb/user');
  await expect(page).toHaveURL(/mongodb\/user/);
  await page.getByRole('textbox', { name: 'Username' }).fill('stefan_mongo_user');
  await page.getByRole('textbox', { name: 'Password' }).fill('stefan94');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.locator('body')).toContainText(/successfully created.*stefan_mongo_user/i);
  await page.getByRole('link', { name: 'Back to Users' }).click();
  await expect(page).toHaveURL(/mongodb\/users/);
  await expect(page.locator('body')).toContainText(/stefan_mongo_user/i);
  console.log('mongodb user created');
});


test('change password', async ({ page }) => {
  await page.goto('/mongodb/users');
  // this spec's own user, other users may exist from earlier runs
  await page.locator('a[href="/mongodb/password/stefan_mongo_user"]').click();
  await expect(page).toHaveURL(/mongodb\/password/);
  // the generate button only works once the page's script has run
  await page.waitForLoadState('load');
  await page.locator('#generatePassword').click();
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expect(page).toHaveURL(/mongodb\/users/);
  await expect(page.locator('body')).toContainText(/successfully changed password/i);
  console.log('mongodb change password working');
});


test('assign user to database', async ({ page }) => {
  await page.goto('/mongodb/users');
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/mongodb/info') && resp.status() === 200),
    page.getByRole('link', { name: 'Assign User to Database' }).click(),
  ]);
  await expect(page).toHaveURL(/mongodb\/assign/);
  await page.locator('select[name="db_user"]').selectOption('stefan_mongo_user');
  await page.locator('select[name="database_name"]').selectOption('stefan_mongo');
  await page.locator('select[name="role"]').selectOption('readWrite');
  await page.getByRole('button', { name: 'Assign User to Database' }).click();
  await expect(page.locator('body')).toContainText(/Successfully added a user/i);
  console.log('mongodb user assigned to database');
});


test('revoke user from database', async ({ page }) => {
  await page.goto('/mongodb/users');
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/mongodb/info') && resp.status() === 200),
    page.getByRole('link', { name: 'Remove User from Database' }).click(),
  ]);
  await expect(page).toHaveURL(/mongodb\/remove/);
  await page.locator('select[name="db_user"]').selectOption('stefan_mongo_user');
  await page.locator('select[name="database_name"]').selectOption('stefan_mongo');
  await page.locator('select[name="role"]').selectOption('readWrite');
  await page.getByRole('button', { name: 'Remove User from Database' }).click();
  await expect(page.locator('body')).toContainText(/successfully revoked|removed/i);
  console.log('mongodb user revoked from database');
});


test('database wizard', async ({ page }) => {
  await page.goto('/mongodb/wizard');
  await expect(page).toHaveURL(/mongodb\/wizard/);
  await page.locator('input[name="database_name"]').fill('mongo_proba');
  await page.locator('input[name="db_user"]').fill('mongo_novi_user');
  await page.locator('#password').fill('stefan456g7dsd');
  await page.locator('select[name="role"]').selectOption('readWrite');
  await page.getByRole('button', { name: 'Create DB, User, and Grant Role' }).click();
  await expect(page.getByText('Successfully created database')).toBeVisible();
  await expect(page).toHaveURL(/mongodb/);
  const row = page.locator('#databases-table tr', { hasText: 'mongo_proba' });
  await expect(row).toContainText(/mongo_proba/i);
  console.log('mongodb database wizard is working');
});


// IMPORT
// Unlike MySQL/PostgreSQL, a real MongoDB dump is a binary mongodump archive
// (not a plain-text SQL file), so a full successful mongorestore round trip
// can't be faked here the way the SQL import tests fake a .sql file. Instead
// this verifies the page loads with the right database pre-selected, and
// that the server genuinely rejects a non-.archive upload (exercises the
// real extension check in handleMongoImportDB, not just the client-side
// accept="" filter).
test('import page rejects wrong file type', async ({ page }) => {
  const tempFilePath = path.join(os.tmpdir(), 'test-mongo-import.sql');
  fs.writeFileSync(tempFilePath, 'not a mongodump archive');

  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/mongodb/info') && resp.status() === 200),
    page.goto('/mongodb/import/stefan_mongo'),
  ]);
  await expect(page).toHaveURL(/mongodb\/import\/stefan_mongo/);
  await expect(page.locator('select[name="database_name"]')).toHaveValue('stefan_mongo');

  await page.locator('input[name="db_file"]').setInputFiles(tempFilePath);
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/mongodb/import') && resp.request().method() === 'POST'),
    page.getByRole('button', { name: 'Upload & Import' }).click(),
  ]);
  expect(response.status()).toBe(400);
  console.log('mongodb import correctly rejected a non-archive file');
});


test('delete user', async ({ page }) => {
  await page.goto('/mongodb/users');
  // scope to our user, the wizard test adds others and the first row isn't necessarily ours
  const row = page.locator('tr', { hasText: 'stefan_mongo_user' });
  await expect(row).toBeVisible();
  await row.locator('button.btn-danger').click();
  const confirmButton = page.locator('button.btn-dark:visible');
  await expect(confirmButton.first()).toBeVisible();
  await confirmButton.first().click();
  await expect(page.locator('body')).toContainText(/successfully deleted/i);
  await page.goto('/mongodb/users');
  await expect(page.locator('tr', { hasText: 'stefan_mongo_user' })).toHaveCount(0);
  console.log('mongodb delete user is working');
});


test('delete database', async ({ page }) => {
  await navigateToMongoDBPage(page);
  const dbName = 'stefan_mongo';
  const row = page.locator('tr', { hasText: dbName });
  const deleteButton = row.locator('button.btn-danger');
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();
  const confirmButton = page.locator('button.btn-dark');
  await expect(confirmButton).toBeVisible();
  await confirmButton.click();
  await expect(page.locator('body')).toContainText(/successfully deleted/i);
  await expectDatabaseNotInTable(page, dbName);
  console.log('mongodb database deleted');
});
