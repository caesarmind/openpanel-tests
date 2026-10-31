import { test, expect, type Page } from '@playwright/test';
import { clickInstall, ensureDomains } from '../helpers';

const domain = 'website-builder.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, domain);
});

// detach keeps the site files and the installer refuses to run over an existing index.html
async function removeIndexHtml(page) {
  await page.goto(`/files/${domain}`);
  const row = page.locator('#filemanager_table tbody tr[data-file="index.html"]');
  if (!(await row.count())) return;
  await row.click();
  await page.locator('#deleteButton').click();
  const deleteEditor = page.locator('.fm-inline-editor').filter({ has: page.locator('button[data-act="save"]') });
  await expect(deleteEditor).toBeVisible();
  await deleteEditor.locator('.fm-inline-skip-trash').check();
  await deleteEditor.locator('button[data-act="save"]').click();
  await expect(row).toHaveCount(0);
}

test('website builder install page loads', async ({ page }) => {
  await page.goto('/website-builder/install');
  await expect(page).toHaveURL(/website-builder\/install/);
  await expect(page.locator('body')).toContainText(/website builder|install|grapejs/i);
  console.log('website builder install page accessible');
});


test('install form has domain selector', async ({ page }) => {
  await page.goto('/website-builder/install');

  const domainSelect = page.locator('select[name="domain_id"]');
  const hasSelect = await domainSelect.isVisible({ timeout: 3000 }).catch(() => false);

  expect(hasSelect).toBe(true);
  const options = await domainSelect.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(0);
  console.log(`website builder install domain selector has ${options.length} options`);
});


// the old page redirects to the builder on its own, the new one stays on a done screen with a link to it
async function expectBuilderOpened(page: Page) {
  const editor = new RegExp(`/website-builder/edit\\?domain=${domain.replace(/\./g, '\\.')}$`);
  const open = page.getByRole('link', { name: /open website builder/i });
  await expect(page.locator('text=Website creation completed!').or(open).first()).toBeAttached({ timeout: 60000 });
  await expect(page).toHaveURL(editor, { timeout: 10000 }).catch(async () => {
    await open.click();
    await expect(page).toHaveURL(editor);
  });
}

test('website builder', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  await removeIndexHtml(page);

  // 1. install
  await page.goto('/website-builder/install');
  await page.locator('#domain_id').selectOption('website-builder.tests.openpanel.org');
  const installResponse = page.waitForResponse(r => r.url().includes('/website-builder/install') && r.request().method() === 'POST', { timeout: 60000 });
  await clickInstall(page);
  // the stream carries the real error, so fail with it instead of a missing toast
  const installLog = await (await installResponse).text();
  expect(installLog, installLog).toContain('Website creation completed!');
  await expectBuilderOpened(page);

  // 2. test edit and save
  await page.locator('span.gjs-pn-btn.fa.fa-save').click();
  await expect(page.locator('text=Saved successfully!')).toBeVisible({ timeout: 30000 });
  
  await page.goto('http://website-builder.tests.openpanel.org/');
  await expect(async () => {
    await page.reload();
    const html = await page.content();
    expect(html).toContain('tailwindcss');
  }).toPass({ timeout: 30000, intervals: [1000] });

  
  // 3. test view
  await page.goto('/sites');
  const table = page.locator('tbody.divide-y.divide-gray-200.dark\\:divide-gray-800');
  await expect(table).toBeVisible();
  await expect(page.locator('tr[id="site-row-website-builder.tests.openpanel.org"]')).toBeVisible();
  console.log('website install is working');
  await expect(page.locator('a[href="/website-builder/edit?domain=website-builder.tests.openpanel.org"]')).toBeVisible();
  console.log('website edit is working');

  // test editor
  await page.goto('/website-builder/edit?domain=website-builder.tests.openpanel.org');
  await expect(page).toHaveURL(url => url.pathname === '/website-builder/edit' && url.searchParams.get('domain') === domain);
  await expect(page.locator('.gjs-cv-canvas iframe')).toBeVisible({ timeout: 15000 });
  console.log('website builder edit page accessible');
  
  // 4. test remove
  await page.goto('/website?domain=website-builder.tests.openpanel.org');
  await page.locator('a#remove-tab').click();
  await page.locator('button#delete-site').click();
  await page.locator('button#confirm-delete-site').click();
  await expect(page.locator('text=Website deleted successfully!')).toBeVisible({ timeout: 30000 });
  await page.goto('/sites');
  await expect(page.locator('tr[id="site-row-website-builder.tests.openpanel.org"]')).not.toBeVisible();
  console.log('website uninstall is working');

  // 5. install again and test detach
  await page.goto('/website-builder/install');
  await page.locator('#domain_id').selectOption('website-builder.tests.openpanel.org');
  await clickInstall(page);
  await expectBuilderOpened(page);

  await page.goto('/website?domain=website-builder.tests.openpanel.org');
  await page.locator('a#remove-tab').click();
  await page.locator('button#detach-site').click();
  await page.locator('button#confirm-detach-site').click();
  await expect(page.locator('text=Website detached successfully!')).toBeVisible({ timeout: 30000 });
  await page.goto('/sites');
  await expect(page.locator('tr#site-row-website-builder.tests.openpanel.org')).not.toBeVisible();
  console.log('website detach is working');

  await removeIndexHtml(page);
});
