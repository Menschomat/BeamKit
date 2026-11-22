import { test, expect } from '@playwright/test';

test('Neewer selection changes the preview, persists, and exports model-specific files', async ({ page }) => {
  const lamp = page.getByRole('button', { name: /^Lamp: / });
  const models = page.getByRole('menu', { name: 'Lamp models' });
  const neewer = models.getByRole('menuitemradio', { name: 'Neewer TL21C' });
  const smallrig = models.getByRole('menuitemradio', { name: 'SmallRig P96L' });
  const export3mf = page.getByRole('button', { name: 'Export 3MF' });
  await page.goto('/');
  await expect(export3mf).toBeEnabled();
  await lamp.click();
  await expect(smallrig).toHaveAttribute('aria-checked', 'true');
  await neewer.click();
  await expect(lamp).toHaveAttribute('aria-expanded', 'false');
  await expect(lamp).toHaveCSS('outline-style', 'none');
  await expect(models).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Neewer TL21C' })).toBeVisible();
  await expect(page.locator('.dimensions')).toHaveText('221.2 × 46.3 × 50.8 mm');
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  const clearance = page.getByRole('spinbutton', { name: 'Diffuser clearance', exact: true });
  await clearance.fill('1.5');
  await expect(page.locator('.dimensions')).toHaveText('221.2 × 46.3 × 51.5 mm');
  const gridDownload = page.waitForEvent('download');
  await export3mf.click();
  expect((await gridDownload).suggestedFilename()).toBe('tl21c-honeycomb-multicolor.3mf');
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await page.getByLabel('Output', { exact: true }).selectOption('fit-test');
  const exportStl = page.getByRole('button', { name: 'Export STL' });
  await expect(exportStl).toBeEnabled();
  const couponDownload = page.waitForEvent('download');
  await exportStl.click();
  expect((await couponDownload).suggestedFilename()).toBe('tl21c-clip-fit-test.stl');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  const mountStyle = page.getByLabel('Mount style', { exact: true });
  await mountStyle.selectOption({ label: 'Slide-on rings' });
  await expect(clearance).toHaveValue('1.5');
  await expect(page.getByRole('spinbutton', { name: 'Ring thickness' })).toHaveValue('2.8');
  await expect(exportStl).toBeEnabled();
  const railDownload = page.waitForEvent('download');
  await exportStl.click();
  expect((await railDownload).suggestedFilename()).toBe('tl21c-slide-on-rings-fit-test.stl');
  await expect(page.getByRole('status')).toContainText('Saved locally');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Neewer TL21C' })).toBeVisible();
  await expect(exportStl).toBeEnabled();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(mountStyle).toHaveValue('neewer.tl21c.slide-on');
  await lamp.press('ArrowDown');
  await expect(neewer).toBeFocused();
  await neewer.press('Escape');
  await expect(lamp).toBeFocused();
  await expect(models).toHaveCount(0);
  await lamp.press('ArrowDown');
  await neewer.press('ArrowUp');
  await expect(smallrig).toBeFocused();
  await smallrig.press('Enter');
  await expect(lamp).toBeFocused();
  await expect(page.getByRole('heading', { name: 'SmallRig P96L' })).toBeVisible();
  await expect(exportStl).toBeEnabled();
  await lamp.click();
  await expect(models).toBeVisible();
  await page.locator('.viewport canvas').click();
  await expect(models).toHaveCount(0);
});

test('the preview switches between the lit assembly and print pose', async ({ page }) => {
  await page.goto('/');
  const export3mf = page.getByRole('button', { name: 'Export 3MF', exact: true });
  await expect(export3mf).toBeEnabled();
  const canvas = page.locator('.viewport canvas');
  await expect(canvas).toBeVisible();
  const toggle = page.getByRole('group', { name: 'Preview pose' });
  const assembled = toggle.getByRole('button', { name: 'Assembled' });
  const printPose = toggle.getByRole('button', { name: 'Print pose' });
  await expect(toggle.getByRole('button')).toHaveCount(2);
  await expect(assembled).toHaveAttribute('aria-pressed', 'true');
  const assembledPreview = await canvas.screenshot();
  await printPose.click();
  await expect(printPose).toHaveAttribute('aria-pressed', 'true');
  expect((await canvas.screenshot()).equals(assembledPreview)).toBe(false);
  await expect(export3mf).toBeEnabled();
  await assembled.click();
  await expect(assembled).toHaveAttribute('aria-pressed', 'true');
  await expect(printPose).toHaveAttribute('aria-pressed', 'false');
});

