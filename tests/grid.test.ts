import assert from 'node:assert/strict';
import test from 'node:test';
import { p96l } from '../src/catalog/p96l.ts';
import { defaultGrid, hexagons, roundedOutline } from '../src/geometry/profile.ts';
import { binaryStl } from '../src/export.ts';
import { decodeProject, encodeProject } from '../src/project.ts';

test('grid profiles preserve aperture bounds and shared wall thickness', () => {
  const aperture = p96l.aperture;
  const outline = roundedOutline(aperture);
  assert.equal(Math.max(...outline.map(([x]) => x)), aperture.width / 2);
  assert.equal(Math.max(...outline.map(([, y]) => y)), aperture.height / 2);
  const [first, second] = hexagons(aperture, defaultGrid);
  const right = Math.max(...first.map(([x]) => x));
  const left = Math.min(...second.map(([x]) => x));
  assert.ok(Math.abs(left - right - defaultGrid.wall) < 1e-10);
});

test('settings round-trip and reject invalid numbers and future revisions', () => {
  const encoded = encodeProject(defaultGrid);
  assert.deepEqual(decodeProject(encoded), defaultGrid);
  assert.throws(() => decodeProject(encoded.replace('"depth": 12', '"depth": "12"')), /Depth/);
  assert.throws(() => decodeProject(encoded.replace('"schemaVersion": 1', '"schemaVersion": 2')), /supported/);
});

test('binary STL preserves millimetre coordinates and the output dedication', () => {
  const stl = binaryStl({
    positions: new Float32Array([0, 0, 0, 6, 0, 0, 0, 12, 0]),
    indices: new Uint32Array([0, 1, 2]),
  });
  const data = new DataView(stl);
  assert.equal(stl.byteLength, 134);
  assert.equal(data.getUint32(80, true), 1);
  assert.equal(data.getFloat32(92, true), 1);
  assert.equal(data.getFloat32(108, true), 6);
  assert.equal(data.getFloat32(124, true), 12);
  assert.match(new TextDecoder().decode(stl.slice(0, 80)), /CC0-1\.0/);
});
