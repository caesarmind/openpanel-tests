import { test, expect } from '@playwright/test';
import { deleteApplication, manageSite } from '../site-tabs';
import { ensureDomains, clickInstall, wizardField } from '../helpers';

// https://github.com/stefanpejcic/nodejs-helloworld

const DOMAIN = 'nodejs.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

const APP_NAME = 'nodeaplikacija';
const PORT = '3000';
const NODE_VERSION = '25.9.0';
const STARTUP_FILE = `/var/www/html/${DOMAIN}/app.js`;

const PACKAGE_JSON = `{
  "name": "helloworld-node",
  "version": "1.0.0",
  "description": "Simple Node.js Hello World app using Express",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "author": "Stefan Pejcic",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2"
  }
}`;

const APP_JS = `const express = require('express');
const app = express();
const port = 3000;
app.get('/', (req, res) => {
  res.send(\`Hello World from Node.js \${process.version} on port \${port}!\`);
});
app.listen(port, () => {
  console.log(\`Server is running at http://localhost:\${port}\`);
});`;

test.describe.configure({ mode: 'serial' });

test.describe('Node.js autoinstaller', () => {

  test('1. create app files', async ({ page }) => {
    // package.json
    await page.goto(`/file-manager/edit-file/${DOMAIN}/package.json?editor=text&new=true`);
    await page.locator('#editor-text').fill(PACKAGE_JSON);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/saved|success/i).first()).toBeVisible();

    // app.js
    await page.goto(`/file-manager/edit-file/${DOMAIN}/app.js?editor=text&new=true`);
    await page.locator('#editor-text').fill(APP_JS);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/saved|success/i).first()).toBeVisible();
  });

  test('2. install app', async ({ page }) => {
    test.setTimeout(300000);
 
    await page.goto('/nodejs/install');
    await page.locator('#domain_id').selectOption({ label: DOMAIN });

    await (await wizardField(page, '#service_name')).fill(APP_NAME);
    await (await wizardField(page, '#port')).fill(PORT);

    await (await wizardField(page, '#startup_file')).fill(STARTUP_FILE);

    await (await wizardField(page, '#version')).selectOption(NODE_VERSION);

    await clickInstall(page);

    // the new wizard keeps that line in its collapsed install log and says "... is installed" on its done screen
    await expect(page.getByText(/setup completed/i).and(page.locator(':visible')).or(page.locator('.op-iw-page h1', { hasText: /is installed/i })).first()).toBeVisible({ timeout: 120000 });
  });

  test('3. verify app appears on /sites', async ({ page }) => {
    await page.goto('/sites');

    const row = page.getByRole('row').filter({ hasText: DOMAIN });
    await expect(row).toBeVisible();
    await expect(row.getByText(NODE_VERSION)).toBeVisible();
  
    await manageSite(row);
    await expect(page).toHaveURL(`/website?domain=${DOMAIN}`);
  });

  test('4. verify app is responding', async ({ page }) => {
    // polls the site for up to 90s below
    test.setTimeout(3 * 60 * 1000);
    // process.version returns e.g. "v25.9.0", strip the leading "v" if version lacks it
    const nodeVersion = NODE_VERSION.startsWith('v') ? NODE_VERSION : `v${NODE_VERSION}`;
    const expected = `Hello World from Node.js ${nodeVersion} on port ${PORT}!`;
    const url = `https://${DOMAIN}/`;

    await page.goto(url);

    const locator = page.getByText(expected);
    const timeout = 90000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await locator.isVisible()) break;
      await page.waitForTimeout(1000);
      await page.reload();
    }

    await expect(locator).toBeVisible();
    console.log('Node.js autoinstaller is fully working');
  });

  test('5. stop, start and restart app', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);

    // a stopped app makes the proxy hang for a while before 503, so a timeout counts as down
    const siteUp = async () => {
      try {
        const res = await page.request.get(`https://${DOMAIN}/`, { failOnStatusCode: false, timeout: 10000 });
        return res.status() === 200 && (await res.text()).includes('Hello World');
      } catch {
        return false;
      }
    };

    await page.goto(`/website?domain=${DOMAIN}`);
    await page.getByRole('button', { name: /\bStop$/ }).click();
    await expect(page.getByText('Application stopped successfully.')).toBeVisible({ timeout: 60000 });
    await expect.poll(siteUp, { timeout: 60000 }).toBe(false);

    await page.goto(`/website?domain=${DOMAIN}`);
    await page.getByRole('button', { name: /\bStart$/ }).click();
    await expect(page.getByText('Application started successfully.')).toBeVisible({ timeout: 60000 });
    await expect.poll(siteUp, { timeout: 90000 }).toBe(true);

    await page.goto(`/website?domain=${DOMAIN}`);
    await page.locator('#restartButton').click();
    await expect(page.getByText('Application restarted successfully.')).toBeVisible({ timeout: 60000 });
    await expect.poll(siteUp, { timeout: 90000 }).toBe(true);
  });

  test('6. app logs', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);
    // route takes the service name, not the domain
    const res = await page.request.get(`/pm2/logs/${APP_NAME}`);
    expect(res.status()).toBe(200);
    expect((await res.text()).trim().length).toBeGreaterThan(0);
  });

  test('7. remove app', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);
    await deleteApplication(page);

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.getByRole('row').filter({ hasText: DOMAIN })).toHaveCount(0);
  });

});