test('the preview updates during a slider drag and keeps the adjusted camera', async ({ page }) => {
  await page.goto('/');
  const export3mf = page.getByRole('button', { name: 'Export 3MF' });
  await expect(export3mf).toBeEnabled();
  await page.getByRole('button', { name: 'Print pose' }).click();
  const canvas = page.locator('.viewport canvas');
  const viewport = (await canvas.boundingBox())!;
  const center = { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
  const initialPreview = await canvas.screenshot();
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 90, center.y + 45, { steps: 5 });
  await page.mouse.up();
  await page.mouse.wheel(0, -120);
  const adjustedPreview = await canvas.screenshot();
  expect(adjustedPreview.equals(initialPreview)).toBe(false);
  const dimensions = page.locator('.dimensions');
  const originalDimensions = await dimensions.innerText();

  const slider = page.getByRole('slider', { name: 'Depth', exact: true });
  const track = (await slider.boundingBox())!;
  const sliderY = track.y + track.height / 2;
  await page.mouse.move(track.x + track.width * 0.45, sliderY);
  await page.mouse.down();
  try {
    await expect(dimensions).not.toHaveText(originalDimensions);
    const firstDimensions = await dimensions.innerText();
    expect((await canvas.screenshot()).equals(adjustedPreview)).toBe(false);
    await page.mouse.move(track.x + track.width * 0.7, sliderY, { steps: 5 });
    await expect(dimensions).not.toHaveText(firstDimensions);
  } finally {
    await page.mouse.up();
  }
  await expect(export3mf).toBeEnabled();

  const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true });
  await depth.fill('100');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(export3mf).toBeDisabled();
  await expect.poll(async () => (await canvas.boundingBox())!.height).not.toBe(viewport.height);
  await depth.fill('12');
  await expect(export3mf).toBeEnabled();
  await expect(dimensions).toHaveText(originalDimensions);
  await expect.poll(async () => (await canvas.screenshot()).equals(adjustedPreview)).toBe(true);
});

