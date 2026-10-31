import { test, expect } from '@playwright/test';

async function firstDomainSslUrl(page) {
  await page.goto('/domains');
  const link = page.locator('a[href^="/domains/ssl/"]').first();
  const count = await link.count();
  if (count === 0) return null;
  return link.getAttribute('href');
}

test('ssl management page loads for a domain', async ({ page }) => {
  const href = await firstDomainSslUrl(page);
  test.skip(!href, 'No domains available to inspect SSL for');

  await page.goto(href!);
  await expect(page.getByText('Manage SSL for')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Status' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Domains' })).toHaveAttribute('href', '/domains');

  console.log(`ssl management page loaded for ${href}`);
});

test('ssl status shows AutoSSL, Custom SSL, or Unknown branch', async ({ page }) => {
  // NOTE: verify-only -- "Switch back to AutoSSL" / "Try enabling AutoSSL" trigger a real
  // certificate issuance/renewal flow; we don't want to fire that from every test run.
  const href = await firstDomainSslUrl(page);
  test.skip(!href, 'No domains available to inspect SSL for');

  await page.goto(href!);

  const autoSsl = page.getByText('Auto SSL');
  const customSsl = page.getByText('Custom SSL');
  const unknown = page.getByText('Unknown');

  if (await autoSsl.isVisible().catch(() => false)) {
    console.log('ssl status: AutoSSL currently active');
  } else if (await customSsl.isVisible().catch(() => false)) {
    await expect(page.getByRole('button', { name: 'Switch back to AutoSSL' })).toBeVisible();
    console.log('ssl status: Custom SSL currently active, switch-back button present (not clicked)');
  } else {
    await expect(unknown).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try enabling AutoSSL' })).toBeVisible();
    console.log('ssl status: Unknown, enable-autossl button present (not clicked)');
  }
});

test('custom certificate upload form is present', async ({ page }) => {
  const href = await firstDomainSslUrl(page);
  test.skip(!href, 'No domains available to inspect SSL for');

  await page.goto(href!);

  const publicPath = page.locator('input[name="public_path"]');
  const hasCustomForm = (await publicPath.count()) > 0;
  test.skip(!hasCustomForm, 'Custom SSL upload form not rendered on this environment/state');

  await expect(publicPath).toBeVisible();
  await expect(page.locator('input[name="private_path"]')).toBeVisible();

  console.log('custom certificate upload form present (not submitted)');
});

test('diagnose shows the last certificate error only when caddy logged one', async ({ page }) => {
  const href = await firstDomainSslUrl(page);
  test.skip(!href, 'No domains available to inspect SSL for');

  const diagnosed = page.waitForResponse(r => r.url().endsWith(href!) && r.request().method() === 'POST');
  await page.goto(href!);
  const res = await diagnosed;
  expect(res.ok()).toBeTruthy();
  const d = await res.json();
  expect(typeof d.found).toBe('boolean');

  const box = page.getByText('Last certificate error');
  if (d.found) {
    expect(d.reason).toBeTruthy();
    await expect(box).toBeVisible();
    await expect(page.getByText(d.reason)).toBeVisible();
    console.log(`last certificate error: ${d.reason}`);
  } else {
    await expect(box).toBeHidden();
    console.log('no certificate error in the caddy log');
  }
});

test('ssl filter on the domains list matches the rows it leaves', async ({ page }) => {
  await page.goto('/domains');
  const rows = page.locator('tr.user-row[data-ssl-problem]');
  const total = await rows.count();
  test.skip(total === 0, 'No domains on this server');

  const filter = page.getByRole('combobox', { name: 'Filter by SSL' });
  const checks: Record<string, (problem: string, ssl: string) => boolean> = {
    problems: p => p !== '',
    expired: p => p === 'expired',
    expiring: p => p === 'expiring',
    none: (_, ssl) => ssl !== 'automatic' && ssl !== 'custom',
  };
  for (const [value, ok] of Object.entries(checks)) {
    await filter.selectOption(value);
    const all = await rows.evaluateAll(trs => trs.map(tr => [(tr as HTMLElement).dataset.sslProblem || '', (tr as HTMLElement).dataset.ssl || '']));
    const want = all.filter(([p, s]) => ok(p, s)).length;
    // alpine hides the rows on its next tick
    await expect.poll(() => rows.evaluateAll(trs => trs.filter(tr => (tr as HTMLElement).offsetParent !== null).length), { message: value }).toBe(want);
    console.log(`ssl filter ${value}: ${want}/${total}`);
  }
  await filter.selectOption('');
  await expect.poll(() => rows.evaluateAll(trs => trs.filter(tr => (tr as HTMLElement).offsetParent !== null).length)).toBe(total);

  // the dashboard links here with the filter already set
  await page.goto('/domains?ssl=problems');
  await expect(filter).toHaveValue('problems');
});
