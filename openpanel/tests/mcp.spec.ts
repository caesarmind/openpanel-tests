import { test, expect, type Page } from '@playwright/test';
import { bulkRun, bulkSelectKeys, bulkSelectAllAndClear } from '../helpers';

const RUN = process.env.TEST_RUN_ID || Math.random().toString(36).slice(2, 8);

const tokenRow = (page: Page, name: string) => page.locator('#mcp-tokens-table tbody tr', { hasText: name });

async function createToken(page: Page, name: string, readOnly = false) {
  await page.goto('/account/mcp');
  const form = page.locator('#mcp-generate-form');
  await form.locator('input[name="name"]').fill(name);
  await form.locator('select[name="expires_in_days"]').selectOption('30');
  if (readOnly) await form.locator('input[name="read_only"]').check();
  await form.getByRole('button', { name: 'Generate new token' }).click();
  await expect(page).toHaveURL(/\/account\/mcp/);
  await expect(tokenRow(page, name)).toBeVisible();
}

test('mcp tokens page loads', async ({ page }) => {
  await page.goto('/account/mcp');
  await expect(page.locator('#mcp-generate-form')).toBeVisible();
  await expect(page.locator('#mcp-connect-section')).toBeVisible();
});

test('generate a read-only token', async ({ page }) => {
  const name = `pw-mcp-ro-${RUN}`;
  await createToken(page, name, true);
  await expect(tokenRow(page, name)).toContainText('Read-only');
});

test('bulk revoke tokens', async ({ page }) => {
  const names = [`pw-mcp-a-${RUN}`, `pw-mcp-b-${RUN}`];
  for (const name of names) await createToken(page, name);

  await page.goto('/account/mcp');
  await bulkSelectAllAndClear(page);

  // the checkbox key is the token id, so read it from each row
  const ids = await Promise.all(names.map(name => tokenRow(page, name).locator('input.bulk-select-box').getAttribute('value')));
  await bulkSelectKeys(page, ids as string[]);
  await bulkRun(page, 'revoke');
  for (const name of names) await expect(tokenRow(page, name)).toHaveCount(0);

  // the read-only token from the test above goes too
  const leftover = tokenRow(page, `pw-mcp-ro-${RUN}`).locator('input.bulk-select-box');
  if (await leftover.count()) {
    await bulkSelectKeys(page, [(await leftover.getAttribute('value'))!]);
    await bulkRun(page, 'revoke');
  }
});
