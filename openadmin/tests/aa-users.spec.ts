// NOT FINISHED!
import { test, expect } from '@playwright/test';

async function navigateToUsersPage(page: any) {
  await page.goto(`/users`);
  await expect(page).toHaveURL(/users/);
}



test('view users', async ({ page }) => {
  await navigateToUsersPage(page);
  await expect(page.getByText(/create new/i)).toBeVisible();
  console.log('Users page is accessible');
});



test('create user', async ({ page }) => {
  // account provisioning through the UI (home dir, docker container, mail,
  // etc.) is noticeably slower than the CLI equivalent and can occasionally
  // take well over a minute under load -- give it plenty of room.
  test.setTimeout(150_000);

  await page.goto(`/user/new`);
  await expect(page).toHaveURL(/user\/new/);

  await page.fill('[name="admin_username"]', 'testinguser');
  await page.fill('[name="admin_password"]', 'testingpassword');
  await page.fill('[name="admin_email"]', 'stefan@test.rs');

  await page.click('#CreateUserButton');

  const successMessage = page.getByText('user created successfully');
  await expect(successMessage).toBeVisible({ timeout: 120_000 });

  console.log('User created successfully');
});


test('test autologin', async ({ page, context }) => {
  // the inner toPass() below can retry for up to 60s; make sure the test's
  // own timeout doesn't cut that short (default is 30s).
  test.setTimeout(90_000);

  const impersonateLink = page.locator('a[href="/login/token/testinguser"]');

  await expect(async () => {
    await navigateToUsersPage(page);
    await expect(impersonateLink).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });

  const [newTab] = await Promise.all([
    context.waitForEvent('page'),
    impersonateLink.click(),
  ]);

  newTab.on('console', msg => console.log('CONSOLE:', msg.text()));
  newTab.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  newTab.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
  newTab.on('close', () => console.log('TAB CLOSED'));


  await newTab.waitForURL(/dashboard/, { timeout: 20_000, waitUntil: 'load' });

  console.log('URL AFTER NAV:', newTab.url());

  await newTab.waitForLoadState('domcontentloaded');

  await expect(newTab.getByText(/last login ip address/i)).toBeVisible({ timeout: 10_000 });

  console.log('autologin is working');
});


test('open single user', async ({ page }) => {
  await page.goto('/users/testinguser');
  await expect(page).toHaveURL(/\/users\/testinguser/);

  const nav = page.getByRole('navigation', {
    name: 'core navigation links',
  });

  await expect(nav).toBeVisible();

  const expectedItems = [
    'Overview',
    'Services',
    'Storage',
    'Edit',
    'Permissions',
    'Export',
    'Suspend',
    'Delete',
    'Activity Log',
    'Login Log',
  ];

  for (const item of expectedItems) {
    await expect(
      nav.getByText(item, { exact: true })
    ).toHaveCount(1);
  }

  console.log('single user page working');
});

