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
  await page.locator('.tab-overflow-btn').click();
  await page.locator('.tab-overflow-item', { hasText: label }).click();
}
