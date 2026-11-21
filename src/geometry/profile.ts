export type Point = [number, number];
export type Aperture = { width: number; height: number; radius: number };

export function roundedOutline({ width, height, radius }: Aperture, segments = 8): Point[] {
  const x = width / 2 - radius;
  const y = height / 2 - radius;
  const centers = [[x, y], [-x, y], [-x, -y], [x, -y]];
  return centers.flatMap(([cx, cy], corner) =>
    Array.from({ length: segments + 1 }, (_, step): Point => {
      const angle = (corner + step / segments) * Math.PI / 2;
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    }),
  );
}

export const gridFields = [
  { key: 'opening', label: 'Cell opening across flats', min: 2, max: 15, step: 0.1 },
  { key: 'depth', label: 'Depth', min: 2, max: 35, step: 0.1 },
  { key: 'wall', label: 'Wall thickness', min: 0.4, max: 2, step: 0.1 },
  { key: 'frame', label: 'Frame width', min: 1, max: 5, step: 0.1 },
] as const;

export type GridSettings = Record<(typeof gridFields)[number]['key'], number>;
export const defaultGrid: GridSettings = { opening: 6, depth: 12, wall: 0.8, frame: 2 };

export function validateGrid(settings: GridSettings) {
  for (const { key, label, min, max } of gridFields) {
    const value = settings[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${label} must be between ${min} and ${max} mm.`);
    }
  }
}

export function hexagons(aperture: Aperture, settings: GridSettings): Point[][] {
  const radius = settings.opening / Math.sqrt(3);
  const pitch = settings.opening + settings.wall;
  const rowStep = pitch * Math.sqrt(3) / 2;
  const columns = Math.ceil((aperture.width / 2 + radius) / pitch) + 1;
  const rows = Math.ceil((aperture.height / 2 + radius) / rowStep);
  const cells: Point[][] = [];
  for (let row = -rows; row <= rows; row++) {
    for (let col = -columns; col <= columns; col++) {
      const x = pitch * (col + (Math.abs(row) % 2) / 2);
      const y = row * rowStep;
      cells.push(Array.from({ length: 6 }, (_, vertex): Point => {
        const angle = (vertex + 0.5) * Math.PI / 3;
        return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
      }));
    }
  }
  return cells;
}
