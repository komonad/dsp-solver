import type { ResolvedCatalogModel } from '../../catalog';
import { DEFAULT_APP_LOCALE, type AppLocale } from '../../i18n';
import type { BalancePolicy, SolveObjective, SolveRequest, SolveResult } from '../../solver';
import { solveCatalogRequest, solveCatalogRequestAsync } from '../../solver/solve';
import {
  buildForcedRecipeStrategyOverrides,
  buildGlobalProliferatorOverrides,
  buildPreferredBuildingOverrides,
  buildPreferredRecipeOverrides,
  buildWorkbenchRequest,
  mergeAdvancedSolveOverrides,
  parseAdvancedSolveOverrides,
  type EditablePreferredBuilding,
  type EditableRecipePreference,
  type EditableRecipeStrategyOverride,
  type EditableTarget,
  type WorkbenchProliferatorPolicy,
} from './requestBuilder';
import { recordWorkbenchPerf } from './workbenchPerf';

export interface ComputeWorkbenchSolveParams {
  catalog: ResolvedCatalogModel;
  targets: EditableTarget[];
  objective: SolveObjective;
  balancePolicy: BalancePolicy;
  proliferatorPolicy: WorkbenchProliferatorPolicy;
  globalProliferatorLevel?: '' | number;
  autoPromoteUnavailableItemsToRawInputs: boolean;
  rawInputItemIds: string[];
  disabledRawInputItemIds?: string[];
  disabledRecipeIds: string[];
  disabledBuildingIds: string[];
  allowedRecipesByItem: Record<string, string[]>;
  preferredBuildings: EditablePreferredBuilding[];
  recipePreferences: EditableRecipePreference[];
  recipeStrategyOverrides: EditableRecipeStrategyOverride[];
  advancedOverridesText: string;
  locale?: AppLocale;
}

export interface WorkbenchSolveState {
  request?: SolveRequest;
  activeRequest?: SolveRequest;
  result: SolveResult | null;
  error: string;
  fallback?: {
    request: SolveRequest;
    result: SolveResult;
    reason: 'force_balance_infeasible';
  };
  activity: WorkbenchSolveActivity;
}

/**
 * Serialized workbench solve state stored with a saved workbench config.
 *
 * Running solve attempts are normalized away before persistence so reloading
 * the page restores the last meaningful request/result pair instead of a
 * phantom in-flight solve.
 */
export interface PersistedWorkbenchSolveState {
  request?: SolveRequest;
  result: SolveResult | null;
  error: string;
  fallback?: {
    request: SolveRequest;
    result: SolveResult;
    reason: 'force_balance_infeasible';
  };
  activityStatus: 'idle' | 'settled' | 'cancelled';
  inputKey?: string;
}

export interface WorkbenchSolveInputKeyParams {
  catalogSignature: string;
  targets: EditableTarget[];
  objective: SolveObjective;
  balancePolicy: BalancePolicy;
  proliferatorPolicy: WorkbenchProliferatorPolicy;
  globalProliferatorLevel?: '' | number;
  autoPromoteUnavailableItemsToRawInputs: boolean;
  rawInputItemIds: string[];
  disabledRawInputItemIds?: string[];
  disabledRecipeIds: string[];
  disabledBuildingIds: string[];
  allowedRecipesByItem: Record<string, string[]>;
  preferredBuildings: EditablePreferredBuilding[];
  recipePreferences: EditableRecipePreference[];
  recipeStrategyOverrides: EditableRecipeStrategyOverride[];
  advancedOverridesText: string;
  locale?: AppLocale;
  isLoading?: boolean;
}

export type WorkbenchSolveStage =
  | 'preparing_request'
  | 'syncing_catalog'
  | 'loading_solver'
  | 'solving_primary'
  | 'solving_relaxed';

export interface WorkbenchSolveActivity {
  status: 'idle' | 'running' | 'settled' | 'cancelled';
  startedAtEpochMs?: number;
  finishedAtEpochMs?: number;
  staleResult: boolean;
  stage?: WorkbenchSolveStage;
}

export interface WorkbenchSolveProgressUpdate {
  stage: WorkbenchSolveStage;
  activeRequest?: SolveRequest;
}

export interface AsyncWorkbenchSolveContext {
  attempt: 'primary' | 'relaxed';
  onProgress?: (progress: WorkbenchSolveProgressUpdate) => void;
}

