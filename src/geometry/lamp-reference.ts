import { roundedOutline } from './profile.ts';
import type { Aperture } from './profile.ts';

type Point3 = [number, number, number];

export type LampReference = {
  body: Aperture & { depth: number };
  aperture: Aperture;
  detail: {
    rearSeamFromBack: number;
    markers: readonly {
      side: 'front-edge' | 'back-edge';
      centerX: number;
      centerZ: number;
      width: number;
      height: number;
      radius: number;
    }[];
  };
};

export function lampReferenceLines({ body, aperture, detail }: LampReference) {
  const outline = roundedOutline(body);
  const onPlane = (shape: Aperture, z: number): Point3[] =>
    roundedOutline(shape).map(([x, y]) => [x, y, z]);
  const loops = [
    onPlane(body, 0),
    onPlane(body, -body.depth),
    onPlane(body, -body.depth + detail.rearSeamFromBack),
    onPlane(aperture, 0),
    ...detail.markers.map(({ side, centerX, centerZ, ...shape }): Point3[] => {
      const edge = side === 'front-edge' ? -body.height / 2 : body.height / 2;
      return roundedOutline(shape).map(([x, z]) => [centerX + x, edge, centerZ + z]);
    }),
  ];
  const segments: Point3[] = outline.filter((_, index) => index % 9 === 0)
    .flatMap(([x, y]): Point3[] => [[x, y, 0], [x, y, -body.depth]]);
  return { loops, segments };
}
