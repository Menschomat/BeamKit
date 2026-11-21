import type { GridPatternId } from '../catalog/grid-patterns.ts';
import { hexagons } from './profile.ts';
import type { Aperture, GridSettings, Point } from './profile.ts';

function rectangle(x: number, y: number, width: number, height: number): Point[] {
  return [
    [x - width / 2, y - height / 2], [x + width / 2, y - height / 2],
    [x + width / 2, y + height / 2], [x - width / 2, y + height / 2],
  ];
}

function centers(span: number, opening: number, wall: number) {
  const pitch = opening + wall;
  const count = Math.ceil((span + opening) / (2 * pitch));
  return Array.from({ length: count * 2 + 1 }, (_, i) => (i - count) * pitch);
}

/** Generate openings overshooting the aperture, ready for the shared clipping step. */
export function gridOpenings(pattern: GridPatternId, aperture: Aperture, p: Record<string, number>): Point[][] {
  if (pattern === 'honeycomb') {
    const angle = p.orientation * Math.PI / 180;
    const span = Math.hypot(aperture.width, aperture.height);
    return hexagons({ width: span, height: span, radius: 0 }, p as GridSettings).map(cell =>
      cell.map(([x, y]): Point => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]));
  }
  if (pattern === 'parallel-louvers') {
    return p.orientation === 90
      ? centers(aperture.width, p.spacing, p.wall).map(x => rectangle(x, 0, p.spacing, aperture.height + 2))
      : centers(aperture.height, p.spacing, p.wall).map(y => rectangle(0, y, aperture.width + 2, p.spacing));
  }
  const [width, height] = pattern === 'square-eggcrate' ? [p.opening, p.opening]
    : p.orientation === 90 ? [p.openingY, p.openingX] : [p.openingX, p.openingY];
  return centers(aperture.height, height, p.wall).flatMap(y =>
    centers(aperture.width, width, p.wall).map(x => rectangle(x, y, width, height)));
}
