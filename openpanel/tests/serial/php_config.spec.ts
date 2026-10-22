import { test, expect } from '@playwright/test';

// changing the default version, php options and php.ini reload or restart php-fpm and change what new
// domains get, which would break app installs running next to it, so these run in the serial project

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