export type AsyncWorkbenchSolveExecutor = (
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  context: AsyncWorkbenchSolveContext
) => Promise<SolveResult>;

interface PreparedWorkbenchSolve {
  request?: SolveRequest;
  requestBuildMs: number;
  requestBuiltAt: number;
  startedAt: number;
  earlyState?: WorkbenchSolveState;
}

function currentTimeMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function currentEpochMs(): number {
  return Date.now();
}

export function buildIdleWorkbenchSolveState(): WorkbenchSolveState {
  return {
    request: undefined,
    activeRequest: undefined,
    result: null,
    error: '',
    fallback: undefined,
    activity: {
      status: 'idle',
      staleResult: false,
      stage: undefined,
    },
  };
}

export function buildRunningWorkbenchSolveState(
  previousState: WorkbenchSolveState,
  options: {
    startedAtEpochMs?: number;
    stage?: WorkbenchSolveStage;
    activeRequest?: SolveRequest;
  } = {}
): WorkbenchSolveState {
  const startedAtEpochMs =
    options.startedAtEpochMs ??
    (previousState.activity.status === 'running'
      ? previousState.activity.startedAtEpochMs
      : undefined) ??
    currentEpochMs();
  return {
    ...previousState,
    activeRequest: options.activeRequest ?? previousState.activeRequest,
    error: '',
    activity: {
      status: 'running',
      startedAtEpochMs,
      staleResult: Boolean(previousState.result),
      stage:
        options.stage ??
        (previousState.activity.status === 'running'
          ? previousState.activity.stage
          : undefined) ??
        'preparing_request',
    },
  };
}

export function buildCancelledWorkbenchSolveState(
  previousState: WorkbenchSolveState
): WorkbenchSolveState {
  return {
    ...previousState,
    error: '',
    activity: {
      status: 'cancelled',
      startedAtEpochMs: previousState.activity.startedAtEpochMs,
      finishedAtEpochMs: currentEpochMs(),
      staleResult: Boolean(previousState.result),
      stage: previousState.activity.stage,
    },
  };
}

function normalizePersistedWorkbenchSolveActivityStatus(
  state: WorkbenchSolveState
): PersistedWorkbenchSolveState['activityStatus'] {
  if (state.activity.status === 'running') {
    return state.request || state.result || state.error ? 'settled' : 'idle';
  }

  return state.activity.status;
}

export function persistWorkbenchSolveState(
  state: WorkbenchSolveState,
  options: {
    inputKey?: string;
  } = {}
): PersistedWorkbenchSolveState {
  const activityStatus = normalizePersistedWorkbenchSolveActivityStatus(state);
  return {
    request: state.request,
    result: state.result,
    error: state.error,
    fallback: state.fallback,
    activityStatus,
    inputKey: activityStatus === 'settled' ? options.inputKey : undefined,
  };
}

export function restoreWorkbenchSolveState(
  state?: PersistedWorkbenchSolveState | null
): WorkbenchSolveState {
  if (!state) {
    return buildIdleWorkbenchSolveState();
  }

  return {
    request: state.request,
    activeRequest: undefined,
    result: state.result,
    error: state.error,
    fallback: state.fallback,
    activity: {
      status: state.activityStatus,
      staleResult: false,
      stage: undefined,
    },
  };
}

function isEmptyIdlePersistedWorkbenchSolveState(
  state: PersistedWorkbenchSolveState
): boolean {
  return (
    state.activityStatus === 'idle' &&
    !state.request &&
    !state.result &&
    !state.error &&
    !state.fallback
  );
}

export function preserveReusableSettledWorkbenchSolveState(params: {
  existingState?: PersistedWorkbenchSolveState | null;
  nextState: PersistedWorkbenchSolveState;
  expectedInputKey?: string | null;
}): PersistedWorkbenchSolveState {
  const { existingState, nextState, expectedInputKey } = params;

  if (
    isEmptyIdlePersistedWorkbenchSolveState(nextState) &&
    existingState?.activityStatus === 'settled' &&
    expectedInputKey &&
    existingState.inputKey === expectedInputKey
  ) {
    return existingState;
  }

  return nextState;
}

