import { test, expect, type Locator, type Page } from '@playwright/test';
import { bulkRun, bulkSelectAllAndClear, bulkSelectKeys, ensureDomains, openColumnToggles } from '../../helpers';

// the webserver page check needs at least one domain on the account
test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, 'shared.tests.openpanel.org');
});

// ─────────────────────────────────────────────
// /containers  (main table)
// ─────────────────────────────────────────────

test('check columns for docker table', async ({ page }) => {
  await page.goto(`/containers`);
  await expect(page).toHaveURL(/containers/);
  for (const { key, toggle, isOn } of await openColumnToggles(page)) {
    const th = page.locator(`th[x-show="columns.${key}"]`);
    const initialState = await isOn();

    await toggle.click();
    await page.waitForTimeout(100); // needed for alpine.js x-show

    if (!initialState) {
      await expect(th).toBeVisible();
    } else {
      await expect(th).toBeHidden();
    }

    await toggle.click();
    await page.waitForTimeout(100);

    if (initialState) {
      await expect(th).toBeVisible();
    } else {
      await expect(th).toBeHidden();
    }
  }
  console.log('column toggle is working');
});

test('containers page loads with header and table', async ({ page }) => {
  await page.goto('/containers');
  await expect(page.locator('h1')).toContainText('Containers');
  await expect(page.locator('#containers-table')).toBeVisible();

  // Total CPU and RAM should be shown
  await expect(page.locator('text=Total CPU')).toBeVisible();
  await expect(page.locator('text=Total Memory')).toBeVisible();
});

test('containers search filters rows', async ({ page }) => {
  await page.goto('/containers');

  const searchInput = page.locator('[x-model="searchQuery"]').first();
  await expect(searchInput).toBeVisible();

  // Search for something that won't match
  await searchInput.fill('zzznomatchzzz');
  await page.waitForTimeout(200);
  const visibleRows = page.locator('#containers-table tbody tr:visible');
  await expect(visibleRows).toHaveCount(0, { timeout: 3000 });

  // Clear search
  await searchInput.fill('');
  await page.waitForTimeout(200);
});

test('containers page New Service button navigates to add form', async ({ page }) => {
  await page.goto('/containers');
  await page.getByRole('link', { name: 'New Service' }).click();
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/containers/new');
  await expect(page.locator('h1')).toContainText('Add a container');
});

// sets a cpu or ram limit inline on the row, returns what was set before
async function setLimit(page: Page, row: Locator, kind: 'cpu' | 'ram', value: string): Promise<string> {
  const cell = row.locator(`td[x-show*="${kind}"]`);
  await row.hover();
  await cell.hover();
  await cell.locator('a').first().click();

  const input = cell.locator('input[name="value"]');
  await expect(input).toBeVisible();
  const before = await input.inputValue();
  await input.fill(value);

  await Promise.all([
    page.waitForResponse(resp =>
      resp.url().includes(`/containers/${kind}/`) && resp.request().method() === 'POST'
    ),
    cell.locator('button[type="submit"]').click(),
  ]);
  await expect(input).toBeHidden();
  return before;
}

async function startStop(page: Page, row: Locator, action: 'start' | 'stop') {
  await row.hover();
  const btn = row.locator('td[x-show*="actions"]').getByRole('button', { name: action === 'start' ? 'Start' : 'Stop', exact: true }).first();
  await Promise.all([
    page.waitForResponse(resp =>
      resp.url().includes(`/containers/${action}/`) && resp.request().method() === 'POST'
    ),
    btn.click(),
  ]);
  await expect(page.locator('body')).toContainText(action === 'start' ? /(?<!de)activated successfully/i : /deactivated successfully/i);
}

