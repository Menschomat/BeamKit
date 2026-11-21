import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';

test('a real production service-worker update prompts, saves and preserves the design', async ({ page }) => {
  test.setTimeout(90000);
  const temp = await mkdtemp(join(tmpdir(), 'beamkit-update-'));
  for (const release of ['a', 'b']) {
    const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', join(temp, release)], {
      cwd: process.cwd(), env: { ...process.env, BEAMKIT_BUILD_ID: release }, encoding: 'utf8', timeout: 30000,
    });
    expect(build.status, build.stderr).toBe(0);
  }
  let active = join(temp, 'a');
  const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url!, 'http://local').pathname);
    const file = resolve(active, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(active + '/')) { response.writeHead(403).end(); return; }
    try {
      if (!(await stat(file)).isFile()) throw new Error('Not a file');
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }); response.end(await readFile(file));
    } catch { response.writeHead(404).end('Not found'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No server');
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await expect(page.getByRole('status')).toContainText('Offline ready');
    await page.reload();
    const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true }); await depth.fill('19');
    await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
    await expect(page.getByRole('status')).toContainText('Saved locally');
    active = join(temp, 'b');
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
    const update = page.getByRole('button', { name: 'Save and reload update', exact: true });
    await expect(update).toBeVisible({ timeout: 15000 });
    await expect(depth).toHaveValue('19');
    await update.click();
    await expect(page.locator('meta[name=beamkit-build]')).toHaveAttribute('content', 'b');
    await expect(depth).toHaveValue('19'); await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
