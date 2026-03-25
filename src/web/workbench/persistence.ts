import type { ResolvedCatalogModel } from '../../catalog';
import type { DatasetPresetId } from '../../i18n';
import type { BalancePolicy, SolveObjective } from '../../solver';
import type {
  EditablePreferredBuilding,
  EditableRecipePreference,
  EditableRecipeStrategyOverride,
  EditableTarget,
  WorkbenchProliferatorPolicy,
} from './requestBuilder';
import type { WorkbenchSnapshotSectionState } from './snapshotSections';

const DSPCALC_STORAGE_PREFIX = 'dspcalc.';
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
  allowedRecipesByItem: Record<string, string[]>;
  recipePreferences: EditableRecipePreference[];
  recipeStrategyOverrides: EditableRecipeStrategyOverride[];
  preferredBuildings: EditablePreferredBuilding[];
  advancedOverridesText: string;
}

type SanitizableWorkbenchEditorState = Omit<
  WorkbenchEditorState,
  'proliferatorPolicy' | 'allowedRecipesByItem'
> & {
  proliferatorPolicy?: WorkbenchProliferatorPolicy | 'disable_all';
  allowedRecipesByItem?: Record<string, string[]>;
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
  snapshotSectionStates?: Record<string, WorkbenchSnapshotSectionState>;
}

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type EnumerableStorage = Pick<Storage, 'key' | 'removeItem'> & { length: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDatasetPresetId(value: unknown): value is DatasetPresetId {
  return (
    value === 'vanilla' ||
    value === 'demo-smelting' ||
    value === 'refinery-balance' ||
    value === 'fullerene-loop' ||
    value === 'orbitalring' ||
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

function sanitizeSnapshotSectionState(value: unknown): WorkbenchSnapshotSectionState | null {
  if (!isRecord(value)) {
    return null;
  }

  const nextState: Partial<WorkbenchSnapshotSectionState> = {};
  const keys: Array<keyof WorkbenchSnapshotSectionState> = [
    'targets',
    'allowedRecipes',
    'disabledRecipes',
    'proliferatorPreferences',
    'disabledBuildings',
    'preferredBuildings',
  ];

  for (const key of keys) {
    if (typeof value[key] === 'boolean') {
      nextState[key] = value[key] as boolean;
    }
  }

  return Object.keys(nextState).length > 0
    ? (nextState as WorkbenchSnapshotSectionState)
    : null;
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
      snapshotSectionStates: isRecord(parsed.snapshotSectionStates)
        ? Object.entries(parsed.snapshotSectionStates).reduce<
            Record<string, WorkbenchSnapshotSectionState>
          >((next, [key, value]) => {
            const sanitizedState = sanitizeSnapshotSectionState(value);
            if (sanitizedState) {
              next[key] = sanitizedState;
            }
            return next;
          }, {})
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
    snapshotSectionStates: payload.snapshotSectionStates,
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

export function readWorkbenchSnapshotSectionState(
  storage: MinimalStorage | undefined,
  source: WorkbenchCacheSource
): WorkbenchSnapshotSectionState | null {
  const payload = readCachePayload(storage);
  if (!payload) {
    return null;
  }

  return payload.snapshotSectionStates?.[buildWorkbenchCacheKey(source)] ?? null;
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
    snapshotSectionStates: payload.snapshotSectionStates,
  });
}

export function writeWorkbenchSnapshotSectionState(
  storage: MinimalStorage | undefined,
  source: WorkbenchCacheSource,
  state: WorkbenchSnapshotSectionState
): void {
  const payload = readCachePayload(storage) ?? {
    version: 1 as const,
    entries: {},
  };

  writeCachePayload(storage, {
    version: 1,
    activeSource: source,
    entries: payload.entries,
    sourceDrafts: payload.sourceDrafts,
    snapshotSectionStates: {
      ...(payload.snapshotSectionStates ?? {}),
      [buildWorkbenchCacheKey(source)]: state,
    },
  });
}

export function clearWorkbenchDatasetDraft(
  storage: MinimalStorage | undefined,
  source: WorkbenchCacheSource
): void {
  const payload = readCachePayload(storage);
  if (!payload?.sourceDrafts) {
    return;
  }

  const key = buildWorkbenchCacheKey(source);
  if (!(key in payload.sourceDrafts)) {
    return;
  }

  const { [key]: _, ...remainingDrafts } = payload.sourceDrafts;
  writeCachePayload(storage, {
    ...payload,
    sourceDrafts: remainingDrafts,
    snapshotSectionStates: payload.snapshotSectionStates,
  });
}

export function clearWorkbenchCache(storage?: MinimalStorage): void {
  storage?.removeItem(WORKBENCH_CACHE_STORAGE_KEY);
}

export function clearNamespacedStorage(
  storage?: EnumerableStorage,
  prefix: string = DSPCALC_STORAGE_PREFIX
): string[] {
  if (!storage) {
    return [];
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => storage.removeItem(key));
  return keysToRemove;
}

export function sanitizeWorkbenchEditorState(
  catalog: ResolvedCatalogModel,
  state: SanitizableWorkbenchEditorState
): WorkbenchEditorState {
  const validItemIds = new Set(catalog.items.map(item => item.itemId));
  const validRecipeIds = new Set(catalog.recipes.map(recipe => recipe.recipeId));
  const validBuildingIds = new Set(catalog.buildings.map(building => building.buildingId));
  const allowedRecipeSource = state.allowedRecipesByItem ?? {};
  const allowedRecipesByItem = Object.entries(allowedRecipeSource).reduce<
    Record<string, string[]>
  >((next, [itemId, recipeIds]) => {
    if (!validItemIds.has(itemId) || !Array.isArray(recipeIds)) {
      return next;
    }

    const filteredRecipeIds = recipeIds.filter(recipeId => {
      if (!validRecipeIds.has(recipeId)) {
        return false;
      }
      const recipe = catalog.recipeMap.get(recipeId);
      return Boolean(recipe && recipe.outputs.some(output => output.itemId === itemId));
    });

    if (filteredRecipeIds.length > 0) {
      next[itemId] = Array.from(new Set(filteredRecipeIds));
    }
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

  const preferredBuildings = Array.isArray((state as Record<string, unknown>).preferredBuildings)
    ? ((state as Record<string, unknown>).preferredBuildings as EditablePreferredBuilding[])
        .filter(entry => {
          if (!entry || typeof entry.buildingId !== 'string' || !validBuildingIds.has(entry.buildingId)) {
            return false;
          }
          if (typeof entry.recipeId !== 'string') {
            return false;
          }
          if (entry.recipeId) {
            const recipe = catalog.recipeMap.get(entry.recipeId);
            return Boolean(recipe && recipe.allowedBuildingIds.includes(entry.buildingId));
          }
          return true; // global entry
        })
        .map(entry => ({ buildingId: entry.buildingId, recipeId: entry.recipeId ?? '' }))
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
    allowedRecipesByItem,
    recipePreferences,
    recipeStrategyOverrides,
    preferredBuildings,
    advancedOverridesText:
      typeof state.advancedOverridesText === 'string' ? state.advancedOverridesText : '',
  };
}
