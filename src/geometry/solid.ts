import type { Manifold } from 'manifold-3d';
import type { GridMesh } from './protocol.ts';
import type { Bounds } from '../domain/definitions.ts';

export class SolidScope {
  private objects: { delete(): void }[] = [];
  own<T extends { delete(): void }>(value: T): T { this.objects.push(value); return value; }
  dispose() { for (const object of this.objects.reverse()) object.delete(); this.objects = []; }
}
export function validateSolid(solid: Manifold, scope: SolidScope, name = 'Printable part'): { mesh: GridMesh; bounds: Bounds; volumeMm3: number } {
  const volumeMm3 = solid.volume();
  if (solid.status() !== 'NoError' || solid.isEmpty() || !Number.isFinite(volumeMm3) || volumeMm3 <= 0) throw new Error('Geometry did not produce a valid positive-volume solid.');
  const components = solid.decompose(); components.forEach(c => scope.own(c));
  if (components.length !== 1) throw new Error(`${name} must be one connected solid.`);
  const data = solid.getMesh();
  const positions = new Float32Array(data.numVert * 3);
  for (let i = 0; i < data.numVert; i++) positions.set(data.vertProperties.subarray(i * data.numProp, i * data.numProp + 3), i * 3);
  if (!positions.every(Number.isFinite)) throw new Error('Geometry contains non-finite vertices.');
  const indices = new Uint32Array(data.triVerts);
  const edgeCounts = new Map<string, { count: number; winding: number }>();
  const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  positions.forEach((v, i) => { const axis = i % 3; bounds.min[axis] = Math.min(bounds.min[axis], v); bounds.max[axis] = Math.max(bounds.max[axis], v); });
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = [indices[i], indices[i + 1], indices[i + 2]];
    triangle.forEach((a, j) => {
      const b = triangle[(j + 1) % 3];
      if (a === b || a >= positions.length / 3 || b >= positions.length / 3) throw new Error('Invalid triangle indices.');
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      const edge = edgeCounts.get(key) ?? { count: 0, winding: 0 };
      edge.count++; edge.winding += a < b ? 1 : -1; edgeCounts.set(key, edge);
    });
  }
  if ([...edgeCounts.values()].some(e => e.count !== 2 || e.winding !== 0)) throw new Error('The printable mesh is not closed and consistently oriented.');
  return { mesh: { positions, indices }, bounds, volumeMm3 };
}
