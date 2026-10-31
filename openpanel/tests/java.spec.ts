import { test, expect } from '@playwright/test';
import { deleteApplication, manageSite } from '../site-tabs';
import { ensureDomains, clickInstall, wizardField } from '../helpers';

const DOMAIN = 'java.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

const APP_NAME = 'javaaplikacija';
const PORT = '8080';
const STARTUP_FILE = `/var/www/html/${DOMAIN}/App.java`;
const EXPECTED = 'Hello World from Java';

const APP_CODE = `import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;

public class App {
    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
        server.createContext("/", ex -> {
            byte[] body = ("Hello World from Java " + System.getProperty("java.version") + " on port 8080!").getBytes();
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
    }
}`;

test.describe.configure({ mode: 'serial' });

test.describe('Java autoinstaller', () => {

  test('1. create app file', async ({ page }) => {
    await page.goto(`/file-manager/edit-file/${DOMAIN}/App.java?editor=text&new=true`);
    await page.locator('#editor-text').fill(APP_CODE);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/saved|success/i).first()).toBeVisible();
  });

  test('2. install app', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    await page.goto('/java/install');
    await page.locator('#domain_id').selectOption({ label: DOMAIN });

    await (await wizardField(page, '#service_name')).fill(APP_NAME);
    await (await wizardField(page, '#port')).fill(PORT);
    await (await wizardField(page, '#startup_file')).fill(STARTUP_FILE);
    // single-file app, no pom.xml/Gemfile to install from
    await (await wizardField(page, '#requirements')).uncheck();

    // newest version is preselected once the list loads
    await expect.poll(() => page.locator('#version option').count(), { timeout: 30000 }).toBeGreaterThan(0);

    await clickInstall(page);

    // the new wizard keeps that line in its collapsed install log and says "... is installed" on its done screen
    await expect(page.getByText(/setup completed/i).and(page.locator(':visible')).or(page.locator('.op-iw-page h1', { hasText: /is installed/i })).first()).toBeVisible({ timeout: 4 * 60 * 1000 });
  });

  test('3. verify app appears on /sites', async ({ page }) => {
    await page.goto('/sites');

    const row = page.getByRole('row').filter({ hasText: DOMAIN });
    await expect(row).toBeVisible();

    await manageSite(row);
    await expect(page).toHaveURL(`/website?domain=${DOMAIN}`);
  });

  test('4. verify app is responding', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    await expect(async () => {
      await page.goto(`https://${DOMAIN}/`);
      await expect(page.getByText(EXPECTED)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 150000 });

    console.log('Java autoinstaller is fully working');
  });

  test('5. remove app', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);
    await deleteApplication(page);

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.getByRole('row').filter({ hasText: DOMAIN })).toHaveCount(0);

    console.log('Java app removal is working');
  });

});