export function buildWorkbenchSolveInputKey(
  params: WorkbenchSolveInputKeyParams
): string {
  return JSON.stringify({
    catalogSignature: params.catalogSignature,
    targets: params.targets,
    objective: params.objective,
    balancePolicy: params.balancePolicy,
    proliferatorPolicy: params.proliferatorPolicy,
    globalProliferatorLevel: params.globalProliferatorLevel,
    autoPromoteUnavailableItemsToRawInputs:
      params.autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds: params.rawInputItemIds,
    disabledRawInputItemIds: params.disabledRawInputItemIds,
    disabledRecipeIds: params.disabledRecipeIds,
    disabledBuildingIds: params.disabledBuildingIds,
    allowedRecipesByItem: params.allowedRecipesByItem,
    preferredBuildings: params.preferredBuildings,
    recipePreferences: params.recipePreferences,
    recipeStrategyOverrides: params.recipeStrategyOverrides,
    advancedOverridesText: params.advancedOverridesText,
    locale: params.locale,
    isLoading: params.isLoading ?? false,
  });
}

export function findReusableWorkbenchSolveInputKey(
  state: PersistedWorkbenchSolveState | null | undefined,
  params: WorkbenchSolveInputKeyParams
): string | null {
  if (!state || state.activityStatus !== 'settled' || !state.inputKey) {
    return null;
  }

  const expectedInputKey = buildWorkbenchSolveInputKey(params);
  return state.inputKey === expectedInputKey ? expectedInputKey : null;
}

function isCancelledWorkbenchSolveError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message === 'Solve cancelled by user.' || message === 'Solve superseded by a newer request.';
}

function isNonFatalRelaxedSolveError(error: unknown): boolean {
  return !isCancelledWorkbenchSolveError(error);
}

function buildCancelledWorkbenchSolveStateForRequest(params: {
  startedAt: number;
  requestBuiltAt: number;
  requestBuildMs: number;
  request?: SolveRequest;
}): WorkbenchSolveState {
  const { startedAt, requestBuiltAt, requestBuildMs, request } = params;
  const finishedAt = currentTimeMs();
  recordWorkbenchPerf({
    phase: 'solve',
    status: 'cancelled',
    durationMs: finishedAt - startedAt,
    requestBuildMs,
    solveMs: finishedAt - requestBuiltAt,
    recordedAt: Date.now(),
  });
  return {
    request,
    activeRequest: request,
    result: null,
    error: '',
    fallback: undefined,
    activity: {
      status: 'cancelled',
      finishedAtEpochMs: currentEpochMs(),
      staleResult: false,
      stage: undefined,
    },
  };
}

function prepareWorkbenchSolve(params: ComputeWorkbenchSolveParams): PreparedWorkbenchSolve {
  const {
    catalog,
    targets,
    objective,
    proliferatorPolicy,
    globalProliferatorLevel,
    autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds,
    disabledRawInputItemIds,
    disabledRecipeIds,
    disabledBuildingIds,
    allowedRecipesByItem,
    preferredBuildings,
    recipePreferences,
    recipeStrategyOverrides,
    advancedOverridesText,
    locale = DEFAULT_APP_LOCALE,
  } = params;
  const startedAt = currentTimeMs();
  const parsedOverrides = parseAdvancedSolveOverrides(advancedOverridesText, locale);

  if (parsedOverrides.error) {
    const durationMs = currentTimeMs() - startedAt;
    recordWorkbenchPerf({
      phase: 'solve',
      status: 'parse_error',
      durationMs,
      requestBuildMs: durationMs,
      recordedAt: Date.now(),
    });
    return {
      startedAt,
      requestBuiltAt: startedAt,
      requestBuildMs: durationMs,
      earlyState: {
        request: undefined,
        activeRequest: undefined,
        result: null,
        error: parsedOverrides.error,
        fallback: undefined,
        activity: {
          status: 'settled',
          finishedAtEpochMs: currentEpochMs(),
          staleResult: false,
          stage: undefined,
        },
      },
    };
  }

  const uiOverrides = mergeAdvancedSolveOverrides(
    mergeAdvancedSolveOverrides(
      mergeAdvancedSolveOverrides(
        {
          disabledRecipeIds,
          disabledBuildingIds,
          allowedRecipesByItem,
        },
        buildPreferredBuildingOverrides(catalog, preferredBuildings)
      ),
      buildPreferredRecipeOverrides(recipePreferences)
    ),
    mergeAdvancedSolveOverrides(
      buildGlobalProliferatorOverrides(proliferatorPolicy, globalProliferatorLevel),
      buildForcedRecipeStrategyOverrides(recipeStrategyOverrides)
    )
  );
  const request = buildWorkbenchRequest({
    targets,
    objective,
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds,
    disabledRawInputItemIds,
    advancedOverrides: mergeAdvancedSolveOverrides(parsedOverrides.value, uiOverrides),
  });
  const requestBuiltAt = currentTimeMs();
  const requestBuildMs = requestBuiltAt - startedAt;

  if (request.targets.length === 0) {
    recordWorkbenchPerf({
      phase: 'solve',
      status: 'empty_target',
      durationMs: requestBuildMs,
      requestBuildMs,
      recordedAt: Date.now(),
    });
    return {
      request,
      startedAt,
      requestBuiltAt,
      requestBuildMs,
      earlyState: {
        request,
        activeRequest: request,
        result: null,
        error: '',
        fallback: undefined,
        activity: {
          status: 'settled',
          finishedAtEpochMs: currentEpochMs(),
          staleResult: false,
          stage: undefined,
        },
      },
    };
  }

  return {
    request,
    startedAt,
    requestBuiltAt,
    requestBuildMs,
  };
}

