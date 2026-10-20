import { test, expect } from '@playwright/test';

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

const suffix = process.env.TEST_RUN_ID || randomSuffix();
const FILE_NAME = `radovanfajl_${suffix}.txt`;
const FOLDER_NAME = `radovanfolder_${suffix}`;
const TXT_FILE = `petarfajl_${suffix}.txt`;
const TXT_FILE_BAK = `petarfajl_${suffix}.txt_bak`;
const ZIP_FILE = `radozip_${suffix}.txt`;
const ZIP_FOLDER = `radofol_${suffix}`;
const ZIP_ARCHIVE = `/rasizip_${suffix}`;
const ZIP_ARCHIVE_NAME = `rasizip_${suffix}.zip`;

// Subdirectory used for tests that need cleanup, to avoid deleting docroots
const TEST_SUBDIR = `test_subdir_${suffix}`;
const TEST_FILE = `test_file_${suffix}.txt`;
const TEST_DIR = `test_dir_${suffix}`;


async function navigateToFiles(page: any) {
  await page.goto(`/files`);
}

async function navigateToSubdir(page: any) {
  	await page.goto(`/files/${TEST_SUBDIR}`);
}

async function enableOwnerColumn(page: any) {
  const toggleBtn = page.locator('#dropdownToggleButton');
  const panel = page.locator('#dropdownToggle');

  await toggleBtn.waitFor({ state: 'visible' });

  await expect(async () => {
    if (await panel.isVisible()) return;
    await toggleBtn.click();
    await expect(panel).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  const ownerToggle = panel.locator('label', { hasText: 'Owner' });
  await ownerToggle.waitFor({ state: 'visible' });

  const isChecked = await ownerToggle.locator('input').isChecked();
  if (!isChecked) await ownerToggle.click();

  await toggleBtn.click();
  await expect(panel).toBeHidden({ timeout: 5000 }).catch(() => {});
}

// https://github.com/stefanpejcic/OpenPanel/issues/976
async function verifyOwnerUids(page: any) {
    await enableOwnerColumn(page);
    const ownerCells = page.locator('#filemanager_table .owner-cell');
    const count = await ownerCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
        const text = (await ownerCells.nth(i).textContent())?.trim();
        if (!text) continue;
        const uid = parseInt(text, 10);
        expect(uid).toBeGreaterThanOrEqual(1000);
    }
}


async function createFileInRoot(page: any, fileName: string, openAfterCreate = false) {
  await navigateToFiles(page);
  await page.getByRole('button', { name: ' New File' }).click();
  await expect(page.locator('#newfiDrawer')).toBeVisible();
  await page.locator('#newfiDrawer #filename').fill(fileName);
  if (openAfterCreate) {
    await page.locator('#open').check();
  }
  await page.locator('#newfiDrawer button[type=submit]').click();
}

async function createFile(page: any, fileName: string, openAfterCreate = false) {
  await page.getByRole('button', { name: ' New File' }).click();
  await expect(page.locator('#newfiDrawer')).toBeVisible();
  await page.locator('#newfiDrawer #filename').fill(fileName);
  if (openAfterCreate) {
    await page.locator('#open').check();
  }
  await page.locator('#newfiDrawer button[type=submit]').click();
}


async function createFolderInRoot(page: any, folderName: string) {
  await navigateToFiles(page);
  await page.getByRole('button', { name: ' New Folder' }).click();
  await page.locator('#foldername').fill(folderName);
  await page.locator('#newfoDrawer button[type=submit]').click();
}

async function createFolder(page: any, folderName: string) {
  await page.getByRole('button', { name: ' New Folder' }).click();
  await page.locator('#foldername').fill(folderName);
  await page.locator('#newfoDrawer button[type=submit]').click();
}

async function selectItem(page: any, name: string, multiSelect = false) {
  const row = page.locator('#filemanager_table tbody tr[data-file]').filter({
    has: page.locator('td:first-child').getByText(name, { exact: true }),
  });
  await expect(row).toBeVisible();
  await row.click(multiSelect ? { modifiers: ['ControlOrMeta'] } : {});
}



async function deleteSelected(page: any, skipTrash = false) {
  // Open inline delete confirmation
  await page.locator('#deleteButton').click();

  // Find the active inline delete editor
  const deleteEditor = page.locator('.fm-inline-editor')
    .filter({ has: page.locator('button[data-act="save"]') });

  await expect(deleteEditor).toBeVisible();

  // Enable permanent deletion if requested
  const skipTrashCheckbox = deleteEditor.locator('.fm-inline-skip-trash');

  if (skipTrash) {
    await skipTrashCheckbox.check();
  } else {
    await expect(skipTrashCheckbox).not.toBeChecked();
  }

  // Confirm deletion (works for single or multiple items)
  await deleteEditor.locator('button[data-act="save"]').click();
}

// Cleanup scoped to TEST_SUBDIR only, to avoid deleting docroots

async function cleanupSubdir(page: any) {
  // Create test subdirectory
  await createFolderInRoot(page, TEST_SUBDIR);

  // Navigate into test subdirectory
  await navigateToSubdir(page);

  // Create test file and folder
  await createFile(page, TEST_FILE);
  await createFolder(page, TEST_DIR);

  // Verify both items exist
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${TEST_FILE}"]`)
  ).toBeVisible();

  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${TEST_DIR}"]`)
  ).toBeVisible();

  // Select all items inside test subdirectory
  await page.locator('#SelectAll-button').click();

  // Permanently delete selected items (skip Trash)
  await deleteSelected(page, true);

  // Verify directory is empty
  await expect(
    page.locator('#filemanager_table tbody tr[data-file]')
  ).toHaveCount(0);

  console.log('Test subdirectory cleaned up successfully');
}
// TODO: test toggle column names makes them visible in the table
	
