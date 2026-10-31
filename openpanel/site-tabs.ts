import { expect, Locator, Page } from '@playwright/test';

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

// deletes the site's application from its remove tab: the old tab has "Delete Application" then "Confirm delete",
// the new theme's trash button opens a confirm (some apps make you type the domain first)
export async function deleteApplication(page: Page) {
  await openSiteTab(page, 'remove');
  // the new trash button is labelled "Delete application" too, so match exactly and leave the new ids out
  const oldButton = page.getByRole('button', { name: 'Delete Application', exact: true }).and(page.locator(':not(#remove-tab):not(#confirm-delete-site)'));
  const newConfirm = page.locator('#confirm-delete-site');
  await expect(oldButton.or(newConfirm).first()).toBeVisible();
  if (await oldButton.isVisible()) {
    await oldButton.click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    return;
  }
  const typed = page.locator('.op-del-type:visible');
  if (await typed.count()) await typed.locator('input').fill((await typed.locator('b.op-mono').innerText()).trim());
  await newConfirm.click();
}

// opens a site's manager from its /sites row: the old row has a Manage link, the new one links the site name
export async function manageSite(row: Locator) {
  const manage = row.getByRole('link', { name: 'Manage', exact: true });
  if (await manage.count()) return manage.click();
  await row.locator('[data-sort-col="name"] a').first().click();
}
