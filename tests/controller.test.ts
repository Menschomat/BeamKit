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
const publish = (worker: FakeWorker, request: GenerationRequest) => {
  const result = { projectRevision: request.projectRevision } as AssemblyResult;
  worker.onmessage!({ data: { ...request, result } });
};

test('active builds finish and only the latest waiting edit is generated', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const worker = new FakeWorker(), ready: AssemblyResult[] = [];
  const controller = new GeometryController(() => worker as unknown as WorkerPort, result => ready.push(result), assert.fail);
  t.after(() => controller.dispose());
  controller.request(createDesign(), 1);
  t.mock.timers.tick(16);
  controller.request(createDesign(), 2);
  controller.request(createDesign(), 3);
  t.mock.timers.tick(160);
  assert.equal(worker.requests.length, 1);
  assert.equal(worker.terminated, false);
  publish(worker, worker.requests[0]);
  assert.deepEqual(ready.map(result => result.projectRevision), [1]);
  controller.request(createDesign(), 4);
  t.mock.timers.tick(16);
  assert.deepEqual(worker.requests.map(request => request.projectRevision), [1, 4]);
  publish(worker, worker.requests[0]);
  publish(worker, worker.requests[1]);
  assert.deepEqual(ready.map(result => result.projectRevision), [1, 4]);
});

test('superseded failures recover, current failures can retry, and invalidation cancels pending work', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const workers: FakeWorker[] = [], ready: AssemblyResult[] = [], errors: string[] = [];
  const controller = new GeometryController(() => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as WorkerPort; }, result => ready.push(result), error => errors.push(error));
  t.after(() => controller.dispose());
  controller.request(createDesign(), 1);
  t.mock.timers.tick(16);
  controller.request(createDesign(), 2);
  workers[0].onerror!();
  assert.ok(workers[0].terminated);
  assert.deepEqual(errors, []);
  publish(workers[0], workers[0].requests[0]);
  assert.deepEqual(ready, []);
  t.mock.timers.tick(16);
  const latest = workers[1].requests[0];
  workers[1].onmessage!({ data: { ...latest, error: 'Kernel failure' } });
  assert.deepEqual(errors, ['Kernel failure']);
  controller.request(createDesign(), 3);
  t.mock.timers.tick(16);
  controller.request(createDesign(), 4);
  controller.invalidate();
  assert.ok(workers[2].terminated);
  publish(workers[2], workers[2].requests[0]);
  t.mock.timers.tick(160);
  assert.equal(workers.length, 3);
  assert.deepEqual(ready, []);
  controller.request(createDesign(), 5);
  t.mock.timers.tick(16);
  publish(workers[3], workers[3].requests[0]);
  assert.equal(ready[0].projectRevision, 5);
});
