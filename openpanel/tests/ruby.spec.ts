import { test, expect } from '@playwright/test';
import { openSiteTab } from '../site-tabs';
import { ensureDomains } from '../helpers';

const DOMAIN = 'ruby.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

const APP_NAME = 'rubyaplikacija';
const PORT = '4567';
const STARTUP_FILE = `/var/www/html/${DOMAIN}/app.rb`;
const EXPECTED = 'Hello World from Ruby on port 4567!';

const APP_CODE = `require 'socket'

server = TCPServer.new('0.0.0.0', 4567)
loop do
  client = server.accept
  client.gets
  body = "Hello World from Ruby on port 4567!"
  client.print "HTTP/1.1 200 OK\\r\\nContent-Type: text/plain\\r\\nContent-Length: #{body.bytesize}\\r\\nConnection: close\\r\\n\\r\\n#{body}"
  client.close
end`;

test.describe.configure({ mode: 'serial' });

test.describe('Ruby autoinstaller', () => {

  test('1. create app file', async ({ page }) => {
    // the editor refuses .rb (not in filemanager_edit_extensions on older configs), so upload it like the upload form does
    await page.goto(`/file-manager/upload?path=${DOMAIN}`);
    const status = await page.evaluate(async ({ dir, code }) => {
      const fd = new FormData();
      fd.append('path_param', dir);
      fd.append('files', new Blob([code], { type: 'text/plain' }), 'app.rb');
      const token = (document.querySelector('input[name="csrf_token"]') as HTMLInputElement)?.value || (window as any).csrf_token;
      const res = await fetch('/file-manager/upload', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': token } });
      return res.status;
    }, { dir: DOMAIN, code: APP_CODE });
    expect(status).toBe(200);

    await page.goto(`/files/${DOMAIN}`);
    await expect(page.locator('#filemanager_table tbody tr[data-file="app.rb"]')).toBeVisible();
  });

  test('2. install app', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    await page.goto('/ruby/install');

    await page.locator('#service_name').fill(APP_NAME);
    await page.locator('#port').fill(PORT);
    await page.locator('#domain_id').selectOption({ label: DOMAIN });
    await page.locator('#startup_file').fill(STARTUP_FILE);
    // single-file app, no pom.xml/Gemfile to install from
    await page.locator('#requirements').uncheck();

    // newest version is preselected once the list loads
    await expect.poll(() => page.locator('#version option').count(), { timeout: 30000 }).toBeGreaterThan(0);

    await page.locator('#installButton').click();

    await expect(page.getByText(/setup completed/i)).toBeVisible({ timeout: 4 * 60 * 1000 });
  });

  test('3. verify app appears on /sites', async ({ page }) => {
    await page.goto('/sites');

    const row = page.getByRole('row').filter({ hasText: DOMAIN });
    await expect(row).toBeVisible();

    await row.getByRole('link', { name: 'Manage', exact: true }).click();
    await expect(page).toHaveURL(`/website?domain=${DOMAIN}`);
  });

  test('4. verify app is responding', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    await expect(async () => {
      await page.goto(`https://${DOMAIN}/`);
      await expect(page.getByText(EXPECTED)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 150000 });

    console.log('Ruby autoinstaller is fully working');
  });

  test('5. remove app', async ({ page }) => {
    await page.goto(`/website?domain=${DOMAIN}`);
    await openSiteTab(page, 'remove');

    await page.getByRole('button', { name: 'Delete Application' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.getByRole('row').filter({ hasText: DOMAIN })).toHaveCount(0);

    console.log('Ruby app removal is working');
  });

});
