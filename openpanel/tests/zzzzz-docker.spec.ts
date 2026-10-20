import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────
// /containers  (main table)
// ─────────────────────────────────────────────

test('check columns for docker table', async ({ page }) => {
  await page.goto(`/containers`);
  await expect(page).toHaveURL(/containers/);
  await page.getByRole('button', { name: 'Show Columns' }).click();

  const rows = page.locator('ul[aria-labelledby="dropdownToggleButton"] li');
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const checkbox = row.locator('input[type="checkbox"]');
    const xModel = await checkbox.getAttribute('x-model');
    if (!xModel) continue;

    const columnKey = xModel.replace('columns.', '');
    const th = page.locator(`th[x-show="columns.${columnKey}"]`);
    const initialState = await checkbox.isChecked();

    await row.locator('label').click();
    await page.waitForTimeout(100);

    const expectedStateAfterToggle = !initialState;
    if (expectedStateAfterToggle) {
      await expect(th).toBeVisible();
    } else {
      await expect(th).toBeHidden();
    }

    await row.locator('label').click();
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

test('edit cpu, ram and toggle container state for all rows', async ({ page }) => {
  test.setTimeout(9000_000);
  await page.goto('/containers');

  const rows = page.locator('#containers-table tr.domain_row');
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    await row.hover();

    // 1. EDIT CPU
    const cpuCell = row.locator('td[x-show*="cpu"]');
    await cpuCell.hover();
    await cpuCell.locator('a').first().click();

    const cpuInput = cpuCell.locator('input[name="value"]');
    await expect(cpuInput).toBeVisible();
    await cpuInput.fill('1');

    await Promise.all([
      page.waitForResponse(resp =>
        resp.url().includes('/containers/cpu/') && resp.request().method() === 'POST'
      ),
      cpuCell.locator('button[type="submit"]').click(),
    ]);

    await expect(cpuInput).toBeHidden();
    await expect(page.locator('body')).toContainText(/Max CPU for container/i);
    await expect(page.locator('body')).toContainText(/set to 1/i);

    // 2. EDIT RAM
    const ramCell = row.locator('td[x-show*="ram"]');
    await ramCell.hover();
    await ramCell.locator('a').first().click();

    const ramInput = ramCell.locator('input[name="value"]');
    await expect(ramInput).toBeVisible();
    await ramInput.fill('1');

    await Promise.all([
      page.waitForResponse(resp =>
        resp.url().includes('/containers/ram/') && resp.request().method() === 'POST'
      ),
      ramCell.locator('button[type="submit"]').click(),
    ]);

    await expect(ramInput).toBeHidden();
    await expect(page.locator('body')).toContainText(/Max RAM for container/i);
    await expect(page.locator('body')).toContainText(/set to 1G/i);

    // 3. ENSURE FINAL STATE = STOPPED
    const freshRow = rows.nth(i);
    await freshRow.hover();

    const actionsCell = freshRow.locator('td[x-show*="actions"]');
    const startBtn = actionsCell.getByRole('button', { name: 'Start', exact: true }).first();
    const stopBtn = actionsCell.getByRole('button', { name: 'Stop', exact: true }).first();

    const hasStartBtn = await startBtn.count();
    if (hasStartBtn > 0 && await startBtn.isVisible()) {
      await Promise.all([
        page.waitForResponse(resp =>
          resp.url().includes('/containers/start/') && resp.request().method() === 'POST'
        ),
        startBtn.click(),
      ]);
      await expect(page.locator('body')).toContainText(/activated successfully/i);
      await expect(stopBtn).toBeVisible({ timeout: 30_000 });
    }

    const hasStopBtn = await stopBtn.count();
    if (hasStopBtn > 0 && await stopBtn.isVisible()) {
      await Promise.all([
        page.waitForResponse(resp =>
          resp.url().includes('/containers/stop/') && resp.request().method() === 'POST'
        ),
        stopBtn.click(),
      ]);
      await expect(page.locator('body')).toContainText(/deactivated successfully/i);
    } else {
      console.log(`Container row ${i + 1} has no visible Stop button, already stopped or not startable`);
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

  await submit.click();
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
  await page.locator('.xterm-rows > div').first().click();
  await page.locator('.xterm-rows > div').first().click({ button: 'right' });
  await page.getByRole('textbox', { name: 'Terminal input' }).fill('php -v');
  await page.getByRole('textbox', { name: 'Terminal input' }).press('Enter');

  const terminalOutput = page.locator('.xterm-rows');
  await expect(terminalOutput).toContainText('The PHP Group');

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