test('test tabs', async ({ page }) => {
  await page.goto('/users/testinguser');
  await expect(page).toHaveURL(/\/users\/testinguser/);

  const nav = page.getByRole('navigation', {
    name: 'core navigation links',
  });

  await expect(nav).toBeVisible();

  // SERVICES
  await nav.getByText('Services', { exact: true }).click();
  await expect(page).toHaveURL(/#services$/);

  const servicesPanel = page.locator('[x-show="activeTab === \'services\'"]');
  await expect(servicesPanel).toBeVisible();

  const expectedServices = ['cpu', 'ram', 'actions'];

  for (const col of expectedServices) {
    await expect(
      servicesPanel.locator(`th[x-show="columns.${col}"]`)
    ).toBeVisible();
  }

  console.log('services tab ok');

  // STORAGE
  await nav.getByText('Storage', { exact: true }).click();
  await expect(page).toHaveURL(/#storage$/);

  const storagePanel = page.locator(
    '[x-show="activeTab === \'storage\'"]'
  );

  await expect(storagePanel).toBeVisible();

  console.log('storage tab ok');

  // OVERVIEW
  await nav.getByText('Overview', { exact: true }).click();
  await expect(page).toHaveURL(/#stats$/);

  const overviewPanel = page.locator(
    '[x-show="activeTab === \'stats\'"]'
  );

  await expect(overviewPanel).toBeVisible();

  // Helper to find an information row by its label.
  function getRow(labelText: string) {
    return overviewPanel.locator('.rounded-lg').filter({
      has: page.locator('span.text-sm', {
        hasText: new RegExp(
          `^\\s*${labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
          'i'
        ),
      }),
    }).first();
  }

  // Extract text while ignoring nested badges/icons.
  async function extractValue(row: any) {
    return row.locator('span.font-medium').first().evaluate(el =>
      Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim() ?? '')
        .filter(Boolean)
        .join('')
        .trim()
    );
  }

  // Values rendered inside a nested badge.
  async function extractBadgeValue(row: any) {
    return (
      await row.locator('span.font-medium span').first().innerText()
    ).trim();
  }

  const fields = [
    {
      label: 'Username:',
      validate: (v: string) => /^[a-z0-9_-]+$/i.test(v),
    },
    {
      label: 'Email address:',
      validate: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    },
    {
      label: 'Locale:',
      validate: (v: string) => v.length > 0,
    },
    {
      label: '2FA status:',
      validate: (v: string) => ['Active', 'Inactive'].includes(v),
      badge: true,
    },
    {
      label: 'User ID (UID):',
      validate: (v: string) => /^\d+$/.test(v),
    },
    {
      label: 'IP address:',
      validate: (v: string) =>
        /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/.test(v),
    },
    {
      label: 'Geo Location:',
      validate: (v: string) => /^[A-Z]{2}$/.test(v),
    },
    {
      label: 'Server:',
      validate: (v: string) => v.length > 0,
    },
    {
      label: 'Docker Context:',
      validate: (v: string) => v.length > 0,
    },
    {
      label: 'Home dir:',
      validate: (v: string) => v.startsWith('/home/'),
    },
    {
      label: 'Web server:',
      validate: (v: string) =>
        ['apache', 'nginx', 'openlitespeed', 'openresty'].includes(
          v.toLowerCase()
        ),
    },
    {
      label: 'Varnish Caching:',
      validate: (v: string) => ['Enabled', 'Disabled'].includes(v),
      badge: true,
    },
    {
      label: 'Database type:',
      validate: (v: string) =>
        ['mariadb', 'mysql'].includes(v.toLowerCase()),
    },
    {
      label: 'Setup time:',
      // Current UI uses ISO timestamps such as:
      // 2026-09-08T12:07:32Z
      validate: (v: string) =>
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v),
    },
  ];

  for (const { label, validate, badge } of fields) {
    const row = getRow(label);

    await expect(row).toBeVisible();

    const value = badge
      ? await extractBadgeValue(row)
      : await extractValue(row);

    if (!validate(value)) {
      throw new Error(
        `Field "${label}" failed validation with value: "${value}"`
      );
    }

    console.log(`  ✓ ${label.padEnd(20)} "${value}"`);
  }

  console.log('overview tab ok');

  // EDIT
  await nav.getByText('Edit', { exact: true }).click();
  await expect(page).toHaveURL(/#edit$/);

  const editPanel = page.locator(
    '[x-show="activeTab === \'edit\'"]'
  );

  await expect(editPanel).toBeVisible();

  const expectedFields = [
    'input[name="new_username"]',
    'input[name="new_email"]',
    'input[name="new_password"]',
    'select[name="new_ip"]',
  ];

  for (const selector of expectedFields) {
    await expect(editPanel.locator(selector)).toBeVisible();
  }

  console.log('edit tab ok');

  // PERMISSIONS
  await nav.getByText('Permissions', { exact: true }).click();
  await expect(page).toHaveURL(/#permissions$/);

  const permissionsPanel = page.locator(
    '[x-show="activeTab === \'permissions\'"]'
  );

  await expect(permissionsPanel).toBeVisible();

  console.log('permissions tab ok');

  // EXPORT
  await nav.getByText('Export', { exact: true }).click();
  await expect(page).toHaveURL(/#export$/);

  const exportPanel = page.locator(
    '[x-show="activeTab === \'export\'"]'
  );

  await expect(exportPanel).toBeVisible();

  console.log('export tab ok');

  // SUSPEND
  await nav.getByText('Suspend', { exact: true }).click();
  await expect(page).toHaveURL(/#suspend$/);

  const suspendPanel = page.locator(
    '[x-show="activeTab === \'suspend\'"]'
  );

  await expect(suspendPanel).toBeVisible();

  await expect(
    suspendPanel.getByText(/suspend user account/i)
  ).toBeVisible();

  const suspendConfirmation = suspendPanel.locator(
    '[x-model="confirmationText"]'
  );

  await expect(suspendConfirmation).toBeVisible();
  await suspendConfirmation.fill('testinguser');

  await expect(
    suspendPanel.getByRole('button', {
      name: /suspend account/i,
    })
  ).toBeVisible();

  console.log('suspend tab ok');

  // DELETE
  await nav.getByText('Delete', { exact: true }).click();
  await expect(page).toHaveURL(/#delete$/);

  const deletePanel = page.locator(
    '[x-show="activeTab === \'delete\'"]'
  );

  await expect(deletePanel).toBeVisible();

  await expect(
    deletePanel.getByText(/delete user account/i)
  ).toBeVisible();

  const deleteConfirmation = deletePanel.locator(
    '[x-model="confirmationText"]'
  );

  await expect(deleteConfirmation).toBeVisible();
  await deleteConfirmation.fill('testinguser');

  await expect(
    deletePanel.getByRole('button', {
      name: /delete account permanently/i,
    })
  ).toBeVisible();

  console.log('delete tab ok');

  // ACTIVITY LOG
  await nav.getByText('Activity Log', { exact: true }).click();
  await expect(page).toHaveURL(/#activity$/);

  const activityPanel = page.locator(
    '[x-show="activeTab === \'activity\'"]'
  );

  await expect(activityPanel).toBeVisible();

  const activityLink = activityPanel.locator(
    'a[href="/json/user-activity/testinguser?raw=true"]'
  );

  await expect(activityLink).toBeVisible();

  console.log('activity tab ok');

  // LOGIN LOG
  await nav.getByText('Login Log', { exact: true }).click();
  await expect(page).toHaveURL(/#logins$/);

  const loginPanel = page.locator(
    '[x-show="activeTab === \'logins\'"]'
  );

  await expect(loginPanel).toBeVisible();

  const loginLogLink = loginPanel.locator(
    'a[href="/json/user-logins/testinguser?raw=true"]'
  );

  await expect(loginLogLink).toBeVisible();

  console.log('login log tab ok');
});


test('toggle columns', async ({ page }) => {
  await navigateToUsersPage(page);

  await page.getByRole('button', { name: 'Show Columns' }).click();

  const rows = page.locator('ul[aria-labelledby="dropdownToggleButton"] li');

  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);

    const checkbox = row.locator('input[type="checkbox"]');

    const xModel = await checkbox.getAttribute('x-model');
    if (!xModel) continue;

    const columnKey = xModel.replace('columns.', '');
    const th = page.locator(`th[x-show="columns.${columnKey}"]`);

    const initialState = await checkbox.isChecked();

    await row.locator('label').click();
    await page.waitForTimeout(100); // needed for alpine.js x-show

    const expectedStateAfterToggle = !initialState;

    if (expectedStateAfterToggle) {
      await expect(th).toBeVisible();
    } else {
      await expect(th).toBeHidden();
    }

    await row.locator('label').click();
    await page.waitForTimeout(100);

    if (initialState) {
      await expect(th).toBeVisible();
    } else {
      await expect(th).toBeHidden();
    }
  }

  console.log('column toggle is working');
});



test('delete user', async ({ page }) => {
  await navigateToUsersPage(page);

  await page.goto('/users/testinguser#delete');
  await expect(page).toHaveURL(/\/users\/testinguser#delete$/);

  await expect(page.getByText('delete user account', { exact: false })).toBeVisible();

  const confirmationInput = page.locator('[x-model="confirmationText"]:visible');

  const deleteButton = page.getByRole('button', {name: /delete account permanently/i,});

  await expect(
  page.getByRole('button', { name: /delete account permanently/i })
).toHaveCount(0); 

  //await expect(deleteButton).toBeDisabled(); nije radio ovaj check pa sam ga zamenio sa ovim iznad

  // https://github.com/stefanpejcic/OpenPanel/issues/948
  await confirmationInput.click();
  await confirmationInput.press('Enter');
  await expect(page).toHaveURL(/\/users\/testinguser#delete$/);
  await expect(page.getByText("User 'testinguser' deleted successfully", {exact: false,})).not.toBeVisible();
  console.log('submit is not working without confirmation (issue #948)');

  // valid deletion
  await confirmationInput.fill('testinguser');
  await expect(deleteButton).toBeEnabled();
  await expect(
  page.getByRole('button', { name: /delete account permanently/i })
).toHaveCount(1);
  await deleteButton.click();
  await expect(page).toHaveURL(/\/users\/?$/);
  await expect(page.getByText("User 'testinguser' deleted successfully", {exact: false,})).toBeVisible();

  const userRows = page.locator('table tbody tr:not([data-cluster-node])');
  await expect(userRows.filter({ hasText: 'testinguser' })).toHaveCount(0);

  console.log('delete user is working');
});



test('recreate user', async ({ page }) => {
  test.setTimeout(150_000);

  await page.goto(`/user/new`);
  await expect(page).toHaveURL(/user\/new/);

  await page.fill('[name="admin_username"]', 'testinguser');
  await page.fill('[name="admin_password"]', 'testingpassword');
  await page.fill('[name="admin_email"]', 'stefan@test.rs');

  await page.click('#CreateUserButton');

  const successMessage = page.getByText('user created successfully');
  await expect(successMessage).toBeVisible({ timeout: 120_000 });

  console.log('User recreated successfully');
});
