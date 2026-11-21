import type { ManifoldToplevel } from 'manifold-3d';
import { hexagons, roundedOutline, validateGrid } from '../geometry/profile.ts';
import type { Aperture, GridSettings } from '../geometry/profile.ts';
import type { GridMesh } from '../geometry/protocol.ts';

/** Generate a printable grid in millimetres, without browser or renderer dependencies. */
export function generateHoneycomb(kernel: ManifoldToplevel, aperture: Aperture, settings: GridSettings): GridMesh {
  const objects: { delete(): void }[] = [];
  function own<T extends { delete(): void }>(object: T): T {
    objects.push(object);
    return object;
  }
  try {
    validateGrid(settings);
    const { CrossSection } = kernel;
    const { frame, depth } = settings;
    const outer = own(new CrossSection([roundedOutline({
      width: aperture.width + 2 * frame,
      height: aperture.height + 2 * frame,
      radius: aperture.radius + frame,
    })]));
    const opening = own(new CrossSection([roundedOutline(aperture)]));
    const cells = own(new CrossSection(hexagons(aperture, settings)));
    const holes = own(cells.intersect(opening));
    const profile = own(outer.subtract(holes));
    const solid = own(profile.extrude(depth));
    if (solid.status() !== 'NoError' || solid.isEmpty() || !(solid.volume() > 0)) {
      throw new Error('The grid generator did not produce a valid solid.');
    }
    const components = solid.decompose();
    components.forEach(own);
    if (components.length !== 1) throw new Error('The grid must be one connected printable solid.');
    const mesh = solid.getMesh();
    const positions = new Float32Array(mesh.numVert * 3);
    for (let index = 0; index < mesh.numVert; index++) {
      positions.set(mesh.vertProperties.subarray(index * mesh.numProp, index * mesh.numProp + 3), index * 3);
    }
    if (!positions.every(Number.isFinite)) throw new Error('The grid contains non-finite coordinates.');
    return { positions, indices: new Uint32Array(mesh.triVerts) };
  } finally {
    for (const object of objects.reverse()) object.delete();
  }
}
