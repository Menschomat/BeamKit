import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { generateHoneycomb } from '../generators/honeycomb.ts';
import type { GridRequest, GridResponse } from './protocol.ts';

const kernel = Module({ locateFile: () => wasmUrl }).then((module) => {
  module.setup();
  return module;
});

self.onmessage = async ({ data }: MessageEvent<GridRequest>) => {
  const { id, aperture, settings } = data;
  try {
    const mesh = generateHoneycomb(await kernel, aperture, settings);
    const response: GridResponse = { id, ...mesh };
    self.postMessage(response, { transfer: [mesh.positions.buffer, mesh.indices.buffer] });
  } catch (error) {
    const response: GridResponse = { id, error: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  }
};
