import type { ResolvedCatalogModel } from '../catalog';
import { DEFAULT_APP_LOCALE, getLocaleBundle, type AppLocale } from '../i18n';
import type { BalancePolicy, SolveObjective, SolveRequest, SolveResult } from '../solver';
import { solveCatalogRequest } from '../solver/solve';
import {
  buildGlobalProliferatorOverrides,
  buildPreferredRecipeOverrides,
  buildWorkbenchRequest,
  mergeAdvancedSolveOverrides,
  parseAdvancedSolveOverrides,
  type EditableRecipePreference,
  type EditableTarget,
  type WorkbenchProliferatorPolicy,
} from './requestBuilder';

export interface ComputeWorkbenchSolveParams {
  catalog: ResolvedCatalogModel;
  targets: EditableTarget[];
  objective: SolveObjective;
  balancePolicy: BalancePolicy;
  proliferatorPolicy: WorkbenchProliferatorPolicy;
  rawInputItemIds: string[];
  disabledRawInputItemIds?: string[];
  disabledRecipeIds: string[];
  disabledBuildingIds: string[];
  recipePreferences: EditableRecipePreference[];
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
    rawInputItemIds,
    disabledRawInputItemIds,
    disabledRecipeIds,
    disabledBuildingIds,
    recipePreferences,
    advancedOverridesText,
    locale = DEFAULT_APP_LOCALE,
  } = params;
  const bundle = getLocaleBundle(locale);
  const parsedOverrides = parseAdvancedSolveOverrides(advancedOverridesText, locale);

  if (parsedOverrides.error) {
    return {
      request: undefined,
      result: null,
      error: parsedOverrides.error,
    };
  }

  const uiOverrides = mergeAdvancedSolveOverrides(
    {
      disabledRecipeIds,
      disabledBuildingIds,
    },
    mergeAdvancedSolveOverrides(
      buildPreferredRecipeOverrides(recipePreferences),
      buildGlobalProliferatorOverrides(catalog, proliferatorPolicy)
    )
  );
  const request = buildWorkbenchRequest({
    targets,
    objective,
    balancePolicy,
    rawInputItemIds,
    disabledRawInputItemIds,
    advancedOverrides: mergeAdvancedSolveOverrides(parsedOverrides.value, uiOverrides),
  });

  if (request.targets.length === 0) {
    return {
      request,
      result: null,
      error: bundle.solveRequest.validTargetRequired,
    };
  }

  try {
    return {
      request,
      result: solveCatalogRequest(catalog, request),
      error: '',
    };
  } catch (error) {
    return {
      request,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