test('theme follows the system until overridden and remembers the choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const root = page.locator('html');
  const project = page.getByRole('button', { name: 'Project', exact: true });
  const theme = page.getByLabel('Theme', { exact: true });
  const canvas = page.getByRole('region', { name: 'Accessory preview' });
  await expect(root).toHaveCSS('color-scheme', 'dark');
  await expect(canvas).toHaveCSS('background-color', 'rgb(27, 48, 59)');
  const export3mf = page.getByRole('button', { name: 'Export 3MF', exact: true });
  await expect(export3mf).toBeEnabled();
  await expect(export3mf).toHaveCSS('background-color', 'rgb(243, 227, 8)');
  await project.click();
  await expect(theme).toHaveValue('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveCSS('color-scheme', 'light');
  await expect(canvas).toHaveCSS('background-color', 'rgb(225, 231, 234)');

  await theme.selectOption('dark');
  await expect(root).toHaveCSS('color-scheme', 'dark');
  await page.reload();
  await expect(root).toHaveCSS('color-scheme', 'dark');
  await project.click();
  await expect(theme).toHaveValue('dark');

  await page.emulateMedia({ colorScheme: 'dark' });
  await theme.selectOption('light');
  await expect(root).toHaveCSS('color-scheme', 'light');
  await theme.selectOption('system');
  await expect(root).toHaveCSS('color-scheme', 'dark');
  await page.reload();
  await project.click();
  await expect(theme).toHaveValue('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveCSS('color-scheme', 'light');
});

test('integrated design, JSON confirmation, history, fit test, holder, and offline restore', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const exportStl = page.getByRole('button', { name: 'Export STL', exact: true });
  const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true });
  const project = page.getByRole('button', { name: 'Project', exact: true });
  const print = page.getByRole('button', { name: 'Print', exact: true });
  const attachment = page.getByLabel('Attachment type', { exact: true });
  await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeEnabled();
  await print.click();
  await page.getByRole('checkbox', { name: 'Multicolor printing' }).uncheck();
  await expect(exportStl).toBeEnabled();
  await expect(page.locator('#output-mode')).toHaveValue('integrated');
  await page.getByRole('button', { name: 'Attachment', exact: true }).click();
  await depth.fill('15'); await expect(exportStl).toBeEnabled();
  await project.click();
  const jsonPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save JSON', exact: true }).click();
  const file = await (await jsonPromise).path();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Reset preset', exact: true }).click(); await expect(depth).toHaveValue('12');
  await page.locator('input[type=file]').setInputFiles(file!);
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(depth).toHaveValue('12');
  await page.getByRole('button', { name: 'Import design', exact: true }).click(); await expect(depth).toHaveValue('15');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}') });
  await expect(page.getByRole('alert')).toContainText('Unsupported'); await expect(depth).toHaveValue('15');
  await project.click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(depth).toHaveValue('12');
  await project.click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(depth).toHaveValue('15');
  await expect(exportStl).toBeEnabled();
  const download = page.waitForEvent('download'); await exportStl.click(); expect((await download).suggestedFilename()).toBe('p96l-honeycomb.stl');
  await print.click();
  await page.getByLabel('Output', { exact: true }).selectOption('fit-test'); await expect(exportStl).toBeEnabled();
  const fitDownload = page.waitForEvent('download'); await exportStl.click(); expect((await fitDownload).suggestedFilename()).toBe('p96l-collar-fit-test.stl');
  await page.getByLabel('Output', { exact: true }).selectOption('integrated');
  await page.getByRole('button', { name: 'Attachment', exact: true }).click();
  await attachment.selectOption('diffusion-sheet-holder');
  await expect(page.getByRole('spinbutton', { name: 'Sheet thickness', exact: true })).toBeVisible(); await expect(exportStl).toBeEnabled();
  const holderDownload = page.waitForEvent('download'); await exportStl.click(); expect((await holderDownload).suggestedFilename()).toBe('p96l-diffusion-sheet-holder.stl');
  await page.getByRole('button', { name: 'Print pose', exact: true }).click();
  await attachment.selectOption('honeycomb'); await depth.fill('18');
  await expect(exportStl).toBeEnabled(); await expect(page.getByRole('status')).toContainText('Offline ready'); await expect(page.getByRole('status')).toContainText('Saved locally');
  await context.setOffline(true); await page.reload(); await expect(depth).toHaveValue('18'); await expect(exportStl).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Offline ready');
  await depth.fill('20'); await expect(exportStl).toBeEnabled();
  expect(errors).toEqual([]);
});

test('local projects, invalid dimensions, latest revision, and mobile panels', async ({ page }) => {
  await page.goto('/'); const export3mf = page.getByRole('button', { name: 'Export 3MF', exact: true }); await expect(export3mf).toBeEnabled();
  const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true });
  await depth.fill('100'); await expect(export3mf).toBeDisabled(); await expect(depth).toHaveAttribute('aria-invalid', 'true');
  for (const value of ['10','15','22','12']) await depth.fill(value);
  await expect(export3mf).toBeEnabled(); await expect(page.getByRole('status')).toContainText('Print geometry ready');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Fit clearance per side', exact: true }).fill('0.5'); await expect(export3mf).toBeEnabled();
  const project = page.getByRole('button', { name: 'Project', exact: true });
  await project.click();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Fit trial'); await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fit trial', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Reset preset', exact: true }).click();
  await project.click();
  await page.getByRole('button', { name: 'Fit trial', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Fit clearance per side', exact: true })).toHaveValue('0.5');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('spinbutton', { name: 'Fit clearance per side', exact: true })).toBeVisible();
  const width = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: innerWidth })); expect(width.actual).toBeLessThanOrEqual(width.viewport);
});


test('storage failure is visible and does not prevent generation or portable export', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('Storage denied'); } } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toContainText(/storage|Autosave/);
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('p96l-accessory.json');
});

