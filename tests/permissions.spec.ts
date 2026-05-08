import { test, expect, devices } from '@playwright/test';
import path from 'path';

test.describe('Camera Permissions - Denied State', () => {
  test('should fallback to upload when camera permission is denied', async ({ browser }) => {
    // Create context without camera permission
    const context = await browser.newContext({
      ...devices['Desktop Chrome'],
      permissions: [],
    });
    const page = await context.newPage();

    // Visit editor
    await page.goto('/editor');
    await expect(page).toHaveURL(/\/editor/);

    // Try camera mode if available
    const cameraModeButton = page.locator('button, label').filter({ hasText: /camera|webcam|캐메라/i }).first();
    if (await cameraModeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cameraModeButton.click();
    }

    // Upload should always be available as fallback
    const fileInput = page.locator('[data-testid="file-input"]');
    const fixturePath = path.join(__dirname, 'fixtures', 'dog.png');
    await fileInput.setInputFiles(fixturePath);

    // Wait for AI background removal to complete
    const step1Result = page.locator('[data-testid="step1-result"]');
    await expect(step1Result).toBeVisible({ timeout: 180000 });

    // Click "다음 단계로"
    const step1NextButton = page.locator('[data-testid="step1-next"]');
    await expect(step1NextButton).toBeVisible();
    await step1NextButton.click();

    // Continue to Step2
    const templateBgButton = page.locator('button').filter({ hasText: /템플릿|template|pattern|gradient/i }).first();
    await expect(templateBgButton).toBeVisible({ timeout: 10000 });
    await templateBgButton.click();

    // Canvas should be visible in Step3
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});
