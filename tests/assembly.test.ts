import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'manifold-3d';
import { generateAssembly } from '../src/generators/assembly.ts';
import { createDesign, decodeDesign, encodeDesign, upgradePrintDesign, validateDesign } from '../src/domain/project.ts';
import { attachments, lamps, mountFields } from '../src/catalog/registry.ts';
import { encodeProject } from '../src/project.ts';
import { defaultGrid } from '../src/geometry/profile.ts';
const kernel = await Module(); kernel.setup();

test('integrated P96L accessories and fit tests produce one validated part', () => {
  for (const attachment of attachments) for (const mode of ['integrated', 'fit-test', 'standalone'] as const) {
    const project = createDesign();
    project.attachment = { id: attachment.id, revision: attachment.revision, parameters: { ...attachment.defaults } };
    project.assembly.mode = mode;
    const result = generateAssembly(kernel, project, 4);
    assert.equal(result.projectRevision, 4);
    assert.equal(result.parts.length, 1);
    assert.ok(result.printAnalysis!.steepOverhangAreaMm2 < 0.00001);
    assert.ok(result.parts[0].volumeMm3 > 0);
    assert.ok(result.parts[0].mesh.indices.length > 100);
    if (mode !== 'standalone') {
      assert.ok(result.parts[0].bounds.min[2] < -11.5);
      assert.ok(Math.abs(result.parts[0].bounds.max[0] - 56.9) < 0.001);
    }
  }
});
test('mount and attachment parameter limits remain connected and clear mandatory access', () => {
  for (const field of mountFields) for (const value of [field.min, field.max]) {
    const project = createDesign(); project.mount!.parameters[field.key] = value;
    generateAssembly(kernel, project);
  }
  for (const attachment of attachments) for (const field of attachment.fields) for (const value of [field.min, field.max]) {
    const project = createDesign();
    project.attachment = { id: attachment.id, revision: attachment.revision, parameters: { ...attachment.defaults, [field.key]: value } };
    if (attachment.id === 'diffusion-sheet-holder' && field.key !== 'depth') project.attachment.parameters.depth = Math.max(project.attachment.parameters.depth, 4.2 + project.attachment.parameters.ledge + 2 * project.attachment.parameters.sheetThickness);
    generateAssembly(kernel, project);
  }
});
test('settings preserve revisions and reject unsupported definitions and modes', () => {
  const project = createDesign(); assert.deepEqual(decodeDesign(encodeDesign(project)), project);
  const legacy = decodeDesign(encodeProject(defaultGrid));
  assert.equal(legacy.attachment.revision, 1); assert.equal(legacy.assembly.mode, 'standalone');
  assert.deepEqual(legacy.attachment.parameters, defaultGrid);
  project.lamp.revision = 9; assert.throws(() => validateDesign(project), /Unsupported definition/);
  const modular = { ...createDesign(), assembly: { mode: 'modular', connection: null } };
  assert.throws(() => validateDesign(modular), /invalid project/);
});
test('a synthetic lamp exercises the generator without a P96L geometry branch', () => {
  const fixture = { ...lamps[0], id: 'test.synthetic.rectangle', body: { width: 90, height: 50, depth: 10, radius: 5 }, aperture: { width: 84, height: 44, radius: 3 }, keepouts: [] };
  const project = createDesign();
  const part = generateAssembly(kernel, project, 0, fixture).parts[0];
  assert.ok(Math.abs(part.bounds.max[0] - 46.9) < 0.001);
});

test('exported geometry leaves USB, controls, dials, screw and the central optical channel open', () => {
  const project = createDesign();
  const result = generateAssembly(kernel, project);
  const mesh = result.parts[0].mesh;
  const solid = new kernel.Manifold(new kernel.Mesh({ numProp: 3, vertProperties: mesh.positions, triVerts: mesh.indices }));
  try {
    for (const keepout of lamps[0].keepouts) {
      const b = keepout.bounds;
      const cube = kernel.Manifold.cube(b.max.map((v, i) => v - b.min[i]) as [number, number, number]);
      const placed = cube.translate(b.min); const overlap = solid.intersect(placed);
      try { assert.ok(overlap.volume() < 1e-5, keepout.id); } finally { overlap.delete(); placed.delete(); cube.delete(); }
    }
    const opening = kernel.Manifold.cube([1, 1, 60]); const placed = opening.translate([-0.5, -0.5, -20]);
    const blocked = solid.intersect(placed);
    try { assert.ok(blocked.volume() < 1e-5); } finally { blocked.delete(); placed.delete(); opening.delete(); }
  } finally { solid.delete(); }
});

