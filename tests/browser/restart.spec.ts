import { test, expect, chromium } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
test('a full browser restart restores local settings and generates offline', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'beamkit-restart-'));
  const first = await chromium.launchPersistentContext(profile, { headless: true });
  try {
    const page = await first.newPage(); await page.goto('http://127.0.0.1:4173/');
    const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true });
    await expect(depth).toBeEnabled(); await depth.fill('17');
    await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
    await expect(page.getByRole('status')).toContainText('Offline ready'); await expect(page.getByRole('status')).toContainText('Saved locally');
  } finally { await first.close(); }
  const second = await chromium.launchPersistentContext(profile, { headless: true, offline: true });
  try {
    const page = await second.newPage(); await page.goto('http://127.0.0.1:4173/');
    await expect(page.getByRole('spinbutton', { name: 'Depth', exact: true })).toHaveValue('17');
    await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
  } finally { await second.close(); }
});
