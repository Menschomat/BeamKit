import assert from 'node:assert/strict';
import test from 'node:test';
import { GeometryController } from '../src/geometry/controller.ts';
import type { WorkerPort } from '../src/geometry/controller.ts';
import { createDesign } from '../src/domain/project.ts';
import type { GenerationRequest, GenerationResponse } from '../src/geometry/protocol.ts';
import type { AssemblyResult } from '../src/generators/assembly.ts';
class FakeWorker {
  onmessage: ((event: { data: GenerationResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  requests: GenerationRequest[] = [];
  terminated = false;
  postMessage(request: GenerationRequest) { this.requests.push(request); }
  terminate() { this.terminated = true; }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
test('newest revision wins, obsolete busy work terminates, and errors can retry', async () => {
  const workers: FakeWorker[] = [], ready: AssemblyResult[] = [], errors: string[] = [];
  const controller = new GeometryController(() => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as WorkerPort; }, result => ready.push(result), error => errors.push(error));
  try {
    controller.request(createDesign(), 1, 0); await tick();
    const oldCallback = workers[0].onmessage!, old = workers[0].requests[0];
    controller.request(createDesign(), 2, 0); await tick();
    assert.ok(workers[0].terminated);
    oldCallback({ data: { id: old.id, projectRevision: 1, result: { projectRevision: 1 } as AssemblyResult } });
    assert.equal(ready.length, 0);
    const latest = workers[1].requests[0];
    workers[1].onmessage!({ data: { id: latest.id, projectRevision: 2, result: { projectRevision: 2 } as AssemblyResult } });
    assert.equal(ready[0].projectRevision, 2);
    controller.request(createDesign(), 3, 0); await tick(); workers[1].onerror!();
    assert.equal(errors.length, 1);
    controller.request(createDesign(), 4, 0); await tick(); assert.equal(workers.length, 3);
    const retry = workers[2].requests[0]; workers[2].onmessage!({ data: { id: retry.id, projectRevision: 4, error: 'Kernel failure' } });
    assert.equal(errors.at(-1), 'Kernel failure');
    controller.request(createDesign(), 5, 100); controller.invalidate(); await tick();
    assert.ok(workers[2].terminated);
  } finally { controller.dispose(); }
});
