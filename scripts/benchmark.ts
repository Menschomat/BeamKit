import Module from 'manifold-3d';
import { createDesign } from '../src/domain/project.ts';
import { generateAssembly } from '../src/generators/assembly.ts';
import { defaultGrid, hexagons, roundedOutline } from '../src/geometry/profile.ts';
import { lamps } from '../src/catalog/registry.ts';
import { SolidScope } from '../src/geometry/solid.ts';
import { generateHoneycomb } from '../src/generators/honeycomb.ts';
import { binaryStl } from '../src/export.ts';
const kernel = await Module(); kernel.setup();
const timings: number[] = [], rss: number[] = []; let triangles = 0;
const runs = Math.min(1000, Math.max(120, Number(process.env.BEAMKIT_BENCHMARK_RUNS) || 120));
const memorySamples: { run: number; rssBytes: number; heapUsedBytes: number; arrayBufferBytes: number }[] = [];
for (let i = 0; i < runs; i++) {
  const start = performance.now(); const result = generateAssembly(kernel, createDesign());
  binaryStl(result.parts[0].mesh); timings.push(performance.now() - start); if (i % 10 === 0 && globalThis.gc) globalThis.gc();
  rss.push(process.memoryUsage().rss);
  triangles = result.parts[0].mesh.indices.length / 3;
  if (i % 50 === 0) { const memory = process.memoryUsage(); memorySamples.push({ run: i, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, arrayBufferBytes: memory.arrayBuffers }); }
}
const scope = new SolidScope(); const own = scope.own.bind(scope); const { CrossSection, Manifold } = kernel;
const aperture = lamps[0].aperture;
let subtractionMs = 0;
try {
  const start = performance.now();
  const outer = own(new CrossSection([roundedOutline({ width: 109, height: 59, radius: 5.5 })]));
  const apertureSolid = own(own(new CrossSection([roundedOutline(aperture)])).extrude(12));
  const cells = hexagons(aperture, defaultGrid).map(cell => own(own(new CrossSection([cell])).extrude(12)));
  const holes = own(own(Manifold.union(cells)).intersect(apertureSolid));
  const grid = own(own(outer.extrude(12)).subtract(holes));
  if (grid.status() !== 'NoError' || grid.decompose().map(part => { part.delete(); return 1; }).length !== 1) throw new Error('Subtraction benchmark failed.');
  subtractionMs = performance.now() - start;
} finally { scope.dispose(); }
const gridStart = performance.now(); generateHoneycomb(kernel, lamps[0].aperture, defaultGrid);
const clipped2dGridMs = performance.now() - gridStart;
console.log(JSON.stringify({ date: new Date().toISOString(), runtime: process.version, platform: process.platform, arch: process.arch,
  kernelVersion: '3.5.5', workload: 'P96L corner clipping + access-cut collar union + validated final mesh + STL', runs: timings.length,
  medianMs: timings.sort((a,b) => a-b)[Math.floor(timings.length / 2)], maxMs: Math.max(...timings), triangles,
  rssWarmupBytes: rss[40], rssFinalBytes: rss.at(-1), memorySamples, batchedSolidSubtractionGridOnlyMs: subtractionMs, clipped2dGridOnlyMs: clipped2dGridMs,
  decision: 'Keep shared 2D walls clipped before extrusion; solid subtraction is correct but adds avoidable solids and allocations.' }, null, 2));
