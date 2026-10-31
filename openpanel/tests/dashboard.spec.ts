import { test, expect, type Locator } from '@playwright/test';

async function navigateToDashboardPage(page: any) {
  await page.goto(`/dashboard`);
  await expect(page).toHaveURL(/dashboard/);
}

// the new theme opens on its own layout, the icon sections are its classic view; the old theme ignores the parameter
async function navigateToIconSections(page: any) {
  await page.goto(`/dashboard?view=classic`);
  await expect(page).toHaveURL(/dashboard/);
}

// the old buttons turn bg-slate-700 when picked, the new ones set aria-pressed
async function expectPicked(btn: Locator, picked: boolean) {
  if ((await btn.getAttribute('aria-pressed')) !== null) await expect(btn).toHaveAttribute('aria-pressed', String(picked));
  else if (picked) await expect(btn).toHaveClass(/bg-slate-700/);
  else await expect(btn).not.toHaveClass(/bg-slate-700/);
}

// OPEN
test('access dashboard', async ({ page }) => {
  await navigateToDashboardPage(page);
  await expect(page.getByText(/cpu usage/i)).toBeVisible();
  console.log('Dashboard page is accessible');
});


// SIDEBAR OPEN/CLOSE
test('sidebar open/close', async ({ page }) => {
  await navigateToDashboardPage(page);

  const html = page.locator('html');
  const sidebar = page.locator('#sidebar');

  await expect(html).toHaveClass(/sidebar-open/);
  await expect(sidebar).toBeVisible();

  await page.locator('#sidebar_toggle_button').click();
  await expect(html).not.toHaveClass(/sidebar-open/);
  await expect(sidebar).not.toBeVisible();

  await page.locator('#sidebar_toggle_button').click();
  await expect(html).toHaveClass(/sidebar-open/);
  await expect(sidebar).toBeVisible();

  console.log('sidebar toggle working');
});


