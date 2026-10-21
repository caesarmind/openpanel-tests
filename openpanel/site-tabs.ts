import { expect, Page } from '@playwright/test';

// site pages move tabs that don't fit into a "More" menu (static/js/tab-overflow.js), so click it from there when hidden
export async function openSiteTab(page: Page, name: string) {
  const tab = page.locator(`#${name}-tab`);
  await expect(tab).toBeAttached();
  if (await tab.isVisible()) {
    await tab.click();
    return;
  }
  const label = (await tab.textContent())!.trim();
  const item = page.locator('.tab-overflow-item', { hasText: label });
  // the menu can close again right after opening, so reopen until the item shows
  await expect(async () => {
    if (!(await item.isVisible())) await page.locator('.tab-overflow-btn').click();
    await expect(item).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
  await item.click();
}
