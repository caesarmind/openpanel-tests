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

test('tasks of every server show with a server column and filter', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page.locator('#tasks_table thead th[data-sort="server"]')).toBeAttached({ timeout: 15_000 });

  const merged = await (await page.request.get('/tasks?output=json&cluster=all')).json();
  const nodesOf = (t: any): string[] => t.nodes || [t.node];
  const node = merged.flatMap(nodesOf).find((n: string) => n && n !== 'local');
  expect(node, 'a task from the slave').toBeTruthy();
  // the same cron job on both servers is one row naming both
  const shared = merged.filter((t: any) => nodesOf(t).length > 1);
  if (shared.length) await expect(page.locator('#tasks_tbody tr[data-command]', { hasText: /\S, \S/ }).first()).toBeVisible();
  console.log(`tasks: ${merged.length} rows, ${shared.length} shared by servers`);

  await page.goto(`/tasks?server=${encodeURIComponent(node)}`);
  await expect(page.locator('#tasks_table thead th[data-sort="server"]')).toBeAttached();
  const want = merged.filter((t: any) => nodesOf(t).includes(node)).length;
  await expect.poll(() => page.locator('#tasks_tbody tr[data-command]').count()).toBe(want);
});

test('crons are applied on all servers by default from the master', async ({ page }) => {
  await page.goto('/server/crons');
  const box = page.locator('input.cluster-apply-all');
  await expect(box).toHaveCount(1);
  await expect(box).toBeChecked();
});

test('health lists the slave online with its stats', async ({ page }) => {
  await page.goto('/server/cluster');
  const health = await (await page.request.get('/server/cluster/health')).json();
  expect(health.role).toBe('master');
  const slave = health.servers.find((s: any) => s.address === slaveHost());
  expect(slave, 'slave in health').toBeTruthy();
  expect(slave.online).toBeTruthy();
  expect(slave.version).toMatch(/^\d+\.\d+\.\d+/);
});

test('sync brings the slave in line with the master', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/server/cluster#sync');
  const state = await (await page.request.get('/_cluster/state')).json();
  const slave = state.servers.find((s: any) => s.address === slaveHost());
  const box = page.locator(`input[name="nodes"][value="${slave.id}"]`);
  await expect(box).toBeChecked();
  // only the slave, a paused or other server keeps its settings
  for (const other of await page.locator('input[name="nodes"]').all()) {
    if (await other.getAttribute('value') !== slave.id) await other.uncheck();
  }

  const diff = page.locator(`[data-diff="${slave.id}"]`);
  await expect(diff).toHaveText(/to review|In sync|Unavailable/, { timeout: 60_000 });
  console.log(`before sync: ${await diff.innerText()}`);

  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Sync to selected' }).click();
  await expect(page.getByRole('alert').filter({ hasText: slave.name })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole('alert').filter({ hasText: 'FAILED' })).toHaveCount(0);

  // the slave restarts its services after a sync, give it a moment before the diff is read again
  await expect(async () => {
    await page.goto('/server/cluster#sync');
    await expect(page.locator(`[data-diff="${slave.id}"]`)).toHaveText('In sync', { timeout: 20_000 });
  }).toPass({ timeout: 120_000, intervals: [5_000] });
  await expect(page.getByText(/changed since last sync/)).toHaveCount(0);
});
