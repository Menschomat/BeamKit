import { test, expect } from '@playwright/test';

for (const width of [320, 390, 640, 768, 900, 1024, 1440]) {
  test(`editor controls and preview remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeEnabled();
    await expect(page.locator('.viewport canvas')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const view = page.locator('.viewport');
    const bounds = await view.boundingBox();
    expect(bounds!.width).toBeGreaterThan(250);
    expect(bounds!.height).toBeGreaterThanOrEqual(200);
    const pose = page.getByRole('group', { name: 'Preview pose' });
    const toggle = (await pose.boundingBox())!;
    expect(toggle.y + toggle.height).toBeLessThanOrEqual(bounds!.y);
    if (width <= 600) {
      const heading = (await page.getByRole('heading', { name: 'SmallRig P96L' }).boundingBox())!;
      const lamp = (await page.getByRole('button', { name: 'Lamp: SmallRig P96L' }).boundingBox())!;
      const assembled = (await pose.getByRole('button', { name: 'Assembled' }).boundingBox())!;
      const printPose = (await pose.getByRole('button', { name: 'Print pose' }).boundingBox())!;
      expect(toggle.x).toBeGreaterThan(heading.x + heading.width);
      expect(toggle.y).toBeLessThan(heading.y + heading.height);
      expect(toggle.width).toBeLessThanOrEqual(160);
      expect(lamp.x + lamp.width).toBeLessThanOrEqual(toggle.x);
      expect(lamp.height).toBeGreaterThanOrEqual(44);
      expect(assembled.width).toBeCloseTo(printPose.width);
      expect(Math.min(assembled.height, printPose.height)).toBeGreaterThanOrEqual(44);
    }

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
      await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeEnabled();
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
  const export3mf = header.getByRole('button', { name: 'Export 3MF', exact: true });
  await expect(export3mf).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const button of [header.getByRole('button', { name: 'Project', exact: true }), export3mf]) {
    await expect(button).toBeInViewport({ ratio: 1 });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

for (const { width, height } of [{ width: 320, height: 568 }, { width: 390, height: 650 }, { width: 844, height: 390 }, { width: 1024, height: 650 }]) {
  test(`parameter tabs and attachment selector stay fixed at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeEnabled();
    // The status footer can wrap as initial autosave and offline setup finish.
    const status = page.getByRole('status');
    await expect(status).toContainText('Saved locally');
    await expect(status).toContainText('Offline ready');
    const panel = page.getByRole('complementary', { name: 'Parameters' });
    await panel.scrollIntoViewIfNeeded();

    const tabs = panel.getByRole('group', { name: 'Parameter groups' });
    const attachment = panel.getByLabel('Attachment type', { exact: true });
    const sliders = panel.locator('.settings-scroll');
    const canvas = page.locator('.viewport canvas');
    const initialPreview = await canvas.boundingBox();
    const tabTop = (await tabs.boundingBox())!.y;
    const selectorTop = (await attachment.boundingBox())!.y;
    await sliders.hover();
    await page.mouse.wheel(0, 1600);
    await expect.poll(() => sliders.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(panel.getByRole('button', { name: 'Reset preset' })).toBeInViewport({ ratio: 1 });
    expect((await tabs.boundingBox())!.y).toBe(tabTop);
    expect((await attachment.boundingBox())!.y).toBe(selectorTop);
    expect(await canvas.boundingBox()).toEqual(initialPreview);
    expect(await page.evaluate(() => {
      window.scrollTo(0, 1000);
      return { scrollY: window.scrollY, overflow: document.documentElement.scrollHeight - window.innerHeight };
    })).toEqual({ scrollY: 0, overflow: 0 });
    await expect(page.getByRole('contentinfo')).toBeInViewport({ ratio: 1 });
    await tabs.getByRole('button', { name: 'Fit', exact: true }).click();
    await expect(panel.getByRole('spinbutton', { name: 'Fit clearance per side', exact: true })).toBeInViewport();
    expect(await sliders.evaluate(element => element.scrollTop)).toBe(0);
  });
}

test('resizing keeps the settings visible and the preview bounded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeEnabled();
  const panel = page.getByRole('complementary', { name: 'Parameters' });
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(panel).toBeVisible();
  const canvas = await page.locator('.viewport canvas').boundingBox();
  expect(canvas!.height).toBeLessThanOrEqual(480);
});
