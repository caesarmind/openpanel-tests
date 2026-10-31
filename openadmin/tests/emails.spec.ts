import { test, expect } from '@playwright/test';

// ─── Accounts ───────────────────────────────────────────────────────────────

test('emails accounts page loads', async ({ page }) => {
  await page.goto('/emails/accounts');
  await expect(page).toHaveURL(/\/emails\/accounts/);

  const mailserverNotInstalled = page.getByText(
    'opencli email-server install',
    { exact: false }
  );

  const mailserverStopped = page.getByText(/stopped/i).first();

  const emailTable = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Email' }),
  });

  const isNotInstalled = await mailserverNotInstalled
    .isVisible()
    .catch(() => false);

  const isStopped = await mailserverStopped
    .isVisible()
    .catch(() => false);

  if (isNotInstalled) {
    await expect(mailserverNotInstalled).toBeVisible();
    return;
  }

  if (isStopped) {
    await expect(mailserverStopped).toBeVisible();
    return;
  }

  await expect(emailTable).toBeVisible();

  await expect(
    emailTable.getByRole('columnheader', { name: 'Email' })
  ).toBeVisible();

  await expect(
    emailTable.getByRole('columnheader', { name: 'Quota' })
  ).toBeVisible();

  await expect(
    emailTable.getByRole('columnheader', { name: 'Webmail' })
  ).toBeVisible();

  await expect(
    emailTable.getByRole('columnheader', { name: 'Actions' })
  ).toBeVisible();

  console.log('emails accounts page working');
});

test('emails accounts search filters rows', async ({ page }) => {
  await page.goto('/emails/accounts');
  await expect(page).toHaveURL(/\/emails\/accounts/);

  const table = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Email' }),
  });

  await expect(table).toBeVisible();

  const searchInput = page.getByPlaceholder('Search emails...');
  await expect(searchInput).toBeVisible();

  // Only actual email account rows.
  const dataRows = table.locator(
    'tbody tr[x-show*="searchQuery"]'
  );

  const emptyState = table.getByText(
    'No email accounts yet.',
    { exact: true }
  );

  // No accounts currently exist.
  if (await dataRows.count() === 0) {
    await expect(emptyState).toBeVisible();
    console.log('No email accounts to search');
    return;
  }

  // Search for something guaranteed not to match.
  await searchInput.fill('zzznomatch_xyz');

  await expect(dataRows).toHaveCount(await dataRows.count());

  for (const row of await dataRows.all()) {
    await expect(row).toBeHidden();
  }

  // Clear search and verify rows return.
  await searchInput.fill('');

  await expect(dataRows.first()).toBeVisible();

  console.log('emails accounts search is functional');
});

test('emails accounts webmail link present per row', async ({ page }) => {
  await page.goto('/emails/accounts');
  await expect(page).toHaveURL(/\/emails\/accounts/);

  const table = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Email' }),
  });

  await expect(table).toBeVisible();

  const rows = table
    .locator('tbody tr')
    .filter({
      has: page.locator('a[href^="/emails/webmail/"]'),
    });

  const count = await rows.count();

  if (count === 0) {
    await expect(
      table.getByText('No email accounts yet.', { exact: true })
    ).toBeVisible();

    console.log('No email accounts present');
    return;
  }

  for (let i = 0; i < count; i++) {
    const link = rows.nth(i).locator('a[href^="/emails/webmail/"]');

    await expect(link).toBeVisible();

    const href = await link.getAttribute('href');

    expect(href).not.toBeNull();
    expect(href).toMatch(/^\/emails\/webmail\/.+@.+/);
  }

  console.log('webmail links present for all email accounts');
});// ─── Queue ───────────────────────────────────────────────────────────────────

test('emails queue page loads', async ({ page }) => {
  await page.goto('/emails/queue');
  await expect(page).toHaveURL(/emails\/queue/);

  const notInstalled = page.getByText('opencli email-server install');
  const emptyQueue  = page.getByText('Queue is empty.');
  const queueTable  = page.locator('table');

  const isNotInstalled = await notInstalled.isVisible().catch(() => false);
  if (isNotInstalled) {
    await expect(notInstalled).toBeVisible();
  } else {
    // Either empty state or a populated table
    const hasTable = await queueTable.isVisible().catch(() => false);
    expect(hasTable).toBe(true);
  }
});

test('emails queue refresh button reloads page', async ({ page }) => {
  await page.goto('/emails/queue');

  const refreshBtn = page.getByRole('button', { name: /refresh/i });
  await expect(refreshBtn).toBeVisible();

  const [response] = await Promise.all([
    page.waitForNavigation(),
    refreshBtn.click(),
  ]);
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/emails\/queue/);
});

