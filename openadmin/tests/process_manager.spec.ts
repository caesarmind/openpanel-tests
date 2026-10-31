import { test, expect } from '@playwright/test';

test.describe('processes table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/server/processes');
    await expect(page).toHaveURL(/server\/processes/);
  });

  test('search', async ({ page }) => {
    const table = page.locator('#processes_table');
    const rows = table.locator('tbody tr:visible');
    const searchInput = page.getByPlaceholder('Search processes...');

    const initialCount = await rows.count();

    await searchInput.fill('testinguser');
    await expect.poll(async () => ((await rows.first().innerHTML()).includes('testinguser'))).toBe(true);

    const testingUserCount = await rows.count();
    console.log(`search testinguser: ${testingUserCount}`);
    expect(testingUserCount).not.toBe(initialCount);

    await searchInput.fill('cron');
    // the match can be in the full command the cell cuts short
    await expect.poll(async () => ((await rows.first().innerHTML()).toLowerCase().includes('cron'))).toBe(true);

    const cronCount = await rows.count();
    console.log(`search cron: ${cronCount}`);
    expect(cronCount).not.toBe(initialCount);

    await expect(table).toBeVisible();
  });

  test('asc/desc sorting', async ({ page }) => {
    const table = page.locator('#processes_table');

    const columns = [
      { name: 'Pid', asc: 'pid', desc: '-pid' },
      { name: 'Owner', asc: 'owner', desc: '-owner' },
      { name: 'Priority', asc: 'priority', desc: '-priority' },
      { name: 'CPU %', asc: 'cpu', desc: '-cpu' },
      { name: 'Memory %', asc: 'memory', desc: '-memory' },
      { name: 'Command', asc: 'command', desc: '-command' },
    ];

    const getColumnValues = async (name: string) => {
      // sorting re-navigates the page; wait for the table to repopulate
      // before reading values, otherwise we can read it mid-reload.
      await expect(table.locator('tbody tr').first()).toBeVisible();
      // the checkbox and Server columns shift things, so find the column by its header
      const heads = (await table.locator('thead th:visible').allInnerTexts()).map(h => h.replace(/\s+/g, ' ').trim());
      const idx = heads.findIndex(h => h === name || h.startsWith(name + ' '));
      const texts = await table.locator(`tbody tr td:nth-child(${idx + 1})`).allInnerTexts();
      // the Pid cell also holds the Trace and Kill links
      return name === 'Pid' ? texts.map(t => (t.match(/\d+/) || [''])[0]) : texts;
    };

    const normalize = (vals: string[]) =>
      vals.map(v => v.replace(/\u00a0/g, '').trim()).filter(Boolean);

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const header = table.locator('th', { hasText: col.name });

      await header.locator(`a[href*="sort=${col.asc}"]`).click();
      await expect(page).toHaveURL(new RegExp(`sort=${col.asc}`));

      const asc = normalize(await getColumnValues(col.name));

      await header.locator(`a[href*="sort=${col.desc}"]`).click();
      await expect(page).toHaveURL(new RegExp(`sort=${col.desc}`));

      const desc = normalize(await getColumnValues(col.name));

      console.log(`[${col.name}] asc: ${asc[0]} → ${asc.at(-1)}, desc: ${desc[0]} → ${desc.at(-1)}`);

      expect(asc.length).toBeGreaterThan(0);
      expect(desc.length).toBeGreaterThan(0);
      expect(asc[0]).not.toBe(desc[0]);
      expect(asc.at(-1)).not.toBe(desc.at(-1));
    }
  });

  test('strace', async ({ page }) => {
    const rows = page.locator('#processes_table tbody tr:visible');

    const userRow = rows.filter({ hasText: 'testinguser' }).first();
    await userRow.getByRole('link', { name: 'Trace' }).click();

    await expect(page).toHaveURL(/\/server\/processes\/\d+\/strace/);
    // the output streams in, wait for either result first
    await expect(page.locator('body')).toContainText(/attached|strace is not installed/, { timeout: 15_000 });
    test.skip(await page.getByText('strace is not installed on this server').isVisible(), 'strace is not installed on this server');
    await expect(page.locator('body')).toContainText(
      /strace:\s*Process\s+\d+\s+attached/
    );
  });

test('kill', async ({ page }) => {
  // only a throwaway sleep, killing systemd --user or httpd would take the account's containers down
  const userRow = page
    .locator('#processes_table tbody tr', { hasText: 'testinguser' })
    .filter({ hasText: /\ssleep\s/ })
    .first();
  test.skip(await userRow.count() === 0, 'No sleep process of testinguser to kill');

  await expect(userRow).toBeVisible();

  // the checkbox is the first cell, the PID is in the second
  const pidCellText = await userRow.locator('td').nth(1).innerText();
  const pidMatch = pidCellText.match(/\d+/);

  expect(pidMatch).not.toBeNull();

  const pid = pidMatch![0];

  await userRow.getByRole('link', { name: 'Kill', exact: true }).click();

  await expect(page.locator('body')).toContainText(
    `Process with PID ${pid} killed successfully`
  );

  // Verify that exact PID no longer exists in the PID column.
  await expect(
    page.locator('#processes_table tbody tr td:nth-child(2)').filter({
      hasText: new RegExp(`^\\s*${pid}\\s*$`),
    })
  ).toHaveCount(0);
});
});
