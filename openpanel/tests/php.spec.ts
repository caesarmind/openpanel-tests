import { test, expect, Page } from '@playwright/test';

const domain = 'wp.tests.openpanel.org';

const versions = [ '8.6', '8.5', '8.4', '8.3', '8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0', '5.6' ];

test.setTimeout(3 * 60 * 1000); // 3min in case image not downloaded yet

async function openPhpPage(page: Page) {
  await page.goto('/php/domains');
  await expect(page.locator('table')).toBeVisible();
}

function domainRows(page: Page) {
  return page.locator('tbody tr');
}

test('list versions', async ({ page }) => {
  await openPhpPage(page);

  // header is ok
  await expect(
    page.getByRole('heading', { name: /PHP version for domains/i })
  ).toBeVisible();

  // table is ok
  const headers = page.locator('#php-domains-table thead th');
  await expect(headers).toHaveCount(4);

  // first column is bulk-selection checkbox
  await expect(
    headers.nth(0).getByRole('checkbox', { name: 'Select all' })
  ).toBeVisible();

  await expect(headers.nth(1)).toContainText(/domain/i);
  await expect(headers.nth(2)).toContainText(/current php version/i);
  await expect(headers.nth(3)).toContainText(/change version/i);

  // versions are shown in the table
  const rows = domainRows(page);
  const rowCount = await rows.count();

  if (rowCount === 1) {
    const empty = rows.first();
    const text = await empty.textContent();

    if (text?.includes('No domains')) {
      test.skip();
      return;
    }
  }

  expect(rowCount).toBeGreaterThan(0);

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);

    // 0 = checkbox
    // 1 = domain
    // 2 = current PHP version
    // 3 = change version
    const versionCell = row.locator('td').nth(2);

    // version format is ok
    const text = await versionCell.textContent();
    expect(text?.trim()).toMatch(/\d+\.\d+/);

    // status indicators are ok
    const bars = versionCell.locator('div.flex.gap-0\\.5 > div');
    await expect(bars).toHaveCount(3);
  }

  // summary per version
  const counters = page.locator('dl > div');
  const count = await counters.count();

  if (rowCount > 0) {
    expect(count).toBeGreaterThan(0);
  }
});



test.describe('search filter', () => {
  test('filter table rows', async ({ page }) => {
    await openPhpPage(page);

    const rows = domainRows(page);
    const totalRows = await rows.count();

    if (totalRows < 2) return;

    // 0 = checkbox
    // 1 = domain
    const firstDomainText =
      (await rows.first().locator('td').nth(1).textContent()) ?? '';

    const searchTerm = firstDomainText.trim().split('.')[0];

    await page.locator('input[x-model="searchQuery"]').fill(searchTerm);

    await page.waitForTimeout(300);

    const visibleRows = rows.filter({
      hasNot: page.locator('[style*="display: none"]')
    });

    const visibleCount = await visibleRows.count();

    expect(visibleCount).toBeGreaterThanOrEqual(1);
    expect(visibleCount).toBeLessThanOrEqual(totalRows);
  });

  test('version counter filter', async ({ page }) => {
    await openPhpPage(page);

    const counterLink = page.locator('dl a').first();
    const count = await counterLink.count();

    if (count === 0) return;

    await counterLink.click();

    await page.waitForTimeout(300);

    const searchValue =
      await page.locator('input[x-model="searchQuery"]').inputValue();

    expect(searchValue).toMatch(/\d+\.\d+/);
  });

  test('clear search', async ({ page }) => {
    await openPhpPage(page);

    const rows = domainRows(page);
    const totalRows = await rows.count();

    if (totalRows < 1) return;

    const searchInput = page.locator('input[x-model="searchQuery"]');

    await searchInput.fill('xyznonexistent999');
    await page.waitForTimeout(300);

    await searchInput.fill('');
    await page.waitForTimeout(300);

    const hiddenRows = page.locator(
      'tbody tr[style*="display: none"]'
    );

    await expect(hiddenRows).toHaveCount(0);
  });
});

