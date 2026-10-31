import { test as setup, expect, Browser, Page } from '@playwright/test';
import path from 'path';
// test files can't import each other, this is the same path auth.setup.ts writes
const AUTH_FILE = path.join(__dirname, '../.auth/session.json');

// session on the master that has the slave selected, the tests-slave project runs every spec with it
export const SLAVE_AUTH_FILE = path.join(__dirname, '../.auth/session-slave.json');

const BASE_URL = process.env.BASE_URL;
const SLAVE_URL = process.env.SLAVE_URL;
const SLAVE_USERNAME = process.env.SLAVE_USERNAME;
const SLAVE_PASSWORD = process.env.SLAVE_PASSWORD;

type Server = { id: string; name: string; address?: string; paused?: boolean };

async function clusterServers(page: Page): Promise<Server[]> {
  const res = await page.request.get('/_cluster/state');
  // a server that isn't a master yet answers 403
  if (!res.ok()) return [];
  return (await res.json()).servers ?? [];
}

async function joinCode(browser: Browser): Promise<string> {
  const ctx = await browser.newContext({ baseURL: SLAVE_URL, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Username' }).fill(SLAVE_USERNAME!);
  await page.getByRole('textbox', { name: 'Password' }).fill(SLAVE_PASSWORD!);
  await page.locator('button[type="submit"]', { hasText: 'Sign in' }).first().click();
  await expect(page).toHaveURL(/.*(dashboard|onboarding)/);
  await page.goto('/server/cluster');
  await page.getByRole('button', { name: 'Generate join code' }).click();
  const code = await page.locator('#join_code').inputValue();
  await ctx.close();
  return code;
}

setup('join slave to master', async ({ browser }) => {
  setup.skip(!SLAVE_URL, 'SLAVE_URL not set, testing a single server');
  if (!SLAVE_USERNAME || !SLAVE_PASSWORD) {
    throw new Error('SLAVE_USERNAME and SLAVE_PASSWORD must be set in .env together with SLAVE_URL');
  }
  setup.setTimeout(120_000);

  const ctx = await browser.newContext({ baseURL: BASE_URL, storageState: AUTH_FILE, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('/dashboard');

  const host = new URL(SLAVE_URL!).hostname;
  let slave = (await clusterServers(page)).find((s) => s.address === host);

  if (!slave) {
    const code = await joinCode(browser);
    await page.goto('/server/cluster');
    await page.locator('#add_url').fill(SLAVE_URL!);
    await page.locator('#add_code').fill(code);
    await page.getByRole('button', { name: 'Add server', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/added|joined/i);
    slave = (await clusterServers(page)).find((s) => s.address === host);
  }
  expect(slave, `slave ${host} should be in the cluster`).toBeTruthy();

  if (slave!.paused) {
    await page.goto('/server/cluster');
    const row = page.locator('tr', { hasText: slave!.name }).first();
    await row.getByRole('button', { name: 'Resume' }).click();
  }

  // switching is kept in the session cookie, so this context's state opens every page on the slave
  const status = await page.evaluate(async (id) => {
    const r = await fetch('/_cluster/switch', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Cluster-Switch': '1' },
      body: JSON.stringify({ to: id }),
    });
    return r.status;
  }, slave!.id);
  expect(status).toBe(204);
  await ctx.storageState({ path: SLAVE_AUTH_FILE });
  await ctx.close();
});