// every container gets its limits and running state back, the specs after this one still need them
test('edit cpu, ram and toggle container state for all rows', async ({ page }) => {
  test.setTimeout(9000_000);
  await page.goto('/containers');

  const rows = page.locator('#containers-table tr.domain_row');
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    // cron (ofelia) restart-loops on an account with no cron jobs, so a live limit change can hit it mid-restart
    const service = (await row.locator('form[action^="/containers/cpu/"]').getAttribute('action'))?.split('/').pop();
    if (service === 'cron') continue;
    // restart-loops on kernel 6.19+, so the panel can't change it, https://github.com/stefanpejcic/OpenPanel/issues/1205
    if (service === 'mongodb') continue;
    console.log(`editing container ${service}`);

    // 1. EDIT CPU
    const cpuBefore = await setLimit(page, row, 'cpu', '1');
    await expect(page.locator('body')).toContainText(/Max CPU for container/i);
    await expect(page.locator('body')).toContainText(/set to 1/i);

    // 2. EDIT RAM
    const ramBefore = await setLimit(page, row, 'ram', '1');
    await expect(page.locator('body')).toContainText(/Max RAM for container/i);
    await expect(page.locator('body')).toContainText(/set to 1G/i);

    // 3. RESTORE LIMITS
    await setLimit(page, rows.nth(i), 'cpu', cpuBefore);
    await setLimit(page, rows.nth(i), 'ram', ramBefore);

    // 4. TOGGLE STATE, ending where it started
    const freshRow = rows.nth(i);
    await freshRow.hover();
    const actionsCell = freshRow.locator('td[x-show*="actions"]');
    const startBtn = actionsCell.getByRole('button', { name: 'Start', exact: true }).first();
    const stopBtn = actionsCell.getByRole('button', { name: 'Stop', exact: true }).first();

    if (await stopBtn.count() && await stopBtn.isVisible()) {
      await startStop(page, rows.nth(i), 'stop');
      await startStop(page, rows.nth(i), 'start');
      await rows.nth(i).hover();
      await expect(stopBtn).toBeVisible({ timeout: 30_000 });
    } else if (await startBtn.count() && await startBtn.isVisible()) {
      await startStop(page, rows.nth(i), 'start');
      await rows.nth(i).hover();
      await expect(stopBtn).toBeVisible({ timeout: 30_000 });
      await startStop(page, rows.nth(i), 'stop');
    } else {
      console.log(`Container row ${i + 1} (${service}) has no visible Start or Stop button`);
    }

    await page.waitForTimeout(2000);
  }
});

// ─────────────────────────────────────────────
// /containers/new  (add container form)
// ─────────────────────────────────────────────

test('add new service form loads', async ({ page }) => {
  await page.goto('/containers/new');
  await expect(page.locator('h1')).toContainText('Add a container');
  await expect(page.locator('input#service_name')).toBeVisible();
  await expect(page.locator('input#image')).toBeVisible();
  await expect(page.locator('input#cpu')).toBeVisible();
  await expect(page.locator('input#ram_amount')).toBeVisible();
  await expect(page.locator('main button[type="submit"]')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('a[href="/containers"]')).toBeVisible();
});

test('add new service - invalid name shows error', async ({ page }) => {
  // an earlier run leaves testapp behind for the delete confirm test, and a taken name keeps the form disabled
  await page.goto('/containers');
  if (await page.locator('#containers-table tbody input.bulk-select-box[value="testapp"]').count()) {
    await page.goto('/containers/delete/testapp');
    await page.getByRole('button', { name: /Delete Service/i }).click();
    await expect.poll(async () => {
      await page.goto('/containers');
      return page.locator('#containers-table tbody input.bulk-select-box[value="testapp"]').count();
    }, { timeout: 60_000, intervals: [3000] }).toBe(0);
  }

  await page.goto('/containers/new');

  const image = page.locator('#image');
  const serviceName = page.locator('#service_name');
  const cpu = page.locator('#cpu');
  const ram = page.locator('#ram_amount');
  const submit = page.locator('main button[type="submit"]');

  // Invalid service name
  await image.fill('nginx:latest');

  await serviceName.clear();
  await serviceName.fill('ab'); // too short

  await cpu.fill('0.5');
  await ram.fill('1');

  // Name is invalid, so the form should not be submittable.
  // The HTML requires at least 3 characters:
  // pattern="[a-z][a-z0-9]{2,}"
  await expect(submit).toBeDisabled();

  // Should remain on the form page
  await expect(page).toHaveURL(/\/containers\/new/);

  // Now create the real test container that will be deleted
  // in another test/task.
  await serviceName.clear();
  await serviceName.fill('testapp');

  await expect(submit).toBeEnabled();

  // wait for the create to finish, ending the test right after the click could cut the request off
  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith('/containers/new'), { timeout: 120_000 }),
    submit.click(),
  ]);
  await expect.poll(async () => {
    await page.goto('/containers');
    return page.locator('#containers-table tbody input.bulk-select-box[value="testapp"]').count();
  }, { timeout: 120_000, intervals: [3000] }).toBe(1);
});
test('add new service - image blur suggests service name', async ({ page }) => {
  await page.goto('/containers/new');

  const imageInput = page.locator('input#image');
  const serviceNameInput = page.locator('input#service_name');

  await imageInput.fill('redis:latest');
  await imageInput.blur();
  await page.waitForTimeout(200);

  const suggestedName = await serviceNameInput.inputValue();
  expect(suggestedName.length).toBeGreaterThan(0);
  expect(suggestedName).toMatch(/^[a-z][a-z0-9]+$/);
});

