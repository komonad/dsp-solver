import type { ResolvedCatalogModel } from '../../catalog';
import type { SolveRequest, SolveResult } from '../../solver';

export interface SolveWorkerSetCatalogRequest {
  type: 'set_catalog';
  requestId: number;
  catalogVersion: string;
  catalog: ResolvedCatalogModel;
}

export interface SolveWorkerSolveRequest {
  type: 'solve';
  requestId: number;
  catalogVersion: string;
  request: SolveRequest;
  attempt: 'primary' | 'relaxed';
}

export type SolveWorkerRequest = SolveWorkerSetCatalogRequest | SolveWorkerSolveRequest;

export interface SolveWorkerSetCatalogResponse {
  type: 'set_catalog_result';
  requestId: number;
  catalogVersion: string;
}

export interface SolveWorkerSolveResponse {
  type: 'solve_result';
  requestId: number;
  result: SolveResult;
}

export interface SolveWorkerProgressResponse {
  type: 'progress';
  requestId: number;
  stage: 'loading_solver' | 'solving_primary' | 'solving_relaxed';
}

export interface SolveWorkerErrorResponse {
  type: 'error';
  requestId: number;
  message: string;
}

export type SolveWorkerResponse =
  | SolveWorkerSetCatalogResponse
  | SolveWorkerProgressResponse
  | SolveWorkerSolveResponse
  | SolveWorkerErrorResponse;
