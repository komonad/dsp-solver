import type { ResolvedCatalogModel } from '../../catalog';
import type { DatasetPresetId } from '../../i18n';
import type { BalancePolicy, SolveObjective } from '../../solver';
import type {
  EditableRecipePreference,
  EditableRecipeStrategyOverride,
  EditableTarget,
  WorkbenchProliferatorPolicy,
} from './requestBuilder';

const WORKBENCH_CACHE_STORAGE_KEY = 'dspcalc.workbench.v1';

export interface WorkbenchCacheSource {
  presetId: DatasetPresetId;
  datasetPath: string;
  defaultConfigPath: string;
}

export interface WorkbenchEditorState {
  targets: EditableTarget[];
  objective: SolveObjective;
  balancePolicy: BalancePolicy;
  autoPromoteUnavailableItemsToRawInputs: boolean;
  proliferatorPolicy: WorkbenchProliferatorPolicy;
  globalProliferatorLevel?: '' | number;
  rawInputItemIds: string[];
  disabledRawInputItemIds: string[];
  disabledRecipeIds: string[];
  disabledBuildingIds: string[];
  preferredRecipeByItem: Record<string, string>;
  recipePreferences: EditableRecipePreference[];
  recipeStrategyOverrides: EditableRecipeStrategyOverride[];
  advancedOverridesText: string;
}

type SanitizableWorkbenchEditorState = Omit<
  WorkbenchEditorState,
  'proliferatorPolicy'
> & {
  proliferatorPolicy?: WorkbenchProliferatorPolicy | 'disable_all';
};

export interface WorkbenchDatasetDraft {
  datasetText: string;
  defaultConfigText: string;
}

interface WorkbenchCachePayload {
  version: 1;
  activeSource?: WorkbenchCacheSource;
  entries: Record<string, WorkbenchEditorState>;
  sourceDrafts?: Record<string, WorkbenchDatasetDraft>;
}

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDatasetPresetId(value: unknown): value is DatasetPresetId {
  return (
    value === 'vanilla' ||
    value === 'demo-smelting' ||
    value === 'refinery-balance' ||
    value === 'fullerene-loop' ||
    value === 'custom'
  );
}

function isSolveObjective(value: unknown): value is SolveObjective {
  return value === 'min_buildings' || value === 'min_power' || value === 'min_external_input';
}

function isBalancePolicy(value: unknown): value is BalancePolicy {
  return value === 'force_balance' || value === 'allow_surplus';
}

function isWorkbenchProliferatorPolicy(value: unknown): value is WorkbenchProliferatorPolicy {
  return value === 'auto' || value === 'none' || value === 'speed' || value === 'productivity';
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function sanitizeCacheSource(value: unknown): WorkbenchCacheSource | null {
  if (!isRecord(value)) {
    return null;
  }

  const presetId = value.presetId;
  const datasetPath = value.datasetPath;
  const defaultConfigPath = value.defaultConfigPath;

  if (
    !isDatasetPresetId(presetId) ||
    typeof datasetPath !== 'string' ||
    typeof defaultConfigPath !== 'string'
  ) {
    return null;
  }

  return {
    presetId,
    datasetPath,
    defaultConfigPath,
  };
}

function readCachePayload(storage?: MinimalStorage): WorkbenchCachePayload | null {
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(WORKBENCH_CACHE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.entries)) {
      return null;
    }

    const activeSource = sanitizeCacheSource(parsed.activeSource);
    return {
      version: 1,
      activeSource: activeSource ?? undefined,
      entries: parsed.entries as Record<string, WorkbenchEditorState>,
      sourceDrafts: isRecord(parsed.sourceDrafts)
        ? (parsed.sourceDrafts as Record<string, WorkbenchDatasetDraft>)
        : undefined,
    };
  } catch {
    return null;
  }
}

function writeCachePayload(storage: MinimalStorage | undefined, payload: WorkbenchCachePayload): void {
  if (!storage) {
    return;
  }

  storage.setItem(WORKBENCH_CACHE_STORAGE_KEY, JSON.stringify(payload));
}

