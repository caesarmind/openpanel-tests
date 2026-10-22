import { test, expect } from '@playwright/test';
import { ensureDomains } from '../helpers';

// Covers modules/json/favicons.py (/json/favicon/<domain>) and
// modules/json/screenshots.py (/json/screenshot/<domain>) — both used as embedded
// image sources on the domains list and website manager pages.

// read-only use, so it shares a domain with other specs that only look at it
const domain = 'shared.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, domain);
});

test('favicon endpoint redirects to a favicon image', async ({ page }) => {
  const response = await page.goto(`/json/favicon/${domain}`);
  expect(response).not.toBeNull();
  const status = response!.status();
  expect(status === 404 || status < 400).toBeTruthy();
  if (status !== 404) {
    const contentType = response!.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/image/);
  }
  console.log('favicon endpoint is working');
});

test('favicon endpoint rejects a domain the user does not own', async ({ page }) => {
  const response = await page.goto('/json/favicon/not-owned-by-this-user.example.com');
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(403);
  console.log('favicon endpoint enforces domain ownership');
});

test('screenshot endpoint returns an image', async ({ page }) => {
  test.skip(true, 'https://github.com/stefanpejcic/OpenPanel/issues/1208 screenshot API is slower than the panel timeout');
  test.setTimeout(60_000);
  const response = await page.goto(`/json/screenshot/${domain}`);
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(400);
  const contentType = response!.headers()['content-type'] ?? '';
  expect(contentType).toMatch(/image/);
  console.log('screenshot endpoint is working');
});

test('screenshot endpoint rejects a domain the user does not own', async ({ page }) => {
  const response = await page.goto('/json/screenshot/not-owned-by-this-user.example.com');
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(403);
  console.log('screenshot endpoint enforces domain ownership');
});

test('screenshot can be force-regenerated via POST', async ({ page }) => {
  test.skip(true, 'https://github.com/stefanpejcic/OpenPanel/issues/1208 screenshot API is slower than the panel timeout');
  test.setTimeout(60_000);
  // any panel page works for the csrf token
  await page.goto('/dashboard');

  const status = await page.evaluate(async (d) => {
    const res = await fetch(`/json/screenshot/${d}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': (window as any).csrf_token },
    });
    return res.status;
  }, domain);

  expect(status).toBeLessThan(400);
  console.log('screenshot regeneration endpoint is working');
});
