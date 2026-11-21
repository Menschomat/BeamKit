import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'manifold-3d';
import { generateHoneycomb } from '../src/generators/honeycomb.ts';
import { p96l } from '../src/catalog/p96l.ts';
import { defaultGrid, gridFields } from '../src/geometry/profile.ts';
import { binaryStl } from '../src/export.ts';

const kernel = await Module();
kernel.setup();

test('real WASM grids have expected bounds, positive volume, and closed topology', () => {
  for (const settings of [defaultGrid,
    Object.fromEntries(gridFields.map(f => [f.key, f.min])),
    Object.fromEntries(gridFields.map(f => [f.key, f.max]))] as typeof defaultGrid[]) {
    const mesh = generateHoneycomb(kernel, p96l.aperture, settings);
    const bounds = [0, 1, 2].map(axis => {
      const values = mesh.positions.filter((_, i) => i % 3 === axis);
      return [values.reduce((a, b) => Math.min(a, b), Infinity), values.reduce((a, b) => Math.max(a, b), -Infinity)];
    });
    for (const [axis, size] of [105 + 2 * settings.frame, 55 + 2 * settings.frame, settings.depth].entries()) {
      assert.ok(Math.abs(bounds[axis][1] - bounds[axis][0] - size) < 0.001);
    }
    const edges = new Map<string, number>();
    let volume = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = Array.from(mesh.indices.slice(i, i + 3));
      const [a, b, c] = ids.map(id => mesh.positions.slice(id * 3, id * 3 + 3));
      volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      ids.forEach((id, j) => {
        const next = ids[(j + 1) % 3];
        const key = [id, next].sort((x, y) => x - y).join(',');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      });
    }
    assert.ok(volume > 0);
    assert.ok([...edges.values()].every(count => count === 2));
    assert.equal(binaryStl(mesh).byteLength, 84 + mesh.indices.length / 3 * 50);
  }
});

test('repeated full rebuild benchmark completes', () => {
  const samples: number[] = [];
  const timings: number[] = [];
  for (let i = 0; i < 24; i++) {
    const start = performance.now();
    const mesh = generateHoneycomb(kernel, p96l.aperture, defaultGrid);
    binaryStl(mesh);
    timings.push(performance.now() - start);
    samples.push(process.memoryUsage().rss);
  }
  console.log(JSON.stringify({ kernel: 'manifold-3d', runtime: process.version, platform: process.platform,
    medianMs: timings.sort((a, b) => a - b)[12], rssBytes: samples.at(-1), rssAfterWarmupBytes: samples[12] }));
});
