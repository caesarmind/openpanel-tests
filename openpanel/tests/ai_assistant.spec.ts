import { test, expect } from '@playwright/test';

// only opens and closes the drawer, nothing is sent to the model
test('ai assistant drawer opens and closes', async ({ page }) => {
  await page.goto('/dashboard');

  const btn = page.locator('#ai-assistant-btn');
  const drawer = page.locator('#ai-assistant-drawer');
  await expect(btn).toBeVisible();
  await expect(drawer).toBeHidden();

  await btn.click();
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveClass(/ai-open/);
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#ai-assistant-input')).toBeFocused();

  // greeting when it's set up, the not configured note when the admin hasn't added a key yet
  await expect(page.locator('#ai-assistant-messages')).toContainText(/Ask me anything|not configured yet/i);

  await page.locator('#ai-assistant-info').click();
  await expect(page.locator('#ai-assistant-about')).toBeVisible();
  await expect(page.locator('#ai-assistant-about')).toContainText(/AI can make mistakes/i);

  await page.locator('#ai-assistant-close').click();
  await expect(drawer).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');

  // Escape closes it too
  await btn.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  console.log('ai assistant drawer is working');
});