function buildCompletedWorkbenchSolveState(params: {
  startedAt: number;
  requestBuiltAt: number;
  requestBuildMs: number;
  request: SolveRequest;
  result: SolveResult;
}): WorkbenchSolveState {
  const { startedAt, requestBuiltAt, requestBuildMs, request, result } = params;
  const finishedAt = currentTimeMs();
  recordWorkbenchPerf({
    phase: 'solve',
    status: result.status,
    durationMs: finishedAt - startedAt,
    requestBuildMs,
    solveMs: finishedAt - requestBuiltAt,
    recordedAt: Date.now(),
  });
  return {
    request,
    activeRequest: request,
    result,
    error: '',
    fallback: undefined,
    activity: {
      status: 'settled',
      finishedAtEpochMs: currentEpochMs(),
      staleResult: false,
      stage: undefined,
    },
  };
}

function buildExceptionalWorkbenchSolveState(params: {
  startedAt: number;
  requestBuiltAt: number;
  requestBuildMs: number;
  request?: SolveRequest;
  error: unknown;
}): WorkbenchSolveState {
  const { startedAt, requestBuiltAt, requestBuildMs, request, error } = params;
  const finishedAt = currentTimeMs();
  recordWorkbenchPerf({
    phase: 'solve',
    status: 'exception',
    durationMs: finishedAt - startedAt,
    requestBuildMs,
    solveMs: finishedAt - requestBuiltAt,
    recordedAt: Date.now(),
  });
  return {
    request,
    activeRequest: request,
    result: null,
    error: error instanceof Error ? error.message : String(error),
    fallback: undefined,
    activity: {
      status: 'settled',
      finishedAtEpochMs: currentEpochMs(),
      staleResult: false,
      stage: undefined,
    },
  };
}

function runWorkbenchSolve(
  catalog: ResolvedCatalogModel,
  request: SolveRequest
): WorkbenchSolveState {
  const strictResult = solveCatalogRequest(catalog, request);
  let effectiveRequest = request;
  let effectiveResult = strictResult;

  if (strictResult.status !== 'optimal') {
    const relaxedRequest: SolveRequest = {
      ...request,
      balancePolicy: 'allow_surplus',
    };
    try {
      const relaxedResult = solveCatalogRequest(catalog, relaxedRequest);
      if (relaxedResult.status === 'optimal') {
        effectiveRequest = relaxedRequest;
        effectiveResult = relaxedResult;
      }
    } catch (error) {
      if (!isNonFatalRelaxedSolveError(error)) {
        throw error;
      }
    }
  }

  return {
    request: effectiveRequest,
    activeRequest: effectiveRequest,
    result: effectiveResult,
    error: '',
    fallback: undefined,
    activity: {
      status: 'settled',
      finishedAtEpochMs: currentEpochMs(),
      staleResult: false,
      stage: undefined,
    },
  };
}

