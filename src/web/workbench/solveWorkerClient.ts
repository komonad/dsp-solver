import type { ResolvedCatalogModel } from '../../catalog';
import {
  solveCatalogRequestAsync,
  type SolveRequest,
  type SolveResult,
} from '../../solver';
import type { AsyncWorkbenchSolveContext } from './autoSolve';
import { SolveWorkerClient } from './solveWorkerClientCore';

let solveWorkerClient: SolveWorkerClient | null = null;

function getSolveWorkerClient(): SolveWorkerClient {
  solveWorkerClient ??= new SolveWorkerClient(
    () =>
      new Worker(new URL('./solveWorker.ts', import.meta.url), {
        type: 'module',
      })
  );
  return solveWorkerClient;
}

export async function solveCatalogRequestWithWorker(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  context: AsyncWorkbenchSolveContext
): Promise<SolveResult> {
  if (typeof Worker === 'undefined') {
    context.onProgress?.({
      stage: context.attempt === 'relaxed' ? 'solving_relaxed' : 'solving_primary',
    });
    return solveCatalogRequestAsync(catalog, request);
  }

  return getSolveWorkerClient().solve(catalog, request, context);
}

export function cancelSolveWorker(): void {
  solveWorkerClient?.cancelActiveSolve();
}
