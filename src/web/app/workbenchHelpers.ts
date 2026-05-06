import type { ProliferatorMode, ResolvedCatalogModel } from '../../catalog';
import {
  formatPower,
  formatPreferredProliferatorLabel,
  type AppLocale,
  type LocaleBundle,
} from '../../i18n';
import type { PresentationItemRate, PresentationRecipePlan } from '../../presentation';
import type { SolveResult } from '../../solver';
import { buildRecipeFlowDisplay } from '../shared/recipeDisplay';
import type {
  PersistedWorkbenchSolveState,
  WorkbenchSolveState,
} from '../workbench/autoSolve';
import type {
  EditableRecipePreference,
  EditableTarget,
  WorkbenchProliferatorPolicy,
} from '../workbench/requestBuilder';
import type {
  WorkbenchEditorState,
  WorkbenchPersistedConfig,
} from '../workbench/persistence';

export interface WorkbenchRecipeOptionIO {
  itemId: string;
  itemName: string;
  iconKey?: string;
  amount: number;
}

export interface WorkbenchRecipeOption {
  recipeId: string;
  recipeName: string;
  recipeIconKey?: string;
  cycleTimeSec: number;
  inputs: WorkbenchRecipeOptionIO[];
  outputs: WorkbenchRecipeOptionIO[];
}

export interface RecipePlanCardDisplayModel {
  buildingCountLabel: string;
  powerLabel: string;
  proliferatorLabel: string;
  visibleInputs: PresentationItemRate[];
  outputs: PresentationItemRate[];
  auxiliaryProliferatorInput: PresentationItemRate | null;
}

export interface RecipeProliferatorPreferenceDisplayEntry {
  recipeId: string;
  recipeName: string;
  recipeIconKey?: string;
  proliferatorPreferenceLabel: string;
}

export type WorkbenchConfigDisplayStatus =
  | 'idle'
  | 'running'
  | 'cancelled'
  | 'solve_error'
  | SolveResult['status'];

export interface WorkbenchConfigDisplayModel {
  id: string;
  title: string;
  customName: string;
  hasCustomName: boolean;
  targetSummary: string;
  objective: WorkbenchEditorState['objective'];
  balancePolicy: WorkbenchEditorState['balancePolicy'];
  status: WorkbenchConfigDisplayStatus;
  recipePlanCount: number | null;
  roundedBuildingCount: number | null;
  powerLabel: string | null;
  datasetLabel: string;
  sourceKey: string;
}

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

export function formatRecipePlanBuildingCount(
  exactBuildingCount: number,
  roundedUpBuildingCount: number,
  locale: AppLocale
): string {
  const roundedLabel = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(roundedUpBuildingCount);
  if (Math.abs(exactBuildingCount - roundedUpBuildingCount) < 1e-9) {
    return roundedLabel;
  }

  const exactLabel = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(exactBuildingCount);
  return `${exactLabel}(${roundedLabel})`;
}

export function buildRecipePlanCardDisplayModel(
  catalog: ResolvedCatalogModel | null,
  plan: PresentationRecipePlan,
  locale: AppLocale
): RecipePlanCardDisplayModel {
  const { visibleInputs, auxiliaryProliferatorInput } = buildRecipeFlowDisplay(catalog, plan);

  return {
    buildingCountLabel: formatRecipePlanBuildingCount(
      plan.exactBuildingCount,
      plan.roundedUpBuildingCount,
      locale
    ),
    powerLabel: formatPower(plan.roundedPlacementPowerMW, locale),
    proliferatorLabel: plan.proliferatorLabel,
    visibleInputs,
    outputs: plan.outputs,
    auxiliaryProliferatorInput,
  };
}

export function buildRecipeProliferatorPreferenceDisplayEntries(
  catalog: ResolvedCatalogModel,
  recipePreferences: EditableRecipePreference[],
  locale: AppLocale
): RecipeProliferatorPreferenceDisplayEntry[] {
  return recipePreferences
    .filter(
      preference =>
        Boolean(preference.recipeId) &&
        (preference.preferredProliferatorMode !== '' ||
          preference.preferredProliferatorLevel !== '')
    )
    .map(preference => {
      const recipe = catalog.recipeMap.get(preference.recipeId);
      const proliferatorPreferenceLabel = formatPreferredProliferatorLabel(
        preference.preferredProliferatorMode || undefined,
        typeof preference.preferredProliferatorLevel === 'number'
          ? preference.preferredProliferatorLevel
          : undefined,
        locale
      );

      return {
        recipeId: preference.recipeId,
        recipeName: recipe?.name ?? preference.recipeId,
        recipeIconKey:
          recipe?.icon ?? (recipe?.outputs[0] ? catalog.itemMap.get(recipe.outputs[0].itemId)?.icon : undefined),
        proliferatorPreferenceLabel: proliferatorPreferenceLabel ?? '',
      };
    })
    .filter(entry => Boolean(entry.proliferatorPreferenceLabel))
    .sort((left, right) => left.recipeName.localeCompare(right.recipeName));
}