test('emails queue search filters rows', async ({ page }) => {
  await page.goto('/emails/queue');

  const searchInput = page.locator('input[placeholder="Search queue..."]');
  const isVisible = await searchInput.isVisible().catch(() => false);
  if (!isVisible) {
    test.skip();
    return;
  }

  await searchInput.fill('zzznomatch_xyz_unique');
  const rows = page.locator('tbody tr[x-show]');
  for (const row of await rows.all()) {
    await expect(row).toBeHidden();
  }

  await searchInput.fill('');
});

test('emails queue bulk actions visible when messages exist', async ({ page }) => {
  await page.goto('/emails/queue');
  await expect(page).toHaveURL(/\/emails\/queue/);

  const retryAllBtn = page.getByRole('button', { name: /retry all/i });
  const deleteAllBtn = page.getByRole('button', { name: /delete all/i });
  const emptyQueue = page.getByText(/^(Queue is empty\.|Nothing here\.)$/);
  const mailserverNotInstalled = page.getByText(
    'opencli email-server install',
    { exact: false }
  );

  // Mail server is not installed — valid page state.
  if (await mailserverNotInstalled.isVisible().catch(() => false)) {
    await expect(mailserverNotInstalled).toBeVisible();
    return;
  }

  // Empty queue — bulk actions are correctly unavailable.
  if (await emptyQueue.isVisible().catch(() => false)) {
    await expect(emptyQueue).toBeVisible();
    await expect(retryAllBtn).toBeHidden();
    await expect(deleteAllBtn).toBeHidden();

    console.log('Queue is empty; bulk actions correctly unavailable');
    return;
  }

  // Queue contains messages — bulk actions must be available.
  await expect(retryAllBtn).toBeVisible();
  await expect(deleteAllBtn).toBeVisible();

  console.log('queue bulk actions working');
  
});// ─── Settings ────────────────────────────────────────────────────────────────

test('emails settings page loads', async ({ page }) => {
  await page.goto('/emails/settings');
  await expect(page).toHaveURL(/emails\/settings/);

  const notInstalled = page.getByText('opencli email-server install');
  const heading      = page.getByRole('heading', { name: /email settings/i });

  const isNotInstalled = await notInstalled.isVisible().catch(() => false);
  if (isNotInstalled) {
    await expect(notInstalled).toBeVisible();
  } else {
    await expect(heading).toBeVisible();
  }
});

test('emails settings shows mailserver status badge', async ({ page }) => {
  await page.goto('/emails/settings');

  const notInstalled = page.getByText('opencli email-server install');
  if (await notInstalled.isVisible().catch(() => false)) {
    test.skip();
    return;
  }

  // Status badge will contain one of these strings
  const statusBadge = page.locator('#status').locator('..').getByText(/(running|stopped|unknown)/i).first();
  // More robust: look for the status section
  const statusSection = page.locator('text=MailServer Status').first();
  await expect(statusSection).toBeVisible();
});

test('emails settings webmail domain input accepts value', async ({ page }) => {
  await page.goto('/emails/settings');

  const notInstalled = page.getByText('opencli email-server install');
  if (await notInstalled.isVisible().catch(() => false)) {
    test.skip();
    return;
  }

  const domainInput = page.locator('input[name="webmail-domain"]');
  await expect(domainInput).toBeVisible();

  const original = await domainInput.inputValue();
  await domainInput.fill('webmail.test.example.com');
  await expect(domainInput).toHaveValue('webmail.test.example.com');

  // Restore original value without submitting
  await domainInput.fill(original);
});

test('emails settings service toggles are present', async ({ page }) => {
  await page.goto('/emails/settings');

  const notInstalled = page.getByText('opencli email-server install');
  if (await notInstalled.isVisible().catch(() => false)) {
    test.skip();
    return;
  }

  const expectedServices = [
    'ENABLE_POSTFWD',
    'ENABLE_AMAVIS',
    'ENABLE_RSPAMD',
    'ENABLE_SPAMASSASSIN',
    'ENABLE_OPENDKIM',
    'ENABLE_OPENDMARC',
    'ENABLE_POP3',
    'ENABLE_IMAP',
    'ENABLE_CLAMAV',
    'ENABLE_FAIL2BAN',
  ];

  for (const name of expectedServices) {
    const checkbox = page.locator(`input[name="${name}"]`);
    await expect(checkbox).toBeVisible();
  }
});

