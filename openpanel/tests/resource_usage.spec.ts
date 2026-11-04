const { test, expect } = require('@playwright/test');

test('Resource Usage page loads with gauges', async ({ page }) => {
    await page.goto('/server/usage');

    // Header should be visible
    await expect(page.locator('h1')).toContainText('Resource Usage');

    // Link to history page should exist
    const historyLink = page.locator('a[href="/server/usage/history"]');
    await expect(historyLink).toBeVisible();
    await expect(historyLink).toContainText('View Usage History');
});

test('Resource Usage page shows CPU and RAM gauges when data available', async ({ page }) => {
    await page.goto('/server/usage');

    const cpuGauge = page.locator('#cpuGauge');
    const ramGauge = page.locator('#ramGauge');
    // the new theme shows CPU and Memory tiles instead of gauges, with "No data yet" in them when nothing was recorded
    const tileValue = (label: string) => page.locator('.op-kpi')
        .filter({ has: page.locator('.op-kpi-label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) })
        .locator('.op-kpi-value');

    // If gauges are present, data was returned
    if (await cpuGauge.isVisible()) {
        await expect(ramGauge).toBeVisible();
        await expect(page.locator('text=Current CPU usage')).toBeVisible();
        await expect(page.locator('text=Used Memory')).toBeVisible();
        await expect(page.locator('text=Last refreshed at')).toBeVisible();
    } else if (await page.locator('.op-kpis').first().isVisible() && !(await page.getByText('No data yet').first().isVisible())) {
        await expect(tileValue('CPU')).toHaveText(/\d+(\.\d+)?\s*%/);
        await expect(tileValue('Memory')).toHaveText(/\d+(\.\d+)?\s*[KMGT]?B/);
        // "Live" while the container table refreshes itself, otherwise "Updated <time>"
        await expect(page.locator('.op-page-head .op-eyebrow')).toHaveText(/Live|Updated \S+/);
    } else {
        // No data state
        await expect(page.locator('text=No resource usage data available yet')).toBeVisible();
    }
});

test('Usage History page loads', async ({ page }) => {
    await page.goto('/server/usage/history');

    // the new page is titled "Usage History"
    await expect(page.locator('h1')).toContainText(/Historical CPU and Memory Usage|Usage History/);

    // Table should be present
    // the new samples table has no id
    const table = page.locator('table#usage').or(page.locator('table.op-table'));
    await expect(table).toBeVisible();

    // Table headers
    // the new table calls them "Time" and "Bandwidth"
    await expect(table).toContainText(/Date|Time/);
    await expect(table).toContainText('CPU');
    await expect(table).toContainText('Memory');
    await expect(table).toContainText('Bandwidth');
    await expect(table).toContainText('Warning');
});

// the new Usage History page filters and caps its rows in the browser: a range switch, a threshold switch
// and a "Show all N samples" button past the first rowLimit rows; null on the classic page
async function modernHistory(page) {
    const root = page.locator('[x-data^="usageHistory"]');
    if (!(await root.count())) return null;
    const table = page.locator('table.op-table');
    const ranges = page.locator('.op-page-head .op-segmented button');
    // the range buttons get aria-pressed from Alpine, so once one is pressed the rows have been filtered
    if (await table.count()) await expect(ranges.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
    const showAll = page.locator('button.uh-more');
    return {
        table,
        ranges,
        showAll,
        rows: table.locator('tbody tr').filter({ visible: true }),
        rowLimit: Number((await root.getAttribute('x-data')).match(/"rowLimit":(\d+)/)[1]),
        total: async () => Number((await showAll.innerText()).match(/\d+/)[0]),
    };
}

const NO_SHOW_ALL = 'no more samples than one page holds, so the new page has no Show all button';

test('Usage History search filters rows', async ({ page }) => {
    await page.goto('/server/usage/history');

    const h = await modernHistory(page);
    if (h) {
        test.skip(!(await h.table.count()), 'no usage samples yet');
        // the new page has no search box, its row filter is the threshold switch
        const onlyWarn = page.getByRole('switch', { name: 'Only samples over a threshold' });
        const before = await h.rows.count();
        expect(before).toBeGreaterThan(0);

        await onlyWarn.click();
        await expect(onlyWarn).toHaveAttribute('aria-checked', 'true');
        await expect(h.table.locator('tbody tr:not([data-warn])').filter({ visible: true })).toHaveCount(0);
        if (!(await h.rows.count())) await expect(page.getByText('No samples went over a threshold')).toBeVisible();

        // Switch it off - rows should return
        await onlyWarn.click();
        await expect(onlyWarn).toHaveAttribute('aria-checked', 'false');
        await expect(h.rows).toHaveCount(before);
        return;
    }

    const table = page.locator('table#usage tbody');
    const rows = table.locator('tr');
    const rowCount = await rows.count();

    // Only run search test if there is data
    if (rowCount === 0) {
        console.log('No usage data rows to test search against, skipping.');
        return;
    }

    const searchInput = page.locator('[x-model="searchQuery"]');
    await expect(searchInput).toBeVisible();

    // Search for something that won't match
    await searchInput.fill('zzznomatchzzz');
    const visibleRows = page.locator('table#usage tbody tr:visible');
    await expect(visibleRows).toHaveCount(0, { timeout: 3000 });

    // Clear search - rows should return
    await searchInput.fill('');
    await expect(page.locator('table#usage tbody tr').first()).toBeVisible({ timeout: 3000 });
});

test('Usage History show all checkbox loads all data', async ({ page }) => {
    await page.goto('/server/usage/history');

    const h = await modernHistory(page);
    if (h) {
        test.skip(!(await h.showAll.isVisible()), NO_SHOW_ALL);
        const total = await h.total();
        expect(total).toBeGreaterThan(h.rowLimit);
        await expect(h.rows).toHaveCount(h.rowLimit);

        await h.showAll.click();
        await expect(h.rows).toHaveCount(total);
        await expect(h.showAll).toBeHidden();
        return;
    }

    const checkbox = page.locator('#showAllCheckboxOnHistoryPage');
    await expect(checkbox).toBeVisible();

    // Check the checkbox
    await checkbox.check();

    // URL should update with show_all=true
    await page.waitForURL('**/server/usage/history?show_all=true', { timeout: 5000 });
    await expect(page.locator('text=Showing 1 -')).toBeVisible();
});

test('Usage History show all checkbox can be unchecked', async ({ page }) => {
    await page.goto('/server/usage/history?show_all=true');

    const h = await modernHistory(page);
    if (h) {
        test.skip(!(await h.showAll.isVisible()), NO_SHOW_ALL);
        test.skip((await h.ranges.count()) < 2, 'only one time range is offered, nothing to switch to');
        const total = await h.total();
        const current = (await h.ranges.and(page.locator('[aria-pressed="true"]')).innerText()).trim();

        await h.showAll.click();
        await expect(h.rows).toHaveCount(total);

        // switching the range away and back drops to the first rowLimit rows again
        await h.ranges.and(page.locator('[aria-pressed="false"]')).first().click();
        await h.ranges.filter({ hasText: current }).click();
        await expect(h.ranges.and(page.locator('[aria-pressed="true"]'))).toHaveText(current);
        await expect(h.rows).toHaveCount(h.rowLimit);
        await expect(h.showAll).toBeVisible();
        return;
    }

    const checkbox = page.locator('#showAllCheckboxOnHistoryPage');
    await expect(checkbox).toBeChecked();

    await checkbox.uncheck();

    // show_all param should be removed from URL
    await page.waitForURL(url => !url.toString().includes('show_all'), { timeout: 5000 });
});

test('Usage History pagination works', async ({ page }) => {
    await page.goto('/server/usage/history');

    const h = await modernHistory(page);
    if (h) {
        // the new page has no Next/Previous links, it shows the first rowLimit rows and a Show all button for the rest
        test.skip(!(await h.showAll.isVisible()), NO_SHOW_ALL);
        const total = await h.total();
        await expect(h.rows).toHaveCount(h.rowLimit);
        // the rows past the first page are already in the table, only hidden
        expect(await h.table.locator('tbody tr').count()).toBeGreaterThanOrEqual(total);

        await h.showAll.click();
        await expect(h.rows).toHaveCount(total);
        await expect(h.showAll).toBeHidden();
        return;
    }

    const nextLink = page.locator('a', { hasText: 'Next' });

    // Only test pagination if Next exists (i.e. more than one page)
    if (await nextLink.isVisible()) {
        await nextLink.click();
        await page.waitForLoadState('networkidle');

        // URL should now have page=2
        expect(page.url()).toContain('page=2');

        // Previous button should now appear
        await expect(page.locator('a', { hasText: 'Previous' })).toBeVisible();
    } else {
        console.log('Only one page of data, skipping pagination test.');
    }
});

test('View Usage History button navigates correctly', async ({ page }) => {
    await page.goto('/server/usage');

    const historyBtn = page.locator('a[href="/server/usage/history"]');
    await historyBtn.click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/server/usage/history');
    await expect(page.locator('h1')).toContainText(/Historical CPU and Memory Usage|Usage History/);
});
