import { test, expect } from '@playwright/test';

// multi-server checks on the master, they only run when a slave is set in .env
const SLAVE_URL = process.env.SLAVE_URL;
test.skip(!SLAVE_URL, 'SLAVE_URL not set');

const slaveHost = () => new URL(SLAVE_URL!).hostname;

test('servers table lists the slave with its actions', async ({ page }) => {
  await page.goto('/server/cluster');
  const row = page.locator('tr', { hasText: slaveHost() }).first();
  await expect(row).toBeVisible();
  for (const name of ['Open', 'Pause', 'Make master', 'Remove']) {
    await expect(row.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Generate install command' })).toBeVisible();
});

test('sidebar menu offers the slave', async ({ page }) => {
  await page.goto('/dashboard');
  const res = await page.request.get('/_cluster/state');
  expect(res.ok()).toBeTruthy();
  const state = await res.json();
  expect(state.servers.some((s: any) => s.address === slaveHost())).toBeTruthy();
});

test('lists show rows of the slave with a server column', async ({ page }) => {
  await page.goto('/plans');
  await expect(page.getByRole('columnheader', { name: /Server/ })).toBeVisible();
  await expect(page.locator('tr[data-cluster-node]').first()).toBeAttached();
  await expect(page.getByRole('heading', { level: 2 })).toContainText(/across \d+ servers/);
});

test('install command carries an invite', async ({ page }) => {
  await page.goto('/server/cluster');
  await page.getByRole('button', { name: 'Generate install command' }).click();
  await expect(page.locator('#install_cmd')).toHaveValue(/--join-cluster=opinvite-/);
});

test('pausing the slave hides its rows until resumed', async ({ page }) => {
  await page.goto('/server/cluster');
  const row = () => page.locator('tr', { hasText: slaveHost() }).first();
  await row().getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(row()).toContainText('paused');
  try {
    await page.goto('/plans');
    const res = await page.request.get('/_cluster/state');
    const slave = (await res.json()).servers.find((s: any) => s.address === slaveHost());
    expect(slave.paused).toBeTruthy();
    await expect(page.locator(`tr[data-cluster-node="${slave.id}"]`)).toHaveCount(0);
  } finally {
    await page.goto('/server/cluster');
    await row().getByRole('button', { name: 'Resume', exact: true }).click();
  }
  await expect(row().getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});