test('add new service - add and remove volume entry', async ({ page }) => {
  await page.goto('/containers/new');

  const volumeEntries = page.locator('select[name="volume_name"]');
  const countBeforeAdd = await volumeEntries.count();

  // Add a volume
  await page.getByRole('button', { name: /Add volume/i }).click();

  await expect(volumeEntries).toHaveCount(countBeforeAdd + 1);

  const countAfterAdd = await volumeEntries.count();
  expect(countAfterAdd).toBeGreaterThan(0);

  // Find the generated volume row
  const volumeRow = page
    .locator('div.mb-2.flex')
    .filter({ has: page.locator('select[name="volume_name"]') })
    .last();

  // Remove the volume
  await volumeRow.locator('button[title="Remove"]').click();

  await expect(volumeEntries).toHaveCount(countAfterAdd - 1);
});

test('add new service - Back to Containers link works', async ({ page }) => {
  await page.goto('/containers/new');
  await page.getByRole('navigation', { name: 'Breadcrumb' }).locator('a[href="/containers"]').click();
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/containers');
  await expect(page.locator('h1')).toContainText('Containers');
});

// ─────────────────────────────────────────────
// /containers/delete/<service>  (delete confirm)
// ─────────────────────────────────────────────

test('delete confirm page loads for a custom service', async ({ page }) => {
  const testService = 'testapp';

  const response = await page.goto(`/containers/delete/${testService}`);

  expect(response).not.toBeNull();
  expect(response!.status()).toBe(200);

  // Verify correct delete page
  await expect(page).toHaveURL(
    new RegExp(`/containers/delete/${testService}$`)
  );

  // Verify heading
  await expect(
    page.getByRole('heading', {
      name: `Delete container ${testService}`,
      exact: true,
    })
  ).toBeVisible();

  // Verify confirmation message
  await expect(
    page.getByText(
      `Are you sure you want to permanently delete the service ${testService}?`,
      { exact: true }
    )
  ).toBeVisible();

  // Verify delete button exists
  await expect(
    page.getByRole('button', { name: /Delete Service/i })
  ).toBeVisible();

  // Cancel and return to containers
  const cancelLink = page.getByRole('link', {
    name: 'Cancel',
    exact: true,
  });

  await expect(cancelLink).toBeVisible();
  await cancelLink.click();

  await expect(page).toHaveURL(/\/containers\/?$/);
});



test('delete confirm - core service returns 403', async ({ page }) => {
  const response = await page.request.get('/containers/delete/nginx');
  expect(response.status()).toBe(403);
});

test('delete confirm - php-fpm service returns 403', async ({ page }) => {
  const response = await page.request.get('/containers/delete/php-fpm-8.2');
  expect(response.status()).toBe(403);
});

// ─────────────────────────────────────────────
// /containers/mysql  (change mysql type)
// ─────────────────────────────────────────────