test('sheet thickness changes the actual retaining-rim geometry', () => {
  const project = createDesign();
  project.attachment = { id: attachments[1].id, revision: attachments[1].revision, parameters: { ...attachments[1].defaults } };
  project.attachment.parameters.depth = 8;
  const first = generateAssembly(kernel, project).parts[0].mesh;
  project.attachment.parameters.sheetThickness = 1;
  const second = generateAssembly(kernel, project).parts[0].mesh;
  assert.notDeepEqual(first.positions, second.positions);
});

test('print-optimized honeycomb preserves the footprint and eliminates steep local overhangs', () => {
  const project = createDesign(); const result = generateAssembly(kernel, project);
  assert.equal(result.printAnalysis!.steepOverhangAreaMm2, 0);
  assert.deepEqual(result.printAnalysis!.degenerateTriangleIndices, []);
  assert.ok(result.printAnalysis!.bedContactAreaMm2 > 1000);
  assert.ok(result.printAnalysis!.maxOverhangDegrees <= 45);
  const old = createDesign(); old.engine.generatorVersion = '0.2.0';
  old.mount!.revision = 1;
  Object.assign(old.mount!.parameters, { engagementMm: 12.5, retainingLipMm: 0.4, accessCutoutWidthMm: 76 });
  old.attachment.revision = 2; old.attachment.parameters.frame = 2;
  const baseline = generateAssembly(kernel, old).parts[0];
  const revised = result.parts[0];
  assert.ok(revised.volumeMm3 < baseline.volumeMm3);
  assert.ok(revised.bounds.min[2] < baseline.bounds.min[2]);
  for (let axis = 0; axis < 2; axis++) {
    assert.ok(Math.abs(revised.bounds.min[axis] - baseline.bounds.min[axis]) < 0.001);
    assert.ok(Math.abs(revised.bounds.max[axis] - baseline.bounds.max[axis]) < 0.001);
  }
});

test('corner hooks leave the center of the right edge open and catch the modeled rear shoulder', () => {
  const { mesh } = generateAssembly(kernel, createDesign()).parts[0];
  const solid = new kernel.Manifold(new kernel.Mesh({
    numProp: 3, vertProperties: mesh.positions, triVerts: mesh.indices,
  }));
  try {
    for (const y of [-22, -8, 0, 8, 22]) {
      for (const z of [-8, -12.8]) assert.equal(solid.rayCast([60, y, z], [52, y, z]).length, 0);
    }
    for (const y of [-23, 23]) {
      const hits = solid.rayCast([60, y, -12.8], [52, y, -12.8]);
      assert.equal(hits.length, 2);
      assert.ok(hits[1].position[0] < 53.5, 'Hook overlaps the reference rear shoulder');
      const housingHeightHits = solid.rayCast([60, y, -8], [52, y, -8]);
      assert.ok(Math.abs(housingHeightHits[1].position[0] - 55.3) < 0.001);
    }
  } finally { solid.delete(); }
});

test('upgrading the earlier tab mount preserves current attachment settings and output mode', () => {
  const old = createDesign();
  old.mount!.revision = 3;
  Object.assign(old.mount!.parameters, { engagementMm: 14.5, retainingLipMm: 1.3 });
  old.assembly.mode = 'fit-test';
  old.attachment.parameters.depth = 10;
  assert.equal(generateAssembly(kernel, old).parts.length, 1);
  const upgraded = upgradePrintDesign(old);
  assert.equal(upgraded.mount!.revision, 4);
  assert.equal(upgraded.assembly.mode, 'fit-test');
  assert.deepEqual(upgraded.attachment, old.attachment);
});
