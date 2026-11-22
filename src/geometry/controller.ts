import type { Design } from '../domain/project.ts';
import type { AssemblyResult } from '../generators/assembly.ts';
import type { GenerationRequest, GenerationResponse } from './protocol.ts';

export type WorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;

/** Let each build finish while coalescing new edits into a single pending request. */
export class GeometryController {
  private worker?: WorkerPort;
  private timer?: ReturnType<typeof setTimeout>;
  private timeout?: ReturnType<typeof setTimeout>;
  private active?: GenerationRequest;
  private pending?: GenerationRequest;
  private id = 0;
  private completedBuilds = 0;
  private factory: () => WorkerPort;
  private ready: (result: AssemblyResult) => void;
  private failed: (message: string) => void;

  constructor(
    factory: () => WorkerPort,
    ready: (result: AssemblyResult) => void,
    failed: (message: string) => void,
  ) {
    this.factory = factory;
    this.ready = ready;
    this.failed = failed;
  }

  request(project: Design, projectRevision: number) {
    this.pending = { id: ++this.id, projectRevision, project };
    this.schedule();
  }

  private schedule() {
    if (this.active || !this.pending || this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.start();
    }, 16);
  }

  private start() {
    const request = this.pending;
    if (!request) return;
    this.pending = undefined;
    // Bound the lifetime of the WASM heap during long editing sessions.
    if (this.completedBuilds >= 32) this.stopWorker();
    this.active = request;
    try {
      const worker = this.worker ??= this.factory();
      worker.onmessage = ({ data }: MessageEvent<GenerationResponse>) => {
        if (worker !== this.worker || this.active !== request ||
            data.id !== request.id || data.projectRevision !== request.projectRevision) return;
        if ('error' in data) {
          this.fail(request, data.error);
          return;
        }
        clearTimeout(this.timeout);
        this.active = undefined;
        this.completedBuilds++;
        this.schedule();
        this.ready(data.result);
      };
      worker.onerror = () => {
        if (worker !== this.worker) return;
        this.fail(request, 'Geometry worker failed. Retry generation to continue.');
      };
      this.timeout = setTimeout(() => {
        this.fail(request, 'Generation exceeded 15 seconds. Reduce complexity or retry.');
      }, 15000);
      worker.postMessage(request);
    } catch (error) {
      this.fail(request, error instanceof Error ? error.message : String(error));
    }
  }

  private fail(request: GenerationRequest, message: string) {
    if (this.active !== request) return;
    this.stopWorker();
    if (this.pending) this.schedule();
    else this.failed(message);
  }

  invalidate() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
    this.stopWorker();
  }

  private stopWorker() {
    clearTimeout(this.timeout);
    this.worker?.terminate();
    this.worker = undefined;
    this.active = undefined;
    this.completedBuilds = 0;
  }

  dispose() { this.invalidate(); }
}
