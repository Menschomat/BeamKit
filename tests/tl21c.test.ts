import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'manifold-3d';
import { tl21c } from '../src/catalog/tl21c.ts';
import { attachments } from '../src/catalog/registry.ts';
import { createDesign, decodeDesign, encodeDesign, validateDesign } from '../src/domain/project.ts';
import { generateAssembly } from '../src/generators/assembly.ts';

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
  assert.deepEqual(grid.bounds.max.map((value, i) => +(value - grid.bounds.min[i]).toFixed(1)), [221.2, 46.3, 52]);
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
