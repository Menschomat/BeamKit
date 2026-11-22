import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'manifold-3d';
import { tl21c, tl21cSlideOn } from '../src/catalog/tl21c.ts';
import { attachments } from '../src/catalog/registry.ts';
import { createDesign, decodeDesign, encodeDesign, validateDesign } from '../src/domain/project.ts';
import { generateAssembly } from '../src/generators/assembly.ts';
import { lampApertureZ } from '../src/geometry/lamp-reference.ts';
import { SolidScope } from '../src/geometry/solid.ts';

const kernel = await Module();
kernel.setup();

test('TL21C designs round-trip and reject the SmallRig mount', () => {
  const project = createDesign('3mf', tl21c);
  assert.deepEqual(decodeDesign(encodeDesign(project)), project);
  assert.throws(() => validateDesign({ ...project, mount: createDesign().mount }), /not compatible/);
});

test('all TL21C attachments generate and the default short coupon preserves the clip span', () => {
  const defaultGrid = generateAssembly(kernel, createDesign('3mf', tl21c));
  const grid = defaultGrid.parts[0];
  assert.equal(grid.name, 'tl21c-honeycomb');
  assert.equal(defaultGrid.regions?.length, 3);
  assert.ok(Math.abs(grid.volumeMm3 - defaultGrid.regions!.reduce((sum, region) => sum + region.volumeMm3, 0)) < 0.1);
  assert.deepEqual(grid.bounds.max.map((value, i) => +(value - grid.bounds.min[i]).toFixed(1)), [221.2, 46.3, 50.8]);
  assert.equal(defaultGrid.printAnalysis?.steepOverhangAreaMm2, 0);
  // These envelope limits leave the rear control surface and both end faces free.
  assert.ok(grid.bounds.min[2] > tl21c.keepouts[0].bounds.max[2]);
  assert.ok(grid.bounds.min[0] > -tl21c.body.width / 2 && grid.bounds.max[0] < tl21c.body.width / 2);

  const project = createDesign('stl', tl21c);
  project.assembly.mode = 'fit-test';
  const fit = generateAssembly(kernel, project);
  assert.equal(fit.parts[0].name, 'tl21c-clip-fit-test');
  const coupon = fit.parts[0].bounds;
  assert.ok(coupon.max[0] - coupon.min[0] < 20);
  assert.equal(coupon.max[1], grid.bounds.max[1]);
  assert.equal(coupon.min[2], grid.bounds.min[2]);
  assert.equal(fit.printAnalysis?.steepOverhangAreaMm2, 0);

  project.assembly.mode = 'integrated';
  for (const attachment of attachments) {
    project.attachment = { id: attachment.id, revision: attachment.revision, parameters: { ...attachment.defaults } };
    if ('inset' in project.attachment.parameters) project.attachment.parameters.inset = 4;
    Object.assign(project.mount!.parameters, { fitClearancePerSideMm: 1, supportThicknessMm: 2.4 });
    const result = generateAssembly(kernel, project);
    assert.equal(result.parts.length, 1);
    assert.equal(result.printAnalysis?.steepOverhangAreaMm2, 0);
  }
});

test('the mounted grid and coupon follow the diffuser with adjustable clearance and a flat print face', () => {
  const project = createDesign('stl', tl21c);
  for (const mode of ['integrated', 'fit-test'] as const) {
    project.assembly.mode = mode;
    const x = mode === 'integrated' ? 109.5 : 8.5;
    for (const clearance of [0.6, 2]) {
      project.mount!.parameters.frontClearanceMm = clearance;
      const { parts: [{ mesh, bounds }], printAnalysis } = generateAssembly(kernel, project);
      assert.ok(printAnalysis!.bedContactAreaMm2 > 100);
      assert.equal(printAnalysis!.steepOverhangAreaMm2, 0);
      const solid = new kernel.Manifold(new kernel.Mesh({ numProp: 3, vertProperties: mesh.positions, triVerts: mesh.indices }));
      try {
        for (const y of [-14, -7, 0, 7, 14]) {
          const [entry, exit] = solid.rayCast([x, y, -10], [x, y, 20]);
          const diffuser = lampApertureZ(y, tl21c.aperture.height, tl21c.detail.apertureEdgeDepth!);
          assert.ok(Math.abs(entry.position[2] - diffuser - clearance) < 0.01);
          assert.ok(Math.abs(exit.position[2] - bounds.max[2]) < 0.001);
        }
      } finally { solid.delete(); }
    }
  }
});