// TODO: test for folder search and file search
	
// TODO: copy path button test
	
// TODO: looooong breadcrumbs test
	
// TODO: test upload drag and drop
	
// TODO: test upload multiple files
	


test('create file', async ({ page }) => {
  await navigateToFiles(page);

  await createFileInRoot(page, FILE_NAME);
  await expect(page.locator('body')).toContainText(/File created successfully/i);
  await expect(page.locator('body')).toContainText(new RegExp(FILE_NAME, 'i'));
	await verifyOwnerUids(page);
  console.log('File created successfully');
});

test('create folder', async ({ page }) => {
  await navigateToFiles(page);

  await createFolderInRoot(page, FOLDER_NAME);
  await expect(page.locator('body')).toContainText(/Folder created successfully/i);
  await expect(page.locator('body')).toContainText(new RegExp(FOLDER_NAME, 'i'));
  await verifyOwnerUids(page);
  console.log('Folder created successfully');
});



test('copy file to folder', async ({ page }) => {
  await navigateToFiles(page);

  // Select file
  await selectItem(page, FILE_NAME);

  // Open copy dialog
  await page.locator('#copyButton').click();

  // Select destination folder using the new folder picker
  await page.locator('#fmPickerList')
    .locator('button[data-path]', { hasText: FOLDER_NAME })
    .click();

  // Verify destination
  await expect(page.locator('#fmPickerDest'))
    .toHaveValue(`/${FOLDER_NAME}`);

  // Confirm copy
  await page.locator('#fmPickerConfirm').click();

  // Verify file was copied successfully
  await expect(page.locator('body'))
    .toContainText(/Done! Reloading.../i);

  // Navigate to destination folder
  await page.goto(`/files/${FOLDER_NAME}`);

  // Verify copied file exists inside folder
  await expect(page.locator(`[data-file="${FILE_NAME}"]`))
    .toBeVisible();

  console.log('File copied into folder successfully');
});




test('move file', async ({ page }) => {
  await navigateToFiles(page);

  // Open destination folder
  await page.locator(
    `#filemanager_table tbody tr[data-file="${FOLDER_NAME}"] td:first-child a`
  ).click();

  await expect(page).toHaveURL(/files\/radovanfolder/);

  // Verify file exists inside the folder
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${FILE_NAME}"]`)
  ).toBeVisible();

  // Select file
  await selectItem(page, FILE_NAME);

  // Open move dialog
  await page.locator('#moveButton').click();

  // Set destination to root directory via the picker's home crumb
  await page.locator('#fmPickerCrumbs button[data-path=""]').click();
  await expect(page.locator('#fmPickerDest')).toHaveValue('/');

  // Confirm move
  await expect(page.locator('#fmPickerConfirm')).toBeEnabled();
  await page.locator('#fmPickerConfirm').click();

  // Verify move succeeded
  await expect(page.locator('body'))
    .toContainText(/Done! Reloading.../i);

  // Verify file no longer exists in source folder
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${FILE_NAME}"]`)
  ).toHaveCount(0);

  // Navigate to root
  await navigateToFiles(page);

  // Verify file exists in root directory
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${FILE_NAME}"]`)
  ).toBeVisible();

  console.log('File moved out of folder successfully');
});



