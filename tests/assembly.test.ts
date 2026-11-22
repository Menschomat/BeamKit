import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'manifold-3d';
import { generateAssembly } from '../src/generators/assembly.ts';
import { createDesign, decodeDesign, encodeDesign, supportsMulticolor, validateDesign } from '../src/domain/project.ts';
import { attachments, historicalMounts, lamps, mountFields, resolveDefinition } from '../src/catalog/registry.ts';
import { encodeProject } from '../src/project.ts';
import { defaultGrid } from '../src/geometry/profile.ts';
const kernel = await Module(); kernel.setup();

test('integrated P96L accessories and fit tests produce one validated part', () => {
  for (const attachment of attachments) for (const mode of ['integrated', 'fit-test', 'standalone'] as const) {
    const project = createDesign();
    project.attachment = { id: attachment.id, revision: attachment.revision, parameters: { ...attachment.defaults } };
    project.assembly.mode = mode;
    if (!supportsMulticolor(project)) project.export.format = 'stl';
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
    if (!supportsMulticolor(project)) project.export.format = 'stl';
    if (attachment.id === 'diffusion-sheet-holder' && field.key !== 'depth') project.attachment.parameters.depth = Math.max(project.attachment.parameters.depth, 4.2 + project.attachment.parameters.ledge + 2 * project.attachment.parameters.sheetThickness);
    generateAssembly(kernel, project);
  }
});
test('settings preserve revisions and reject unsupported definitions and modes', () => {
  const project = createDesign(); assert.deepEqual(decodeDesign(encodeDesign(project)), project);
  const legacy = decodeDesign(encodeProject(defaultGrid));
  assert.equal(legacy.attachment.revision, project.attachment.revision);
  assert.equal(legacy.assembly.mode, 'integrated');
  assert.equal(legacy.export.format, 'stl');
  assert.deepEqual(legacy.mount, project.mount);
  assert.deepEqual(legacy.attachment.parameters, { ...project.attachment.parameters, ...defaultGrid });
  generateAssembly(kernel, legacy);
  project.lamp.revision = 9; assert.throws(() => validateDesign(project), /Unsupported definition/);
  const modular = { ...createDesign(), assembly: { mode: 'modular', connection: null } };
  assert.throws(() => validateDesign(modular), /invalid project/);
});
test('a synthetic lamp exercises the generator without a P96L geometry branch', () => {
  const fixture = { ...lamps[0], id: 'test.synthetic.rectangle', body: { width: 90, height: 50, depth: 10, radius: 5 }, aperture: { width: 84, height: 44, radius: 3 }, mountingFacts: undefined, keepouts: [] };
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
  const project = createDesign('stl');
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
  const old = createDesign('stl'); old.engine.generatorVersion = '0.2.0';
  old.mount!.revision = 1;
  old.mount!.parameters = { ...resolveDefinition(historicalMounts, old.mount!).defaults };
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

test('four corner hooks catch the modeled shoulder and leave the short edges open', () => {
  const project = createDesign();
  project.mount!.parameters.plateClearanceWidthMm = 88;
  const { mesh } = generateAssembly(kernel, project).parts[0];
  const solid = new kernel.Manifold(new kernel.Mesh({
    numProp: 3, vertProperties: mesh.positions, triVerts: mesh.indices,
  }));
  try {
    for (const side of [-1, 1]) {
      for (const y of [-22, -8, 0, 8, 22]) {
        for (const z of [-8, -12.8]) assert.equal(solid.rayCast([side * 60, y, z], [side * 52, y, z]).length, 0);
      }
      for (const y of [-24.5, 24.5]) {
        const hits = solid.rayCast([side * 60, y, -12.8], [side * 52, y, -12.8]);
        assert.equal(hits.length, 2);
        assert.ok(Math.abs(hits[1].position[0]) < 53.5, 'Hook overlaps the reference rear shoulder');
        const wall = solid.rayCast([side * 60, y, -8], [side * 52, y, -8]);
        assert.ok(Math.abs(wall[1].position[0]) > 55.2);
      }
    }
  } finally { solid.delete(); }
});

test('the threaded edge clears a flat plate in both mesh exports and the fit coupon', () => {
  const project = createDesign();
  project.attachment.parameters.frame = 5;
  const integrated = generateAssembly(kernel, project);
  const previousMount = resolveDefinition(historicalMounts, { id: project.mount!.id, revision: 5 });
  const previous = generateAssembly(kernel, {
    ...project, mount: { id: previousMount.id, revision: previousMount.revision, parameters: { ...previousMount.defaults } },
  });
  project.export.format = 'stl';
  project.assembly.mode = 'fit-test';
  const fitTest = generateAssembly(kernel, project);

  const plate = kernel.Manifold.cube([72, 10, 45]);
  const seated = plate.translate([-36, -40.5, -20]);
  try {
    for (const part of [...integrated.parts, ...integrated.regions!, ...fitTest.parts, ...previous.parts]) {
      const solid = new kernel.Manifold(new kernel.Mesh({
        numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices,
      }));
      const overlap = solid.intersect(seated);
      try {
        if (part === previous.parts[0]) assert.ok(overlap.volume() > 1);
        else assert.ok(overlap.volume() < 1e-5, part.name);
        if (part === integrated.parts[0]) {
          const nearFloor = solid.rayCast([0, -30.6, 9], [49, -30.6, 9])[0].position[0];
          const nearRim = solid.rayCast([0, -31.8, 9], [49, -31.8, 9])[0].position[0];
          assert.ok(nearFloor > 37.1 && nearFloor < 37.3);
          assert.ok(nearRim > 38.2 && nearRim < 38.4);
        }
      } finally { overlap.delete(); solid.delete(); }
    }
  } finally { seated.delete(); plate.delete(); }
});

test('upgrading the earlier tab mount preserves current attachment settings and output mode', () => {
  const old = createDesign('stl');
  old.mount!.revision = 3;
  old.mount!.parameters = { ...resolveDefinition(historicalMounts, old.mount!).defaults };
  old.assembly.mode = 'fit-test';
  old.attachment.parameters.depth = 10;
  assert.equal(generateAssembly(kernel, old).parts.length, 1);
  const upgraded = decodeDesign(encodeDesign(old));
  assert.equal(upgraded.mount!.revision, 7);
  assert.equal(upgraded.assembly.mode, 'fit-test');
  assert.equal(upgraded.export.format, 'stl');
  assert.deepEqual(upgraded.attachment, old.attachment);
});
