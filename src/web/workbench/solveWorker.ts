import type { ResolvedCatalogModel } from '../../catalog';
import { solveCatalogRequest } from '../../solver';
import type { SolveWorkerRequest, SolveWorkerResponse } from './solveWorkerProtocol';

type SolveWorkerScope = {
  postMessage: (message: SolveWorkerResponse) => void;
  onmessage: ((event: MessageEvent<SolveWorkerRequest>) => void) | null;
};

const workerContext = globalThis as unknown as SolveWorkerScope;

let currentCatalog: ResolvedCatalogModel | null = null;
let currentCatalogVersion: string | null = null;

function postResponse(response: SolveWorkerResponse): void {
  workerContext.postMessage(response);
}

async function handleWorkerRequest(message: SolveWorkerRequest): Promise<void> {
  if (message.type === 'set_catalog') {
    currentCatalog = message.catalog;
    currentCatalogVersion = message.catalogVersion;
    postResponse({
      type: 'set_catalog_result',
      requestId: message.requestId,
      catalogVersion: message.catalogVersion,
    });
    return;
  }

  if (!currentCatalog || currentCatalogVersion !== message.catalogVersion) {
    throw new Error('Solve worker catalog is not initialized for this solve request.');
  }

  postResponse({
    type: 'progress',
    requestId: message.requestId,
    stage: message.attempt === 'relaxed' ? 'solving_relaxed' : 'solving_primary',
  });
  const result = solveCatalogRequest(currentCatalog, message.request);
  postResponse({
    type: 'solve_result',
    requestId: message.requestId,
    result,
  });
}

workerContext.onmessage = event => {
  const message = event.data as SolveWorkerRequest;
  void handleWorkerRequest(message).catch(error => {
    postResponse({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
};