export function buildGlobalProliferatorPreferenceDisplayEntry(
  proliferatorPolicy: WorkbenchProliferatorPolicy,
  globalProliferatorLevel: '' | number,
  locale: AppLocale
): RecipeProliferatorPreferenceDisplayEntry | null {
  if (
    proliferatorPolicy === 'auto' &&
    (typeof globalProliferatorLevel !== 'number' || globalProliferatorLevel <= 0)
  ) {
    return null;
  }

  const proliferatorPreferenceLabel = formatPreferredProliferatorLabel(
    proliferatorPolicy === 'auto'
      ? undefined
      : proliferatorPolicy === 'none'
        ? 'none'
        : proliferatorPolicy,
    typeof globalProliferatorLevel === 'number' ? globalProliferatorLevel : undefined,
    locale
  );

  if (!proliferatorPreferenceLabel) {
    return null;
  }

  return {
    recipeId: '*',
    recipeName: '*',
    proliferatorPreferenceLabel,
  };
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

function buildItemPickerOptions(
  catalog: ResolvedCatalogModel,
  predicate: (item: ResolvedCatalogModel['items'][number]) => boolean
): ItemPickerOption[] {
  return catalog.items
    .filter(predicate)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(item => ({
      itemId: item.itemId,
      name: item.name,
      icon: item.icon,
    }));
}

export function buildTargetItemOptions(catalog: ResolvedCatalogModel | null): ItemPickerOption[] {
  return catalog ? buildItemPickerOptions(catalog, item => item.kind !== 'utility') : [];
}

export function buildRecipeItemOptions(catalog: ResolvedCatalogModel | null): ItemPickerOption[] {
  return catalog ? buildItemPickerOptions(catalog, () => true) : [];
}

export function buildRecipeOptionsByOutputItem(
  catalog: ResolvedCatalogModel | null
): Record<string, WorkbenchRecipeOption[]> {
  const next: Record<string, WorkbenchRecipeOption[]> = {};

  if (!catalog) {
    return next;
  }

  const resolveIO = (io: Array<{ itemId: string; amount: number }>) =>
    io.map(entry => {
      const item = catalog.itemMap.get(entry.itemId);
      return {
        itemId: entry.itemId,
        itemName: item?.name ?? entry.itemId,
        iconKey: item?.icon,
        amount: entry.amount,
      };
    });

  for (const recipe of catalog.recipes) {
    const option = {
      recipeId: recipe.recipeId,
      recipeName: recipe.name,
      recipeIconKey: recipe.icon,
      cycleTimeSec: recipe.cycleTimeSec,
      inputs: resolveIO(recipe.inputs),
      outputs: resolveIO(recipe.outputs),
    };

    for (const output of recipe.outputs) {
      if (!next[output.itemId]) {
        next[output.itemId] = [];
      }
      next[output.itemId].push(option);
    }
  }

  for (const itemId of Object.keys(next)) {
    next[itemId].sort((left, right) => left.recipeName.localeCompare(right.recipeName));
  }

  return next;
}

export function filterRecipeOptionsByExclusion(
  recipeOptions: WorkbenchRecipeOption[] | undefined,
  excludedRecipeIds: string[] = []
): WorkbenchRecipeOption[] {
  if (!recipeOptions || recipeOptions.length === 0) {
    return [];
  }

  if (excludedRecipeIds.length === 0) {
    return recipeOptions;
  }

  const excluded = new Set(excludedRecipeIds);
  return recipeOptions.filter(option => !excluded.has(option.recipeId));
}

export function filterItemOptionsByRecipeAvailability<T extends { itemId: string }>(
  itemOptions: T[],
  recipeOptionsByItem: Record<string, WorkbenchRecipeOption[]>,
  getExcludedRecipeIds: (itemId: string) => string[] = () => []
): T[] {
  return itemOptions.filter(item =>
    filterRecipeOptionsByExclusion(
      recipeOptionsByItem[item.itemId],
      getExcludedRecipeIds(item.itemId),
    ).length > 0
  );
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
  const recommendedObjective =
    catalog.recommendedSolve.objective === 'min_complexity'
      ? 'min_buildings'
      : (catalog.recommendedSolve.objective ?? 'min_buildings');
  return {
    targets: [],
    objective: recommendedObjective,
    balancePolicy: catalog.recommendedSolve.balancePolicy ?? 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: catalog.recommendedSolve.proliferatorPolicy ?? 'auto',
    globalProliferatorLevel: '',
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: catalog.recommendedDisabledRecipeIds,
    disabledBuildingIds: catalog.recommendedDisabledBuildingIds,
    allowedRecipesByItem: {},
    recipePreferences: [],
    recipeStrategyOverrides: [],
    preferredBuildings: [],
    advancedOverridesText: '',
  };
}

type WorkbenchConfigSummarySolveState =
  | Pick<WorkbenchSolveState, 'result' | 'error' | 'activity'>
  | Pick<PersistedWorkbenchSolveState, 'result' | 'error' | 'activityStatus'>;

function isRunningWorkbenchConfigSolveState(
  state: WorkbenchConfigSummarySolveState | undefined
): state is Pick<WorkbenchSolveState, 'result' | 'error' | 'activity'> {
  return Boolean(state && 'activity' in state);
}

function summarizeWorkbenchTargets(
  catalog: ResolvedCatalogModel,
  targets: EditableTarget[],
  locale: AppLocale,
  bundle: LocaleBundle
): string {
  if (targets.length === 0) {
    return bundle.workbenchConfigs.noTargets;
  }

  const visibleTargets = targets.slice(0, 2).map(target => {
    const itemName = catalog.itemMap.get(target.itemId)?.name ?? target.itemId;
    return `${itemName} ${formatRecipeAmount(target.ratePerMin, locale)}/分`;
  });

  if (targets.length > 2) {
    visibleTargets.push(`+${targets.length - 2}`);
  }

  return visibleTargets.join(' · ');
}

function pickWorkbenchConfigStatus(
  solveState: WorkbenchConfigSummarySolveState | undefined
): WorkbenchConfigDisplayStatus {
  if (!solveState) {
    return 'idle';
  }

  if (isRunningWorkbenchConfigSolveState(solveState)) {
    if (solveState.activity.status === 'running') {
      return 'running';
    }
    if (solveState.activity.status === 'cancelled') {
      return 'cancelled';
    }
  } else if (solveState.activityStatus === 'cancelled') {
    return 'cancelled';
  }

  if (solveState.error) {
    return 'solve_error';
  }

  return solveState.result?.status ?? 'idle';
}

export function buildWorkbenchConfigDisplayModel(
  config: WorkbenchPersistedConfig,
  solveState: WorkbenchConfigSummarySolveState | undefined,
  extra: { datasetLabel?: string; sourceKey?: string },
  live?: {
    catalog: ResolvedCatalogModel;
    locale: AppLocale;
    bundle: LocaleBundle;
  }
): WorkbenchConfigDisplayModel {
  const customName = config.name?.trim() ?? '';
  const targetSummary = live
    ? summarizeWorkbenchTargets(live.catalog, config.editorState.targets, live.locale, live.bundle)
    : config.cachedTargetSummary ?? (customName || config.id);
  const result = solveState?.result ?? null;

  return {
    id: config.id,
    title: customName || targetSummary,
    customName,
    hasCustomName: customName.length > 0,
    targetSummary,
    objective: config.editorState.objective,
    balancePolicy: config.editorState.balancePolicy,
    status: pickWorkbenchConfigStatus(solveState),
    recipePlanCount: result?.recipePlans.length ?? null,
    roundedBuildingCount:
      result?.buildingSummary.reduce((sum, entry) => sum + entry.roundedUpCount, 0) ?? null,
    powerLabel: result ? formatPower(result.powerSummary.roundedPlacementPowerMW, live?.locale ?? 'zh-CN') : null,
    datasetLabel: extra?.datasetLabel ?? config.datasetLabel ?? '',
    sourceKey: extra?.sourceKey ?? '',
  };
}