test.describe('version change', () => {
  let originalVersion: string | null = null;

  async function findDomainRow(page: Page) {
    await page.goto('/php/domains');
    await expect(page.locator('table')).toBeVisible();

    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);

      // 0 = checkbox
      // 1 = domain
      const domainCell = await row.locator('td').nth(1).textContent();

      if (
        domainCell?.trim() &&
        domain.includes(domainCell.trim())
      ) {
        return row;
      }
    }

    return null;
  }

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // remember current version so we can restore after the loop
    const row = await findDomainRow(page);

    if (row) {
      // 0 = checkbox
      // 1 = domain
      // 2 = current PHP version
      originalVersion =
        (await row.locator('td').nth(2).textContent())
          ?.match(/\d+\.\d+/)?.[0] ?? null;

      console.log(`original php version: ${originalVersion}`);
    }

    // Ensure info.php exists
    await page.goto(
      `/file-manager/edit-file/${domain}/info.php?editor=text&new=true`
    );

    await page.locator('#editor-text').fill('<?php phpinfo();');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByText(/saved|success/i).first()
    ).toBeVisible();

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!originalVersion) return;

    const page = await browser.newPage();

    const row = await findDomainRow(page);

    if (row) {
      const current =
        (await row.locator('td').nth(2).textContent())
          ?.match(/\d+\.\d+/)?.[0];

      if (current !== originalVersion) {
        await row
          .locator('select[name="new_php_version"]')
          .selectOption(originalVersion);

        await Promise.all([
          page.waitForResponse(
            res =>
              res.request().method() === 'POST' &&
              res.status() === 200,
            { timeout: 90_000 }
          ),

          row.getByRole('button', { name: /change/i }).click(),
        ]);

        await expect(
          page.getByText(
            new RegExp(
              `updated from ${current} to ${originalVersion}`,
              'i'
            )
          )
        ).toBeVisible();

        console.log(
          `restored php ${originalVersion} for ${domain}`
        );
      }
    }

    await page.close();
  });

  for (const version of versions) {
    test(`php ${version}`, async ({ page }) => {
      test.setTimeout(240_000);

      await openPhpPage(page);

      const rows = domainRows(page);
      const rowCount = await rows.count();

      let targetRow = null;

      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);

        // 0 = checkbox
        // 1 = domain
        const domainCell =
          await row.locator('td').nth(1).textContent();

        if (
          domainCell?.trim() &&
          domain.includes(domainCell.trim())
        ) {
          targetRow = row;
          break;
        }
      }

      if (!targetRow) {
        test.skip(true, 'Domain not found');
        return;
      }

      // 0 = checkbox
      // 1 = domain
      // 2 = current PHP version
      const currentVersion =
        (await targetRow.locator('td').nth(2).textContent())
          ?.match(/\d+\.\d+/)?.[0] ?? 'unknown';

      if (currentVersion === version) {
        test.skip(
          true,
          `domain already on php ${version}`
        );
      }

      const select =
        targetRow.locator('select[name="new_php_version"]');

      // only versions the server actually offers
      const offered = await select.locator('option').evaluateAll(opts => opts.map(o => (o as HTMLOptionElement).value));
      test.skip(!offered.includes(version), `php ${version} not offered on this server`);

      await select.selectOption(version);

      await Promise.all([
        page.waitForResponse(
          res =>
            res.request().method() === 'POST' &&
            res.status() === 200,
          { timeout: 90_000 }
        ),

        targetRow
          .getByRole('button', { name: /change/i })
          .click(),
      ]);

      await expect(
        page.getByText(
          new RegExp(
            `updated from ${currentVersion} to ${version}`,
            'i'
          )
        )
      ).toBeVisible();

      const versionShort =
        version.match(/\d+\.\d+/)?.[0] ?? version;

      await expect(async () => {
        await page.goto(
          `https://${domain}/info.php?nocache=${Date.now()}`
        );

        await expect(page.locator('body')).toContainText(
          `PHP Version ${versionShort}`
        );
      }).toPass({
        // first switch to an older version may pull its php-fpm image
        timeout: 120000,
        intervals: [1000]
      });

      console.log(`php ${versionShort} is working`);

      // ionCube never shipped a loader for php 8.0
      if (versionShort === '8.0') return;

      // ioncube loader is enabled
      await expect(page.getByRole('heading', { level: 2, name: 'ionCube Loader' })).toBeVisible();
      
      await expect(page.getByRole('row', { name: /^Loader version \d+\.\d+/ })).toBeVisible();
      
      console.log(`ioncube is enabled on php ${versionShort}`);
    });
  }
});

