import { test, expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

// shared by the specs so each one can set up what it needs instead of relying on another spec running first

// one lock dir per server, shared by all workers on this machine
function lockDir(name: string): string {
  const host = new URL(process.env.BASE_URL!).host.replace(/[^\w.-]/g, '_');
  return path.join(os.tmpdir(), `openpanel-tests-${host}-${name}.lock`);
}

// runs fn while no other worker holds the same lock, a worker killed mid-way leaves the lock behind so old ones are taken over
export async function withLock<T>(name: string, fn: () => Promise<T>, staleMs = 5 * 60_000): Promise<T> {
  const dir = lockDir(name);
  const deadline = Date.now() + 15 * 60_000;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      break;
    } catch (e: any) {
      if (e.code !== 'EEXIST') throw e;
      try {
        if (Date.now() - fs.statSync(dir).mtimeMs > staleMs) fs.rmSync(dir, { recursive: true, force: true });
      } catch { /* released meanwhile */ }
      if (Date.now() > deadline) throw new Error(`timed out waiting for the ${name} lock`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// a page with the project's login and baseURL, for beforeAll/afterAll where the page fixture isn't available
export async function withProjectPage<T>(browser: Browser, testInfo: TestInfo, fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext(testInfo.project.use as any);
  try {
    return await fn(await context.newPage());
  } finally {
    await context.close();
  }
}

export async function hasDomain(page: Page, domain: string): Promise<boolean> {
  await page.goto('/domains');
  const names = await page.locator('td[data-sort-col="domain"]').evaluateAll(tds => tds.map(td => td.getAttribute('data-sort-value') || ''));
  return names.some(n => n.toLowerCase() === domain.toLowerCase());
}

// caller must hold the domains lock, the panel and the dashboard counts aren't safe with adds from several workers at once
export async function addDomain(page: Page, domain: string) {
  await page.goto('/domains/new');
  await expect(page).toHaveURL(/domains\/new/);
  // the old form labels it "Domain*", the new one "Domain name", the id is the same in both
  await page.locator('#domain_url').fill(domain);
  await page.getByRole('button', { name: 'Add Domain' }).click();
  await expect(page.getByText(`Domain name ${domain} added successfully`)).toBeVisible({ timeout: 60_000 });
  console.log(`Domain added: ${domain}`);
}

// Adding (or deleting) a domain restarts the webserver and recreates php-fpm and the mailserver, which kills
// app installs and mail actions running in other workers. So the setup project adds every domain the parallel
// specs use before they start, and ensureDomain() in a spec only adds one when that spec runs on its own.
// The domains spec, which adds and deletes domains, is in tests/serial/.
export const SUITE_DOMAINS = [
  'shared.tests.openpanel.org',
  'wp.tests.openpanel.org',
  'waf.tests.openpanel.org',
  'capitalize.tests.openpanel.org',
  'wordpress.tests.openpanel.org',
  'php.tests.openpanel.org',
  'files.tests.openpanel.org',
  'website-builder.tests.openpanel.org',
  'drupal.tests.openpanel.org',
  'joomla.tests.openpanel.org',
  'opencart.tests.openpanel.org',
  'nextcloud.tests.openpanel.org',
  'prestashop.tests.openpanel.org',
  'moodle.tests.openpanel.org',
  'mediawiki.tests.openpanel.org',
  'matomo.tests.openpanel.org',
  'java.tests.openpanel.org',
  'ruby.tests.openpanel.org',
  'n8n.tests.openpanel.org',
  'nodejs.tests.openpanel.org',
  'python.tests.openpanel.org',
];

// adds the domain unless the account already has it
export async function ensureDomain(page: Page, domain: string) {
  await withLock('domains', async () => {
    if (!(await hasDomain(page, domain))) await addDomain(page, domain);
  });
}

export async function ensureDomains(browser: Browser, testInfo: TestInfo, ...domains: string[]) {
  // the hook can sit in the lock queue while other workers add theirs
  testInfo.setTimeout(Math.max(testInfo.timeout, 15 * 60_000));
  await withProjectPage(browser, testInfo, async page => {
    for (const domain of domains) await ensureDomain(page, domain);
  });
}

// the new theme splits install forms into wizard steps, so click Continue until the field is on screen;
// on the old one-page forms the field is already visible and nothing is clicked
export async function wizardField(page: Page, selector: string): Promise<Locator> {
  const field = page.locator(selector);
  const next = page.getByRole('button', { name: /^\s*continue\s*$/i });
  for (let i = 0; i < 6 && !(await field.isVisible()) && (await next.isVisible()); i++) {
    await next.click();
    await field.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
  }
  return field;
}

// the Install button sits on the wizard's last step in the new theme
export async function clickInstall(page: Page) {
  await (await wizardField(page, '#installButton')).click();
}

// clicks Install on an app's install page and waits for the outcome; on a failure it fails right away with the
// installer's own output instead of waiting out the whole timeout
export async function runInstaller(page: Page, app: string, timeout: number) {
  const response = page.waitForResponse(
    r => r.url().includes(`/${app}/install`) && r.request().method() === 'POST',
    { timeout },
  );

  // "Latest" makes the server ask GitHub's API, 60 calls an hour per IP run out on repeated runs, so pick the newest listed version instead
  const versionSelect = await wizardField(page, `#${app}_version`);
  if (await versionSelect.count()) {
    const firstVersion = versionSelect.locator('option:not([value=""])').first();
    try {
      await firstVersion.waitFor({ state: 'attached', timeout: 15000 });
      const value = await firstVersion.getAttribute('value');
      if (value) await versionSelect.selectOption(value);
    } catch {
      // the list didn't load, keep Latest
    }
  }

  await clickInstall(page);

  const outcome = page.getByText(/installation completed|install process failed/i).first();
  await expect(outcome).toBeVisible({ timeout });
  const text = (await outcome.textContent()) ?? '';
  if (!/installation completed/i.test(text)) {
    const log = await response.then(r => r.text(), () => '(installer output not available)');
    expect(text, `install failed, installer output:\n${log}`).toMatch(/installation completed/i);
  }
}

// column pickers: the old ones list checkboxes under "Show Columns", the new ones labelled checkboxes or switch
// buttons under "Columns"; opens the picker and returns each column's key, what to click and whether it's on
export async function openColumnToggles(page: Page) {
  await page.getByRole('button', { name: /^(show )?columns$/i }).click();
  const rows = page.locator('ul[aria-labelledby="dropdownToggleButton"] li')
    .or(page.locator('.op-columns:visible > label'))
    .or(page.locator('.op-menu:visible button.op-menu-row:has([role="switch"])'));
  await rows.first().waitFor();
  const toggles: { key: string; toggle: Locator; isOn: () => Promise<boolean> }[] = [];
  for (const row of await rows.all()) {
    const checkbox = row.locator('input[type="checkbox"]');
    if (await checkbox.count()) {
      const xModel = await checkbox.getAttribute('x-model');
      if (!xModel) continue;
      const label = row.locator('label');
      toggles.push({ key: xModel.replace('columns.', ''), toggle: (await label.count()) ? label : row, isOn: () => checkbox.isChecked() });
    } else {
      const key = (await row.getAttribute('@click.stop'))?.match(/columns\.(\w+)/)?.[1];
      if (!key) continue;
      toggles.push({ key, toggle: row, isOn: async () => (await row.locator('[role="switch"]').getAttribute('aria-checked')) === 'true' });
    }
  }
  return toggles;
}

// bulk actions bar (templates/partials/_bulk.html + static/js/bulk-actions.js), shared by every page that has row checkboxes

// ticks the row checkbox of each row that contains one of the names
export async function bulkSelect(page: Page, names: string[], rows = 'tbody tr') {
  for (const name of names) {
    const box = page.locator(rows, { hasText: name }).locator('input.bulk-select-box');
    await expect(box, `bulk checkbox for ${name}`).toHaveCount(1);
    await box.check();
  }
  await expect(page.locator('#bulk-actions-bar')).toBeVisible();
}

// same, by the row key the page puts in the checkbox value, for rows whose text isn't unique (sessions from one IP, ids)
export async function bulkSelectKeys(page: Page, keys: string[]) {
  for (const key of keys) {
    const box = page.locator(`tbody input.bulk-select-box[value="${key}"]`);
    await expect(box, `bulk checkbox for ${key}`).toHaveCount(1);
    await box.check();
  }
  await expect(page.locator('#bulk-actions-bar')).toBeVisible();
}

// select all shows the bar with every visible row counted, Clear hides it again
export async function bulkSelectAllAndClear(page: Page) {
  const bar = page.locator('#bulk-actions-bar');
  const boxes = page.locator('tbody input.bulk-select-box:visible');
  const count = await boxes.count();
  expect(count, 'rows with a bulk checkbox').toBeGreaterThan(0);
  await page.getByRole('checkbox', { name: 'Select all' }).first().check();
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(`${count} selected`);
  await bar.getByRole('button', { name: 'Clear' }).click();
  await expect(bar).toBeHidden();
  await expect(page.locator('tbody input.bulk-select-box:checked')).toHaveCount(0);
}

// clicks confirm and returns the bulk reply, the page reloads as soon as it lands so it's read on the way through, a plain waitForResponse loses the body
export async function bulkReply(page: Page, action: string, confirm: () => Promise<void>): Promise<any[]> {
  let status = 0;
  let body: any;
  let replied!: () => void;
  const reply = new Promise<void>(resolve => { replied = resolve; });
  const handler = async (route: any) => {
    const req = route.request();
    if (req.method() !== 'POST' || !(req.postData() ?? '').includes(`"action":"${action}"`)) return route.fallback();
    const response = await route.fetch({ timeout: 120_000 });
    status = response.status();
    body = await response.json().catch(() => ({}));
    await route.fulfill({ response, json: body });
    replied();
  };
  await page.route('**/*', handler);
  const reloaded = page.waitForEvent('load', { timeout: 120_000 });
  await confirm();
  await reply;
  await page.unroute('**/*', handler);
  expect(status, `bulk ${action}: ${JSON.stringify(body)}`).toBe(200);
  expect(Array.isArray(body?.results), `bulk ${action} reply has results: ${JSON.stringify(body)}`).toBe(true);
  const failed = body.results.filter((r: any) => !r.ok);
  expect(failed, `bulk ${action} failed for some items`).toEqual([]);
  await reloaded;
  return body.results;
}

// runs a bulk action on the ticked rows, fails unless every item succeeded, the page reloads with the summary after
// value can pick from a select's options when they depend on the server, e.g. the installed PHP versions
export async function bulkRun(page: Page, action: string, value?: string | ((options: string[]) => string)): Promise<{ item: string; ok: boolean; message: string }[]> {
  const bar = page.locator('#bulk-actions-bar');
  await bar.locator(`[data-bulk-action="${action}"]`).click();
  if (value !== undefined) {
    const input = bar.locator(`[data-bulk-input="${action}"]`);
    await expect(input).toBeVisible();
    if ((await input.evaluate(el => el.tagName)) === 'SELECT') {
      const options = await input.locator('option').evaluateAll(opts => opts.map(o => (o as HTMLOptionElement).value).filter(Boolean));
      await input.selectOption(typeof value === 'function' ? value(options) : value);
    } else {
      await input.fill(typeof value === 'function' ? value([]) : value);
    }
  }
  const results = await bulkReply(page, action, () => bar.locator('button[type="submit"]').click());
  await expect(page.getByText(/completed successfully for all \d+ selected item/i).first()).toBeVisible();
  return results;
}

// a new domain gets its certificate in the background, visiting it over http kicks that off
export async function waitForCert(page: Page, domain: string, timeout = 3 * 60_000) {
  test.info().setTimeout(test.info().timeout + timeout);
  await page.goto(`http://${domain}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await expect(async () => {
    // certificates are issued on demand, an https request is what asks for one
    await page.request.get(`https://${domain}/`, { failOnStatusCode: false, timeout: 15_000 }).catch(() => {});
    await page.goto(`/domains/ssl?domain_name=${domain}`);
    await expect(page.locator('#certData')).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout, intervals: [5000] });
}

export type MenuStyle = 'classic' | 'modern';

// classic menu login, used by the -classic projects
export const AUTH_FILE = path.join(__dirname, '../.auth/session.json');
// same login with the modern menu (menu_style cookie), used by the default projects
export const AUTH_FILE_MODERN = path.join(__dirname, '../.auth/session-modern.json');

// logs in with the menu style pinned and saves the session, used by auth.setup.ts and by specs that end every session
export async function saveLogin(browser: Browser, style: MenuStyle, file: string) {
  const BASE_URL = process.env.BASE_URL!;
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  // pin the menu style, so the admin's default menu_style can't change what a project tests
  await context.addCookies([{ name: 'menu_style', value: style, url: BASE_URL }]);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('textbox', { name: 'Username' }).fill(process.env.PANEL_USERNAME!);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.PANEL_PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/.*dashboard/);
  // a fresh account gets the setup wizard and tour over the dashboard, which blocks clicks in every spec
  await page.evaluate(async () => {
    const headers = { 'X-CSRF-Token': (window as any).csrf_token || '' };
    await fetch('/dashboard/onboarding/complete', { method: 'POST', headers });
    await fetch('/dashboard/tour/complete', { method: 'POST', headers });
  });
  await context.storageState({ path: file });
  await context.close();
}