async function runWorkbenchSolveAsync(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  executeSolve: AsyncWorkbenchSolveExecutor,
  onProgress?: (progress: WorkbenchSolveProgressUpdate) => void
): Promise<WorkbenchSolveState> {
  const strictResult = await executeSolve(catalog, request, {
    attempt: 'primary',
    onProgress,
  });
  let effectiveRequest = request;
  let effectiveResult = strictResult;

  if (strictResult.status !== 'optimal') {
    const relaxedRequest: SolveRequest = {
      ...request,
      balancePolicy: 'allow_surplus',
    };
    try {
      const relaxedResult = await executeSolve(catalog, relaxedRequest, {
        attempt: 'relaxed',
        onProgress,
      });
      if (relaxedResult.status === 'optimal') {
        effectiveRequest = relaxedRequest;
        effectiveResult = relaxedResult;
      }
    } catch (error) {
      if (!isNonFatalRelaxedSolveError(error)) {
        throw error;
      }
    }
  }

  return {
    request: effectiveRequest,
    activeRequest: effectiveRequest,
    result: effectiveResult,
    error: '',
    fallback: undefined,
    activity: {
      status: 'settled',
      finishedAtEpochMs: currentEpochMs(),
      staleResult: false,
      stage: undefined,
    },
  };
}

/**
 * Build the effective workbench request and solve it using the current editor
 * state. Keeping this as a pure function makes the frontend solve flow
 * independently testable without requiring React rendering.
 */
export function computeWorkbenchSolve(
  params: ComputeWorkbenchSolveParams
): WorkbenchSolveState {
  const prepared = prepareWorkbenchSolve(params);
  if (prepared.earlyState || !prepared.request) {
    return prepared.earlyState ?? buildIdleWorkbenchSolveState();
  }

  try {
    const nextState = runWorkbenchSolve(params.catalog, prepared.request);
    if (!nextState.request || !nextState.result) {
      return nextState;
    }

    return buildCompletedWorkbenchSolveState({
      startedAt: prepared.startedAt,
      requestBuiltAt: prepared.requestBuiltAt,
      requestBuildMs: prepared.requestBuildMs,
      request: nextState.request,
      result: nextState.result,
    });
  } catch (error) {
    if (isCancelledWorkbenchSolveError(error)) {
      return buildCancelledWorkbenchSolveStateForRequest({
        startedAt: prepared.startedAt,
        requestBuiltAt: prepared.requestBuiltAt,
        requestBuildMs: prepared.requestBuildMs,
        request: prepared.request,
      });
    }
    return buildExceptionalWorkbenchSolveState({
      startedAt: prepared.startedAt,
      requestBuiltAt: prepared.requestBuiltAt,
      requestBuildMs: prepared.requestBuildMs,
      request: prepared.request,
      error,
    });
  }
}

export async function computeWorkbenchSolveAsync(
  params: ComputeWorkbenchSolveParams,
  executeSolve: AsyncWorkbenchSolveExecutor = (catalog, request) =>
    solveCatalogRequestAsync(catalog, request),
  onProgress?: (progress: WorkbenchSolveProgressUpdate) => void
): Promise<WorkbenchSolveState> {
  const prepared = prepareWorkbenchSolve(params);
  if (prepared.earlyState || !prepared.request) {
    return prepared.earlyState ?? buildIdleWorkbenchSolveState();
  }
  onProgress?.({
    stage: 'preparing_request',
    activeRequest: prepared.request,
  });

  try {
    const nextState = await runWorkbenchSolveAsync(
      params.catalog,
      prepared.request,
      executeSolve,
      onProgress
    );
    if (!nextState.request || !nextState.result) {
      return nextState;
    }

    return buildCompletedWorkbenchSolveState({
      startedAt: prepared.startedAt,
      requestBuiltAt: prepared.requestBuiltAt,
      requestBuildMs: prepared.requestBuildMs,
      request: nextState.request,
      result: nextState.result,
    });
  } catch (error) {
    if (isCancelledWorkbenchSolveError(error)) {
      return buildCancelledWorkbenchSolveStateForRequest({
        startedAt: prepared.startedAt,
        requestBuiltAt: prepared.requestBuiltAt,
        requestBuildMs: prepared.requestBuildMs,
        request: prepared.request,
      });
    }
    return buildExceptionalWorkbenchSolveState({
      startedAt: prepared.startedAt,
      requestBuiltAt: prepared.requestBuiltAt,
      requestBuildMs: prepared.requestBuildMs,
      request: prepared.request,
      error,
    });
  }
}
