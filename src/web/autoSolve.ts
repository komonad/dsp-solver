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
  const parsedOverrides = parseAdvancedSolveOverrides(advancedOverridesText, locale);

  if (parsedOverrides.error) {
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
