import { test, expect } from '@playwright/test';

for (const width of [320, 390, 640, 768, 900, 1024, 1440]) {
  test(`editor controls and preview remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
    await expect(page.locator('.viewport canvas')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const stage = page.locator('.stage');
    const view = page.locator('.viewport');
    const bounds = await view.boundingBox();
    expect(bounds!.width).toBeGreaterThan(250);
    expect(bounds!.height).toBeGreaterThanOrEqual(200);
    if (width <= 1000) {
      const parameters = page.getByRole('button', { name: 'Parameters', exact: true });
      await expect(parameters).toBeVisible();
      await expect(page.locator('.settings-panel')).toBeHidden();
      await parameters.click();
      const panel = page.locator('.settings-panel');
      await expect(panel).toBeVisible();
      expect(await panel.evaluate(element => element.clientHeight)).toBeLessThanOrEqual(450);
      // The last parameter remains reachable inside the panel's own scroll area.
      const orientation = panel.getByRole('spinbutton', { name: 'Cell orientation', exact: true });
      await orientation.scrollIntoViewIfNeeded();
      await expect(orientation).toBeVisible();
      await orientation.fill('30');
      await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
      await parameters.click();
      await expect(panel).toBeHidden();
      await stage.scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Print pose', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Print pose', exact: true })).toHaveAttribute('aria-pressed', 'true');
    } else {
      await expect(page.getByRole('button', { name: 'Parameters', exact: true })).toBeHidden();
      const panel = page.locator('.settings-panel');
      expect(await panel.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto');
      const orientation = panel.getByRole('spinbutton', { name: 'Cell orientation', exact: true });
      await orientation.scrollIntoViewIfNeeded();
      await expect(orientation).toBeVisible();
      const canvasBounds = await page.locator('.viewport canvas').boundingBox();
      expect(canvasBounds!.y + canvasBounds!.height).toBeLessThan(900);
    }
  });
}

test('resizing an open panel does not trap it or stretch the renderer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.settings-panel')).toBeVisible();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator('.settings-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  await expect(page.locator('.settings-panel')).toBeHidden();
  const canvas = await page.locator('.viewport canvas').boundingBox();
  expect(canvas!.height).toBeLessThanOrEqual(480);
});
