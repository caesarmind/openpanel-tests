import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ensureDomain, withProjectPage } from '../helpers';

// repos deploy to their own folders, not the docroot, so it shares a domain with other specs
const DOMAIN = 'shared.tests.openpanel.org';
const LOCAL_REPO = 'pw-local';
const LOCAL_DIR = '/var/www/html/pw-git-local';
const REMOTE_REPO = 'pw-remote';
const REMOTE_URL = 'https://github.com/octocat/Hello-World.git';
const REMOTE_DIR = '/var/www/html/pw-git-remote';
const COMMIT_MSG = 'playwright test commit';

const BASE_URL = process.env.BASE_URL!;
const USERNAME = process.env.PANEL_USERNAME!;

// the push password is only shown once, so later tests reuse it
let pushPassword = '';

test.describe.configure({ mode: 'serial' });

const repoRow = (page: Page, name: string) => page.locator(`tr#repo-${name}`);

// a run that failed halfway leaves its repositories behind, which would make create fail next time
test.beforeAll(async ({ browser }, testInfo) => {
  testInfo.setTimeout(15 * 60_000);
  await withProjectPage(browser, testInfo, async page => {
    await ensureDomain(page, DOMAIN);
    await page.goto('/git');
    for (const name of [LOCAL_REPO, REMOTE_REPO]) {
      if (await repoRow(page, name).count()) {
        await page.evaluate(async (repo) => {
          const body = new URLSearchParams({ action: 'delete', repo, csrf_token: (window as any).csrf_token });
          await fetch('/git', { method: 'POST', body });
        }, name);
      }
    }
  });
});

async function openAddForm(page: Page) {
  await page.goto('/git');
  await page.locator('#add-repository').click();
  await expect(page.locator('#domain')).toBeVisible();
}

// git push from this machine, the panel's cert is self-signed on test servers
function git(cwd: string, ...args: string[]) {
  return execFileSync('git', ['-c', 'http.sslVerify=false', ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
}

test('git page loads', async ({ page }) => {
  await page.goto('/git');
  await expect(page.getByRole('heading', { name: 'Git', level: 1 })).toBeVisible();
  await expect(page.locator('#add-repository')).toBeVisible();
  console.log('git page accessible');
});

test('create local repository', async ({ page }) => {
  await openAddForm(page);
  await page.getByRole('button', { name: /Local repository/i }).click();
  await page.locator('#name').fill(LOCAL_REPO);
  await page.locator('#domain').selectOption(DOMAIN);
  await page.locator('#target_dir').fill(LOCAL_DIR);
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByText(new RegExp(`Local repository ${LOCAL_REPO} created`))).toBeVisible();
  const creds = page.locator('#push-credentials');
  await expect(creds).toBeVisible();
  await expect(creds).toContainText(LOCAL_REPO);
  await expect(creds).toContainText(`/git-http/${USERNAME}/${LOCAL_REPO}.git`);

  const fields = creds.locator('code');
  await expect(fields.nth(0)).toHaveText(USERNAME);
  pushPassword = (await fields.nth(1).textContent())!.trim();
  expect(pushPassword.length).toBeGreaterThan(8);

  const row = repoRow(page, LOCAL_REPO);
  await expect(row).toBeVisible();
  await expect(row).toContainText('Local');
  await expect(row).toContainText(DOMAIN);
  await expect(row).toContainText('No commits yet.');
  console.log('local git repository created');
});

test('push to local repository deploys it', async ({ page }) => {
  test.setTimeout(120_000);
  expect(pushPassword, 'push password from the create test').not.toBe('');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-git-'));
  try {
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.name', 'Playwright');
    git(dir, 'config', 'user.email', 'playwright@tests.openpanel.org');
    fs.writeFileSync(path.join(dir, 'index.html'), '<h1>deployed by git</h1>\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', COMMIT_MSG);

    const url = new URL(`/git-http/${USERNAME}/${LOCAL_REPO}.git`, BASE_URL);
    url.username = encodeURIComponent(USERNAME);
    url.password = encodeURIComponent(pushPassword);
    git(dir, 'push', '-q', url.toString(), 'main');

    // a wrong password must be refused
    url.password = 'wrong-password';
    expect(() => git(dir, 'push', '-q', url.toString(), 'main')).toThrow();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  await page.goto('/git');
  const row = repoRow(page, LOCAL_REPO);
  await expect(row).toContainText(COMMIT_MSG);
  await expect(row).toContainText('deployed');
  await expect(row).not.toContainText('not deployed');

  // the pushed file landed in the target dir
  await page.goto(`/files${LOCAL_DIR.replace('/var/www/html', '')}`);
  await expect(page.locator('body')).toContainText('index.html');
  console.log('push to local repository deployed it');
});

test('commit log', async ({ page }) => {
  await page.goto('/git');
  await repoRow(page, LOCAL_REPO).getByTitle('Commit log').click();
  await expect(page).toHaveURL(new RegExp(`/git\\?log=${LOCAL_REPO}`));
  await expect(page.getByRole('heading', { name: `Commit log: ${LOCAL_REPO}` })).toBeVisible();
  await expect(page.locator('body')).toContainText(COMMIT_MSG);
  await expect(page.locator('body')).toContainText('Playwright');
  console.log('commit log is working');
});

test('manual deploy', async ({ page }) => {
  await page.goto('/git');
  await repoRow(page, LOCAL_REPO).getByTitle('Deploy').click();
  await expect(page.getByText(new RegExp(`Deployed ${LOCAL_REPO} \\(main at [0-9a-f]+\\) to ${LOCAL_DIR}`))).toBeVisible();
  console.log('manual deploy is working');
});

test('new push password', async ({ page }) => {
  await page.goto('/git');
  const row = repoRow(page, LOCAL_REPO);
  await row.getByTitle('Settings').click();
  const settings = page.locator('tr', { has: page.getByTitle('New push password') });
  await expect(settings).toBeVisible();

  // first click arms it, second click submits
  const btn = settings.getByTitle('New push password');
  await btn.click();
  await expect(btn).toContainText('Confirm');
  await btn.click();

  await expect(page.getByText(new RegExp(`New push password generated for ${LOCAL_REPO}`))).toBeVisible();
  const fresh = (await page.locator('#push-credentials code').nth(1).textContent())!.trim();
  expect(fresh).not.toBe(pushPassword);
  console.log('push password reset is working');
});

test('create remote repository', async ({ page }) => {
  test.setTimeout(120_000);
  await openAddForm(page);
  await page.getByRole('button', { name: /Remote Git hosting/i }).click();
  await page.locator('#remote_url').fill(REMOTE_URL);
  await page.locator('#name').fill(REMOTE_REPO);
  await page.locator('#domain').selectOption(DOMAIN);
  await page.locator('#target_dir').fill(REMOTE_DIR);
  await page.locator('form:has(input[name="action"][value="create"]) input[name="deploy_mode"][value="automatic"]').check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByText(new RegExp(`Repository ${REMOTE_REPO} cloned and branch \\S+ deployed to ${REMOTE_DIR}`))).toBeVisible({ timeout: 90_000 });
  const row = repoRow(page, REMOTE_REPO);
  await expect(row).toContainText('Remote');
  await expect(row).toContainText(REMOTE_URL);
  await expect(row).toContainText('deployed');
  console.log('remote git repository cloned and deployed');
});

test('pull updates', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/git');
  await repoRow(page, REMOTE_REPO).getByTitle('Pull Updates').click();
  await expect(page.getByText(new RegExp(`${REMOTE_REPO} is already up to date`))).toBeVisible({ timeout: 60_000 });
  console.log('pull updates is working');
});