test('delete file to trash', async ({ page }) => {
  await navigateToFiles(page);

  // Select file
  await selectItem(page, FILE_NAME);

  // Open inline delete confirmation
  await page.locator('#deleteButton').click();

  // Confirm deletion (leave "Skip the trash" unchecked)
  await expect(page.locator('.fm-inline-skip-trash')).not.toBeChecked();
  await page.locator('button[data-act="save"]').click();

  // Verify file disappeared from File Manager
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${FILE_NAME}"]`)
  ).toHaveCount(0);

  console.log('File moved to trash successfully');
});


test('restore file from trash', async ({ page }) => {
  await navigateToFiles(page);

  // the trash tab is only there with the modern menu, so go by URL
  await page.goto('/files.trash');

  const trashRow = page.locator(
    `#filemanager_table tbody tr[data-file="${FILE_NAME}"]`
  );

  // Verify file is in Trash
  await expect(trashRow).toBeVisible();

  // Select file
  await selectItem(page, FILE_NAME);

  // Open inline restore confirmation
  await page.locator('#restoreButton').click();

  // Confirm restore within the selected file row
  await trashRow.locator('button[data-act="ok"]').click();

  // Verify file disappeared from Trash
  await expect(trashRow).toHaveCount(0);

  // Navigate back to File Manager
  await navigateToFiles(page);

  // Verify restored file exists in root directory
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${FILE_NAME}"]`)
  ).toBeVisible();

  console.log('File restored from trash successfully');
});

test('delete multiple items permanently', async ({ page }) => {
  await navigateToFiles(page);

  await selectItem(page, FOLDER_NAME);
  await selectItem(page, FILE_NAME, true);
  await deleteSelected(page, true);

  await expect(page.locator('#filemanager_table tbody tr[data-file="' + FILE_NAME + '"]')).toHaveCount(0);
  await expect(page.locator('#filemanager_table tbody tr[data-file="' + FOLDER_NAME + '"]')).toHaveCount(0);

  console.log('Multiple items permanently deleted successfully');
});


async function createFileWithEditor(page: any, fileName: string) {
  await navigateToFiles(page);
  await createFileInRoot(page, fileName, true);
  await page.locator('.view-lines').click();
  await page.getByRole('textbox', { name: 'Editor content;Press Alt+F1' }).fill('nekitext');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.locator('#fullscreenButton').click();
  await expect(page.locator('body')).toContainText(/File saved successfully/i);
  console.log('File created with editor successfully');
}


async function viewFile(page: any, fileName: string, expectedContent: string) {
  await navigateToFiles(page);

  // Verify file exists
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${fileName}"]`)
  ).toBeVisible();

  // Select file
  await selectItem(page, fileName);

  // Open file in new tab
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#viewButton').click()
  ]);

  // Verify correct file was opened
  await expect(popup).toHaveURL(/\/file-manager\/view-file\//);

  // Verify file contents
  await expect(popup.locator('pre')).toContainText(expectedContent);

  await popup.close();

  console.log('File viewed successfully');
}



async function editFile(page: any, fileName: string, newContent: string) {
  await navigateToFiles(page);
  await selectItem(page, fileName);

  // Open editor in new tab
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#editButton').click()
  ]);

  await expect(popup).toHaveURL(/\/file-manager\/edit-file\//);

  // Wait for Monaco editor
  const editor = popup.locator('.monaco-editor textarea.inputarea');
  await expect(editor).toBeAttached();

  // Focus editor and replace ALL existing content
  await popup.locator('.monaco-editor .view-lines').click();
  await popup.keyboard.press('ControlOrMeta+A');
  await popup.keyboard.insertText(newContent);

  // Verify Monaco displays only the new content
  await expect(
    popup.locator('.monaco-editor .view-lines')
  ).toHaveText(newContent);

  // Save file
  await popup.locator('#editorcontentvalue').click();

  console.log('File edited successfully');
}


test('create file with editor', async ({ page }) => {
  await createFileWithEditor(page, TXT_FILE);
});

test('view file content', async ({ page }) => {
  await viewFile(page, TXT_FILE, 'nekitext');
});


