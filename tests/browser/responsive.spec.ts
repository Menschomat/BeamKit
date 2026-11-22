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
    const viewOptions = page.getByText('View options', { exact: true });
    const toggle = (await viewOptions.boundingBox())!;
    expect(bounds!.x + bounds!.width - (toggle.x + toggle.width)).toBeGreaterThan(0);
    const bottomGap = bounds!.y + bounds!.height - (toggle.y + toggle.height);
    expect(bottomGap).toBeGreaterThan(0);
    expect(bottomGap).toBeLessThanOrEqual(16);
    await viewOptions.click();
    const menu = (await page.locator('.view-options').boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(menu.y).toBeGreaterThanOrEqual(bounds!.y);
    expect(menu.y + menu.height).toBeLessThan(toggle.y);
    await viewOptions.click();

    await expect(page.getByRole('button', { name: 'Parameters', exact: true })).toHaveCount(0);
    const panel = page.getByRole('complementary', { name: 'Parameters' });
    await expect(panel).toBeVisible();
    const orientation = panel.getByRole('spinbutton', { name: 'Cell orientation', exact: true });
    if (width <= 1000) {
      expect(await panel.evaluate(element => element.clientHeight)).toBeLessThanOrEqual(450);
      // The last parameter remains reachable inside the panel's own scroll area.
      await orientation.scrollIntoViewIfNeeded();
      await expect(orientation).toBeVisible();
      await orientation.fill('30');
      await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
      await stage.scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Print pose', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Print pose', exact: true })).toHaveAttribute('aria-pressed', 'true');
    } else {
      expect(await panel.locator('.settings-scroll').evaluate(element => getComputedStyle(element).overflowY)).toBe('auto');
      await orientation.scrollIntoViewIfNeeded();
      await expect(orientation).toBeVisible();
      const canvasBounds = await page.locator('.viewport canvas').boundingBox();
      expect(canvasBounds!.y + canvasBounds!.height).toBeLessThan(900);
    }
  });
}

test('the header fits at 320px with wider font metrics', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-family: monospace; letter-spacing: 0.045em; }' });
  const header = page.getByRole('banner');
  const exportStl = header.getByRole('button', { name: 'Export STL', exact: true });
  await expect(exportStl).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const button of [header.getByRole('button', { name: 'Project', exact: true }), exportStl]) {
    await expect(button).toBeInViewport({ ratio: 1 });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [390, 1024]) {
  test(`parameter tabs and attachment selector stay fixed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 650 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
    const panel = page.getByRole('complementary', { name: 'Parameters' });
    await panel.scrollIntoViewIfNeeded();

    const tabs = panel.getByRole('group', { name: 'Parameter groups' });
    const attachment = panel.getByLabel('Attachment type', { exact: true });
    const sliders = panel.locator('.settings-scroll');
    const tabTop = (await tabs.boundingBox())!.y;
    const selectorTop = (await attachment.boundingBox())!.y;
    expect(await sliders.evaluate(element => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    })).toBeGreaterThan(0);
    expect((await tabs.boundingBox())!.y).toBe(tabTop);
    expect((await attachment.boundingBox())!.y).toBe(selectorTop);
    await tabs.getByRole('button', { name: 'Fit', exact: true }).click();
    await expect(panel.getByRole('spinbutton', { name: 'Fit clearance per side', exact: true })).toBeInViewport();
    expect(await sliders.evaluate(element => element.scrollTop)).toBe(0);
  });
}

test('resizing keeps the settings visible and the preview bounded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
  const panel = page.getByRole('complementary', { name: 'Parameters' });
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(panel).toBeVisible();
  const canvas = await page.locator('.viewport canvas').boundingBox();
  expect(canvas!.height).toBeLessThanOrEqual(480);
});