test('webhook pulls the repository', async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.goto('/git');
  await repoRow(page, REMOTE_REPO).getByTitle('Settings').click();
  const hook = page.locator('code', { hasText: '/git-webhook/' }).first();
  await expect(hook).toBeVisible();
  const hookPath = new URL((await hook.textContent())!.trim()).pathname;

  const res = await request.post(new URL(hookPath, BASE_URL).toString(), { data: {}, ignoreHTTPSErrors: true, timeout: 60_000 });
  expect(res.status(), await res.text()).toBeLessThan(300);

  // a made up token is refused
  const bad = await request.post(new URL(`/git-webhook/${USERNAME}/not-a-real-token`, BASE_URL).toString(), { data: {}, ignoreHTTPSErrors: true });
  expect(bad.status()).toBeGreaterThanOrEqual(400);
  console.log('git webhook is working');
});

test('change deployment mode', async ({ page }) => {
  await page.goto('/git');
  const row = repoRow(page, REMOTE_REPO);
  await row.getByTitle('Settings').click();
  const form = page.locator(`form:has(input[name="action"][value="settings"]):has(input[name="repo"][value="${REMOTE_REPO}"])`);
  await expect(form).toBeVisible();
  await form.locator('input[name="deploy_mode"][value="manual"]').check();
  await form.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(new RegExp(`Settings saved for ${REMOTE_REPO}`))).toBeVisible();
  await expect(repoRow(page, REMOTE_REPO)).toContainText('Manual');
  console.log('git settings are working');
});

test('search repositories', async ({ page }) => {
  await page.goto('/git');
  const search = page.locator('section[aria-label="Repositories"] input[type="search"]');
  await search.fill(REMOTE_REPO);
  await expect(repoRow(page, REMOTE_REPO)).toBeVisible();
  await expect(repoRow(page, LOCAL_REPO)).toBeHidden();
  await search.fill('');
  await expect(repoRow(page, LOCAL_REPO)).toBeVisible();
  console.log('git search is working');
});

test('remove repositories', async ({ page }) => {
  for (const [name, dir] of [[LOCAL_REPO, LOCAL_DIR], [REMOTE_REPO, REMOTE_DIR]]) {
    await page.goto('/git');
    await repoRow(page, name).getByTitle('Remove').click();
    const confirm = page.locator(`form:has(input[name="action"][value="delete"]):has(input[name="repo"][value="${name}"])`);
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByText(new RegExp(`Repository ${name} removed. Files already deployed to ${dir} were left in place.`))).toBeVisible();
    await expect(repoRow(page, name)).toHaveCount(0);
  }
  console.log('git repositories removed');
});
