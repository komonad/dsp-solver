import type { ResolvedCatalogModel } from '../../catalog';
import { DEFAULT_APP_LOCALE, getLocaleBundle, type AppLocale } from '../../i18n';
import type { BalancePolicy, SolveObjective, SolveRequest, SolveResult } from '../../solver';
import { solveCatalogRequest } from '../../solver/solve';
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
  result: SolveResult | null;
  error: string;
  fallback?: {
    request: SolveRequest;
    result: SolveResult;
    reason: 'force_balance_infeasible';
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
  const bundle = getLocaleBundle(locale);
  const startedAt =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  const parsedOverrides = parseAdvancedSolveOverrides(advancedOverridesText, locale);

  if (parsedOverrides.error) {
    const durationMs =
      (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()) - startedAt;
    recordWorkbenchPerf({
      phase: 'solve',
      status: 'parse_error',
      durationMs,
      requestBuildMs: durationMs,
      recordedAt: Date.now(),
    });
    return {
      request: undefined,
      result: null,
      error: parsedOverrides.error,
      fallback: undefined,
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
      buildGlobalProliferatorOverrides(catalog, proliferatorPolicy, globalProliferatorLevel),
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
  const requestBuiltAt =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
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
      result: null,
      error: bundle.solveRequest.validTargetRequired,
      fallback: undefined,
    };
  }

  try {
    const strictResult = solveCatalogRequest(catalog, request);
    let effectiveRequest = request;
    let effectiveResult = strictResult;

    if (strictResult.status !== 'optimal') {
      const relaxedRequest: SolveRequest = {
        ...request,
        balancePolicy: 'allow_surplus',
      };
      const relaxedResult = solveCatalogRequest(catalog, relaxedRequest);
      if (relaxedResult.status === 'optimal') {
        effectiveRequest = relaxedRequest;
        effectiveResult = relaxedResult;
      }
    }
    const finishedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    recordWorkbenchPerf({
      phase: 'solve',
      status: effectiveResult.status,
      durationMs: finishedAt - startedAt,
      requestBuildMs,
      solveMs: finishedAt - requestBuiltAt,
      recordedAt: Date.now(),
    });
    return {
      request: effectiveRequest,
      result: effectiveResult,
      error: '',
      fallback: undefined,
    };
  } catch (error) {
    const finishedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
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
      result: null,
      error: error instanceof Error ? error.message : String(error),
      fallback: undefined,
    };
  }
}
