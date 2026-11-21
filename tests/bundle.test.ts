import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'manifold-3d';
import { exportBundle } from '../src/export-bundle.ts';
import { createDesign } from '../src/domain/project.ts';
import { generateAssembly } from '../src/generators/assembly.ts';
const kernel = await Module(); kernel.setup();
test('ZIP contains only the printable part, resolved project and CC0 dedication', () => {
  const project = createDesign(); const result = generateAssembly(kernel, project);
  const zip = exportBundle(project, result); const view = new DataView(zip);
  const entries = new Map<string, Uint8Array>(); let cursor = 0;
  while (view.getUint32(cursor, true) === 0x04034b50) {
    const size = view.getUint32(cursor + 18, true), nameSize = view.getUint16(cursor + 26, true);
    const name = new TextDecoder().decode(new Uint8Array(zip, cursor + 30, nameSize));
    entries.set(name, new Uint8Array(zip, cursor + 30 + nameSize, size)); cursor += 30 + nameSize + size;
  }
  assert.deepEqual([...entries.keys()], ['p96l-honeycomb.stl', 'project.json', 'OUTPUT_LICENSE.txt']);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(entries.get('project.json'))), project);
  assert.match(new TextDecoder().decode(entries.get('OUTPUT_LICENSE.txt')), /CC0-1.0/);
  assert.match(new TextDecoder().decode(entries.get('OUTPUT_LICENSE.txt')), /creativecommons.org\/publicdomain\/zero\/1.0/);
  const stl = entries.get('p96l-honeycomb.stl')!;
  assert.equal(stl.length, 84 + result.parts[0].mesh.indices.length / 3 * 50);
  const end = new DataView(zip, zip.byteLength - 22); assert.equal(end.getUint32(0, true), 0x06054b50); assert.equal(end.getUint16(10, true), 3);
});