test('edit file content', async ({ page }) => {
  await editFile(page, TXT_FILE, 'nekitext2');

  // Select the edited file again
  await navigateToFiles(page);
  await selectItem(page, TXT_FILE);

  // Open file viewer in a new tab
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#viewButton').click()
  ]);

  // Verify the correct file was opened
  await expect(popup).toHaveURL(/\/file-manager\/view-file\//);

  // Verify updated content
  await expect(popup.locator('pre')).toHaveText('nekitext2');

  await popup.close();

  console.log('File content updated and verified successfully');
});



test('rename file', async ({ page }) => {
  await navigateToFiles(page);

  // Select file
  await selectItem(page, TXT_FILE);

  // Open inline rename editor
  await page.locator('#renameButton').click();

  // Locate the rename editor for this specific file
  const renameEditor = page.locator(
    `#filemanager_table tbody tr[data-file="${TXT_FILE}"] .fm-inline-editor`
  );

  await expect(renameEditor).toBeVisible();

  // Enter new filename
  await renameEditor.locator('.fm-inline-input').fill(TXT_FILE_BAK);

  // Save new filename
  await renameEditor.locator('button[data-act="save"]').click();

  // Verify old filename is gone
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${TXT_FILE}"]`)
  ).toHaveCount(0);

  // Verify new filename exists
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${TXT_FILE_BAK}"]`)
  ).toBeVisible();

  // Verify success message
  await expect(page.locator('body'))
    .toContainText(/File renamed successfully/i);

  console.log('File renamed successfully');
});



test('change file permissions', async ({ page }) => {
  await navigateToFiles(page);

  // Select file
  await selectItem(page, TXT_FILE_BAK);

  // Open inline permissions editor
  await page.locator('#permButton').click();

  const fileRow = page.locator(
    `#filemanager_table tbody tr[data-file="${TXT_FILE_BAK}"]`
  );

  const permissionsEditor = fileRow.locator('.fm-inline-editor');

  await expect(permissionsEditor).toBeVisible();

  // Set permissions to 755
  await permissionsEditor.locator('.fm-inline-input').fill('755');

  // Save permissions
  await permissionsEditor.locator('button[data-act="save"]').click();

  // Verify success message
  await expect(page.locator('body'))
    .toContainText(/Permissions changed/i);

  // Verify symbolic permissions
  await expect(fileRow).toHaveAttribute(
    'data-permissions',
    '-rwxr-xr-x'
  );

  // Verify owner IDs
  await verifyOwnerUids(page);

  // Reopen permissions editor to verify saved numeric value
  await selectItem(page, TXT_FILE_BAK);
  await page.locator('#permButton').click();

  await expect(
    fileRow.locator('.fm-inline-editor .fm-inline-input')
  ).toHaveValue('755');

  console.log('File permissions changed successfully');
});

test('upload file from URL', async ({ page }) => {
  test.setTimeout(180_000);

  await navigateToFiles(page);

  // wget refuses to overwrite, so drop a leftover copy from an earlier run
  const leftover = page.locator('#filemanager_table tbody tr[data-file="20MB.zip"]');
  if (await leftover.count()) {
    await selectItem(page, '20MB.zip');
    await deleteSelected(page, true);
    await expect(leftover).toHaveCount(0);
  }

  await page.goto('/file-manager/upload?method=download');
  await page.getByRole('textbox', { name: 'https://' }).fill('http://ipv4.download.thinkbroadband.com/20MB.zip');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  await expect(page.locator('body')).toContainText(/downloaded from URL successfully/i, { timeout: 120_000 });

  await navigateToFiles(page);
  await expect(page.locator('#filemanager_table tbody tr[data-file="20MB.zip"]')).toBeVisible();
  await verifyOwnerUids(page);
  console.log('File uploaded from URL successfully');
});



