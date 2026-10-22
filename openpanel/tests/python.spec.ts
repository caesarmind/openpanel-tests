import { test, expect } from '@playwright/test';
import { openSiteTab } from '../site-tabs';
import { ensureDomains } from '../helpers';

// https://github.com/stefanpejcic/python-helloworld

const DOMAIN = 'python.tests.openpanel.org';

test.beforeAll(async ({ browser }, testInfo) => {
  await ensureDomains(browser, testInfo, DOMAIN);
});

const APP_NAME = 'pythonaplikacija';
const PORT = '5000';
const STARTUP_FILE = `/var/www/html/${DOMAIN}/app.py`;

const REQUIREMENTS_TXT = `Flask==2.3.3`;

const APP_PY = `from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello():
    return "Hello World from Flask on port 5000!"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)`;

let pythonVersion: string;

test.describe.configure({ mode: 'serial' });

test.describe('Python autoinstaller', () => {
  test('1. create app files', async ({ page }) => {
    // requirements.txt
    await page.goto(
      `/file-manager/edit-file/${DOMAIN}/requirements.txt?editor=text&new=true`
    );

    await page.locator('#editor-text').fill(REQUIREMENTS_TXT);

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByText(/saved|success/i).first()
    ).toBeVisible();

    // app.py
    await page.goto(
      `/file-manager/edit-file/${DOMAIN}/app.py?editor=text&new=true`
    );

    await page.locator('#editor-text').fill(APP_PY);

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByText(/saved|success/i).first()
    ).toBeVisible();
  });

  test('2. install app', async ({ page }) => {
    test.setTimeout(300000);

    await page.goto('/python/install');

    await page.locator('#service_name').fill(APP_NAME);
    await page.locator('#port').fill(PORT);

    await page.locator('#domain_id').selectOption({
      label: DOMAIN,
    });

    await page.locator('#startup_file').fill(STARTUP_FILE);

    const versionSelect = page.locator('#version');

    // Wait for Python versions to be populated dynamically.
    await expect
      .poll(
        async () => {
          return await versionSelect.locator('option').count();
        },
        {
          timeout: 30000,
          message: 'Waiting for Python versions to load',
        }
      )
      .toBeGreaterThan(0);

    // Get all available versions.
    const versions = await versionSelect
      .locator('option')
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter((value) => /^\d+\.\d+\.\d+$/.test(value))
      );

    expect(versions.length).toBeGreaterThan(0);

    // Sort versions numerically, newest first.
    versions.sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);

      for (
        let i = 0;
        i < Math.max(aParts.length, bParts.length);
        i++
      ) {
        const difference =
          (bParts[i] ?? 0) - (aParts[i] ?? 0);

        if (difference !== 0) {
          return difference;
        }
      }

      return 0;
    });

    pythonVersion = versions[0];

    console.log(
      `Newest available Python version: ${pythonVersion}`
    );

    await versionSelect.selectOption(pythonVersion);

    await expect(versionSelect).toHaveValue(pythonVersion);

    console.log(
      `Installing application with Python ${pythonVersion}`
    );

    await page.locator('#installButton').click();

    await expect(page.getByText(/setup completed/i)).toBeVisible({timeout: 120000,});
  });

  test('3. verify app appears on /sites', async ({ page }) => {
    await page.goto('/sites');

    const row = page
      .getByRole('row')
      .filter({ hasText: DOMAIN });

    await expect(row).toBeVisible();

    await expect(
      row.getByText(pythonVersion)
    ).toBeVisible();

    await row
      .getByRole('link', {
        name: 'Manage',
        exact: true,
      })
      .click();

    await expect(page).toHaveURL(
      `/website?domain=${DOMAIN}`
    );
  });

  test('4. verify app is responding', async ({ page }) => {
    // polls the site for up to 90s below
    test.setTimeout(3 * 60 * 1000);
    const expected = `Hello World from Flask on port ${PORT}!`;
    const url = `https://${DOMAIN}/`;

    await page.goto(url);

    const locator = page.getByText(expected);

    const timeout = 90000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await locator.isVisible()) {
        break;
      }

      await page.waitForTimeout(1000);
      await page.reload();
    }

    await expect(locator).toBeVisible();

    console.log(
      `Python autoinstaller is fully working with Python ${pythonVersion}`
    );
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
    await openSiteTab(page, 'remove');

    await page.getByRole('button', { name: 'Delete Application' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await page.waitForURL('/sites', { timeout: 60000 });
    await expect(page.getByRole('row').filter({ hasText: DOMAIN })).toHaveCount(0);
  });
});
