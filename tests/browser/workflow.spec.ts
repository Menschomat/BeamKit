import { test, expect } from '@playwright/test';

test('integrated design, JSON confirmation, history, fit test, holder, and offline restore', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const exportStl = page.getByRole('button', { name: 'Export STL', exact: true });
  const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true });
  await expect(exportStl).toBeEnabled();
  await expect(page.locator('#output-mode')).toHaveValue('integrated');
  await page.getByText('Advanced test tools', { exact: true }).click();
  await depth.fill('15'); await expect(exportStl).toBeEnabled();
  const jsonPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save JSON', exact: true }).click();
  const file = await (await jsonPromise).path();
  await page.getByRole('button', { name: 'Reset preset', exact: true }).click(); await expect(depth).toHaveValue('12');
  await page.locator('input[type=file]').setInputFiles(file!);
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(depth).toHaveValue('12');
  await page.getByRole('button', { name: 'Import design', exact: true }).click(); await expect(depth).toHaveValue('15');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}') });
  await expect(page.getByRole('alert')).toContainText('Unsupported'); await expect(depth).toHaveValue('15');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(depth).toHaveValue('12');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(depth).toHaveValue('15');
  await expect(exportStl).toBeEnabled();
  const download = page.waitForEvent('download'); await exportStl.click(); expect((await download).suggestedFilename()).toBe('p96l-honeycomb.stl');
  await page.getByLabel('Output', { exact: true }).selectOption('fit-test'); await expect(exportStl).toBeEnabled();
  const fitDownload = page.waitForEvent('download'); await exportStl.click(); expect((await fitDownload).suggestedFilename()).toBe('p96l-collar-fit-test.stl');
  await page.getByLabel('Output', { exact: true }).selectOption('integrated');
  await page.getByRole('button', { name: 'Diffusion sheet holder Commercial diffusion material' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Sheet thickness', exact: true })).toBeVisible(); await expect(exportStl).toBeEnabled();
  const holderDownload = page.waitForEvent('download'); await exportStl.click(); expect((await holderDownload).suggestedFilename()).toBe('p96l-diffusion-sheet-holder.stl');
  await page.getByRole('button', { name: 'Section', exact: true }).click(); await page.getByRole('checkbox', { name: 'Access volumes', exact: true }).check();
  await page.getByRole('button', { name: 'Honeycomb Spill control' }).click(); await depth.fill('18');
  await expect(exportStl).toBeEnabled(); await expect(page.getByRole('status')).toContainText('Offline ready'); await expect(page.getByRole('status')).toContainText('Saved locally');
  await context.setOffline(true); await page.reload(); await expect(depth).toHaveValue('18'); await expect(exportStl).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Offline ready');
  await depth.fill('20'); await expect(exportStl).toBeEnabled();
  expect(errors).toEqual([]);
});

test('local projects, invalid dimensions, latest revision, and mobile panels', async ({ page }) => {
  await page.goto('/'); const exportStl = page.getByRole('button', { name: 'Export STL', exact: true }); await expect(exportStl).toBeEnabled();
  const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true });
  await depth.fill('100'); await expect(exportStl).toBeDisabled(); await expect(depth).toHaveAttribute('aria-invalid', 'true');
  for (const value of ['10','15','22','12']) await depth.fill(value);
  await expect(exportStl).toBeEnabled(); await expect(page.getByRole('status')).toContainText('Print geometry ready');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Fit clearance per side', exact: true }).fill('0.5'); await expect(exportStl).toBeEnabled();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Fit trial'); await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fit trial', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset preset', exact: true }).click();
  await page.getByRole('button', { name: 'Fit trial', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Fit clearance per side', exact: true })).toHaveValue('0.5');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Parameters', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Fit clearance per side', exact: true })).toBeVisible();
  const width = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: innerWidth })); expect(width.actual).toBeLessThanOrEqual(width.viewport);
});


test('storage failure is visible and does not prevent generation or portable export', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('Storage denied'); } } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toContainText(/storage|Autosave/);
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
  await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry generation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
});
