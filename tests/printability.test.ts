import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeOverhangs, orientFrontDown } from '../src/geometry/printability.ts';
import type { GridMesh } from '../src/geometry/protocol.ts';
const triangle = (points: number[]): GridMesh => ({ positions: new Float32Array(points), indices: new Uint32Array([0, 1, 2]) });

test('front-down orientation is a proper rotation, keeps scale and places the front on Z=0', () => {
  const mesh = triangle([-2, -3, -12.5, 2, -3, 14, 2, 3, 14]);
  const before = new Float32Array(mesh.positions);
  const oriented = orientFrontDown(mesh);
  assert.deepEqual(mesh.positions, before);
  assert.deepEqual(Array.from(oriented.positions), [-2, 3, 26.5, 2, 3, 0, 2, -3, 0]);
  assert.deepEqual(oriented.indices, mesh.indices);
  assert.notEqual(oriented.indices, mesh.indices);
  const distance = (positions: Float32Array) => Math.hypot(...[0, 1, 2].map(axis => positions[axis] - positions[axis + 3]));
  assert.equal(distance(oriented.positions), distance(mesh.positions));
});

test('a bed face is supported while the same face above the bed is an overhang candidate', () => {
  const bed = triangle([0, 0, 0, 0, 1, 0, 1, 0, 0]);
  const exposed = triangle([0, 0, 1, 0, 1, 1, 1, 0, 1]);
  const first = analyzeOverhangs(bed), second = analyzeOverhangs(exposed);
  assert.equal(first.bedContactAreaMm2, 0.5);
  assert.equal(first.steepOverhangAreaMm2, 0);
  assert.equal(second.steepOverhangAreaMm2, 0.5);
  assert.equal(second.maxOverhangDegrees, 90);
  assert.deepEqual(second.steepTriangleIndices, [0]);
});

test('45-degree ramps pass the local slope check; shallower ramps are identified', () => {
  const ramp45 = triangle([0, 0, 1, 0, 1, 1, 1, 0, 2]);
  const rampShallow = triangle([0, 0, 1, 0, 1, 1, 1, 0, 1.5]);
  const first = analyzeOverhangs(ramp45), second = analyzeOverhangs(rampShallow);
  assert.ok(Math.abs(first.maxOverhangDegrees - 45) < 1e-7);
  assert.equal(first.steepTriangleIndices.length, 0);
  assert.equal(second.steepTriangleIndices.length, 1);
  assert.ok(second.maxOverhangDegrees > 45);
});

test('upward and vertical faces are not downward candidates, and invalid inputs fail visibly', () => {
  assert.equal(analyzeOverhangs(triangle([0, 0, 1, 1, 0, 1, 0, 1, 1])).downwardAreaMm2, 0);
  assert.equal(analyzeOverhangs(triangle([0, 0, 0, 1, 0, 0, 0, 0, 1])).downwardAreaMm2, 0);
  assert.deepEqual(analyzeOverhangs(triangle([0, 0, 0, 0, 0, 0, 0, 0, 0])).degenerateTriangleIndices, [0]);
  assert.throws(() => orientFrontDown(triangle([0, 0, NaN, 1, 0, 0, 0, 1, 0])), /finite/);
  assert.throws(() => analyzeOverhangs(triangle([0, 0, 1, 0, 1, 1, 1, 0, 1]), { maxOverhangDegrees: 91 }), /limit/);
});
