import { roundedOutline } from './profile.ts';
import type { Aperture, Point } from './profile.ts';

type Point3 = [number, number, number];

export type LampReference = {
  body: Aperture & { depth: number };
  aperture: Aperture;
  detail: {
    rearSeamFromBack: number;
    leftControlBay?: { insetMm: number; flatHalfSpanMm: number; outerHalfSpanMm: number };
    markers: readonly {
      side: 'front-edge' | 'back-edge' | 'left-edge';
      /** X on the long sides, Y on the left edge. */
      centerAlongEdge: number;
      /** Distance from the nominal wall, positive toward the outside. */
      outwardOffset?: number;
      centerZ: number;
      width: number;
      height: number;
      radius: number;
    }[];
  };
};

export function lampReferenceLines({ body, aperture, detail }: LampReference) {
  const outline = roundedOutline(body);
  const bay = detail.leftControlBay;
  const housingOutline = bay ? outline.flatMap((point, i): Point[] => {
    const next = outline[(i + 1) % outline.length];
    const wall = -body.width / 2;
    if (point[0] !== wall || next[0] !== wall || point[1] < bay.outerHalfSpanMm || next[1] > -bay.outerHalfSpanMm) {
      return [point];
    }
    return [
      point,
      [wall, bay.outerHalfSpanMm],
      [wall + bay.insetMm, bay.flatHalfSpanMm],
      [wall + bay.insetMm, -bay.flatHalfSpanMm],
      [wall, -bay.outerHalfSpanMm],
    ];
  }) : outline;
  const onPlane = (contour: Point[], z: number): Point3[] =>
    contour.map(([x, y]) => [x, y, z]);
  const loops = [
    onPlane(housingOutline, 0),
    onPlane(housingOutline, -body.depth),
    onPlane(housingOutline, -body.depth + detail.rearSeamFromBack),
    onPlane(roundedOutline(aperture), 0),
    ...detail.markers.map(({ side, centerAlongEdge, centerZ, outwardOffset = 0, ...shape }): Point3[] => {
      const shortSidePlane = body.width / 2 + outwardOffset;
      const longSidePlane = (side === 'front-edge' ? -1 : 1) * (body.height / 2 + outwardOffset);
      return roundedOutline(shape).map(([along, z]) => side === 'left-edge'
        ? [-shortSidePlane, centerAlongEdge + along, centerZ + z]
        : [centerAlongEdge + along, longSidePlane, centerZ + z]);
    }),
  ];
  const segments: Point3[] = outline.filter((_, index) => index % 9 === 0)
    .flatMap(([x, y]): Point3[] => [[x, y, 0], [x, y, -body.depth]]);
  return { loops, segments };
}
