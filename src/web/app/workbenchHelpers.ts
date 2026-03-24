import type { ProliferatorMode, ResolvedCatalogModel } from '../../catalog';
import type { EditableTarget } from '../workbench/requestBuilder';
import type { WorkbenchEditorState } from '../workbench/persistence';

export function formatRecipeAmount(amount: number, locale: string): string {
  return Number.isInteger(amount)
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
}

export function shouldOmitRecipeAmount(amount: number): boolean {
  return Math.abs(amount - 1) < 1e-9;
}

export function formatRecipeCycleTime(seconds: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: seconds < 10 && !Number.isInteger(seconds) ? 1 : 0,
    maximumFractionDigits: seconds < 10 ? 1 : 2,
  }).format(seconds);
}

export function pickDefaultTarget(catalog: ResolvedCatalogModel): string {
  return (
    catalog.items.find(item => item.kind === 'product')?.itemId ??
    catalog.items.find(item => item.kind === 'intermediate')?.itemId ??
    catalog.items.find(item => item.kind !== 'utility')?.itemId ??
    ''
  );
}

export function pickDefaultRecipePreference(catalog: ResolvedCatalogModel): string {
  return catalog.recipes[0]?.recipeId ?? '';
}

export function pickSuggestedTargetItemId(
  catalog: ResolvedCatalogModel,
  itemOptions: Array<{ itemId: string }>,
  existingTargets: EditableTarget[]
): string {
  return (
    itemOptions.find(item => !existingTargets.some(target => target.itemId === item.itemId))
      ?.itemId ??
    pickDefaultTarget(catalog)
  );
}

export function sortModeOptions(modes: ProliferatorMode[]): ProliferatorMode[] {
  const order: ProliferatorMode[] = ['none', 'speed', 'productivity'];
  return order.filter(mode => modes.includes(mode));
}

export function pickDefaultGlobalProliferatorLevel(catalog: ResolvedCatalogModel | null): '' | number {
  if (!catalog) {
    return '';
  }

  const levels = catalog.proliferatorLevels
    .map(level => level.level)
    .filter(level => level > 0)
    .sort((left, right) => right - left);

  return levels[0] ?? '';
}

export function getBrowserStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function getBrowserSessionStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function buildDefaultWorkbenchEditorState(
  catalog: ResolvedCatalogModel
): WorkbenchEditorState {
  const nextTargetId = pickDefaultTarget(catalog);
  return {
    targets: nextTargetId ? [{ itemId: nextTargetId, ratePerMin: 60 }] : [],
    objective: catalog.recommendedSolve.objective ?? 'min_buildings',
    balancePolicy: catalog.recommendedSolve.balancePolicy ?? 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: 'auto',
    globalProliferatorLevel: '',
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: catalog.recommendedDisabledRecipeIds,
    disabledBuildingIds: catalog.recommendedDisabledBuildingIds,
    allowedRecipesByItem: {},
    recipePreferences: [],
    recipeStrategyOverrides: [],
    advancedOverridesText: '',
  };
}