// THEME SWITCH
test('toggle dark mode', async ({ page }) => {
  await navigateToDashboardPage(page);

  await page.locator('#user-btn-info').click();

  await expect(page.locator('#theme-toggle-dark-icon')).toBeVisible();

  await page.locator('#theme-toggle-dark-icon').click();
  await expect(page.locator('#theme-toggle-light-icon')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.locator('#theme-toggle-light-icon').click();
  await expect(page.locator('#theme-toggle-dark-icon')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  console.log('Dark mode switch is working');
});

// SEARCH
test('search results', async ({ page }) => {
  test.setTimeout(300_000);
  await navigateToDashboardPage(page);
  await page.waitForFunction(() => typeof (window as any).Alpine !== 'undefined');
  await page.waitForTimeout(500);

  const items = ['Domain', 'DNS', 'Emails'];
  const failures: Array<{ name: string; error: string }> = [];
  let passed = 0;

  for (const name of items) {
    try {
      const openBtn = page.locator('button[aria-label="Open search"]');
      await expect(openBtn).toBeVisible({ timeout: 3000 });
      await openBtn.click();
      const searchInput = page.locator('#searchInput');
      await expect(searchInput).toBeVisible({ timeout: 2000 });
      await expect(searchInput).toBeFocused({ timeout: 2000 });
      await searchInput.pressSequentially(name, { delay: 50 });
      const dropdown = page.locator('#filteredDropdown');
      await expect(dropdown).toBeVisible({ timeout: 5000 });
      const match = dropdown.locator('a').filter({ hasText: name }).first();
      await expect(match).toBeVisible({ timeout: 3000 });
      console.log(`✓ found: "${name}"`);
      passed++;
    } catch (err: any) {
      const msg = err?.message?.split('\n')[0] ?? String(err);
      console.log(`✗ failed: "${name}" — ${msg}`);
      failures.push({ name, error: msg });
    } finally {
      try {
        const closeBtn = page.locator('button[aria-label="Close search"]');
        if (await closeBtn.isVisible({ timeout: 1000 })) {
          await closeBtn.click();
          await page.locator('#searchInput').waitFor({ state: 'hidden', timeout: 3000 });
        }
      } catch {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  }

  console.log('\n─── Search Test Summary ───────────────────────────');
  console.log(`  Passed : ${passed} / ${items.length}`);
  console.log(`  Failed : ${failures.length} / ${items.length}`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    for (const f of failures) console.log(`    ✗ "${f.name}": ${f.error}`);
  }
  console.log('───────────────────────────────────────────────────\n');

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} item(s) not found in search:\n` +
      failures.map(f => `  • "${f.name}": ${f.error}`).join('\n')
    );
  }
});


// ICONS TOP/START
test('icons mode toggle', async ({ page }) => {
  await navigateToDashboardPage(page);

  await page.locator('#user-btn-info').click();

  const iconsPosition = page.locator('#tour-icons-position');
  await expect(iconsPosition).toBeVisible();

  const topBtn = iconsPosition.locator('button[title="Top"]');
  const startBtn = iconsPosition.locator('button[title="Start"]');

  await expect(topBtn).toBeVisible();
  await expect(startBtn).toBeVisible();

  //
  // START / list
  //
  await startBtn.click();

  await expectPicked(startBtn, true);
  await expectPicked(topBtn, false);

  await expect
    .poll(() =>
      page.evaluate(() => Alpine.store('dashboardIconView').value)
    )
    .toBe('list');

  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.find(
        cookie => cookie.name === 'dashboard_icon_view'
      )?.value;
    })
    .toBe('list');

  //
  // Verify LIST survives reload
  //
  await page.reload();

  await page.locator('#user-btn-info').click();

  const iconsPositionAfterReload = page.locator('#tour-icons-position');
  await expect(iconsPositionAfterReload).toBeVisible();

  const topBtnAfterReload =
    iconsPositionAfterReload.locator('button[title="Top"]');

  const startBtnAfterReload =
    iconsPositionAfterReload.locator('button[title="Start"]');

  await expectPicked(startBtnAfterReload, true);
  await expectPicked(topBtnAfterReload, false);

  await expect
    .poll(() =>
      page.evaluate(() => Alpine.store('dashboardIconView').value)
    )
    .toBe('list');

  //
  // Switch back to TOP / icon
  //
  await topBtnAfterReload.click();

  await expectPicked(topBtnAfterReload, true);
  await expectPicked(startBtnAfterReload, false);

  await expect
    .poll(() =>
      page.evaluate(() => Alpine.store('dashboardIconView').value)
    )
    .toBe('icon');

  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.find(
        cookie => cookie.name === 'dashboard_icon_view'
      )?.value;
    })
    .toBe('icon');

  console.log('icons toggle working');
});

// SORTABLE
test('icon sections drag&sort', async ({ page }) => {
  await navigateToIconSections(page);

  const sortable = page.locator('#dashboard-sortable-area');

  const firstSection = sortable.locator('> [data-id]').nth(0);
  const secondSection = sortable.locator('> [data-id]').nth(1);

  const firstKey = await firstSection.getAttribute('data-id');
  const secondKey = await secondSection.getAttribute('data-id');

  expect(firstKey).toBeTruthy();
  expect(secondKey).toBeTruthy();

  const handle = page.locator(`#section-title-${firstKey}`);
  const targetSection = page.locator(`#wrapper-${secondKey}`);

  await expect(handle).toBeVisible();
  await expect(targetSection).toBeVisible();

  const handleBox = await handle.boundingBox();
  const targetBox = await targetSection.boundingBox();

  expect(handleBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  const startX = handleBox!.x + handleBox!.width / 2;
  const startY = handleBox!.y + handleBox!.height / 2;

  const endX = targetBox!.x + targetBox!.width / 2;
  const endY = targetBox!.y + targetBox!.height + 40; // lower than second section

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(300);

  await page.mouse.move(endX, endY, { steps: 35 });
  await page.waitForTimeout(300);

  await page.mouse.up();
  await page.waitForTimeout(700);

  const newFirstKey = await sortable.locator('> [data-id]').nth(0).getAttribute('data-id');
  const newSecondKey = await sortable.locator('> [data-id]').nth(1).getAttribute('data-id');

  expect(newFirstKey).toBe(secondKey);
  expect(newSecondKey).toBe(firstKey);

  const savedOrder = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('dashboard_section_order') || 'null')
  );

  expect(savedOrder).not.toBeNull();
  expect(savedOrder[0]).toBe(secondKey);
  expect(savedOrder[1]).toBe(firstKey);

  console.log(`sections drag to sort working: moved '${firstKey}' below '${secondKey}'`);
});


// SECTION CLOSE/OPEN
test('icon sections open/close', async ({ page }) => {
  await navigateToIconSections(page);

  const firstSectionWrapper = page.locator('#dashboard-sortable-area > [data-id]').nth(0);
  const sectionKey = await firstSectionWrapper.getAttribute('data-id');

  const toggleBtn = firstSectionWrapper.locator('button[aria-expanded]');
  const iconsGrid = firstSectionWrapper.locator(`#section-icons-${sectionKey}`);

  await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(iconsGrid).toBeVisible();

  await toggleBtn.click();
  await page.waitForTimeout(350); // alpinejs x-collapse

  await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  await expect(iconsGrid).toBeHidden();

  const closedValue = await page.evaluate((key) =>
    localStorage.getItem(`section_state_${key}`)
  , sectionKey);
  expect(closedValue).toBe('false');

  await toggleBtn.click();
  await page.waitForTimeout(350);

  await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(iconsGrid).toBeVisible();

  const openedValue = await page.evaluate((key) =>
    localStorage.getItem(`section_state_${key}`)
  , sectionKey);
  expect(openedValue).toBe('true');

  console.log(`section toggle open/close working for section: '${sectionKey}'`);
});


// MENU ITEMS CLOSE/OPEN
test('menu items collapse/expand individually', async ({ page }) => {
  await navigateToDashboardPage(page);

  // the new sidebar keeps the group of the current page open, so only the others can be toggled
  const groupItems = page.locator(
    '[data-sidebar="menu"] > li[x-data]:has(> button):has(> ul[x-show])'
  ).or(page.locator('.op-nav > li[x-data]:has(> button.op-nav-group:not(.is-active)):has(> ul[x-show])'));

  const count = await groupItems.count();

  console.log(`Found ${count} collapsible sidebar groups`);
  // the new theme's modern menu is a flat list, only its classic menu has groups
  test.skip(count === 0 && (await page.locator('.op-nav').count()) > 0, 'flat menu, no groups to collapse');
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const li = groupItems.nth(i);
    const button = li.locator(':scope > button');
    const submenu = li.locator(':scope > ul[x-show]');

    const label = (await button.innerText())
      .trim()
      .split('\n')[0]
      .trim();

    const isExpanded = async () =>
      await submenu.evaluate(el => getComputedStyle(el).display !== 'none');

    const initialState = await isExpanded();

    console.log(
      `[${label}] initial state: ${initialState ? 'expanded' : 'collapsed'}`
    );

    // First click
    await button.click();

    await expect
      .poll(isExpanded, { timeout: 3000 })
      .toBe(!initialState);

    console.log(
      `[${label}] ${initialState ? 'collapsed' : 'expanded'} ✓`
    );

    // Second click
    await button.click();

    await expect
      .poll(isExpanded, { timeout: 3000 })
      .toBe(initialState);

    console.log(
      `[${label}] returned to original state ✓`
    );
  }

  console.log('All collapsible sidebar groups toggle correctly');
});

