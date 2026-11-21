import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { hexagons, roundedOutline, validateGrid } from './profile.ts';
import type { GridRequest, GridResponse } from './protocol.ts';

const kernel = Module({ locateFile: () => wasmUrl }).then((module) => {
  module.setup();
  return module;
});

self.onmessage = async ({ data }: MessageEvent<GridRequest>) => {
  const { id, aperture, settings } = data;
  const objects: { delete(): void }[] = [];
  function own<T extends { delete(): void }>(object: T): T {
    objects.push(object);
    return object;
  }

  try {
    validateGrid(settings);
    const { CrossSection } = await kernel;
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
    const mesh = solid.getMesh();
    const positions = new Float32Array(mesh.numVert * 3);
    for (let index = 0; index < mesh.numVert; index++) {
      positions.set(mesh.vertProperties.subarray(index * mesh.numProp, index * mesh.numProp + 3), index * 3);
    }
    const indices = new Uint32Array(mesh.triVerts);
    const response: GridResponse = { id, positions, indices };
    self.postMessage(response, { transfer: [positions.buffer, indices.buffer] });
  } catch (error) {
    const response: GridResponse = { id, error: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  } finally {
    for (const object of objects.reverse()) object.delete();
  }
};
