import type { Design } from '../domain/project.ts';
import type { AssemblyResult } from '../generators/assembly.ts';
import type { GenerationResponse } from './protocol.ts';
export type WorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;
/** Debounce edits, terminate busy obsolete WASM work, and accept only the current revision. */
export class GeometryController {
  private worker?: WorkerPort;
  private timer?: ReturnType<typeof setTimeout>;
  private timeout?: ReturnType<typeof setTimeout>;
  private id = 0;
  private active = false;
  private completedBuilds = 0;
  private factory: () => WorkerPort;
  private ready: (result: AssemblyResult) => void;
  private failed: (message: string) => void;
  constructor(factory: () => WorkerPort, ready: (result: AssemblyResult) => void, failed: (message: string) => void) {
    this.factory = factory; this.ready = ready; this.failed = failed;
  }
  request(project: Design, projectRevision: number, delayMs = 120) {
    const id = ++this.id;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.active || this.completedBuilds >= 32) this.stopWorker();
      clearTimeout(this.timeout);
      try {
        if (!this.worker) this.worker = this.factory();
        const worker = this.worker;
        this.active = true;
        worker.onmessage = ({ data }: MessageEvent<GenerationResponse>) => {
          if (data.id !== this.id || data.projectRevision !== projectRevision || worker !== this.worker) return;
          this.active = false; clearTimeout(this.timeout);
          if ('error' in data) {
            this.stopWorker();
            this.failed(data.error);
          } else {
            // Bound the lifetime of the WASM heap during long editing sessions.
            this.completedBuilds++;
            this.ready(data.result);
          }
        };
        worker.onerror = () => {
          if (worker !== this.worker || id !== this.id) return;
          this.stopWorker(); this.failed('Geometry worker failed. Retry generation to continue.');
        };
        worker.postMessage({ id, projectRevision, project });
        this.timeout = setTimeout(() => {
          if (id !== this.id) return;
          this.stopWorker(); this.failed('Generation exceeded 15 seconds. Reduce complexity or retry.');
        }, 15000);
      } catch (error) { this.stopWorker(); this.failed(error instanceof Error ? error.message : String(error)); }
    }, delayMs);
  }
  invalidate() { ++this.id; clearTimeout(this.timer); this.stopWorker(); }
  private stopWorker() { clearTimeout(this.timeout); this.worker?.terminate(); this.worker = undefined; this.active = false; this.completedBuilds = 0; }
  dispose() { this.invalidate(); }
}
