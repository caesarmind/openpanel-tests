import { test, expect, type Page } from '@playwright/test';
import { bulkRun, bulkSelect, bulkSelectAllAndClear } from '../helpers';

// These tests intentionally share a cron job. Run in order, in one worker.
test.describe.configure({ mode: 'serial' });

// unique per run so a leftover job from an aborted run can't make the row lookups ambiguous
const RUN = process.env.TEST_RUN_ID || Math.random().toString(36).slice(2, 8);
const JOB = `curl job ${RUN}`;
const UPDATED_JOB = `updated description ${RUN}`;
const COMMAND = 'curl https://google.com > /var/www/html/cron-test.txt';
const INITIAL_SCHEDULE = '@every 5s';

function jobRow(page: Page, name: string) {
  return page.locator('#cronjobs-table tbody tr').filter({
    has: page.locator('[data-sort-col="comment"]', { hasText: name }),
  });
}

async function jobTable(page: Page) {
  await page.goto('/cronjobs');
  await expect(page.locator('#cronjobs-table')).toBeVisible();
}

// table isn't rendered at all when the account has no jobs yet
async function jobList(page: Page) {
  await page.goto('/cronjobs');
  await expect(page.locator('#cronjobs-table').or(page.getByText('No cronjobs yet', { exact: false }))).toBeVisible();
}

async function editorText(page: Page) {
  await expect(page.locator('.CodeMirror')).toBeVisible();
  return page.locator('.CodeMirror').evaluate((el: any) => el.CodeMirror.getValue() as string);
}

test('list', async ({ page }) => {
  await jobList(page);

  // drop jobs left behind by earlier aborted runs
  const stale = page.locator('#cronjobs-table tbody tr').filter({
    has: page.locator('[data-sort-col="comment"]', { hasText: /^\s*(curl job|updated description)/ }),
  });
  while (await stale.count()) {
    const row = stale.first();
    const name = (await row.locator('[data-sort-col="comment"]').innerText()).trim();
    await row.getByRole('button', { name: `Delete ${name}` }).click();
    await row.locator('button[title="Confirm"]').click();
    await expect(page.getByText('Cron job was successfully deleted.')).toBeVisible();
    await jobList(page);
  }

  await expect(page.locator('a[href="/cronjobs/new"]')).toBeVisible();
  // the File Editor and Logs tabs only exist with the modern menu
  if (await page.locator('#page-tabs').count()) {
    await expect(page.locator('#page-tabs a[href="/cronjobs/editor"]')).toBeVisible();
    await expect(page.locator('#page-tabs a[href="/cronjobs/logs"]')).toBeVisible();
  }
  // The list may contain existing jobs; an empty-state check is not appropriate.
});

test('create job', async ({ page }) => {
  await page.goto('/cronjobs/new');
  await expect(page).toHaveURL(/\/cronjobs\/new(?:\?|$)/);

  // The old "Switch to file editor" link was removed from this workflow.
  // Navigation to File Editor is now in the Cron Jobs page tabs.
  await expect(page.locator('#container')).toBeVisible();
  await page.locator('#container').selectOption('php-fpm-8.5');
  await page.getByRole('radio', { name: /custom/i }).check();
  await expect(page.locator('#schedule')).toBeVisible();
  await page.locator('#schedule').fill(INITIAL_SCHEDULE);
  await page.locator('#command').fill(COMMAND);
  await page.locator('#comment').fill(JOB);
  await page.getByRole('button', { name: /schedule cronjob/i }).click();

  await expect(page.getByText('Cron job created and saved successfully!')).toBeVisible();
  await jobTable(page);
  await expect(jobRow(page, JOB)).toBeVisible();
  await expect(jobRow(page, JOB)).toContainText(COMMAND);
});

test('view logs', async ({ page }) => {
  await jobTable(page);
  const row = jobRow(page, JOB);
  await expect(row).toBeVisible();

  // New frontend: a Logs link exists on each row as well as in the top tabs.
  await row.locator('a[href^="/cronjobs/logs?job="]').click();
  await expect(page).toHaveURL(/\/cronjobs\/logs(?:\?|$)/);

  // container logs are cached 60s per `lines` value, so bump it each poll to always get a fresh read
  let lines = 1000;
  await expect.poll(async () => {
    const response = await page.request.get('/cronjobs/log', {
      params: { job: JOB, lines: String(lines++) },
    });
    if (!response.ok()) return 0;
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return 0;
    return body.filter((entry: any) =>
      String(entry.log ?? entry.message ?? entry.msg ?? '').includes(JOB)
    ).length;
  }, { timeout: 30_000, intervals: [1_000, 2_000, 3_000] }).toBeGreaterThan(0);

  // The log page's table/dropdown structure isn't present in the provided HTML.
  // Verify its route and the underlying job-specific log data above.
});