test('change default php version', async ({ page }) => {
  await page.goto('/php/default');

  // Page loaded correctly
  await expect(
    page.getByRole('heading', { name: 'Default PHP version' })
  ).toBeVisible();

  const radios = page.locator('input[name="new_php_version"]');

  await expect(radios.first()).toBeVisible();

  // Current default is the checked + disabled radio
  const currentRadio = radios.filter({ has: page.locator(':checked') });
  const oldVersion = await page
    .locator('input[name="new_php_version"]:checked')
    .getAttribute('value');

  if (!oldVersion) {
    throw new Error('Could not determine current default PHP version.');
  }

  console.log(`Starting version: ${oldVersion}`);

  // Get all selectable versions, excluding the current disabled/default one
  const availableVersions = await radios.evaluateAll(inputs =>
    inputs
      .filter(input => !(input as HTMLInputElement).disabled)
      .map(input => (input as HTMLInputElement).value)
      .filter(Boolean)
  );

  if (availableVersions.length === 0) {
    throw new Error('No alternative PHP versions available to select.');
  }

  const randomVersion =
    availableVersions[Math.floor(Math.random() * availableVersions.length)];

  console.log(`Changing default PHP version to: ${randomVersion}`);

  // Submit button changes from:
  // "Choose a PHP version"
  // to:
  // "Set PHP X as default"
  const submitButton = page.getByRole('button', {
    name: new RegExp(`Set PHP ${randomVersion} as default`, 'i')
  });

  // Alpine starting up can reset a radio ticked right after load, so tick until the button follows
  await expect(async () => {
    await page.locator(`input[name="new_php_version"][value="${randomVersion}"]`).check();
    await expect(submitButton).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 15000 });

  await submitButton.click();

  // Verify the selected version became the default
  await expect(
    page.locator(
      `input[name="new_php_version"][value="${randomVersion}"]`
    )
  ).toBeChecked();

  await expect(
    page.locator(
      `input[name="new_php_version"][value="${randomVersion}"]`
    )
  ).toBeDisabled();

  await expect(
    page.locator(
      `input[name="new_php_version"][value="${randomVersion}"]`
    ).locator('xpath=..')
  ).toContainText('Default');

  console.log(
    `Default PHP version switch from ${oldVersion} to ${randomVersion} is working`
  );

  // Restore original default version
  const oldVersionRadio = page.locator(
    `input[name="new_php_version"][value="${oldVersion}"]`
  );

  const restoreButton = page.getByRole('button', {
    name: new RegExp(`Set PHP ${oldVersion} as default`, 'i')
  });

  // the page just reloaded after the switch, same Alpine startup race as above
  await expect(async () => {
    await oldVersionRadio.check();
    await expect(restoreButton).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 15000 });

  await restoreButton.click();

  // Verify original version is default again
  const restoredRadio = page.locator(
    `input[name="new_php_version"][value="${oldVersion}"]`
  );

  await expect(restoredRadio).toBeChecked();
  await expect(restoredRadio).toBeDisabled();

  await expect(
    restoredRadio.locator('xpath=..')
  ).toContainText('Default');

  console.log(`Restored default PHP version to ${oldVersion}`);
});

