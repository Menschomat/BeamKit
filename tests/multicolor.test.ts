import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'manifold-3d';
import { createDesign, decodeDesign, encodeDesign } from '../src/domain/project.ts';
import { multicolor3mf } from '../src/export-3mf.ts';
import { generateAssembly } from '../src/generators/assembly.ts';
import { SolidScope } from '../src/geometry/solid.ts';

const kernel = await Module();
kernel.setup();

function modelXml(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  for (let offset = 0; view.getUint32(offset, true) === 0x04034b50;) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 30, nameLength));
    const start = offset + 30 + nameLength + view.getUint16(offset + 28, true);
    if (name === '3D/3dmodel.model') return decoder.decode(new Uint8Array(buffer, start, size));
    offset = start + size;
  }
  throw new Error('No 3MF model part');
}

test('multicolor regions partition the integrated solid without bulk overlap', () => {
  const project = createDesign();
  project.export.format = '3mf';
  assert.equal(decodeDesign(encodeDesign(project)).export.format, '3mf');
  for (const edit of [{}, { inset: 4, orientation: 35 }, { opening: 2, depth: 25 }]) {
    Object.assign(project.attachment.parameters, edit);
    const result = generateAssembly(kernel, project);
    const regions = result.regions!;
    assert.deepEqual(regions.map(region => region.material), ['honeycomb', 'liner', 'shell']);
    const total = regions.reduce((volume, region) => volume + region.volumeMm3, 0);
    assert.ok(Math.abs(total - result.parts[0].volumeMm3) < 0.01);
    const scope = new SolidScope();
    try {
      const solids = regions.map(({ mesh }) => scope.own(new kernel.Manifold(new kernel.Mesh({
        numProp: 3, vertProperties: mesh.positions, triVerts: mesh.indices,
      }))));
      for (const [first, second] of [[0, 1], [0, 2], [1, 2]]) {
        assert.ok(Math.abs(scope.own(solids[first].intersect(solids[second])).volume()) < 0.01);
      }
    } finally { scope.dispose(); }
  }
  project.assembly.mode = 'fit-test';
  assert.throws(() => encodeDesign(project), /integrated honeycomb/);
});

test('3MF encodes one build object with three named, bed-aligned components', () => {
  const project = createDesign();
  project.export.format = '3mf';
  const result = generateAssembly(kernel, project);
  const model = modelXml(multicolor3mf(result, 'front-down'));
  assert.match(model, /unit="millimeter"/);
  assert.match(model, /<build><item objectid="5"\/><\/build>/);
  assert.match(model, /<components><component objectid="2"\/><component objectid="3"\/><component objectid="4"\/><\/components>/);
  for (const [i, title] of ['Honeycomb', 'Black perimeter liner', 'Outer shell and clips'].entries()) {
    assert.ok(model.includes(`name="${title}" pid="1" pindex="${i}"`));
  }
  const heights = Array.from(model.matchAll(/<vertex x="[^"]+" y="[^"]+" z="([^"]+)"/g), match => Number(match[1]));
  assert.equal(Math.min(...heights), 0);
  assert.equal(Math.max(...heights), 28.5);
});
