import { test as setup, expect } from '@playwright/test';
import { AUTH_FILE, AUTH_FILE_MODERN, SUITE_DOMAINS, addDomain, hasDomain, saveLogin, withLock } from './helpers';

// one login per menu style, so a spec that logs out or ends sessions in one project can't log out the other
setup('authenticate', async ({ browser }, testInfo) => {
  if (!process.env.BASE_URL || !process.env.PANEL_USERNAME || !process.env.PANEL_PASSWORD) {
    throw new Error('BASE_URL, USERNAME and PASSWORD must be set in .env');
  }

  // setup logs in for tests + serial (modern), setup-classic for tests-classic + serial-classic
  const style = testInfo.project.metadata.menuStyle === 'classic' ? 'classic' : 'modern';
  const file = style === 'classic' ? AUTH_FILE : AUTH_FILE_MODERN;
  await saveLogin(browser, style, file);

  // all domains up front, an add during the parallel run would restart services under other specs (see SUITE_DOMAINS)
  setup.setTimeout(30 * 60_000);
  const context = await browser.newContext({ ...testInfo.project.use, storageState: file } as any);
  const page = await context.newPage();
  let added = false;
  for (const domain of SUITE_DOMAINS) {
    await withLock('domains', async () => {
      if (await hasDomain(page, domain)) return;
      await addDomain(page, domain);
      added = true;
    });
  }
  // php-fpm and the mailserver are recreated in the background after an add, let them come back first
  if (added) {
    await expect.poll(async () => {
      const res = await page.request.get(`https://${SUITE_DOMAINS[0]}/`, { failOnStatusCode: false, timeout: 10_000 }).catch(() => null);
      return res ? res.status() < 500 : false;
    }, { timeout: 3 * 60_000, intervals: [5000] }).toBe(true);
    await page.waitForTimeout(15_000);
  }
  await context.close();
});