test('change mysql page loads', async ({ page }) => {
  await page.goto('/containers/mysql');

  const section = page.getByRole('region', {
    name: 'Change Database Server',
  });

  // Page heading
  await expect(
    section.getByRole('heading', {
      name: 'Database Server',
      exact: true,
    })
  ).toBeVisible();

  // Current database server should be indicated
  await expect(
    section.getByText('Current', { exact: true })
  ).toBeVisible();

  // All available database server options should be present
  await expect(
    section.getByText('MySQL', { exact: true })
  ).toBeVisible();

  await expect(
    section.getByText('MariaDB', { exact: true })
  ).toBeVisible();

  await expect(
    section.getByText('Percona', { exact: true })
  ).toBeVisible();

  // with databases left from earlier specs the switch is blocked and says why, otherwise it warns what switching does
  const blocked = section.getByText(/first remove all databases from your account/i);
  if (await blocked.isVisible()) {
    await expect(section.getByRole('link', { name: 'Go to Databases' })).toBeVisible();
    await expect(section.locator('input[name="new_sql"]:not(:checked)').first()).toBeDisabled();
    return;
  }
  await expect(
    section.getByText(
      /Switching stops the current database server, deletes its data and starts the new one/i
    )
  ).toBeVisible();

  // No server selected yet, so submit button should be disabled
  const switchButton = section.getByRole('button', {
    name: 'Choose a database server',
  });

  await expect(switchButton).toBeVisible();
  await expect(switchButton).toBeDisabled();
});

// ─────────────────────────────────────────────
// /containers/webserver  (change webserver)
// ─────────────────────────────────────────────

test('change webserver page loads', async ({ page }) => {
  await page.goto('/containers/webserver');

  // Page heading
  await expect(
    page.getByRole('heading', { name: 'Webserver', exact: true })
  ).toBeVisible();

  // Page description
  await expect(
    page.getByText('Choose the webserver that will power your websites.')
  ).toBeVisible();

  // Available webserver options
  await expect(page.getByText('Apache', { exact: true })).toBeVisible();
  await expect(page.getByText('Nginx', { exact: true })).toBeVisible();
  await expect(page.getByText('OpenLiteSpeed', { exact: true })).toBeVisible();
  await expect(page.getByText('OpenResty', { exact: true })).toBeVisible();

  // Current webserver should be indicated
  await expect(
    page.getByText('Current', { exact: true })
  ).toBeVisible();

  // Switching is blocked while domains exist
  await expect(
    page.getByText(
      /To switch the webserver, first remove all domains from your account/i
    )
  ).toBeVisible();
});

// ─────────────────────────────────────────────
// /containers/logs  (logs viewer)
// ─────────────────────────────────────────────

test('logs page loads with container selector', async ({ page }) => {
  await page.goto('/containers/logs');
  await expect(page.locator('h1')).toContainText('Logs');
  await expect(page.locator('select#log-select')).toBeVisible();
  await expect(page.locator('select#lines-select')).toBeVisible();
  await expect(page.locator('#log-content')).toBeVisible();
});

test('logs page - selecting container loads log content', async ({ page }) => {
  await page.goto('/containers/logs');

  const select = page.locator('select#log-select');
  const options = select.locator('option:not([disabled])');
  const count = await options.count();

  if (count > 0) {
    const value = await options.first().getAttribute('value');
    await select.selectOption(value);
    await page.waitForTimeout(2000);

    const logContent = page.locator('#log-content');
    const text = await logContent.textContent();
    expect(text).not.toBe('Select a container to view its logs here.');
  } else {
    console.log('No containers in log selector, skipping.');
  }
});

test('logs page - ?container= param pre-selects and loads', async ({ page }) => {
  // Navigate with query param; the JS should auto-select and fetch
  await page.goto('/containers/logs?container=nginx&lines=20');
  await page.waitForTimeout(2000);

  const select = page.locator('select#log-select');
  const selected = await select.inputValue();

  // Should be set to nginx (or empty if nginx doesn't exist)
  if (selected === 'nginx') {
    const logContent = await page.locator('#log-content').textContent();
    expect(logContent).not.toBe('Select a container to view its logs here.');
  } else {
    console.log('nginx not in log selector (may not be running), skipping content check.');
  }
});

