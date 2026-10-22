
import { test, expect, Page } from '@playwright/test';

async function selectItem(page: Page, name: string, multiSelect = false) {
  const row = page.locator(
    `#filemanager_table tbody tr[data-file="${name}"]`
  );

  await expect(row).toBeVisible();

  await row.click(
    multiSelect ? { modifiers: ['ControlOrMeta'] } : undefined
  );
}

async function deleteSelected(page: Page, skipTrash = false) {
  await page.locator('#deleteButton').click();

  const deleteEditor = page.locator(
    '#filemanager_table .fm-inline-editor'
  ).filter({
    has: page.locator('button[data-act="save"]')
  });

  await expect(deleteEditor).toBeVisible();

  const skipTrashCheckbox = deleteEditor.locator('.fm-inline-skip-trash');

  if (skipTrash) {
    await skipTrashCheckbox.check();
  } else {
    await expect(skipTrashCheckbox).not.toBeChecked();
  }

  await deleteEditor.locator('button[data-act="save"]').click();
}

async function changePermissions(page: Page, name: string, permissions: string) {
  // Select file or folder
  await selectItem(page, name);

  // Open inline permissions editor
  await page.locator('#permButton').click();

  const row = page.locator(
    `#filemanager_table tbody tr[data-file="${name}"]`
  );

  const editor = row.locator('.fm-inline-editor');

  await expect(editor).toBeVisible();

  // Change permissions
  await editor.locator('.fm-inline-input').fill(permissions);

  // Save permissions
  await editor.locator('button[data-act="save"]').click();

  // Verify success
  await expect(page.locator('body'))
    .toContainText(/Permissions changed/i);
}

async function verifyPermissions(page: Page, name: string, expected: string) {
  await selectItem(page, name);

  // Open inline permissions editor
  await page.locator('#permButton').click();

  const row = page.locator(
    `#filemanager_table tbody tr[data-file="${name}"]`
  );

  const editor = row.locator('.fm-inline-editor');

  await expect(editor).toBeVisible();

  // Verify numeric permissions
  await expect(editor.locator('.fm-inline-input'))
    .toHaveValue(expected);

  // Close editor
  await editor.locator('button[data-act="cancel"]').click();
}

test('fix permissions', async ({ page }) => {

  // Create test file
  await page.goto('/file-manager/edit-file/test.txt?editor=text&new=true');
  await page.locator('#editor-text').fill('nista');
  await page.locator('#editorcontentvalue').click();


  // Create test folder
  await page.goto('/files');
  await page.locator('#newFolderButton').click();
  
  const folderEditor = page.locator('#newfoDrawer');
  
  await expect(folderEditor).toBeVisible();
  
  await folderEditor.locator('#foldername').fill('testdir');
  
  // Submit folder creation
  await folderEditor.locator(
    'button[type="submit"][form="newFolderForm"]'
  ).click();
  
  // Verify folder was created
  await expect(
    page.locator('#filemanager_table tbody tr[data-file="testdir"]')
  ).toBeVisible();

  // Verify test file exists
  await expect(
    page.locator('tr[data-file="test.txt"]')
  ).toBeVisible();


  // Set incorrect permissions
  await changePermissions(page, 'testdir', '200');
  await changePermissions(page, 'test.txt', '200');

  // Verify incorrect permissions were applied
  await verifyPermissions(page, 'testdir', '200');
  await verifyPermissions(page, 'test.txt', '200');

  // Fix permissions
  await page.goto('/fix-permissions');

  await page.getByRole('button', {
    name: 'Fix Permissions'
  }).click();

  const message = page.locator('#scan-complete-message');

  await expect(message).toBeVisible();
  await expect(message).toHaveText('Permissions are fixed!');

  // Return to File Manager
  await page.goto('/files');

  // Verify corrected folder permissions
  await verifyPermissions(page, 'testdir', '775');

  // Verify corrected file permissions
  await verifyPermissions(page, 'test.txt', '664');

  // Cleanup test files
  await page.goto('/files');

  await selectItem(page, 'testdir');
  await selectItem(page, 'test.txt', true);

  await deleteSelected(page, true);

  // Verify cleanup
  await expect(
    page.locator('tr[data-file="testdir"]')
  ).toHaveCount(0);

  await expect(
    page.locator('tr[data-file="test.txt"]')
  ).toHaveCount(0);

  console.log('Fix permissions test completed successfully');
});
