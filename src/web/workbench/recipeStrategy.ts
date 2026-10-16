import type { ResolvedCatalogModel } from '../../catalog';
import { DEFAULT_APP_LOCALE, getLocaleBundle, type AppLocale } from '../../i18n';
import type { BalancePolicy, SolveObjective } from '../../solver';
import { computeWorkbenchSolve } from './autoSolve';
import { parseAdvancedSolveOverrides } from './requestBuilder';
import { updateObjectiveWeightsText } from './objectiveWeights';
import type {
  EditablePreferredBuilding,
  EditableRecipePreference,
  EditableRecipeStrategyOverride,
  EditableTarget,
  WorkbenchProliferatorPolicy,
} from './requestBuilder';

export interface TryApplyRecipeStrategyOverrideParams {
  catalog: ResolvedCatalogModel;
  targets: EditableTarget[];
  objective: SolveObjective;
  balancePolicy: BalancePolicy;
  proliferatorPolicy: WorkbenchProliferatorPolicy;
  globalProliferatorLevel?: '' | number;
  autoPromoteUnavailableItemsToRawInputs: boolean;
  rawInputItemIds: string[];
  disabledRawInputItemIds: string[];
  disabledRecipeIds: string[];
  disabledBuildingIds: string[];
  allowedRecipesByItem: Record<string, string[]>;
  recipePreferences: EditableRecipePreference[];
  recipeStrategyOverrides: EditableRecipeStrategyOverride[];
  preferredBuildings: EditablePreferredBuilding[];
  advancedOverridesText: string;
  recipeId: string;
  patch: Partial<EditableRecipeStrategyOverride>;
  locale?: AppLocale;
}

export interface TryApplyRecipeStrategyOverrideResult {
  accepted: boolean;
  nextOverrides: EditableRecipeStrategyOverride[];
  message: string;
}

function normalizeStrategyOverride(
  catalog: ResolvedCatalogModel,
  override: EditableRecipeStrategyOverride
): EditableRecipeStrategyOverride | null {
  const recipe = catalog.recipeMap.get(override.recipeId);
  if (!recipe) {
    return null;
  }

  const forcedBuildingId = recipe.allowedBuildingIds.includes(override.forcedBuildingId)
    ? override.forcedBuildingId
    : '';

  const forcedProliferatorMode =
    override.forcedProliferatorMode &&
    recipe.supportsProliferatorModes.includes(override.forcedProliferatorMode)
      ? override.forcedProliferatorMode
      : '';

  let forcedProliferatorLevel: '' | number = '';
  if (forcedProliferatorMode === 'none') {
    forcedProliferatorLevel = 0;
  } else if (
    typeof override.forcedProliferatorLevel === 'number' &&
    Number.isFinite(override.forcedProliferatorLevel) &&
    override.forcedProliferatorLevel > 0 &&
    override.forcedProliferatorLevel <= recipe.maxProliferatorLevel
  ) {
    forcedProliferatorLevel = override.forcedProliferatorLevel;
  }

  if (!forcedBuildingId && !forcedProliferatorMode && forcedProliferatorLevel === '') {
    return null;
  }

  return {
    recipeId: recipe.recipeId,
    forcedBuildingId,
    forcedProliferatorMode,
    forcedProliferatorLevel,
  };
}

function upsertRecipeStrategyOverride(
  catalog: ResolvedCatalogModel,
  currentOverrides: EditableRecipeStrategyOverride[],
  recipeId: string,
  patch: Partial<EditableRecipeStrategyOverride>
): EditableRecipeStrategyOverride[] {
  const currentOverride =
    currentOverrides.find(override => override.recipeId === recipeId) ?? {
      recipeId,
      forcedBuildingId: '',
      forcedProliferatorMode: '',
      forcedProliferatorLevel: '',
    };

  const normalizedOverride = normalizeStrategyOverride(catalog, {
    ...currentOverride,
    ...patch,
    recipeId,
  });

  const remainingOverrides = currentOverrides.filter(override => override.recipeId !== recipeId);
  return normalizedOverride ? [...remainingOverrides, normalizedOverride] : remainingOverrides;
}

export function tryApplyRecipeStrategyOverride(
  params: TryApplyRecipeStrategyOverrideParams
): TryApplyRecipeStrategyOverrideResult {
  const {
    catalog,
    targets,
    objective,
    balancePolicy,
    proliferatorPolicy,
    globalProliferatorLevel,
    autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds,
    disabledRawInputItemIds,
    disabledRecipeIds,
    disabledBuildingIds,
    allowedRecipesByItem,
    recipePreferences,
    recipeStrategyOverrides,
    preferredBuildings,
    advancedOverridesText,
    recipeId,
    patch,
    locale = DEFAULT_APP_LOCALE,
  } = params;
  const nextOverrides = upsertRecipeStrategyOverride(
    catalog,
    recipeStrategyOverrides,
    recipeId,
    patch
  );

  const parsed = parseAdvancedSolveOverrides(advancedOverridesText, locale);
  // Strategy validation checks feasibility; recipe-count search belongs to the worker.
  const validationOverridesText = parsed.error ? advancedOverridesText : updateObjectiveWeightsText(advancedOverridesText, {
    recipeWeight: 0, recipeCountPenalty: undefined,
    objectiveWeights: parsed.value.objectiveWeights ? { ...parsed.value.objectiveWeights, recipes: 0 } : undefined,
  });
  const nextSolveState = computeWorkbenchSolve({
    catalog,
    targets,
    objective: objective === 'min_complexity' ? 'min_buildings' : objective,
    balancePolicy,
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
    recipeStrategyOverrides: nextOverrides,
    advancedOverridesText: validationOverridesText,
    locale,
  });

  if (nextSolveState.error) {
    return {
      accepted: false,
      nextOverrides: recipeStrategyOverrides,
      message: nextSolveState.error,
    };
  }

  if (!nextSolveState.result || !['optimal', 'feasible'].includes(nextSolveState.result.status)) {
    const diagnosticMessage =
      nextSolveState.result?.diagnostics.messages[0] ??
      nextSolveState.result?.diagnostics.unmetPreferences[0] ??
      '';
    return {
      accepted: false,
      nextOverrides: recipeStrategyOverrides,
      message: diagnosticMessage || getLocaleBundle(locale).recipeStrategy.infeasibleFallback,
    };
  }

  return {
    accepted: true,
    nextOverrides,
    message: '',
  };
}