async function compressFiles(page: any) {
  await navigateToFiles(page);

  // Create test file and folder
  await createFileInRoot(page, ZIP_FILE);
  await createFolderInRoot(page, ZIP_FOLDER);

  // Select both items
  await selectItem(page, ZIP_FOLDER);
  await selectItem(page, ZIP_FILE, true);

  // Open compression dialog
  await page.locator('#compressButton').click();

  // Set archive name (without .zip extension)
  await page.locator('#fmPickerArchiveName')
    .fill(ZIP_ARCHIVE.replace(/^\//, ''));

  // Select ZIP format
  await page.locator('#fmPickerExt').selectOption('zip');

  // Verify archive name
  await expect(page.locator('#fmPickerArchiveName'))
    .toHaveValue(ZIP_ARCHIVE.replace(/^\//, ''));

  // Confirm compression
  await expect(page.locator('#fmPickerConfirm')).toBeEnabled();
  await page.locator('#fmPickerConfirm').click();

  // Verify archive was created
  await expect(
    page.locator(
      `#filemanager_table tbody tr[data-file="${ZIP_ARCHIVE_NAME}"]`
    )
  ).toBeVisible();

  console.log('Files compressed successfully');
}



async function extractFiles(page: any) {
  await navigateToFiles(page);

  // Delete original file and folder before extraction
  await selectItem(page, ZIP_FILE);
  await selectItem(page, ZIP_FOLDER, true);
  await deleteSelected(page);

  // Verify originals were removed
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${ZIP_FILE}"]`)
  ).toHaveCount(0);

  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${ZIP_FOLDER}"]`)
  ).toHaveCount(0);

  // Select ZIP archive
  await selectItem(page, ZIP_ARCHIVE_NAME);

  // Open extraction dialog
  await page.locator('#extractButton').click();

  // Extract into current directory
  await expect(page.locator('#fmPickerConfirm')).toBeEnabled();
  await page.locator('#fmPickerConfirm').click();

  // Verify extracted file and folder appear
  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${ZIP_FILE}"]`)
  ).toBeVisible({ timeout: 15000 });

  await expect(
    page.locator(`#filemanager_table tbody tr[data-file="${ZIP_FOLDER}"]`)
  ).toBeVisible({ timeout: 15000 });

  console.log('Files extracted successfully');
}

test('compress files', async ({ page }) => {
  await compressFiles(page);
  await verifyOwnerUids(page);
});

test('extract files', async ({ page }) => {
  await extractFiles(page);
  await verifyOwnerUids(page);
  // TODO: cover all 3 supported archive extensions
  // Cleanup scoped to test subdir to avoid deleting docroots
});

test('cleanup subdir', async ({ page }) => {
  await cleanupSubdir(page);
  // TODO: cover all 3 supported archive extensions
  // Cleanup scoped to test subdir to avoid deleting docroots
});


// INODES AND DISK USAGE EXPLORERS
const explorerTests = [
  {
    route: '/disk-usage',
    columnHeader: 'Size',
    valueRegex: /^\d+(\.\d+)?\s?[KMGT]?B?$/ 
  },
  {
    route: '/inodes-explorer',
    columnHeader: 'INodes',
    valueRegex: /^\d+$/ 
  }
];

for (const { route, columnHeader, valueRegex } of explorerTests) {
  test(route, async ({ page }) => {
    // 1. Initial
    await page.goto(route);
    const table = page.locator('#folders_to_navigate');
    
    await expect(table).toBeVisible();
    await expect(table).toContainText('docker-data');
    await expect(table.locator('th', { hasText: columnHeader })).toBeVisible();
    
    const chart = page.locator('#folderChart');
    await expect(chart).toBeVisible();

    let box = await chart.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);

    const valueCells = table.locator('tbody tr td:nth-child(2)');
    const count = await valueCells.count();
    for (let i = 0; i < count; i++) {
      const text = (await valueCells.nth(i).textContent())?.trim();
      expect(text).toMatch(valueRegex);
    }

    // 2. enter "docker-data'
    const dockerLink = page.locator(`a[href*="${route}/docker-data"]`);
    await dockerLink.click();

    await expect(page).toHaveURL(new RegExp(`${route}/docker-data/?`));
    
    const table2 = page.locator('#folders_to_navigate');
    await expect(table2).toContainText('volumes');
    await expect(table2.locator('th', { hasText: columnHeader })).toBeVisible();
    
    const volumesRow = table2.locator('tr', { hasText: 'volumes' });
    const valueCell = volumesRow.locator('td').nth(1);
    
    await expect(valueCell).toBeVisible();
    const cellText = (await valueCell.textContent())?.trim();
    expect(cellText).toMatch(valueRegex);

    const isRendered = await page.evaluate(() => {
      const canvas = document.getElementById('folderChart') as HTMLCanvasElement;
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      return Array.from(data).some((v) => v !== 0);
    });
    expect(isRendered).toBeTruthy();

    // 3. "Up One Level"
    const upOneLevelLink = page.locator('a', { hasText: 'Up One Level' });
    await upOneLevelLink.click();
    
    await expect(page).toHaveURL(new RegExp(`${route}/?$`));
    const table3 = page.locator('#folders_to_navigate');
    await expect(table3).toContainText('docker-data');
    await expect(table3).not.toContainText('volumes');
    
    console.log(`${route} is functional`);
  });
}