test('a failed geometry worker load can retry without losing settings', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker; let fail = true;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(fail ? new URL('/assets/missing-worker.js', location.href) : url, options); fail = false;
      }
    };
  });
  await page.goto('/'); await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry generation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeEnabled();
});

test('an older STL autosave opens the current corner model and keeps its format', async ({ page }) => {
  await page.goto('/');
  const exportStl = page.getByRole('button', { name: 'Export STL', exact: true });
  await expect(page.getByRole('button', { name: 'Export 3MF', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Saved locally');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('beamkit', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        const request = store.get('_autosave');
        request.onsuccess = () => {
          const old = JSON.parse(request.result);
          old.export.format = 'stl';
          old.mount.revision = 6;
          old.mount.parameters.plateClearanceWidthMm = 80;
          old.mount.parameters.engagementMm = 16.5;
          old.attachment.parameters.depth = 17;
          store.put(JSON.stringify(old), '_autosave');
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  await expect(exportStl).toBeEnabled();
  await expect(page.getByRole('spinbutton', { name: 'Depth', exact: true })).toHaveValue('17');
  await expect(page.getByText('The new mount uses smaller hooks on all four corners.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use four corner clips' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Corner clip depth', exact: true })).toHaveValue('16.5');
  await expect(page.getByRole('spinbutton', { name: 'Plate clearance width', exact: true })).toHaveValue('80');
});

test('new projects start in multicolor and remember switching to STL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Multicolor printing' })).toBeChecked();
  const export3mf = page.getByRole('button', { name: 'Export 3MF', exact: true });
  await expect(export3mf).toBeEnabled();
  await expect(page.getByText('Inner shell', { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await export3mf.click();
  expect((await downloaded).suggestedFilename()).toBe('p96l-honeycomb-multicolor.3mf');
  await expect(page.getByRole('status')).toContainText('Saved locally');
  await page.reload();
  await expect(export3mf).toBeEnabled();
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Multicolor printing' }).uncheck();
  const exportStl = page.getByRole('button', { name: 'Export STL', exact: true });
  await expect(exportStl).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Saved locally');
  await page.reload();
  await expect(exportStl).toBeEnabled();
});

test('pattern switch keeps common dimensions and exports the selected grid', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Multicolor printing' }).uncheck();
  await page.getByRole('button', { name: 'Attachment', exact: true }).click();
  const stl = page.getByRole('button', { name: 'Export STL', exact: true });
  await expect(stl).toBeEnabled();
  const pattern = page.getByLabel('Attachment type', { exact: true });
  const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true });
  await depth.fill('15');
  await pattern.selectOption('square-eggcrate');
  await expect(page.getByRole('spinbutton', { name: 'Clear cell width', exact: true })).toHaveValue('6');
  await pattern.selectOption('rectangular-eggcrate');
  await expect(depth).toHaveValue('15');
  await expect(page.getByRole('spinbutton', { name: 'Clear opening A' })).toHaveValue('4');
  await expect(page.getByRole('spinbutton', { name: 'Clear opening B' })).toHaveValue('10');
  await page.getByLabel('Cell orientation', { exact: true }).selectOption('90');
  await expect(stl).toBeEnabled();
  const stlDownload = page.waitForEvent('download');
  await stl.click();
  expect((await stlDownload).suggestedFilename()).toBe('p96l-rectangular-eggcrate.stl');

  await pattern.selectOption('parallel-louvers');
  await expect(page.getByRole('spinbutton', { name: 'Clear slat spacing' })).toHaveValue('6');
  await page.getByLabel('Slat direction', { exact: true }).selectOption('90');
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Multicolor printing' }).check();
  const threeMf = page.getByRole('button', { name: 'Export 3MF', exact: true });
  await expect(threeMf).toBeEnabled();
  const threeMfDownload = page.waitForEvent('download');
  await threeMf.click();
  expect((await threeMfDownload).suggestedFilename()).toBe('p96l-parallel-louvers-multicolor.3mf');
  await expect(page.getByRole('status')).toContainText('Saved locally');
  await page.reload();
  await expect(pattern).toHaveValue('parallel-louvers');
  await expect(page.getByLabel('Slat direction', { exact: true })).toHaveValue('90');
  await expect(threeMf).toBeEnabled();
});
