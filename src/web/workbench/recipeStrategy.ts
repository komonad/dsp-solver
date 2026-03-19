import type { ProliferatorMode, ResolvedCatalogModel } from '../../catalog';
import { DEFAULT_APP_LOCALE, type AppLocale } from '../../i18n';
import type { BalancePolicy, SolveObjective } from '../../solver';
import { computeWorkbenchSolve } from './autoSolve';
import type {
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
  preferredRecipeByItem: Record<string, string>;
  recipePreferences: EditableRecipePreference[];
  recipeStrategyOverrides: EditableRecipeStrategyOverride[];
  currentResolvedRawInputItemIds: string[];
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
    override.forcedProliferatorLevel <= recipe.maxProliferatorLevel &&
    forcedProliferatorMode
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
    preferredRecipeByItem,
    recipePreferences,
    recipeStrategyOverrides,
    currentResolvedRawInputItemIds,
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

  const nextSolveState = computeWorkbenchSolve({
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
    preferredRecipeByItem,
    recipePreferences,
    recipeStrategyOverrides: nextOverrides,
    advancedOverridesText,
    locale,
  });

  if (nextSolveState.error) {
    return {
      accepted: false,
      nextOverrides: recipeStrategyOverrides,
      message: nextSolveState.error,
    };
  }

  if (!nextSolveState.result || nextSolveState.result.status !== 'optimal') {
    const diagnosticMessage =
      nextSolveState.result?.diagnostics.messages[0] ??
      nextSolveState.result?.diagnostics.unmetPreferences[0] ??
      '';
    return {
      accepted: false,
      nextOverrides: recipeStrategyOverrides,
      message: diagnosticMessage || '该修改会导致当前方案无解，已撤销。',
    };
  }

  const currentResolvedRawInputIds = new Set(currentResolvedRawInputItemIds);
  const introducedResolvedRawInputIds = nextSolveState.result.resolvedRawInputItemIds.filter(
    itemId => !currentResolvedRawInputIds.has(itemId)
  );
  if (introducedResolvedRawInputIds.length > 0) {
    const diagnosticMessage =
      nextSolveState.result.diagnostics.messages.find(message =>
        message.includes(introducedResolvedRawInputIds[0])
      ) ?? `该修改会使相关物品退化为外部输入，已撤销。`;
    return {
      accepted: false,
      nextOverrides: recipeStrategyOverrides,
      message: diagnosticMessage,
    };
  }

  return {
    accepted: true,
    nextOverrides,
    message: '',
  };
}