test('edit as file', async ({ page }) => {
  await page.goto('/cronjobs/editor');
  await expect(page).toHaveURL(/\/cronjobs\/editor(?:\?|$)/);
  const before = await editorText(page);
  expect(before).toContain(`[job-exec "${JOB}"]`);
  expect(before).toContain(`command = ${COMMAND}`);

  // Only update this job's block, not the schedule of an unrelated job.
  const header = `[job-exec "${JOB}"]`;
  const start = before.indexOf(header);
  const end = before.indexOf('\n[', start + header.length);
  const blockEnd = end === -1 ? before.length : end;
  const block = before.slice(start, blockEnd);
  expect(block).toMatch(/^schedule\s*=.*$/m);
  const updatedBlock = block.replace(/^schedule\s*=.*$/m, 'schedule = * * * * * *');
  const after = before.slice(0, start) + updatedBlock + before.slice(blockEnd);

  await page.locator('.CodeMirror').evaluate((el: any, value) => {
    el.CodeMirror.setValue(value);
    el.CodeMirror.save();
  }, after);
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText('Crons file saved successfully!')).toBeVisible();

  await jobTable(page);
  await expect(jobRow(page, JOB)).toContainText('* * * * * *');
});

test('edit job', async ({ page }) => {
  await jobTable(page);
  const edits: { field: string; value: string; select?: boolean }[] = [
    { field: 'schedule', value: '0 0 * * * *' },
    { field: 'container', value: 'php-fpm-8.4', select: true },
    { field: 'command', value: 'curl https://google.com' },
    { field: 'comment', value: UPDATED_JOB },
  ];
  let currentName = JOB;

  for (const edit of edits) {
    let row = jobRow(page, currentName);
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: `Edit ${currentName}` }).click();

    const field = row.locator(`[name="${edit.field}"]:visible`);
    await expect(field).toBeVisible();
    if (edit.select) await field.selectOption(edit.value);
    else await field.fill(edit.value);

    // Clicking Save posts to /cronjobs/edit and reloads/navigates.
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/cronjobs/edit') && r.request().method() === 'POST'),
      row.getByRole('button', { name: `Save ${currentName}` }).click(),
    ]);

    if (edit.field === 'comment') currentName = edit.value;
    await jobTable(page);
    row = jobRow(page, currentName);
    await expect(row).toBeVisible();
    await expect(row).toContainText(edit.value);
  }
});

test('delete job', async ({ page }) => {
  await jobTable(page);
  const row = jobRow(page, UPDATED_JOB);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: `Delete ${UPDATED_JOB}` }).click();

  // The row's delete button changes its title to Confirm for five seconds.
  const confirm = row.locator('button[title="Confirm"]');
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(page.getByText('Cron job was successfully deleted.')).toBeVisible();
  await jobList(page);
  await expect(jobRow(page, UPDATED_JOB)).toHaveCount(0);
});

test('bulk actions', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const jobs = [`bulk a ${RUN}`, `bulk b ${RUN}`];

  for (const name of jobs) {
    await page.goto('/cronjobs/new');
    await page.locator('#container').selectOption('php-fpm-8.5');
    await page.getByRole('radio', { name: /custom/i }).check();
    await page.locator('#schedule').fill('0 0 3 * * *');
    await page.locator('#command').fill('echo bulk');
    await page.locator('#comment').fill(name);
    await page.getByRole('button', { name: /schedule cronjob/i }).click();
    await expect(page.getByText('Cron job created and saved successfully!')).toBeVisible();
  }

  const status = (name: string) => jobRow(page, name).locator('[data-sort-col="status"]');

  await jobTable(page);
  await bulkSelectAllAndClear(page);

  await bulkSelect(page, jobs);
  await bulkRun(page, 'disable');
  for (const name of jobs) await expect(status(name)).toHaveAttribute('data-sort-value', '0');

  await bulkSelect(page, jobs);
  await bulkRun(page, 'enable');
  for (const name of jobs) await expect(status(name)).toHaveAttribute('data-sort-value', '1');

  await bulkSelect(page, jobs);
  await bulkRun(page, 'schedule', '0 30 4 * * *');
  for (const name of jobs) await expect(jobRow(page, name).locator('[data-sort-col="schedule"]')).toHaveText('0 30 4 * * *');

  await bulkSelect(page, jobs);
  await bulkRun(page, 'delete');
  for (const name of jobs) await expect(jobRow(page, name)).toHaveCount(0);
});