export function buildWorkbenchCacheKey(source: WorkbenchCacheSource): string {
  return `${source.datasetPath}::${source.defaultConfigPath}`;
}

export function readActiveWorkbenchCacheSource(
  storage?: MinimalStorage
): WorkbenchCacheSource | null {
  return readCachePayload(storage)?.activeSource ?? null;
}

export function readWorkbenchEditorState(
  storage: MinimalStorage | undefined,
  source: WorkbenchCacheSource
): WorkbenchEditorState | null {
  const payload = readCachePayload(storage);
  if (!payload) {
    return null;
  }

  return payload.entries[buildWorkbenchCacheKey(source)] ?? null;
}

export function writeActiveWorkbenchCacheSource(
  storage: MinimalStorage | undefined,
  source: WorkbenchCacheSource
): void {
  const payload = readCachePayload(storage) ?? {
    version: 1 as const,
    entries: {},
  };

  writeCachePayload(storage, {
    ...payload,
    activeSource: source,
  });
}

export function writeWorkbenchEditorState(
  storage: MinimalStorage | undefined,
  source: WorkbenchCacheSource,
  editorState: WorkbenchEditorState
): void {
  const payload = readCachePayload(storage) ?? {
    version: 1 as const,
    entries: {},
  };

  writeCachePayload(storage, {
    version: 1,
    activeSource: source,
    entries: {
      ...payload.entries,
      [buildWorkbenchCacheKey(source)]: editorState,
    },
    sourceDrafts: payload.sourceDrafts,
  });
}

export function readWorkbenchDatasetDraft(
  storage: MinimalStorage | undefined,
  source: WorkbenchCacheSource
): WorkbenchDatasetDraft | null {
  const payload = readCachePayload(storage);
  if (!payload) {
    return null;
  }

  return payload.sourceDrafts?.[buildWorkbenchCacheKey(source)] ?? null;
}

export function writeWorkbenchDatasetDraft(
  storage: MinimalStorage | undefined,
  source: WorkbenchCacheSource,
  draft: WorkbenchDatasetDraft
): void {
  const payload = readCachePayload(storage) ?? {
    version: 1 as const,
    entries: {},
  };

  writeCachePayload(storage, {
    version: 1,
    activeSource: source,
    entries: payload.entries,
    sourceDrafts: {
      ...(payload.sourceDrafts ?? {}),
      [buildWorkbenchCacheKey(source)]: draft,
    },
  });
}

export function clearWorkbenchCache(storage?: MinimalStorage): void {
  storage?.removeItem(WORKBENCH_CACHE_STORAGE_KEY);
}

