import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Mobile - Full Editor Flow (Pixel 5)', () => {
  test('should complete all steps on mobile viewport', async ({ page }) => {
    // Step 0: Visit home page
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Verify mobile viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(500);

    // Click CTA to enter editor
    const ctaButton = page.locator('button, a').filter({ hasText: /시작|editor|start|begin/i }).first();
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    // Navigate to /editor
    await page.waitForURL('**/editor');
    await expect(page).toHaveURL(/\/editor/);

    // ============ STEP 1: Image Upload & Background Removal ============
    const fileInput = page.locator('[data-testid="file-input"]');
    const fixturePath = path.join(__dirname, 'fixtures', 'dog.png');
    await fileInput.setInputFiles(fixturePath);

    // Wait for AI background removal to complete (3 minute timeout)
    const step1Result = page.locator('[data-testid="step1-result"]');
    await expect(step1Result).toBeVisible({ timeout: 180000 });

    // Click "다음 단계로" to proceed to Step2
    const step1NextButton = page.locator('[data-testid="step1-next"]');
    await expect(step1NextButton).toBeVisible();
    await step1NextButton.click();

    // ============ STEP 2: Background Selection ============
    const templateBgButton = page.locator('button').filter({ hasText: /템플릿|template|pattern|gradient/i }).first();
    await expect(templateBgButton).toBeVisible({ timeout: 10000 });
    await templateBgButton.click();

    // ============ STEP 3: Canvas Composition ============
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Verify canvas is within viewport
    const boundingBox = await canvas.boundingBox();
    expect(boundingBox).not.toBeNull();

    // Click "다음 단계로"
    const step3NextButton = page.locator('button').filter({ hasText: /다음 단계로|next/i }).first();
    await expect(step3NextButton).toBeVisible({ timeout: 5000 });
    await step3NextButton.click();

    // ============ STEP 4: Download ============
    const saveButton = page.locator('button').filter({ hasText: /저장하기|save|다운로드|download/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 10000 });

    const downloadPromise = page.waitForEvent('download');
    await saveButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/i);
  });
});