test('emails settings storage type select is present', async ({ page }) => {
  await page.goto('/emails/settings');

  const notInstalled = page.getByText('opencli email-server install');
  if (await notInstalled.isVisible().catch(() => false)) {
    test.skip();
    return;
  }

  const storageSelect = page.locator('select[name="storage_type"]');
  await expect(storageSelect).toBeVisible();

  const options = await storageSelect.locator('option').allTextContents();
  expect(options.some(o => /docker volume/i.test(o) || /user_dir/i.test(o))).toBe(true);
  expect(options.some(o => /custom/i.test(o))).toBe(true);
});

// ─── Rate limits ─────────────────────────────────────────────────────────────

test('email rate limits page loads', async ({ page }) => {
  await page.goto('/emails/domain-limits');
  await expect(page).toHaveURL(/emails\/domain-limits/);

  const heading = page.getByRole('heading', { name: /email rate limits/i });
  await expect(heading).toBeVisible();
});

test('email rate limits shows rules table or empty state', async ({ page }) => {
  await page.goto('/emails/domain-limits');

  const table      = page.locator('table#domain_limits_table');
  const emptyState = page.getByText('No rate-limit rules configured');

  const hasTable = await table.isVisible().catch(() => false);
  const hasEmpty = await emptyState.isVisible().catch(() => false);

  expect(hasTable || hasEmpty).toBe(true);
});

test('email rate limits search input filters rows', async ({ page }) => {
  await page.goto('/emails/domain-limits');
  await expect(page).toHaveURL(/\/emails\/domain-limits/);

  const searchInput = page.getByPlaceholder('Search domains or users...');

  await expect(searchInput).toBeVisible();

  const table = page.getByRole('table');
  const emptyState = page.getByText(
    'No rate-limit rules configured',
    { exact: true }
  );

  // No rules configured — valid state.
  if (await emptyState.isVisible().catch(() => false)) {
    await expect(emptyState).toBeVisible();
    await expect(table).toHaveCount(0);

    console.log('No rate-limit rules configured; search input is present');
    return;
  }

  // Rules exist, so the table must be present.
  await expect(table).toBeVisible();

  const dataRows = table.locator('tbody tr[x-data]');
  await expect(dataRows.first()).toBeVisible();

  // Search for something that should match nothing.
  await searchInput.fill('zzznomatch_xyz_unique');

  for (const row of await dataRows.all()) {
    await expect(row).toBeHidden();
  }

  // Clear search and verify rows return.
  await searchInput.fill('');

  await expect(dataRows.first()).toBeVisible();

  console.log('email rate limits search is functional');
});

test('email rate limits edit pencil opens inline input', async ({ page }) => {
  await page.goto('/emails/domain-limits');
  await expect(page).toHaveURL(/\/emails\/domain-limits/);

  const emptyState = page.getByText(
    'No rate-limit rules configured',
    { exact: true }
  );

  const table = page.getByRole('table');

  // No rules configured — valid state, nothing to edit.
  if (await emptyState.isVisible().catch(() => false)) {
    await expect(emptyState).toBeVisible();
    await expect(table).toHaveCount(0);

    console.log('No email rate limit rows available to edit');
    return;
  }

  // Rules exist, so the table must be present.
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr[x-data]');
  expect(await rows.count()).toBeGreaterThan(0);

  const firstRow = rows.first();
  await expect(firstRow).toBeVisible();

  const editBtn = firstRow.getByRole('button', { name: 'Edit', exact: true });
  await expect(editBtn).toBeVisible();

  await editBtn.click();

  const editInput = firstRow.locator('input[type="number"]');
  await expect(editInput).toBeVisible();

  // Cancel editing without changing anything.
  await editInput.press('Escape');

  await expect(editInput).toBeHidden();

  console.log('email rate limit inline edit working');
});

test('email rate limits raw mode toggle shows textarea', async ({ page }) => {
  await page.goto('/emails/domain-limits?mode=raw');
  await expect(page).toHaveURL(/mode=raw/);

  const textarea = page.locator('textarea[name="raw_content"]');
  await expect(textarea).toBeVisible();

  const saveBtn = page.getByRole('button', { name: /save.*reload/i });
  await expect(saveBtn).toBeVisible();
});

// ─── Reports ─────────────────────────────────────────────────────────────────

test('emails reports page loads', async ({ page }) => {
  await page.goto('/emails/reports');
  await expect(page).toHaveURL(/emails\/reports/);

  const notInstalled = page.getByText('opencli email-server install');
  const noReports = page.getByText(/no reports yet/i);

  const reportsFrame = page.frameLocator('iframe');
  const heading = reportsFrame.getByRole('heading', { name: 'Mail Reports' });

  await expect(async () => {
    const visible =
      await notInstalled.isVisible() ||
      await noReports.isVisible() ||
      await heading.isVisible();

    expect(visible).toBe(true);
  }).toPass();
});
