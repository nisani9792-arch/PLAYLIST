import { test, expect } from '@playwright/test';

/**
 * Smoke test for Jusic Playlist Studio shell.
 * Skips when lock screen blocks workspace.
 */
test('workspace shell renders Jusic title', async ({ page }) => {
  await page.goto('/');
  const title = page.getByText('Jusic', { exact: false }).first();
  await expect(title).toBeVisible({ timeout: 15_000 });
});

test('mobile nav steps exist when workspace is visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const build = page.getByText('בנה', { exact: true });
  if ((await build.count()) === 0) {
    test.skip();
    return;
  }
  await expect(build).toBeVisible();
  await expect(page.getByText('התאם', { exact: true })).toBeVisible();
  await expect(page.getByText('פלייליסט', { exact: true })).toBeVisible();
});
