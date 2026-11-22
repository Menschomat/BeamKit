import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { LampDefinition, MountDefinition } from '../domain/definitions.ts';
import type { Aperture, Point } from '../geometry/profile.ts';
import { roundedOutline } from '../geometry/profile.ts';
import { lampApertureZ } from '../geometry/lamp-reference.ts';
import type { SolidScope } from '../geometry/solid.ts';

export const wandAttachmentBaseZ = 2;

function extrudeAlongWand(kernel: ManifoldToplevel, scope: SolidScope, profile: Point[], length: number, center: number) {
  const section = scope.own(new kernel.CrossSection([profile]));
  const extrusion = scope.own(section.extrude(length));
  const tilted = scope.own(extrusion.rotate([90, 0, 0]));
  const aligned = scope.own(tilted.rotate([0, 0, 90]));
  return scope.own(aligned.translate([center - length / 2, 0, 0]));
}

export function wandDiffuserEnvelope(kernel: ManifoldToplevel, scope: SolidScope, lamp: LampDefinition, clearance: number) {
  const half = lamp.aperture.height / 2;
  const sag = lamp.detail.apertureEdgeDepth ?? 0;
  const extent = lamp.body.height / 2 + 10;
  const minZ = clearance - sag;
  const arch: Point[] = Array.from({ length: 33 }, (_, i) => {
    const y = half * (1 - i / 16);
    return [y, lampApertureZ(y, lamp.aperture.height, sag) + clearance];
  });
  const contour: Point[] = [
    [-extent, -lamp.body.depth], [extent, -lamp.body.depth],
    [extent, minZ], ...arch, [-extent, minZ],
  ];
  return { solid: extrudeAlongWand(kernel, scope, contour, lamp.body.width + 4, 0), minZ };
}

export function generateWandMount(
  kernel: ManifoldToplevel,
  scope: SolidScope,
  lamp: LampDefinition,
  aperture: Aperture,
  frame: number,
  parameters: Record<string, number>,
  fitTest: boolean,
  strategy: NonNullable<MountDefinition['strategy']>,
  diffuser?: ReturnType<typeof wandDiffuserEnvelope>,
) {
  const { fitClearancePerSideMm: clearance, supportThicknessMm: thickness, retainingLipMm: reach } = parameters;
  const shoulder = lamp.body.height / 2 + clearance;
  const lip = aperture.height / 2;
  const top = wandAttachmentBaseZ + 0.6;
  const lensShoulder = lamp.aperture.height / 2 + clearance;
  // The front skirts block side spill near the diffuser.
  const innerFront: Point[] = [[lip + 0.05, top], [lip + 0.05, 0], [lensShoulder, -6.5], [shoulder - 1.1, -11]];
  const outerFront: Point[] = [
    [lip + frame - 0.05, top], [lensShoulder + thickness, -6.5], [shoulder - 1.1 + thickness, -11],
  ];
  const skirt = [...innerFront, ...outerFront.slice().reverse()];
  const grip = strategy === 'wand-slide-on' ? [
    ...innerFront, [shoulder, -16], [shoulder, -23], [shoulder - 0.5, -29], [shoulder - 1.25, -35],
    [shoulder - 1.85, -38], [shoulder + thickness - 1.85, -38], [shoulder + thickness - 0.6, -34],
    [shoulder + thickness, -28], [shoulder + thickness, -16], ...outerFront.slice().reverse(),
  ] as Point[] : [
    ...innerFront, [shoulder, -16], [shoulder, -28], [shoulder - reach, -35],
    [shoulder - reach + 1.3, -38], [shoulder + thickness - 0.4, -38],
    [shoulder + thickness, -35], [shoulder + thickness, -16], ...outerFront.slice().reverse(),
  ] as Point[];
  const gripLength = strategy === 'wand-slide-on' && !fitTest ? 32 : 12;
  const skirtLength = fitTest ? gripLength + 2 : aperture.width - 2 * aperture.radius;
  const gripCenters = fitTest ? [0] : [-1, 1].map(sign => sign * (aperture.width / 2 - 30));
  const solids: Manifold[] = [];
  for (const sign of [-1, 1]) {
    function alongLamp(profile: Point[], length: number, center: number) {
      const contour: Point[] = profile.map(([y, z]) => [sign * y, z]);
      if (sign < 0) contour.reverse();
      return extrudeAlongWand(kernel, scope, contour, length, center);
    }
    solids.push(alongLamp(skirt, skirtLength, 0));
    for (const center of gripCenters) solids.push(alongLamp(grip, gripLength, center));
  }
  if (fitTest) {
    // Connect the two tabs through a short, open front rim using the production mating profile.
    const opening = scope.own(new kernel.CrossSection([roundedOutline({ ...aperture, width: 16, radius: 1 })]));
    const outside = scope.own(new kernel.CrossSection([roundedOutline({
      width: 16 + 2 * frame, height: aperture.height + 2 * frame, radius: 1 + frame,
    })]));
    const rim = scope.own(outside.subtract(opening));
    const bottom = diffuser?.minZ ?? wandAttachmentBaseZ;
    const rimSolid = scope.own(rim.extrude(wandAttachmentBaseZ + 2.4 - bottom));
    const raisedRim = scope.own(rimSolid.translate([0, 0, bottom]));
    solids.push(diffuser ? scope.own(raisedRim.subtract(diffuser.solid)) : raisedRim);
  }
  return scope.own(kernel.Manifold.union(solids));
}
