import { test, expect } from '@playwright/test';

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
function isIpBased(BASE_URL: string | undefined): boolean {
  if (!BASE_URL) return true;
  const host = new URL(BASE_URL).hostname;
  return IP_RE.test(host) || host === 'localhost';
}

test('table, clipboard, activity link, search filter and dashboard IP', async ({ page, context, baseURL }) => {

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // Get current public IP
  const ipResponse = await page.request.get('https://ip.openpanel.com/');
  const expectedIp = (await ipResponse.text()).trim();
  expect(expectedIp).toBeTruthy();

  await page.goto('/account/login-history');

  const rows = page.locator('#login-log-table tbody tr');
  const firstRow = rows.first();
  await expect(firstRow).toBeVisible();

  const ipText = (await firstRow
    .locator('td')
    .first()
    .locator('.text-base.font-semibold, .op-login-ip > b')
    .textContent())?.trim();
  expect(ipText).toContain(expectedIp);

  // panel copies via execCommand on a temp textarea, and navigator.clipboard doesn't exist on plain http, so grab it from the copy event
  await page.evaluate(() => {
    (window as any).__copied = '';
    document.addEventListener('copy', () => {
      const el = document.activeElement as HTMLTextAreaElement;
      (window as any).__copied = el?.value?.slice(el.selectionStart, el.selectionEnd) || String(document.getSelection());
    });
  });
  await firstRow.locator('.copy-ip-icon, .op-login-copy').click();
  // the new theme shows a "Copied <ip>" toast instead of swapping the icon
  await expect(firstRow.locator('.bi-clipboard-check-fill').or(page.locator('#toast-container').getByText(`Copied ${expectedIp}`))).toBeVisible();
  // it also writes with navigator.clipboard where that exists, which fires no copy event, so read the clipboard back then
  expect(await page.evaluate(async () => (window as any).__copied || (navigator.clipboard ? await navigator.clipboard.readText() : ''))).toBe(expectedIp);

  const activityLink = firstRow.locator('a', { hasText: 'View activity log' });
  await expect(activityLink).toHaveAttribute('href', `/account/activity?search=${expectedIp}`);

  const searchInput = page.locator('[x-model="searchQuery"]');
  await searchInput.fill(expectedIp);
  const visibleRows = rows.filter({ visible: true });
  await expect(visibleRows.first()).toBeVisible();
  await expect(visibleRows.first()).toContainText(expectedIp);

  await searchInput.fill('lazar');
  await expect(firstRow).toBeHidden();

  // Go to dashboard and verify last IP element contains any IP address
  await page.goto('/dashboard');
  const lastIp = page.locator('#last-ip');
  await expect(lastIp).toBeVisible();
  await expect(lastIp).toContainText(/\b\d{1,3}(\.\d{1,3}){3}\b/);
});
