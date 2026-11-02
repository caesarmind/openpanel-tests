import { test, expect } from '@playwright/test';

// NOTE: verify-only -- the images tab's Pull/Delete/"Download all"/"Delete unused"/
// "Check all for updates"/"Check all for vulnerabilities" actions mutate the shared
// podman image store (or hit a real registry / install Trivy on first use), which
// would disrupt other services and tests relying on that store in a shared
// environment. Presence/wiring of those controls is asserted; none are clicked.

test('podman page loads with Info/Images/Volumes/Networks/Disk Usage tabs', async ({ page }) => {
  await page.goto('/services/podman');
  await expect(page).toHaveURL(/services\/podman/);

  await expect(page.getByRole('heading', { name: 'Podman' })).toBeVisible();

  for (const tab of ['Info', 'Images', 'Volumes', 'Networks', 'Disk Usage']) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  }

  console.log('podman page loaded with all five tabs present');
});

test('info tab shows podman info output by default', async ({ page }) => {
  await page.goto('/services/podman');

  const infoPanel = page.getByRole('tabpanel').first();
  // the raw output sits in a collapsible block under the summary
  const raw = infoPanel.locator('details');
  if ((await raw.count()) && (await raw.getAttribute('open')) === null) await raw.locator('summary').click();
  await expect(infoPanel.locator('pre')).toBeVisible();

  const text = (await infoPanel.locator('pre').innerText()).trim();
  expect(text.length).toBeGreaterThan(0);

  console.log('info tab rendered non-empty podman info output');
});

test('images tab lists images with search and bulk action controls', async ({ page }) => {
  await page.goto('/services/podman#images');

  await page.getByRole('tab', { name: 'Images' }).click();
  await expect(page).toHaveURL(/#images/);

  for (const label of ['Check all for updates', 'Check all for vulnerabilities', 'Download all', 'Delete unused']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }

  const rows = page.locator('#podman-images-tbody tr');
  const count = await rows.count();
  test.skip(count === 0, 'No images found on this environment');

  await expect(page.locator('thead').getByText('Repository', { exact: true })).toBeVisible();
  await expect(page.locator('thead').getByText('Containers', { exact: true })).toBeVisible();

  console.log(`images tab listed ${count} image row(s) with bulk action controls`);
});

test('search filters the images table', async ({ page }) => {
  await page.goto('/services/podman#images');

  const rows = page.locator('#podman-images-tbody tr');
  const count = await rows.count();
  test.skip(count === 0, 'No images found on this environment');

  const repo = (await rows.first().locator('td').nth(0).innerText()).trim();
  test.skip(repo === '' || repo === '<none>', 'First image row has no usable repository name');

  await page.locator('input[placeholder="Search images…\"]').fill(repo);
  await page.waitForTimeout(150);

  await expect(rows.filter({ hasText: repo }).first()).toBeVisible();

  console.log(`search filtered images table to "${repo}"`);
});

test('each downloaded, unused image exposes a Delete control; in-use images do not', async ({ page }) => {
  await page.goto('/services/podman#images');

  const rows = page.locator('#podman-images-tbody tr');
  const count = await rows.count();
  test.skip(count === 0, 'No images found on this environment');

  let sawDeletable = false;
  let sawProtected = false;

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const usageText = await row.locator('td').nth(4).innerText();
    // Delete lives in the row's actions menu, which stays in the DOM while closed
    const deleteBtn = row.locator('[role="menuitem"]', { hasText: 'Delete' });
    const hasDelete = (await deleteBtn.count()) > 0;

    if (usageText.includes('Unused')) {
      expect(hasDelete).toBeTruthy();
      sawDeletable = true;
    } else if (usageText.includes('system') || usageText.includes('user')) {
      expect(hasDelete).toBeFalsy();
      sawProtected = true;
    }
  }

  test.skip(!sawDeletable && !sawProtected, 'No images with a determinable usage state on this environment');
  console.log(`verified delete-control gating (deletable seen: ${sawDeletable}, protected seen: ${sawProtected})`);
});

test('volumes tab lists podman volumes', async ({ page }) => {
  await page.goto('/services/podman#volumes');
  await page.getByRole('tab', { name: 'Volumes' }).click();
  await expect(page).toHaveURL(/#volumes/);

  const rows = page.locator('#podman-volumes-tbody tr');
  const count = await rows.count();
  if (count === 0) {
    await expect(page.getByText('No volumes found.')).toBeVisible();
    console.log('volumes tab shows empty state');
    return;
  }

  await expect(page.locator('thead').getByText('Mountpoint', { exact: true })).toBeVisible();
  console.log(`volumes tab listed ${count} volume row(s)`);
});

test('networks tab lists podman networks', async ({ page }) => {
  await page.goto('/services/podman#networks');
  await page.getByRole('tab', { name: 'Networks' }).click();
  await expect(page).toHaveURL(/#networks/);

  const rows = page.locator('#podman-networks-tbody tr');
  const count = await rows.count();
  if (count === 0) {
    await expect(page.getByText('No networks found.')).toBeVisible();
    console.log('networks tab shows empty state');
    return;
  }

  await expect(page.locator('thead').getByText('Subnet', { exact: true })).toBeVisible();
  console.log(`networks tab listed ${count} network row(s)`);
});

test('disk usage tab shows podman system df output', async ({ page }) => {
  await page.goto('/services/podman#diskusage');
  await page.getByRole('tab', { name: 'Disk Usage' }).click();
  await expect(page).toHaveURL(/#diskusage/);

  const rows = page.locator('#podman-diskusage-tbody tr');
  const count = await rows.count();
  if (count === 0) {
    await expect(page.getByText('Could not read disk usage.')).toBeVisible();
    console.log('disk usage tab shows empty/error state');
    return;
  }

  await expect(page.locator('thead').getByText('Reclaimable', { exact: true })).toBeVisible();
  console.log(`disk usage tab listed ${count} row(s)`);
});

test('check for updates asks the registry about one image', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/services/podman#images');
  const btn = page.locator('button[onclick^="podmanCheckImageUpdate("]').first();
  test.skip(await btn.count() === 0, 'No downloaded image to check');

  // jsStr escapes the slashes in the onclick
  const ref = (await btn.getAttribute('onclick'))!.match(/podmanCheckImageUpdate\('([^']+)'\)/)![1].replace(/\\\//g, '/');
  const checked = page.waitForResponse(r => r.url().includes('/services/podman/images/check-update?ref='), { timeout: 60_000 });
  await btn.click();
  const body = await (await checked).json();
  if (body.error) {
    console.log(`registry check for ${ref} failed: ${body.error}`);
    await expect(page.getByText(`Failed to check ${ref}`)).toBeVisible();
  } else {
    expect(typeof body.available).toBe('boolean');
    // the toast shows before the page reloads with the new badge
    await expect(page.getByText(`${ref} is `).first()).toBeVisible();
    console.log(`${ref}: ${body.available ? 'update available' : 'up to date'}`);
  }
});

test('vulnerability details of an image load', async ({ page }) => {
  await page.goto('/services/podman#images');
  const res = await page.request.get('/services/podman/images/vulnerabilities?ref=' + encodeURIComponent('docker.io/library/alpine:latest'));
  expect(res.status()).toBeLessThan(500);
  const body = await res.json();
  expect(body).toBeTruthy();
});
