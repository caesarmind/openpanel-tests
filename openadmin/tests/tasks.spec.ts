import { test, expect } from '@playwright/test';

// /tasks: opencli commands running now and the ones cron runs, the table is re-rendered from json every 5s

const rows = (page) => page.locator('#tasks_tbody tr[data-command]');

// column text by header label, the Server column only shows on a cluster master
async function columnValues(page, label: string): Promise<string[]> {
  const heads = (await page.locator('#tasks_table thead th').allInnerTexts()).map(h => h.trim());
  const idx = heads.indexOf(label);
  expect(idx, `column ${label}`).toBeGreaterThanOrEqual(0);
  return (await rows(page).locator(`td:nth-child(${idx + 1})`).allInnerTexts()).map(t => t.trim());
}

// "in 1h 2m" / "4s" as seconds, same as the page does
const seconds = (text: string) => {
  let total = 0;
  for (const m of text.matchAll(/(\d+)\s*([dhms])/g)) total += +m[1] * { d: 86400, h: 3600, m: 60, s: 1 }[m[2]]!;
  return total;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/tasks/);
  // wait for the first json render, it sets data-sort on the headers
  await expect(page.locator('#tasks_table thead th[data-sort="command"]')).toBeAttached();
});

test('lists scheduled opencli jobs with an edit link to their cron line', async ({ page }) => {
  const scheduled = rows(page).filter({ hasText: 'Scheduled' });
  test.skip(await scheduled.count() === 0, 'no opencli cron jobs on this server');

  const first = scheduled.first();
  await expect(first.locator('td').first()).toContainText(/^opencli /);
  await expect(first).toContainText(/in \d+|due now/);

  const edit = first.getByRole('link', { name: 'Edit' });
  const href = await edit.getAttribute('href');
  expect(href).toMatch(/\/server\/crons#\d+$/);

  // the anchor is the row of that job on the crons page
  const command = (await first.getAttribute('data-command'))!;
  await edit.click();
  await expect(page).toHaveURL(/\/server\/crons/);
  const line = href!.split('#')[1];
  await expect(page.locator(`tr[id="${line}"] input[name="${line}_command"]`)).toHaveValue(command);
});

test('running tasks offer trace and kill', async ({ page }) => {
  const running = rows(page).filter({ hasText: 'Running' });
  test.skip(await running.count() === 0, 'no opencli command running right now');

  const first = running.first();
  await expect(first.getByRole('link', { name: 'Trace' })).toHaveAttribute('href', /\/strace$/);
  await expect(first.getByRole('button', { name: 'Kill' })).toBeVisible();
});

test('search filters the rows and survives a refresh', async ({ page }) => {
  const count = await rows(page).count();
  test.skip(count < 2, 'not enough tasks to filter');

  // pick a word from the first command that not every task contains, so the filter has to drop rows
  const commands = await rows(page).evaluateAll(trs => trs.map(tr => ((tr as HTMLElement).dataset.command || '').toLowerCase()));
  const word = commands[0].split(/\s+/).find(w => w.length > 2 && commands.some(c => !c.includes(w)));
  test.skip(!word, 'every task shares the same words');
  await page.getByPlaceholder('Search tasks…').fill(word!);

  const visible = page.locator('#tasks_tbody tr[data-command]:visible');
  await expect.poll(() => visible.count()).toBeLessThan(count);
  // the table is rebuilt every 5s, the filter has to hold after that too
  await page.waitForTimeout(6_000);
  const left = await visible.count();
  expect(left).toBeGreaterThan(0);
  expect(left).toBeLessThan(count);
  for (const c of await visible.evaluateAll(trs => trs.map(tr => (tr as HTMLElement).dataset.command || ''))) {
    expect(c.toLowerCase()).toContain(word!);
  }
});

test('command column sorts both ways and the sort stays in the url', async ({ page }) => {
  test.skip(await rows(page).count() < 2, 'not enough tasks to sort');

  const header = page.locator('#tasks_table thead th[data-sort="command"]');
  await header.click();
  await expect(page).toHaveURL(/sort=command&direction=asc/);
  const asc = await columnValues(page, 'Command');
  expect(asc).toEqual([...asc].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));

  await header.click();
  await expect(page).toHaveURL(/sort=command&direction=desc/);
  const desc = await columnValues(page, 'Command');
  expect(desc).toEqual([...asc].reverse());

  // a reload and the 5s refresh keep the order
  await page.reload();
  await expect(page.locator('#tasks_table thead th[data-sort="command"]')).toBeAttached();
  await page.waitForTimeout(6_000);
  expect(await columnValues(page, 'Command')).toEqual(desc);
});

test('time column puts running tasks first, then the next scheduled run', async ({ page }) => {
  test.skip(await rows(page).count() < 2, 'not enough tasks to sort');

  await page.locator('#tasks_table thead th[data-sort="time"]').click();
  await expect(page).toHaveURL(/sort=time&direction=asc/);

  const status = await columnValues(page, 'Status');
  const time = await columnValues(page, 'Time');
  const firstScheduled = status.indexOf('Scheduled');
  if (firstScheduled > 0) expect(status.slice(0, firstScheduled).every(s => s === 'Running')).toBeTruthy();
  const waits = time.slice(Math.max(firstScheduled, 0)).map(seconds);
  // the countdowns tick between rows, a second or two of slack
  for (let i = 1; i < waits.length; i++) expect(waits[i]).toBeGreaterThanOrEqual(waits[i - 1] - 2);
});

test('json output lists the same tasks', async ({ page }) => {
  const res = await page.request.get('/tasks?output=json');
  expect(res.ok()).toBeTruthy();
  const tasks = await res.json();
  expect(Array.isArray(tasks)).toBeTruthy();
  for (const t of tasks) {
    expect(['running', 'scheduled']).toContain(t.status);
    expect(t.command).toMatch(/^opencli /);
  }
});
