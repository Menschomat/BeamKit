import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { lamps, resolveDefinition } from '../catalog/registry.ts';
import { printDiagnostics, validateDesign } from '../domain/project.ts';
import type { Design } from '../domain/project.ts';
import { gridMaterialLabel, materialRegions } from '../domain/materials.ts';
import type { Bounds, Diagnostic, LampDefinition } from '../domain/definitions.ts';
import { isGridPattern } from '../catalog/grid-patterns.ts';
import { gridOpenings } from '../geometry/grid-openings.ts';
import { roundedOutline } from '../geometry/profile.ts';
import type { Aperture, GridSettings, Point } from '../geometry/profile.ts';
import { analyzeOverhangs, orientFrontDown } from '../geometry/printability.ts';
import type { OverhangReport } from '../geometry/printability.ts';
import { SolidScope, validateSolid } from '../geometry/solid.ts';
import type { GridMesh } from '../geometry/protocol.ts';
import { generateHoneycomb } from './honeycomb.ts';

export type PrintablePart = { name: string; mesh: GridMesh; bounds: Bounds; volumeMm3: number; transform: [number, number, number] };
export type MaterialRegion = PrintablePart & { material: keyof typeof materialRegions };
export type AssemblyResult = { parts: PrintablePart[]; regions?: MaterialRegion[]; diagnostics: Diagnostic[]; elapsedMs: number; projectRevision: number; provenance: Design['engine']; connection: null; printAnalysis?: OverhangReport };

/** Join corresponding convex contours, including the horizontal sheet seat. */
function loftOpening(kernel: ManifoldToplevel, rings: { outline: Point[]; z: number }[]) {
  const count = rings[0].outline.length;
  const positions = new Float32Array(rings.flatMap(({ outline, z }) =>
    outline.flatMap(([x, y]) => [x, y, z])));
  const triangles: number[] = [];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const lower = ring * count, upper = lower + count;
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      triangles.push(lower + i, lower + next, upper + next, lower + i, upper + next, upper + i);
    }
  }
  const top = (rings.length - 1) * count;
  for (let i = 1; i < count - 1; i++) triangles.push(0, i + 1, i, top, top + i, top + i + 1);
  return new kernel.Manifold(new kernel.Mesh({
    numProp: 3,
    vertProperties: positions,
    triVerts: new Uint32Array(triangles),
  }));
}

