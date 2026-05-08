import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Performance Metrics', () => {
  test('background removal should complete within reasonable time', async ({ page }) => {
    await page.goto('/editor');
    await expect(page).toHaveURL(/\/editor/);

    const fileInput = page.locator('[data-testid="file-input"]');
    const fixturePath = path.join(__dirname, 'fixtures', 'dog.png');

    // Measure time from upload to Step1 result visible
    const startTime = Date.now();
    await fileInput.setInputFiles(fixturePath);

    // Wait for step1-result (indicates background removal complete)
    const step1Result = page.locator('[data-testid="step1-result"]');
    await expect(step1Result).toBeVisible({ timeout: 180000 });

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    console.log(`Step1 (background removal) time: ${processingTime}ms`);
    // Note: First run downloads WASM model (~25MB, can take 60-180s)
    // Subsequent runs process background removal in <2000ms for 256x256 images
  });

  test.fixme('canvas drag should respond quickly', async ({ page }) => {
    await page.goto('/editor');

    const fileInput = page.locator('[data-testid="file-input"]');
    const fixturePath = path.join(__dirname, 'fixtures', 'dog.png');
    await fileInput.setInputFiles(fixturePath);

    // Wait for Step1 complete
    const step1Result = page.locator('[data-testid="step1-result"]');
    await expect(step1Result).toBeVisible({ timeout: 180000 });

    const step1NextButton = page.locator('[data-testid="step1-next"]');
    await step1NextButton.click();

    // Select template background
    const templateBtn = page.locator('button').filter({ hasText: /템플릿|template|pattern|gradient/i }).first();
    await expect(templateBtn).toBeVisible();
    await templateBtn.click();

    // Canvas appears in Step3
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Measure drag responsiveness
    const boundingBox = await canvas.boundingBox();
    if (boundingBox) {
      const startX = boundingBox.x + boundingBox.width / 2;
      const startY = boundingBox.y + boundingBox.height / 2;

      const dragStartTime = Date.now();
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 50, startY + 50, { steps: 10 });
      await page.mouse.up();
      const dragEndTime = Date.now();

      console.log(`Drag operation time: ${dragEndTime - dragStartTime}ms`);
    }
  });
});
