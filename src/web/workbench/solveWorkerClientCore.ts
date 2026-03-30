import type { ResolvedCatalogModel } from '../../catalog';
import type { SolveRequest, SolveResult } from '../../solver';
import type { AsyncWorkbenchSolveContext } from './autoSolve';
import type { SolveWorkerRequest, SolveWorkerResponse } from './solveWorkerProtocol';

type WorkerLike = Pick<Worker, 'onmessage' | 'onerror' | 'postMessage' | 'terminate'>;

type PendingRequest =
  | {
      type: 'set_catalog';
      resolve: () => void;
      reject: (error: Error) => void;
    }
  | {
      type: 'solve';
      resolve: (result: SolveResult) => void;
      reject: (error: Error) => void;
      onProgress?: AsyncWorkbenchSolveContext['onProgress'];
    };

export class SolveWorkerClient {
  private activeSolve = false;
  private currentCatalog: ResolvedCatalogModel | null = null;
  private currentCatalogVersion: string | null = null;
  private nextCatalogVersion = 1;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private worker: WorkerLike | null = null;
  private workerCatalogVersion: string | null = null;

  constructor(private readonly createWorkerInstance: () => WorkerLike) {}

  async solve(
    catalog: ResolvedCatalogModel,
    request: SolveRequest,
    context: AsyncWorkbenchSolveContext
  ): Promise<SolveResult> {
    if (this.activeSolve) {
      this.resetWorker('Solve superseded by a newer request.');
    }

    this.activeSolve = true;
    try {
      const catalogVersion = await this.ensureCatalog(catalog, context);
      return await this.sendSolveRequest(catalogVersion, request, context);
    } finally {
      this.activeSolve = false;
    }
  }

  cancelActiveSolve(reason = 'Solve cancelled by user.'): void {
    if (!this.activeSolve) {
      return;
    }

    this.activeSolve = false;
    this.resetWorker(reason);
  }

  private createWorker(): WorkerLike {
    const worker = this.createWorkerInstance();
    worker.onmessage = event => {
      if (this.worker !== worker) {
        return;
      }
      this.handleWorkerMessage(event.data as SolveWorkerResponse);
    };
    worker.onerror = event => {
      if (this.worker !== worker) {
        return;
      }
      const message = event.message || 'Solve worker crashed.';
      this.resetWorker(message);
    };
    return worker;
  }

  private ensureWorker(): WorkerLike {
    if (!this.worker) {
      this.worker = this.createWorker();
    }
    return this.worker;
  }

  private handleWorkerMessage(message: SolveWorkerResponse): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) {
      return;
    }

    if (message.type === 'error') {
      this.pendingRequests.delete(message.requestId);
      pending.reject(new Error(message.message));
      return;
    }

    if (message.type === 'progress') {
      if (pending.type === 'solve') {
        pending.onProgress?.({
          stage: message.stage,
        });
      }
      return;
    }

    this.pendingRequests.delete(message.requestId);

    if (message.type === 'set_catalog_result') {
      this.workerCatalogVersion = message.catalogVersion;
      if (pending.type === 'set_catalog') {
        pending.resolve();
      }
      return;
    }

    if (pending.type === 'solve') {
      pending.resolve(message.result);
    }
  }

  private resetWorker(errorMessage: string): void {
    const activeWorker = this.worker;
    if (activeWorker) {
      activeWorker.onmessage = null;
      activeWorker.onerror = null;
      activeWorker.terminate();
      this.worker = null;
    }

    this.workerCatalogVersion = null;

    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error(errorMessage));
    }
    this.pendingRequests.clear();
  }

  private async ensureCatalog(
    catalog: ResolvedCatalogModel,
    context: AsyncWorkbenchSolveContext
  ): Promise<string> {
    if (this.currentCatalog !== catalog) {
      this.currentCatalog = catalog;
      this.currentCatalogVersion = `catalog-${this.nextCatalogVersion++}`;
    }

    if (!this.currentCatalogVersion) {
      throw new Error('Missing catalog version for solve worker.');
    }

    if (this.workerCatalogVersion === this.currentCatalogVersion) {
      return this.currentCatalogVersion;
    }

    context.onProgress?.({
      stage: 'syncing_catalog',
    });
    const requestId = this.nextRequestId++;
    const worker = this.ensureWorker();
    await new Promise<void>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        type: 'set_catalog',
        resolve,
        reject,
      });

      const message: SolveWorkerRequest = {
        type: 'set_catalog',
        requestId,
        catalogVersion: this.currentCatalogVersion!,
        catalog,
      };
      worker.postMessage(message);
    });

    return this.currentCatalogVersion;
  }

  private async sendSolveRequest(
    catalogVersion: string,
    request: SolveRequest,
    context: AsyncWorkbenchSolveContext
  ): Promise<SolveResult> {
    const requestId = this.nextRequestId++;
    const worker = this.ensureWorker();

    return new Promise<SolveResult>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        type: 'solve',
        resolve,
        reject,
        onProgress: context.onProgress,
      });

      const message: SolveWorkerRequest = {
        type: 'solve',
        requestId,
        catalogVersion,
        request,
        attempt: context.attempt,
      };
      worker.postMessage(message);
    });
  }
}
