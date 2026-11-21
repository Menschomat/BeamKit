import assert from 'node:assert/strict';
import test from 'node:test';
import { p96l } from '../src/catalog/p96l.ts';
import { defaultGrid, hexagons, roundedOutline } from '../src/geometry/profile.ts';
import { binaryStl } from '../src/export.ts';
import { lampReferenceLines } from '../src/geometry/lamp-reference.ts';
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
  assert.equal(JSON.parse(encoded).format, 'beamkit-grid-prototype');
  assert.deepEqual(decodeProject(encoded), defaultGrid);
  assert.deepEqual(decodeProject(encoded.replace('beamkit-grid-prototype', 'lightform-grid-prototype')), defaultGrid);
  assert.throws(() => decodeProject(encoded.replace('"depth": 12', '"depth": "12"')), /depth/);
  assert.throws(() => decodeProject(encoded.replace('"schemaVersion": 1', '"schemaVersion": 2')), /[Uu]nsupported/);
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
  assert.match(new TextDecoder().decode(stl.slice(0, 80)), /^BeamKit \| mm \| CC0-1\.0/);
});

test('procedural reference includes the inset, rear seam, and schematic side markers', () => {
  const { loops, segments } = lampReferenceLines(p96l);
  const [front, rear, seam, aperture, port, control] = loops;
  assert.ok(front.every((point) => point[2] === 0));
  assert.ok(rear.every((point) => point[2] === -11.5));
  assert.ok(seam.every((point) => point[2] === -9));
  assert.equal(Math.max(...aperture.map(([x]) => x)), 52.5);
  assert.ok(port.every((point) => point[1] === -30));
  assert.ok(control.every((point) => point[1] === 30));
  assert.equal(segments.length, 8);
});


test('project imports reject unknown fields, revisions, and oversized files', () => {
  const project = JSON.parse(encodeProject(defaultGrid));
  assert.throws(() => decodeProject(JSON.stringify({ ...project, script: 'ignored?' })), /Unrecognized/);
  project.attachment.parameters.extra = 1;
  assert.throws(() => decodeProject(JSON.stringify(project)), /Unrecognized/);
  assert.throws(() => decodeProject(' '.repeat(65537)), /too large/);
  project.lamp.revision = 2;
  assert.throws(() => decodeProject(JSON.stringify(project)), /lamp.revision/);
});