/** All modeling is independent of Svelte, Three.js, the filesystem and browser globals. */
export function generateAssembly(kernel: ManifoldToplevel, input: Design, projectRevision = 0, lampOverride?: LampDefinition): AssemblyResult {
  const project = validateDesign(input);
  const lamp = lampOverride ?? resolveDefinition(lamps, project.lamp);
  const prefix = lamp.id.split('.').at(-1)!;
  const start = performance.now();
  const scope = new SolidScope(); const own = scope.own.bind(scope);
  const { CrossSection, Manifold } = kernel;
  const section = (shape: Aperture) => own(new CrossSection([roundedOutline(shape)]));
  const box = (bounds: Bounds) => own(own(Manifold.cube(bounds.max.map((v, i) => v - bounds.min[i]) as [number, number, number])).translate(bounds.min));
  const extrude = (shape: ReturnType<typeof section>, depth: number, z = 0) => own(own(shape.extrude(depth)).translate([0, 0, z]));
  try {
    if (project.attachment.id === 'honeycomb' && project.attachment.revision === 1) {
      const mesh = generateHoneycomb(kernel, lamp.aperture, project.attachment.parameters as GridSettings);
      // Historical grids retain their original mesh exactly; validation is already performed by their generator.
      const frame = project.attachment.parameters.frame;
      return { parts: [{ name: `${prefix}-honeycomb`, mesh, bounds: { min: [-lamp.aperture.width / 2 - frame, -lamp.aperture.height / 2 - frame, 0], max: [lamp.aperture.width / 2 + frame, lamp.aperture.height / 2 + frame, project.attachment.parameters.depth] }, volumeMm3: meshVolume(mesh), transform: [0, 0, 0] }],
        diagnostics: printDiagnostics(project), elapsedMs: performance.now() - start, projectRevision, provenance: project.engine, connection: null };
    }
    const p = project.attachment.parameters;
    const dfam = (project.mount?.revision ?? 0) >= 2;
    const inset = p.inset ?? 0;
    const aperture = { width: lamp.aperture.width - inset * 2, height: lamp.aperture.height - inset * 2, radius: Math.max(0.5, lamp.aperture.radius - inset) };
    let attachment: Manifold;
    const pattern = project.attachment.id;
    if (isGridPattern(pattern)) {
      const openings = own(new CrossSection(gridOpenings(pattern, aperture, p)));
      const clipped = own(openings.intersect(section(aperture)));
      // Remove clipped slivers below two nominal nozzle widths from new patterns.
      const holes = pattern === 'honeycomb' ? clipped
        : own(own(own(clipped.offset(-0.4, 'Miter')).offset(0.4, 'Miter')).intersect(clipped));
      attachment = extrude(own(section({ width: aperture.width + 2 * p.frame, height: aperture.height + 2 * p.frame, radius: aperture.radius + p.frame }).subtract(holes)), p.depth);
    } else {
      if (project.attachment.revision >= 2) {
        // Flexible sheet inserts through the front rim and sits in a tapered pocket.
        // The front retaining rim starts on the bed; the rear ledge grows at <45°.
        const rearThickness = 1.6, frontThickness = 1.6 + p.sheetThickness;
        const inner = { width: aperture.width - 2 * p.ledge, height: aperture.height - 2 * p.ledge, radius: Math.max(0.5, aperture.radius - p.ledge) };
        const innerOutline = roundedOutline(inner), apertureOutline = roundedOutline(aperture);
        const ramp = Math.max(...innerOutline.map(([x, y], i) =>
          Math.hypot(apertureOutline[i][0] - x, apertureOutline[i][1] - y))) + 0.1;
        const minimumDepth = rearThickness + ramp + frontThickness + p.sheetThickness + 0.2;
        if (p.depth < minimumDepth) throw new Error(`Holder depth must be at least ${Math.ceil(minimumDepth * 10) / 10} mm for the sheet pocket and print ramps.`);
        const outer = section({ width: aperture.width + 2 * p.wall, height: aperture.height + 2 * p.wall, radius: aperture.radius + p.wall });
        const body = extrude(outer, p.depth);
        const pocketEnd = p.depth - frontThickness;
        const voids = own(loftOpening(kernel, [
          { outline: innerOutline, z: -0.01 },
          { outline: innerOutline, z: rearThickness },
          { outline: apertureOutline, z: rearThickness + ramp },
          { outline: apertureOutline, z: pocketEnd },
          { outline: innerOutline, z: pocketEnd },
          { outline: innerOutline, z: p.depth + 0.01 },
        ]));
        attachment = own(body.subtract(voids));
      } else {
      const outer = section({ width: aperture.width + 2 * p.wall, height: aperture.height + 2 * p.wall, radius: aperture.radius + p.wall });
      const wall = extrude(own(outer.subtract(section(aperture))), p.depth);
      const ledgeOpening = { width: aperture.width - 2 * p.ledge, height: aperture.height - 2 * p.ledge, radius: Math.max(0.5, aperture.radius - p.ledge) };
      const ledge = extrude(own(outer.subtract(section(ledgeOpening))), 0.8);
      attachment = own(wall.add(ledge));
      const tabZ = 0.8 + p.sheetThickness + 0.2;
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const x0 = side < 0 ? -aperture.width / 2 - p.wall : aperture.width / 2 - p.ledge;
        const x1 = side < 0 ? -aperture.width / 2 + p.ledge : aperture.width / 2 + p.wall;
        const y = end * aperture.height / 4;
        const tab = box({ min: [x0, y - 3, tabZ], max: [x1, y + 3, tabZ + 0.8] });
        attachment = own(attachment.add(tab));
      }
      // Small top-side removal notch for lifting a sheet off the ledge.
      attachment = own(attachment.subtract(box({ min: [-5, aperture.height / 2 - 0.1, 0.8], max: [5, aperture.height / 2 + p.wall + 1, p.depth + 1] })));
      }
    }
    let solid = attachment;
    if (project.mount && project.assembly.mode !== 'standalone') {
      const m = project.mount.parameters;
      const fit = m.fitClearancePerSideMm, thickness = m.supportThicknessMm;
      const cavity = { width: lamp.body.width + 2 * fit, height: lamp.body.height + 2 * fit, radius: lamp.body.radius + fit };
      const outerShape = { width: cavity.width + 2 * thickness, height: cavity.height + 2 * thickness, radius: cavity.radius + thickness };
      let collar = extrude(own(section(outerShape).subtract(section(cavity))), m.engagementMm + m.diffuserClearanceMm + thickness, -m.engagementMm);
      const support = extrude(own(section(outerShape).subtract(section(aperture))), thickness, m.diffuserClearanceMm);
      collar = own(collar.add(support));
      if (project.mount.revision < 3 && m.engagementMm >= lamp.body.depth + 0.8 && m.retainingLipMm > 0) {
        const reach = m.retainingLipMm;
        const lipInner = { width: cavity.width - 2 * reach, height: cavity.height - 2 * reach, radius: Math.max(0.5, cavity.radius - reach) };
        if (dfam) {
          const topZ = -lamp.body.depth, bottomZ = -m.engagementMm;
          if (topZ - bottomZ < reach) throw new Error('Rear lip needs at least its reach in vertical ramp height. Increase engagement or reduce lip reach.');
          const profile = own(new CrossSection([[
            [cavity.width / 2 - reach, bottomZ], [outerShape.width / 2, bottomZ],
            [outerShape.width / 2, topZ], [cavity.width / 2, topZ],
          ]]));
          const lip = own(own(own(profile.extrude(24)).rotate([90, 0, 0])).translate([0, 12, 0]));
          collar = own(collar.add(lip));
        } else {
          const lipRing = extrude(own(section(outerShape).subtract(section(lipInner))), Math.min(0.8, m.engagementMm - lamp.body.depth), -m.engagementMm);
          const lip = own(lipRing.intersect(box({ min: [lamp.body.width / 2 - reach - 1, -12, -m.engagementMm - 1], max: [outerShape.width, 12, -lamp.body.depth] })));
          collar = own(collar.add(lip));
        }
      }
      for (const sign of [-1, 1]) {
        const y0 = sign < 0 ? -outerShape.height : cavity.height / 2 - 0.2;
        const y1 = sign < 0 ? -cavity.height / 2 + 0.2 : outerShape.height;
        collar = own(collar.subtract(box({ min: [-m.accessCutoutWidthMm / 2, y0, -m.engagementMm - 1], max: [m.accessCutoutWidthMm / 2, y1, m.diffuserClearanceMm - 0.1] })));
      }
      if (project.mount.revision === 3) {
        const sideX = lamp.body.width / 2 - (lamp.mountingFacts?.rightSideInsetMm ?? 0.8) + fit;
        // Leave the right side open except two spring tongues and the corner anchors.
        collar = own(collar.subtract(box({
          min: [sideX - 0.05, -27, -m.engagementMm - 0.1],
          max: [outerShape.width, 27, m.diffuserClearanceMm],
        })));
        const reach = m.retainingLipMm;
        const rearInset = lamp.mountingFacts?.rearFaceInsetMm ?? 1.5;
        const rearEdgeX = lamp.body.width / 2 - rearInset;
        const hookX = sideX - reach;
        const rampLength = reach + 0.05;
        // Keep the rear shoulder clear when seated while placing the hook behind the rear face.
        const peakZ = -lamp.body.depth - Math.max(0.5, (rearEdgeX + 0.1 - hookX) * rampLength / reach);
        for (const centerY of [-8, 8]) {
          const arm = box({ min: [sideX, centerY - 3, -m.engagementMm], max: [sideX + thickness, centerY + 3, m.diffuserClearanceMm + 0.1] });
          const rootProfile = own(new CrossSection([[[centerY - 3, -2], [centerY + 3, -2], [centerY + 4.5, m.diffuserClearanceMm + 0.1], [centerY - 4.5, m.diffuserClearanceMm + 0.1]]]));
          const root = own(own(own(rootProfile.extrude(thickness)).rotate([90, 0, 90])).translate([sideX, 0, 0]));
          const hookProfile = own(new CrossSection([[[sideX, peakZ - rampLength], [sideX + thickness, peakZ - rampLength], [sideX + thickness, peakZ + rampLength], [sideX, peakZ + rampLength], [sideX - reach, peakZ]]]));
          const hook = own(own(own(hookProfile.extrude(6)).rotate([90, 0, 0])).translate([0, centerY + 3, 0]));
          collar = own(own(own(collar.add(arm)).add(root)).add(hook));
        }
      }
      if (project.mount.revision >= 4) {
        const allCorners = project.mount.revision >= 5;
        const sideX = cavity.width / 2;
        const straightEdgeEnd = lamp.body.height / 2 - lamp.body.radius;
        const gapEnd = straightEdgeEnd - 1.5;
        collar = own(collar.subtract(box({
          min: [sideX - 0.05, -gapEnd, -m.engagementMm - 0.1],
          max: [outerShape.width, gapEnd, m.diffuserClearanceMm],
        })));

        // The existing corner walls carry the hooks. Keep the ramps inside the outer corner contour.
        const hookReach = m.retainingLipMm;
        const hookX = sideX - hookReach;
        const rampLength = hookReach + 0.05;
        const rearInset = lamp.mountingFacts?.rearFaceInsetMm ?? 1.5;
        const rearRollMm = 0.75;
        const slope = hookReach / rampLength;
        const rearEdgeX = lamp.body.width / 2 - rearInset;
        const rolledEdgeX = rearEdgeX + Math.hypot(rearInset, slope * rearRollMm) - slope * rearRollMm;
        const peakZ = -lamp.body.depth - Math.max(0.5, (rolledEdgeX + 0.1 - hookX) / slope);
        const cornerShell = extrude(section(outerShape), m.engagementMm + m.diffuserClearanceMm, -m.engagementMm);
        // Shorten the rear lead-in on the compact clip. The print-facing slope stays below 45°.
        const hookBack = allCorners ? Math.max(-m.engagementMm, peakZ - rampLength) : peakZ - rampLength;
        const hookProfile = own(new CrossSection([[
          [sideX, hookBack], [outerShape.width / 2, hookBack],
          [outerShape.width / 2, peakZ + rampLength], [sideX, peakZ + rampLength], [hookX, peakZ],
        ]]));
        // Keep the left hooks beyond the dial envelope and use matching placements on the right.
        const dialEnvelope = lamp.keepouts.find(keepout => keepout.id === 'dial-finger-access');
        const startY = allCorners ? Math.max(straightEdgeEnd, dialEnvelope?.bounds.max[1] ?? 0) + 0.05 : gapEnd;
        const hookWidth = allCorners ? 1.8 : 3;
        const hookStrip = own(own(hookProfile.extrude(hookWidth)).rotate([90, 0, 0]));
        for (const endY of [-startY, startY + hookWidth]) {
          const hook = own(own(hookStrip.translate([0, endY, 0])).intersect(cornerShell));
          collar = own(collar.add(hook));
          if (allCorners) collar = own(collar.add(own(hook.rotate([0, 0, 180]))));
        }
      }
      if (project.mount.revision >= 3) {
        // Four small original bezel seats establish a real Z=0 stop; the diffuser remains clear.
        const bezel = own(section({ width: lamp.aperture.width + 2, height: lamp.aperture.height + 2, radius: lamp.aperture.radius + 1 }).subtract(section(lamp.aperture)));
        const seatRing = extrude(bezel, m.diffuserClearanceMm + thickness, 0);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          const cx = sx * (lamp.aperture.width / 2 - 0.7), cy = sy * (lamp.aperture.height / 2 - 0.7);
          const pad = own(seatRing.intersect(box({ min: [cx - 1.2, cy - 1.2, 0], max: [cx + 1.2, cy + 1.2, m.diffuserClearanceMm + thickness] })));
          collar = own(collar.add(pad));
        }
      }
      if (dfam) {
        // Seat pads keep the original mating plane. Remove redundant webs between pads.
        const seatTop = m.diffuserClearanceMm + thickness;
        for (const sign of [-1, 1]) {
          collar = own(collar.subtract(box({ min: [-40, sign < 0 ? -cavity.height / 2 : aperture.height / 2, m.diffuserClearanceMm],
            max: [40, sign < 0 ? -aperture.height / 2 : cavity.height / 2, seatTop] })));
        }
        // A tapered shoulder grows outwards as the front-down print rises.
        const frame = isGridPattern(pattern) ? p.frame : p.wall;
        const topWidth = aperture.width + 2 * frame, topHeight = aperture.height + 2 * frame;
        const dx = Math.max(0, (outerShape.width - topWidth) / 2), dy = Math.max(0, (outerShape.height - topHeight) / 2);
        const rampHeight = Math.hypot(dx, dy) + 0.05;
        if (p.depth < rampHeight + 0.4) throw new Error(`Attachment depth must be at least ${(rampHeight + 0.4).toFixed(1)} mm for the support-free transition.`);
        const tapered = own(section(outerShape).extrude(rampHeight, 0, 0, [Math.min(1, topWidth / outerShape.width), Math.min(1, topHeight / outerShape.height)]));
        const hollow = own(tapered.subtract(extrude(section(aperture), rampHeight + 0.1, -0.05)));
        collar = own(collar.add(own(hollow.translate([0, 0, seatTop]))));
      }
      for (const keepout of lamp.keepouts) collar = own(collar.subtract(box({ min: [keepout.bounds.min[0], keepout.bounds.min[1], project.mount.revision >= 3 ? Math.min(keepout.bounds.min[2], -m.engagementMm - 1) : keepout.bounds.min[2]], max: keepout.bounds.max })));
      const raisedAttachment = own(attachment.translate([0, 0, m.diffuserClearanceMm + thickness - 0.4]));
      solid = project.assembly.mode === 'fit-test' ? collar : own(collar.add(raisedAttachment));
      const plateSeat = lamp.mountingFacts?.plateSeat;
      if (plateSeat && m.plateClearanceWidthMm > 0) {
        const { min, max } = solid.boundingBox();
        // Recess the whole printed edge so a flat plate seats against the threaded boss.
        const cutY = plateSeat.faceY + 0.2;
        if (min[1] < cutY) {
          let cutter: Manifold;
          if (project.mount.revision >= 7) {
            // Put the arcs outside the requested clear span and extrude parallel to the build axis.
            const radius = 2.5;
            const height = cutY - min[1] + 2 * radius + 1;
            const width = m.plateClearanceWidthMm + 2 * radius;
            const outline = roundedOutline({ width, height, radius }, 16).map(([x, y]): Point =>
              [plateSeat.centerX + x, cutY - height / 2 + y]);
            cutter = extrude(own(new CrossSection([outline])), max[2] - min[2] + 2, min[2] - 1);
          } else {
            const halfWidth = m.plateClearanceWidthMm / 2;
            cutter = box({
              min: [plateSeat.centerX - halfWidth, min[1] - 1, min[2] - 1],
              max: [plateSeat.centerX + halfWidth, cutY, max[2] + 1],
            });
          }
          solid = own(solid.subtract(cutter));
        }
      }
      for (const keepout of lamp.keepouts) {
        const overlap = own(solid.intersect(box(keepout.bounds)));
        if (overlap.volume() > 1e-5) throw new Error(`Geometry blocks ${keepout.id}. Increase front clearance or use a compatible configuration.`);
      }
    }
    const partitionSource = solid;
    if (dfam) solid = own(own(new Manifold(solid.getMesh())).setTolerance(0.0001));
    const checked = validateSolid(solid, scope);
    const printAnalysis = analyzeOverhangs(orientFrontDown(checked.mesh));
    if (dfam && isGridPattern(pattern) && printAnalysis.steepOverhangAreaMm2 > 0.00001) throw new Error('This configuration exceeds the 45-degree front-down print limit. Adjust the frame, depth or fit settings.');
    let regions: MaterialRegion[] | undefined;
    if (project.export.format === '3mf' && project.mount) {
      const { diffuserClearanceMm, supportThicknessMm } = project.mount.parameters;
      const baseZ = diffuserClearanceMm + supportThicknessMm - 0.4;
      const volumeAtOffset = (offset: number) => extrude(section({
        width: aperture.width + 2 * offset,
        height: aperture.height + 2 * offset,
        radius: aperture.radius + offset,
      }), p.depth + 0.1, baseZ);
      // A 0.4 mm rim joins the grid walls. The next 0.8 mm is the liner.
      // Cutting the same finished solid keeps the regions in contact without overlapping.
      const gridBoundary = volumeAtOffset(0.4);
      const linerBoundary = volumeAtOffset(1.2);
      const grid = own(partitionSource.intersect(gridBoundary));
      const insideLiner = own(partitionSource.intersect(linerBoundary));
      const liner = own(insideLiner.subtract(gridBoundary));
      const shell = own(partitionSource.subtract(linerBoundary));
      const region = (material: MaterialRegion['material'], geometry: Manifold): MaterialRegion => ({
        material, name: material === 'honeycomb' ? gridMaterialLabel(pattern) : materialRegions[material].label,
        ...validateSolid(own(own(new Manifold(geometry.getMesh())).setTolerance(0.0001)), scope, material),
        transform: [0, 0, 0],
      });
      regions = [region('honeycomb', grid), region('liner', liner), region('shell', shell)];
    }
    const diagnostics = printDiagnostics(project);
    if (printAnalysis.steepOverhangAreaMm2 > 0.00001) diagnostics.push({ level: 'warning', code: 'overhangs', message: 'This revision has downward-facing ledges. Inspect bridging and supports in your slicer; support-free printing is not verified.' });
    const name = project.assembly.mode === 'fit-test' ? `${prefix}-collar-fit-test` : `${prefix}-${project.attachment.id}`;
    return { parts: [{ name, ...checked, transform: [0, 0, 0] }], regions, diagnostics, elapsedMs: performance.now() - start, projectRevision, provenance: project.engine, connection: null, printAnalysis };
  } finally { scope.dispose(); }
}
function meshVolume(mesh: GridMesh) {
  let volume = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => mesh.positions.slice(mesh.indices[i + j] * 3, mesh.indices[i + j] * 3 + 3));
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return volume;
}