export function sanitizeWorkbenchEditorState(
  catalog: ResolvedCatalogModel,
  state: SanitizableWorkbenchEditorState
): WorkbenchEditorState {
  const validItemIds = new Set(catalog.items.map(item => item.itemId));
  const validRecipeIds = new Set(catalog.recipes.map(recipe => recipe.recipeId));
  const validBuildingIds = new Set(catalog.buildings.map(building => building.buildingId));
  const preferredRecipeByItem = Object.entries(state.preferredRecipeByItem ?? {}).reduce<
    Record<string, string>
  >((next, [itemId, recipeId]) => {
    if (!validItemIds.has(itemId) || !validRecipeIds.has(recipeId)) {
      return next;
    }

    const recipe = catalog.recipeMap.get(recipeId);
    if (!recipe || !recipe.outputs.some(output => output.itemId === itemId)) {
      return next;
    }

    next[itemId] = recipeId;
    return next;
  }, {});

  const targets = Array.isArray(state.targets)
    ? state.targets.filter(
        target =>
          target &&
          typeof target.itemId === 'string' &&
          validItemIds.has(target.itemId) &&
          typeof target.ratePerMin === 'number' &&
          Number.isFinite(target.ratePerMin) &&
          target.ratePerMin >= 0
      )
    : [];

  const recipePreferences = Array.isArray(state.recipePreferences)
    ? state.recipePreferences
        .map(preference => {
          if (!preference || typeof preference.recipeId !== 'string') {
            return null;
          }

          const recipe = catalog.recipeMap.get(preference.recipeId);
          if (!recipe) {
            return null;
          }

          const preferredBuildingId =
            typeof preference.preferredBuildingId === 'string' &&
            recipe.allowedBuildingIds.includes(preference.preferredBuildingId)
              ? preference.preferredBuildingId
              : '';

          const preferredProliferatorMode =
            preference.preferredProliferatorMode &&
            recipe.supportsProliferatorModes.includes(preference.preferredProliferatorMode)
              ? preference.preferredProliferatorMode
              : '';

          const preferredProliferatorLevel =
            typeof preference.preferredProliferatorLevel === 'number' &&
            Number.isFinite(preference.preferredProliferatorLevel) &&
            preference.preferredProliferatorLevel >= 0 &&
            preference.preferredProliferatorLevel <= recipe.maxProliferatorLevel
              ? preference.preferredProliferatorLevel
              : '';

          return {
            recipeId: recipe.recipeId,
            preferredBuildingId,
            preferredProliferatorMode,
            preferredProliferatorLevel,
          };
        })
        .filter((entry): entry is EditableRecipePreference => Boolean(entry))
    : [];

  const recipeStrategyOverrides = Array.isArray(state.recipeStrategyOverrides)
    ? state.recipeStrategyOverrides
        .map(override => {
          if (!override || typeof override.recipeId !== 'string') {
            return null;
          }

          const recipe = catalog.recipeMap.get(override.recipeId);
          if (!recipe) {
            return null;
          }

          const forcedBuildingId =
            typeof override.forcedBuildingId === 'string' &&
            recipe.allowedBuildingIds.includes(override.forcedBuildingId)
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
            override.forcedProliferatorLevel >= 0 &&
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
        })
        .filter((entry): entry is EditableRecipeStrategyOverride => Boolean(entry))
    : [];

  const proliferatorPolicyValue = state.proliferatorPolicy;

  return {
    targets,
    objective: isSolveObjective(state.objective) ? state.objective : 'min_buildings',
    balancePolicy: isBalancePolicy(state.balancePolicy) ? state.balancePolicy : 'force_balance',
    autoPromoteUnavailableItemsToRawInputs:
      typeof state.autoPromoteUnavailableItemsToRawInputs === 'boolean'
        ? state.autoPromoteUnavailableItemsToRawInputs
        : true,
    proliferatorPolicy:
      proliferatorPolicyValue === 'disable_all'
        ? 'none'
        : isWorkbenchProliferatorPolicy(proliferatorPolicyValue)
          ? proliferatorPolicyValue
          : 'auto',
    globalProliferatorLevel:
      typeof state.globalProliferatorLevel === 'number' &&
      Number.isFinite(state.globalProliferatorLevel) &&
      state.globalProliferatorLevel > 0 &&
      catalog.proliferatorLevelMap.has(state.globalProliferatorLevel)
        ? state.globalProliferatorLevel
        : '',
    rawInputItemIds: sanitizeStringArray(state.rawInputItemIds).filter(itemId =>
      validItemIds.has(itemId)
    ),
    disabledRawInputItemIds: sanitizeStringArray(state.disabledRawInputItemIds).filter(itemId =>
      validItemIds.has(itemId)
    ),
    disabledRecipeIds: sanitizeStringArray(state.disabledRecipeIds).filter(recipeId =>
      validRecipeIds.has(recipeId)
    ),
    disabledBuildingIds: sanitizeStringArray(state.disabledBuildingIds).filter(buildingId =>
      validBuildingIds.has(buildingId)
    ),
    preferredRecipeByItem,
    recipePreferences,
    recipeStrategyOverrides,
    advancedOverridesText:
      typeof state.advancedOverridesText === 'string' ? state.advancedOverridesText : '',
  };
}