test('older TL21C projects upgrade the curved mount and preserve clip settings', () => {
  const project = createDesign('3mf', tl21c);
  project.mount!.revision = 1;
  project.mount!.parameters.retainingLipMm = 1.6;
  delete project.mount!.parameters.frontClearanceMm;
  project.export.orientation = 'assembly';
  const previous = generateAssembly(kernel, project);
  assert.equal(previous.parts[0].bounds.max[2], 14);
  const upgraded = decodeDesign(encodeDesign(project));
  assert.equal(upgraded.mount!.revision, 2);
  assert.equal(upgraded.mount!.parameters.retainingLipMm, 1.6);
  assert.equal(upgraded.mount!.parameters.frontClearanceMm, 0.8);
  assert.equal(upgraded.export.orientation, 'assembly');
  assert.equal(upgraded.export.format, '3mf');
});

test('slide-on rails clear the modeled insertion path and overlap its shoulders', () => {
  const project = createDesign('3mf', tl21c);
  project.mount = { id: tl21cSlideOn.id, revision: tl21cSlideOn.revision, parameters: { ...tl21cSlideOn.defaults } };
  assert.deepEqual(decodeDesign(encodeDesign(project)), project);
  const scope = new SolidScope();
  const own = scope.own.bind(scope);
  try {
    // Use the full nominal cross-section through the end caps for a conservative straight slide.
    const profile = own(new kernel.CrossSection([[...tl21c.detail.crossSection!].reverse()]));
    const extrusion = own(profile.extrude(tl21c.body.width));
    const pitched = own(extrusion.rotate([90, 0, 0]));
    const aligned = own(pitched.rotate([0, 0, 90]));
    const lamp = own(aligned.translate([-tl21c.body.width / 2, 0, 0]));

    for (const mode of ['integrated', 'fit-test'] as const) {
      project.assembly.mode = mode;
      project.export.format = mode === 'integrated' ? '3mf' : 'stl';
      const result = generateAssembly(kernel, project);
      const { mesh, bounds, name, volumeMm3 } = result.parts[0];
      assert.equal(name, mode === 'integrated' ? 'tl21c-slide-on-honeycomb' : 'tl21c-slide-on-fit-test');
      assert.equal(result.printAnalysis!.steepOverhangAreaMm2, 0);
      assert.ok(result.printAnalysis!.bedContactAreaMm2 > 100);
      assert.ok(bounds.min[0] > -114 && bounds.max[0] < 114 && bounds.min[2] > -40);
      assert.ok(result.diagnostics.some(note => note.code === 'slide-on-retention'));
      if (mode === 'integrated') {
        assert.equal(result.regions?.length, 3);
        assert.ok(Math.abs(result.regions!.reduce((sum, region) => sum + region.volumeMm3, 0) - volumeMm3) < 0.1);
      } else {
        assert.ok(bounds.max[0] - bounds.min[0] < 20);
      }
      const rail = own(new kernel.Manifold(new kernel.Mesh({ numProp: 3, vertProperties: mesh.positions, triVerts: mesh.indices })));
      for (const x of [-210, -110, -50, 0, 50, 110, 210]) {
        const insertion = own(lamp.translate([x, 0, 0]));
        assert.ok(own(rail.intersect(insertion)).volume() < 0.01, `Lamp overlaps the rail at X=${x}`);
      }
      // The back edges still extend inboard of the widest part of the housing.
      const x = mode === 'integrated' ? 79 : 0;
      const [leftOutside, leftInside, rightInside, rightOutside] = rail.rayCast([x, -30, -37], [x, 30, -37]);
      assert.ok(leftOutside && rightOutside);
      assert.ok(leftInside.position[1] > -tl21c.body.height / 2);
      assert.ok(rightInside.position[1] < tl21c.body.height / 2);
    }
  } finally { scope.dispose(); }
});
