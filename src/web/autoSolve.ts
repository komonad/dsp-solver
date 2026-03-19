import type { ResolvedCatalogModel } from '../catalog';
import { DEFAULT_APP_LOCALE, getLocaleBundle, type AppLocale } from '../i18n';
import type { BalancePolicy, SolveObjective, SolveRequest, SolveResult } from '../solver';
import { solveCatalogRequest } from '../solver/solve';
import {
  buildForcedRecipeStrategyOverrides,
  buildGlobalProliferatorOverrides,
  buildPreferredRecipeOverrides,
  buildWorkbenchRequest,
  mergeAdvancedSolveOverrides,
  parseAdvancedSolveOverrides,
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
  autoPromoteUnavailableItemsToRawInputs: boolean;
  rawInputItemIds: string[];
  disabledRawInputItemIds?: string[];
  disabledRecipeIds: string[];
  disabledBuildingIds: string[];
  preferredRecipeByItem: Record<string, string>;
  recipePreferences: EditableRecipePreference[];
  recipeStrategyOverrides: EditableRecipeStrategyOverride[];
  advancedOverridesText: string;
  locale?: AppLocale;
}

export interface WorkbenchSolveState {
  request?: SolveRequest;
  result: SolveResult | null;
  error: string;
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
    balancePolicy,
    proliferatorPolicy,
    autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds,
    disabledRawInputItemIds,
    disabledRecipeIds,
    disabledBuildingIds,
    preferredRecipeByItem,
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
    };
  }

  const uiOverrides = mergeAdvancedSolveOverrides(
    mergeAdvancedSolveOverrides(
      {
        disabledRecipeIds,
        disabledBuildingIds,
        preferredRecipeByItem,
      },
      buildPreferredRecipeOverrides(recipePreferences)
    ),
    mergeAdvancedSolveOverrides(
      buildGlobalProliferatorOverrides(catalog, proliferatorPolicy),
      buildForcedRecipeStrategyOverrides(recipeStrategyOverrides)
    )
  );
  const request = buildWorkbenchRequest({
    targets,
    objective,
    balancePolicy,
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
    };
  }

  try {
    const result = solveCatalogRequest(catalog, request);
    const finishedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
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
      result,
      error: '',
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
    };
  }
}
