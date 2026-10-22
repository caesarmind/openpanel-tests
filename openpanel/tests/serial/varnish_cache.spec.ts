import { test, expect, type Page } from '@playwright/test';
import { ensureDomains, withProjectPage } from '../../helpers';

const DOMAIN = 'shared.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

// a failure halfway would leave varnish in front of every site of the account
test.afterAll(async ({ browser }, testInfo) => {
  testInfo.setTimeout(2 * 60_000);
  await withProjectPage(browser, testInfo, async page => {
    await page.goto('/cache/varnish');
    const status = page.locator('#service-page-status');
    if ((await status.textContent())?.trim() !== 'Disabled') {
      await page.getByRole('button', { name: 'Click to Disable' }).click();
      await expect(status).toHaveText('Disabled', { timeout: 40_000 });
    }
  });
});

// toggling varnish recreates caddy/webserver, so 443 refuses connections for a few seconds right after
async function varnishHeaders(page: Page, path: string): Promise<boolean | null> {
  try {
    const response = await page.request.get(`https://${DOMAIN}/${path}?${Date.now()}`, { timeout: 10_000 });
    const headers = response.headers();
    const xCache = headers['x-cache']?.toLowerCase() || '';
    const via = headers['via']?.toLowerCase() || '';
    return 'x-varnish' in headers || xCache.includes('hit') || xCache.includes('miss') || via.includes('varnish');
  } catch {
    return null;
  }
}

function domainRow(page: Page) {
  return page.locator('tbody tr.domain_row').filter({ has: page.locator('td', { hasText: new RegExp(`^\\s*${DOMAIN.replace(/\./g, '\\.')}\\s*$`) }) });
}

test('enable varnish', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/cache/varnish');
  const status = page.locator('#service-page-status');
  await expect(status).toHaveText('Disabled');
  await page.getByRole('button', { name: 'Click to Enable' }).click();
  // Enabling stops/recreates both the webserver and varnish containers,
  // which routinely takes longer than the 5s default assertion timeout.
  await expect(status).not.toHaveText('Disabled', { timeout: 40_000 });
});

test('should show domains table and enable Varnish', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/cache/varnish');
  const table = page.locator('table');
  await expect(table).toBeVisible();
  const firstRow = domainRow(page);
  await expect(firstRow).toBeVisible();
  const domainName = DOMAIN;
  const toggleButton = firstRow.locator('button[type="submit"]');
  await expect(toggleButton).toHaveAttribute('aria-checked', 'false');
  await toggleButton.click();
  await page.waitForLoadState('networkidle');
  const alert = page.locator('#alert-stack .ms-3');
  await expect(alert).toContainText(`Varnish cache is now On for domain ${domainName}`, { timeout: 10_000 });

  // create test files
  await page.goto(`/file-manager/edit-file/${DOMAIN}/test.txt?editor=text&new=true`);
  await page.locator('#editor-text').fill(`nista`);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.goto(`/file-manager/edit-file/${DOMAIN}/test2.txt?editor=text&new=true`);
  await page.locator('#editor-text').fill(`nista`);
  await page.getByRole('button', { name: 'Save' }).click();


  
  await expect.poll(() => varnishHeaders(page, 'test.txt'), { timeout: 60_000, intervals: [2000] }).toBe(true);
});

test('should display container log and show Varnish Cache & Container stats', async ({ page }) => {
  await page.goto('/cache/varnish');
  const logButton = page.locator('#service-log');
  await expect(logButton).toBeVisible();
  await expect(logButton).toHaveText('View container log');
  await logButton.click();
  const logContainer = page.locator('#log-container');
  await expect(logContainer).toBeVisible({ timeout: 15_000 });
  const logPre = page.locator('#log-content');
  await expect(logPre).toBeVisible();
  const logText = await logPre.textContent();
  expect(logText?.trim().length).toBeGreaterThan(0);
  
  const varnishCacheSection = page.locator('h2:has-text("Varnish Cache")');
  await expect(varnishCacheSection).toBeVisible();
  
  const expectedMetrics = ['Hit Ratio', 'Hits', 'Misses', 'Pass', 'Requests', 'Backend Requests'];
  for (const metric of expectedMetrics) {
    const label = page.locator('span.text-sm').filter({ hasText: metric }).first();
    await expect(label).toBeVisible();
  }
  
  const metricValues = page.locator('[x-data="varnishStats()"] span.font-medium');
  const count = await metricValues.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(metricValues.nth(i)).not.toHaveText('--', { timeout: 10_000 });
  }
  
  const containerSection = page.locator('h2:has-text("Container")');
  await expect(containerSection).toBeVisible();
  const containerStats = page.locator('#service-page-stats');
  await expect(containerStats).toBeVisible();
  const expectedContainerLabels = ['CPU Usage', 'Memory Usage', 'Memory %', 'Network I/O', 'PIDs'];
  for (const label of expectedContainerLabels) {
    const labelEl = containerStats.locator('span.text-sm').filter({ hasText: label });
    await expect(labelEl).toBeVisible();
  }
  
  const containerValues = containerStats.locator('span.font-medium');
  const containerCount = await containerValues.count();
  expect(containerCount).toBeGreaterThan(0);
  for (let i = 0; i < containerCount; i++) {
    await expect(containerValues.nth(i)).not.toHaveText('--', { timeout: 10_000 });
  }
});

test('should disable Varnish for domain', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/cache/varnish');
  
  const table = page.locator('table');
  await expect(table).toBeVisible();
  
  const firstRow = domainRow(page);
  await expect(firstRow).toBeVisible();
  const domainName = DOMAIN;
  
  const toggleButton = firstRow.locator('button[type="submit"]');
  await expect(toggleButton).toHaveAttribute('aria-checked', 'true');
  
  await toggleButton.click();
  await page.waitForLoadState('networkidle');
  
  const alert = page.locator('#alert-stack .ms-3');
  await expect(alert).toContainText(`Varnish cache is now Off for domain ${domainName}`, { timeout: 10_000 });
  
  await expect.poll(() => varnishHeaders(page, 'test2.txt'), { timeout: 60_000, intervals: [2000] }).toBe(false);
});
test('disable varnish', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/cache/varnish');
  const status = page.locator('#service-page-status');
  await expect(status).not.toHaveText('Disabled');
  await page.getByRole('button', { name: 'Click to Disable' }).click();
  // Disabling stops/removes both the webserver and varnish containers then
  // recreates the webserver, which routinely takes longer than the 5s
  // default assertion timeout.
  await expect(status).toHaveText('Disabled', { timeout: 40_000 });
});