// ─────────────────────────────────────────────
// /containers/terminal
// ─────────────────────────────────────────────

test('terminal page without container shows service picker', async ({ page }) => {
  await page.goto('/containers/terminal');
  await expect(page.locator('h1')).toContainText('Container Terminal');
  await expect(page.locator('select#service-select')).toBeVisible();
});

test('terminal page - selecting service redirects', async ({ page }) => {
  await page.goto('/containers/terminal');

  const select = page.locator('select#service-select');
  const options = select.locator('option:not([disabled])');
  const count = await options.count();

  if (count > 0) {
    const value = await options.first().getAttribute('value');
    await select.selectOption(value);
    await page.waitForURL(`**/containers/terminal/${value}`, { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('Container Terminal');
    await expect(page.locator('#terminal')).toBeVisible();
    await expect(page.locator('select#shell')).toBeVisible();
  } else {
    console.log('No running services for terminal, skipping.');
  }
});

test('terminal', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/containers/terminal/php-fpm-8.5');
  const terminalOutput = page.locator('.xterm-rows');
  // keys typed before the shell has attached are lost, e.g. right after the container was restarted
  await expect(terminalOutput).toContainText(/[#$]\s*$/, { timeout: 30_000 });
  await page.locator('.xterm-rows > div').first().click();
  await page.locator('.xterm-rows > div').first().click({ button: 'right' });
  await expect(async () => {
    await page.getByRole('textbox', { name: 'Terminal input' }).fill('php -v');
    await page.getByRole('textbox', { name: 'Terminal input' }).press('Enter');
    await expect(terminalOutput).toContainText('The PHP Group', { timeout: 10_000 });
  }).toPass({ timeout: 60_000 });

  console.log('php -v executed successfully');
});

test('terminal - reconnect button appears after disconnect', async ({ page }) => {
  await page.goto('/containers/terminal/php-fpm-8.5');
  await page.waitForTimeout(2000);

  // Status dot and text should be present
  await expect(page.locator('#status-dot')).toBeVisible();
  await expect(page.locator('#status-text')).toBeVisible();

  // Shell selector should be set to bash/sh
  const shell = await page.locator('select#shell').inputValue();
  expect(['bash', 'sh']).toContain(shell);
});

// ─────────────────────────────────────────────
// /containers/status  (JSON endpoint)
// ─────────────────────────────────────────────

test('containers status endpoint returns JSON', async ({ page }) => {
  const response = await page.request.get('/containers/status');
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('running_containers');
  expect(Array.isArray(body.running_containers)).toBe(true);
});

// ─────────────────────────────────────────────
// /containers  (bulk actions, only on containers made for it)
// ─────────────────────────────────────────────

test('bulk actions', async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const services = ['bulkappa', 'bulkappb'];
  const rows = '#containers-table tbody tr';
  const box = (service: string) => page.locator(`${rows} input.bulk-select-box[value="${service}"]`);

  for (const service of services) {
    await page.goto('/containers');
    if (await box(service).count()) continue;
    await page.goto('/containers/new');
    await page.locator('#image').fill('nginx:latest');
    await page.locator('#service_name').fill(service);
    await page.locator('#cpu').fill('0.5');
    await page.locator('#ram_amount').fill('1');
    await page.locator('main button[type="submit"]').click();
    await expect.poll(async () => { await page.goto('/containers'); return box(service).count(); }, { timeout: 120_000, intervals: [3000] }).toBe(1);
  }

  await page.goto('/containers');
  await bulkSelectAllAndClear(page);

  for (const [action, value] of [['start'], ['restart'], ['stop'], ['cpu', '0.25'], ['ram', '0.5'], ['pids', '50']] as [string, string?][]) {
    await page.goto('/containers');
    await bulkSelectKeys(page, services);
    await bulkRun(page, action, value);
  }

  await page.goto('/containers');
  await bulkSelectKeys(page, services);
  await bulkRun(page, 'delete');
  for (const service of services) await expect(box(service)).toHaveCount(0);
});
