import { test, expect } from '@playwright/test';
import { SUITE_DOMAINS } from '../helpers';

// read only, so it runs with the parallel tests on a domain the setup always adds
test('filter dns records by type', async ({ page }) => {
  await page.goto(`/domains/edit-dns-zone/${SUITE_DOMAINS[0]}`);
  const rows = page.locator('#filemanager_table tr.domain_row');
  const total = await rows.count();
  expect(total).toBeGreaterThan(0);

  const all = page.locator('#dnsTypeFilters button[data-type-filter=""]');
  await expect(all).toContainText(String(total));

  // every zone has A records, and at least one other type to hide
  const a = page.locator('#dnsTypeFilters button[data-type-filter="A"]');
  const aRows = rows.and(page.locator('[data-type="A"]'));
  const aCount = await aRows.count();
  expect(aCount).toBeGreaterThan(0);
  expect(aCount).toBeLessThan(total);
  await expect(a).toContainText(String(aCount));
  await a.click();
  await expect(rows.and(page.locator(':visible'))).toHaveCount(aCount);
  await expect(rows.and(page.locator(':not([data-type="A"])')).first()).toBeHidden();

  // the search still works inside the picked type
  await page.locator('input[x-model="searchQuery"]').fill('zzz-no-such-record');
  await expect(rows.and(page.locator(':visible'))).toHaveCount(0);
  await page.locator('input[x-model="searchQuery"]').fill('');

  await all.click();
  await expect(rows.and(page.locator(':visible'))).toHaveCount(total);
  console.log('dns type filters are working');
});
