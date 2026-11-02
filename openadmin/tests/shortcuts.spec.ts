import { test, expect, request as playwrightRequest } from '@playwright/test';

test('all keyboard shortcuts work correctly', async ({ page }) => {
  const apiContext = await playwrightRequest.newContext({
    storageState: await page.context().storageState(),
  });
  const response = await apiContext.get(`/shortcuts.json`);
  const shortcuts = await response.json();

  const parseShortcut = (shortcut: string) =>
    shortcut
      .replace(/ctrl/g, 'Control')
      .replace(/shift/g, 'Shift')
      .replace(/escape/g, 'Escape')
      .split('+')
      .map(k => (k.length === 1 ? k.toLowerCase() : k))
      .join('+');

  let logoutCombo: string | null = null;

  for (const [combo, path] of Object.entries(shortcuts) as [string, string][]) {
    if (path === '/logout') {
      logoutCombo = combo;
      continue;
    }
    // the shortcuts load after the page does, wait for them before pressing
    await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/shortcuts.json')),
      page.goto(`/dashboard`),
    ]);
    await expect(page).toHaveURL(/dashboard/);
    await page.waitForTimeout(200);
    await page.locator('body').click();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }),
      page.keyboard.press(parseShortcut(combo)),
    ]);
    expect(page.url()).toContain(path);
    console.log(`${combo} → ${path} loaded successfully`);
  }

  if (logoutCombo) {
    await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/shortcuts.json')),
      page.goto(`/dashboard`),
    ]);
    await page.waitForTimeout(200);
    await page.locator('body').click();
    await Promise.all([
      page.waitForURL(/login/, { timeout: 3000 }),
      page.keyboard.press(parseShortcut(logoutCombo)),
    ]);
    await expect(page).toHaveURL(/login/);
    console.log(`${logoutCombo} → /logout redirected to login`);
  }
});