test('edit php options', async ({ page }) => {
  await page.goto('/php/options');  
  const dropdown = page.locator('#php_version');
  const values = await dropdown.locator('option').evaluateAll(options => 
    options
      .map(opt => opt.value)
      .filter(val => val !== "" && val !== "oldVersionValueHere") 
  );
  
  if (values.length === 0) {
    throw new Error('No alternative PHP versions available to select.');
  }

  const randomVersion = values[Math.floor(Math.random() * values.length)];
  await dropdown.selectOption(randomVersion);
  await page.click('#submit_version');

  const successRegex = new RegExp(`${randomVersion} Options`, 'i');
  await expect(page.getByText(successRegex).first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/php/php${randomVersion}/options`));

  // 1. max_execution_time
  const maxExecTime = page.locator('input[name="max_execution_time"]');
  await maxExecTime.fill('600');

  // 2. disable_functions
  const disableFuncs = page.locator('input[name="disable_functions"]');
  await disableFuncs.fill('passthru,system');

  // 3. post_max_size
  const postMaxSizeContainer = page.locator('div[data-key="post_max_size"]');
  await postMaxSizeContainer.locator('input.numeric-part').fill('2');
  await postMaxSizeContainer.locator('select.unit-part').selectOption('G');
  
  await page.click('#save-changes-button');
  // the panel reloads php-fpm when it can and only restarts it as a fallback
  await expect(page.getByText(/Configuration edited successfully and PHP-FPM (reloaded|service restarted)/i)).toBeVisible();

  await expect(maxExecTime).toHaveValue('600');
  await expect(disableFuncs).toHaveValue('passthru,system');
  await expect(postMaxSizeContainer.locator('input.numeric-part')).toHaveValue('2');
  await expect(postMaxSizeContainer.locator('select.unit-part')).toHaveValue('G');
  
  console.log(`PHP options editor for version ${randomVersion} is working and verified.`);
  // TODO: test on a website and test on page Search to filter table!
});



test('edit php.ini files', async ({ page }) => {
  await page.goto('/php/php_ini_editor');  
  const dropdown = page.locator('#php_version');
  const values = await dropdown.locator('option').evaluateAll(options =>
    options
      .map(opt => opt.value)
      .filter(val => val !== '')
  );

  if (values.length === 0) {
    throw new Error('No PHP versions available to select.');
  }

  const randomVersion = values[Math.floor(Math.random() * values.length)];
  await dropdown.selectOption(randomVersion);
  await page.click('#submit_version');
  await page.waitForURL(new RegExp(`/php/php${randomVersion}\\.ini/editor`));

  const successRegex = new RegExp(`/etc/php/${randomVersion}/fpm/php.ini`, 'i');
  await expect(page.getByText(successRegex)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/php/php${randomVersion}\\.ini/editor`));


  const editorLocator = page.locator('.CodeMirror'); 
  await expect(editorLocator).toBeVisible();

  const updates = {
    'max_input_time': '120',
    'opcache.enable': '1'
  };
  
  await page.evaluate((settings) => {
    const cm = (document.querySelector('.CodeMirror') as any).CodeMirror;
    let content = cm.getValue();
  
    for (const [key, value] of Object.entries(settings)) {
      const escapedKey = key.replace('.', '\\.');
      const regex = new RegExp(`^;?(${escapedKey}\\s*=\\s*).*`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key} = ${value}`);
      } else {
        throw new Error(`Directive "${key}" not found in php.ini`);
      }
    }
    cm.setValue(content);
  }, updates);

  await page.click('#save-changes-button');
  const feedbackRegex = new RegExp(`PHP.INI file for PHP-FPM version ${randomVersion} edited successfully`, 'i');
  await expect(page.getByText(feedbackRegex)).toBeVisible();

  const updatedContent = await page.evaluate(() => {
    return document.querySelector('.CodeMirror').CodeMirror.getValue(); //or just textarea!
  });
  
  expect(updatedContent).toContain('max_input_time = 120');
  expect(updatedContent).toContain('opcache.enable = 1');

  console.log(`PHP.INI editor for version ${randomVersion} is working and verified.`);
  // TODO: test on a website
});
