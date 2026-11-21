import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { generateAssembly } from '../generators/assembly.ts';
import type { GenerationRequest, GenerationResponse } from './protocol.ts';
const kernel = Module({ locateFile: () => wasmUrl }).then(module => { module.setup(); return module; });
self.onmessage = async ({ data }: MessageEvent<GenerationRequest>) => {
  const { id, projectRevision, project } = data;
  try {
    const result = generateAssembly(await kernel, project, projectRevision);
    const response: GenerationResponse = { id, projectRevision, result };
    const transfer = result.parts.flatMap(part => [part.mesh.positions.buffer, part.mesh.indices.buffer]);
    self.postMessage(response, { transfer });
  } catch (error) {
    const response: GenerationResponse = { id, projectRevision, error: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  }
};
