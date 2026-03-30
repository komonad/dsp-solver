import React, {
  startTransition,
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ProliferatorMode, ResolvedCatalogModel, ResolvedRecipeSpec } from '../../catalog';
import {
  AppLocale,
  DEFAULT_APP_LOCALE,
  type DatasetPresetId,
  getDatasetPresetText,
  getLocaleBundle,
} from '../../i18n';
import {
  buildPresentationModel,
  buildPresentationRequestSummary,
  type PresentationModel,
} from '../../presentation';
import type { BalancePolicy, SolveObjective, SolveRequest, SolveResult } from '../../solver';
import {
  DATASET_PRESETS,
  loadCatalogSourceFromUrl,
  resolveCatalogSourceTexts,
} from '../catalog/catalogClient';
import {
  buildWorkbenchSolveInputKey,
  buildCancelledWorkbenchSolveState,
  buildIdleWorkbenchSolveState,
  buildRunningWorkbenchSolveState,
  computeWorkbenchSolve,
  computeWorkbenchSolveAsync,
  findReusableWorkbenchSolveInputKey,
  preserveReusableSettledWorkbenchSolveState,
  persistWorkbenchSolveState,
  restoreWorkbenchSolveState,
  type WorkbenchSolveState,
} from '../workbench/autoSolve';
import {
  createWorkbenchConfig as createWorkbenchConfigCollection,
  createWorkbenchPersistedConfig,
  deleteWorkbenchConfig as deleteWorkbenchConfigCollection,
  forkWorkbenchConfig as forkWorkbenchConfigCollection,
  renameWorkbenchConfig as renameWorkbenchConfigCollection,
  replaceWorkbenchConfigEditorState,
  sanitizeWorkbenchConfigCollectionForCatalog,
  syncActiveWorkbenchConfigCollection,
} from '../workbench/configs';
import {
  cancelSolveWorker,
  solveCatalogRequestWithWorker,
} from '../workbench/solveWorkerClient';
import { computeLedgerSectionScrollTop } from '../shared/ledgerScroll';
import type { ItemPickerOption } from '../shared/itemPickerModel';
import { tryApplyRecipeStrategyOverride } from '../workbench/recipeStrategy';
import {
  parseAdvancedSolveOverrides,
  type EditablePreferredBuilding,
  type EditableRecipePreference,
  type EditableRecipeStrategyOverride,
  type EditableTarget,
  type ParseAdvancedOverridesResult,
  type WorkbenchProliferatorPolicy,
} from '../workbench/requestBuilder';
import {
  clearNamespacedStorage,
  clearWorkbenchCache,
  clearWorkbenchDatasetDraft,
  readActiveWorkbenchCacheSource,
  readWorkbenchConfigCollection,
  readWorkbenchDatasetDraft,
  sanitizeWorkbenchEditorState,
  writeActiveWorkbenchCacheSource,
  writeWorkbenchConfigCollection,
  writeWorkbenchDatasetDraft,
  type WorkbenchCacheSource,
  type WorkbenchEditorState,
  type WorkbenchPersistedConfig,
} from '../workbench/persistence';
import { recordWorkbenchPerf } from '../workbench/workbenchPerf';
import {
  buildWorkbenchConfigDisplayModel,
  buildRecipeOptionsByOutputItem,
  buildDefaultWorkbenchEditorState,
  getBrowserSessionStorage,
  getBrowserStorage,
  pickDefaultGlobalProliferatorLevel,
  pickDefaultRecipePreference,
  pickDefaultTarget,
  pickSuggestedTargetItemId,
  sortModeOptions,
  type WorkbenchConfigDisplayModel,
  type WorkbenchRecipeOption,
} from './workbenchHelpers';
import { buildDisplayedWorkbenchSolveState } from './workbenchDisplayedSolveState';
import { buildWorkbenchSnapshotSolveRequest } from './workbenchSnapshotRequest';

function waitForNextPaint(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  return new Promise(resolve => {
    window.requestAnimationFrame(() => resolve());
  });
}

function hashWorkbenchText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildWorkbenchCatalogSolveSignature(
  datasetText: string,
  defaultConfigText: string
): string {
  return `${hashWorkbenchText(datasetText)}:${hashWorkbenchText(defaultConfigText)}`;
}

function findReusableSolveInputKeyForConfig(params: {
  config: Pick<WorkbenchPersistedConfig, 'editorState' | 'solveState'>;
  catalogSignature: string;
  locale: AppLocale;
}): string | null {
  const { config, catalogSignature, locale } = params;
  return findReusableWorkbenchSolveInputKey(config.solveState, {
    catalogSignature,
    targets: config.editorState.targets,
    objective: config.editorState.objective,
    balancePolicy: config.editorState.balancePolicy,
    proliferatorPolicy: config.editorState.proliferatorPolicy,
    globalProliferatorLevel: config.editorState.globalProliferatorLevel,
    autoPromoteUnavailableItemsToRawInputs:
      config.editorState.autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds: config.editorState.rawInputItemIds,
    disabledRawInputItemIds: config.editorState.disabledRawInputItemIds,
    disabledRecipeIds: config.editorState.disabledRecipeIds,
    disabledBuildingIds: config.editorState.disabledBuildingIds,
    allowedRecipesByItem: config.editorState.allowedRecipesByItem,
    preferredBuildings: config.editorState.preferredBuildings,
    recipePreferences: config.editorState.recipePreferences,
    recipeStrategyOverrides: config.editorState.recipeStrategyOverrides,
    advancedOverridesText: config.editorState.advancedOverridesText,
    locale,
    isLoading: false,
  });
}

function buildExpectedSolveInputKeyForWorkbenchEditorState(params: {
  editorState: WorkbenchEditorState;
  catalogSignature: string;
  locale: AppLocale;
}): string {
  const { editorState, catalogSignature, locale } = params;
  return buildWorkbenchSolveInputKey({
    catalogSignature,
    targets: editorState.targets,
    objective: editorState.objective,
    balancePolicy: editorState.balancePolicy,
    proliferatorPolicy: editorState.proliferatorPolicy,
    globalProliferatorLevel: editorState.globalProliferatorLevel,
    autoPromoteUnavailableItemsToRawInputs: editorState.autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds: editorState.rawInputItemIds,
    disabledRawInputItemIds: editorState.disabledRawInputItemIds,
    disabledRecipeIds: editorState.disabledRecipeIds,
    disabledBuildingIds: editorState.disabledBuildingIds,
    allowedRecipesByItem: editorState.allowedRecipesByItem,
    preferredBuildings: editorState.preferredBuildings,
    recipePreferences: editorState.recipePreferences,
    recipeStrategyOverrides: editorState.recipeStrategyOverrides,
    advancedOverridesText: editorState.advancedOverridesText,
    locale,
    isLoading: false,
  });
}

function backfillWorkbenchConfigSolveInputKeys(params: {
  configs: WorkbenchPersistedConfig[];
  catalogSignature: string;
  locale: AppLocale;
}): WorkbenchPersistedConfig[] {
  const { configs, catalogSignature, locale } = params;
  let changed = false;
  const nextConfigs = configs.map(config => {
    if (
      !config.solveState ||
      config.solveState.activityStatus !== 'settled' ||
      config.solveState.inputKey
    ) {
      return config;
    }

    changed = true;
    return {
      ...config,
      solveState: {
        ...config.solveState,
        inputKey: buildWorkbenchSolveInputKey({
          catalogSignature,
          targets: config.editorState.targets,
          objective: config.editorState.objective,
          balancePolicy: config.editorState.balancePolicy,
          proliferatorPolicy: config.editorState.proliferatorPolicy,
          globalProliferatorLevel: config.editorState.globalProliferatorLevel,
          autoPromoteUnavailableItemsToRawInputs:
            config.editorState.autoPromoteUnavailableItemsToRawInputs,
          rawInputItemIds: config.editorState.rawInputItemIds,
          disabledRawInputItemIds: config.editorState.disabledRawInputItemIds,
          disabledRecipeIds: config.editorState.disabledRecipeIds,
          disabledBuildingIds: config.editorState.disabledBuildingIds,
          allowedRecipesByItem: config.editorState.allowedRecipesByItem,
          preferredBuildings: config.editorState.preferredBuildings,
          recipePreferences: config.editorState.recipePreferences,
          recipeStrategyOverrides: config.editorState.recipeStrategyOverrides,
          advancedOverridesText: config.editorState.advancedOverridesText,
          locale,
          isLoading: false,
        }),
      },
    };
  });

  return changed ? nextConfigs : configs;
}

function resolvePersistedWorkbenchConfigSolveState(params: {
  existingState?: WorkbenchPersistedConfig['solveState'];
  nextState: ReturnType<typeof persistWorkbenchSolveState>;
  editorState: WorkbenchEditorState;
  catalogSignature: string;
  locale: AppLocale;
}): ReturnType<typeof persistWorkbenchSolveState> {
  const { existingState, nextState, editorState, catalogSignature, locale } = params;
  const expectedInputKey = buildExpectedSolveInputKeyForWorkbenchEditorState({
    editorState,
    catalogSignature,
    locale,
  });

  const reusableState = preserveReusableSettledWorkbenchSolveState({
    existingState,
    nextState,
    expectedInputKey,
  });

  if (reusableState.inputKey || !existingState?.inputKey || reusableState.activityStatus !== 'settled') {
    return reusableState;
  }

  return {
    ...reusableState,
    inputKey: existingState.inputKey,
  };
}

function mergePersistedSolveStateInputKey(
  existingState: WorkbenchPersistedConfig['solveState'],
  nextState: ReturnType<typeof persistWorkbenchSolveState>
): ReturnType<typeof persistWorkbenchSolveState> {
  if (
    nextState.activityStatus !== 'settled' ||
    nextState.inputKey ||
    !existingState?.inputKey
  ) {
    return nextState;
  }

  return {
    ...nextState,
    inputKey: existingState.inputKey,
  };
}

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export interface WorkbenchContextValue {
  // Locale / bundle
  locale: AppLocale;
  bundle: ReturnType<typeof getLocaleBundle>;

  // Dataset source state
  presetId: DatasetPresetId;
  setPresetId: React.Dispatch<React.SetStateAction<DatasetPresetId>>;
  datasetPath: string;
  setDatasetPath: React.Dispatch<React.SetStateAction<string>>;
  defaultConfigPath: string;
  setDefaultConfigPath: React.Dispatch<React.SetStateAction<string>>;
  catalogLabel: string;
  setCatalogLabel: React.Dispatch<React.SetStateAction<string>>;
  catalog: ResolvedCatalogModel | null;
  loadedSource: WorkbenchCacheSource | null;
  loadedDatasetText: string;
  loadedDefaultConfigText: string;
  datasetEditorText: string;
  setDatasetEditorText: React.Dispatch<React.SetStateAction<string>>;
  defaultConfigEditorText: string;
  setDefaultConfigEditorText: React.Dispatch<React.SetStateAction<string>>;
  datasetEditorError: string;
  loadError: string;
  isLoading: boolean;

  // Workbench editor state
  workbenchConfigs: WorkbenchPersistedConfig[];
  activeWorkbenchConfigId: string;
  workbenchConfigDisplayModels: WorkbenchConfigDisplayModel[];
  targets: EditableTarget[];
  setTargets: React.Dispatch<React.SetStateAction<EditableTarget[]>>;
  targetDraftItemId: string;
  setTargetDraftItemId: React.Dispatch<React.SetStateAction<string>>;
  targetDraftRatePerMin: number;
  setTargetDraftRatePerMin: React.Dispatch<React.SetStateAction<number>>;
  targetPickerQuery: string;
  setTargetPickerQuery: React.Dispatch<React.SetStateAction<string>>;
  objective: SolveObjective;
  setObjective: React.Dispatch<React.SetStateAction<SolveObjective>>;
  balancePolicy: BalancePolicy;
  setBalancePolicy: React.Dispatch<React.SetStateAction<BalancePolicy>>;
  autoPromoteUnavailableItemsToRawInputs: boolean;
  setAutoPromoteUnavailableItemsToRawInputs: React.Dispatch<React.SetStateAction<boolean>>;
  proliferatorPolicy: WorkbenchProliferatorPolicy;
  setProliferatorPolicy: React.Dispatch<React.SetStateAction<WorkbenchProliferatorPolicy>>;
  globalProliferatorLevel: '' | number;
  setGlobalProliferatorLevel: React.Dispatch<React.SetStateAction<'' | number>>;
  rawInputItemIds: string[];
  setRawInputItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  disabledRawInputItemIds: string[];
  setDisabledRawInputItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  disabledRecipeIds: string[];
  setDisabledRecipeIds: React.Dispatch<React.SetStateAction<string[]>>;
  disabledBuildingIds: string[];
  setDisabledBuildingIds: React.Dispatch<React.SetStateAction<string[]>>;
  disabledBuildingDraftId: string;
  setDisabledBuildingDraftId: React.Dispatch<React.SetStateAction<string>>;
  allowedRecipesByItem: Record<string, string[]>;
  setAllowedRecipesByItem: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  recipePreferences: EditableRecipePreference[];
  setRecipePreferences: React.Dispatch<React.SetStateAction<EditableRecipePreference[]>>;
  recipeStrategyOverrides: EditableRecipeStrategyOverride[];
  setRecipeStrategyOverrides: React.Dispatch<
    React.SetStateAction<EditableRecipeStrategyOverride[]>
  >;
  recipePreferenceDraftId: string;
  setRecipePreferenceDraftId: React.Dispatch<React.SetStateAction<string>>;
  advancedOverridesText: string;
  setAdvancedOverridesText: React.Dispatch<React.SetStateAction<string>>;
  recipeStrategyWarning: string;
  setRecipeStrategyWarning: React.Dispatch<React.SetStateAction<string>>;

  // Preferred buildings
  preferredBuildings: EditablePreferredBuilding[];
  setPreferredBuildings: React.Dispatch<React.SetStateAction<EditablePreferredBuilding[]>>;

  // Refs
  itemLedgerScrollRef: React.MutableRefObject<HTMLDivElement | null>;
  itemLedgerSectionRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;

  // Derived data
  itemOptions: ItemPickerOption[];
  recipeOptions: ResolvedRecipeSpec[];
  buildingOptions: ResolvedCatalogModel['buildings'];
  parsedOverrides: ParseAdvancedOverridesResult;
  autoSolveState: WorkbenchSolveState;
  model: PresentationModel | null;
  fallbackModel: PresentationModel | null;
  preferredRecipeOptionsByItem: Record<string, WorkbenchRecipeOption[]>;
  globalProliferatorLevelOptions: number[];
  recipeStrategyOverrideMap: Map<string, EditableRecipeStrategyOverride>;
  isCustomPreset: boolean;
  hasTargets: boolean;
  lastRequest: SolveRequest | undefined;
  activeSolveRequest: SolveRequest | undefined;
  canStartSolve: boolean;
  canCancelSolve: boolean;
  solveCancelledForCurrentInputs: boolean;
  result: SolveResult | null;
  solveError: string;
  fallbackSolve: WorkbenchSolveState['fallback'];
  requestSummary: PresentationModel['requestSummary'] | undefined;
  iconAtlasIds: string[];
  targetDraftItemOption: ItemPickerOption | null;
  disableBuildingOptions: ResolvedCatalogModel['buildings'];
  recipePreferenceOptions: ResolvedRecipeSpec[];
  globalProliferatorLevelDisabled: boolean;
  revealedRecipePlanKey: string;
  revealedRecipePlanNonce: number;

  // Event handlers
  applyWorkbenchEditorState: (
    nextCatalog: ResolvedCatalogModel,
    editorState: WorkbenchEditorState
  ) => void;
  buildCurrentWorkbenchEditorState: () => WorkbenchEditorState;
  loadCatalog: (
    nextDatasetPath: string,
    nextDefaultConfigPath: string,
    nextLabel: string,
    nextPresetId: DatasetPresetId
  ) => Promise<void>;
  reloadCatalog: () => void;
  onPresetChange: (nextPresetId: DatasetPresetId) => void;
  clearCachedWorkbenchState: () => void;
  switchWorkbenchConfig: (configId: string) => void;
  createDefaultWorkbenchConfig: () => void;
  renameWorkbenchConfig: (configId: string, name: string) => void;
  forkActiveWorkbenchConfig: () => void;
  deleteWorkbenchConfig: (configId: string) => void;
  resetDatasetEditorToLoadedSource: () => void;
  updateDatasetEditorTexts: (nextDatasetText: string, nextDefaultConfigText: string) => void;
  applyDatasetEditorChanges: () => void;
  addTarget: (nextTarget?: EditableTarget) => void;
  updateTarget: (index: number, patch: Partial<EditableTarget>) => void;
  removeTarget: (index: number) => void;
  markItemAsRawInput: (itemId: string) => void;
  unmarkItemAsRawInput: (itemId: string) => void;
  addDisabledRecipe: (recipeId: string) => void;
  removeDisabledRecipe: (recipeId: string) => void;
  addDisabledBuilding: () => void;
  removeDisabledBuilding: (buildingId: string) => void;
  addRecipePreference: () => void;
  updateRecipePreference: (recipeId: string, patch: Partial<EditableRecipePreference>) => void;
  removeRecipePreference: (recipeId: string) => void;
  getRecipeDefinition: (recipeId: string) => ResolvedRecipeSpec | undefined;
  getRecipeBuildingOptions: (
    recipeId: string
  ) => Array<NonNullable<ReturnType<ResolvedCatalogModel['buildingMap']['get']>>>;
  getRecipeModeOptions: (recipeId: string) => ProliferatorMode[];
  getRecipeLevelOptions: (recipeId: string) => number[];
  applyRecipeStrategyPatch: (
    recipeId: string,
    patch: Partial<EditableRecipeStrategyOverride>
  ) => boolean;
  applyAllowedRecipesForItem: (
    itemId: string,
    recipeIds: string[]
  ) => { accepted: boolean; message: string };
  clearAllowedRecipesForItem: (itemId: string) => void;
  removeAllowedRecipeForItem: (itemId: string, recipeId: string) => void;
  setRecipePreferredBuilding: (recipeId: string, buildingId: string) => void;
  setRecipePreferredProliferator: (
    recipeId: string,
    mode: '' | ProliferatorMode,
    level: '' | number
  ) => void;
  addPreferredBuilding: (entry: EditablePreferredBuilding) => void;
  removePreferredBuilding: (index: number) => void;
  locateItemInLedger: (itemId: string) => void;
  revealRecipePlan: (planKey: string) => void;
  scrollItemLedgerToTop: () => void;
  scrollItemLedgerToBottom: () => void;
  scrollItemLedgerToSection: (sectionKey: string) => void;
  applyAllowSurplusFallback: () => void;
  startSolve: () => void;
  cancelSolve: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

function upsertRecipePreferenceEntry(
  currentPreferences: EditableRecipePreference[],
  recipeId: string,
  patch: Partial<EditableRecipePreference>
): EditableRecipePreference[] {
  const currentPreference =
    currentPreferences.find(preference => preference.recipeId === recipeId) ?? {
      recipeId,
      preferredBuildingId: '',
      preferredProliferatorMode: '',
      preferredProliferatorLevel: '',
    };

  const nextPreference: EditableRecipePreference = {
    ...currentPreference,
    ...patch,
    recipeId,
  };

  if (nextPreference.preferredProliferatorMode === '') {
    nextPreference.preferredProliferatorLevel = '';
  } else if (nextPreference.preferredProliferatorMode === 'none') {
    nextPreference.preferredProliferatorLevel = 0;
  } else if (nextPreference.preferredProliferatorLevel === 0) {
    nextPreference.preferredProliferatorLevel = '';
  }

  const remainingPreferences = currentPreferences.filter(
    preference => preference.recipeId !== recipeId
  );
  const hasValue = Boolean(
    nextPreference.preferredBuildingId ||
    nextPreference.preferredProliferatorMode ||
    nextPreference.preferredProliferatorLevel !== ''
  );

  return hasValue
    ? [...remainingPreferences, nextPreference]
    : remainingPreferences;
}

function patchRecipeStrategyOverrideEntry(
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

  const nextOverride: EditableRecipeStrategyOverride = {
    ...currentOverride,
    ...patch,
    recipeId,
  };

  if (nextOverride.forcedProliferatorMode === '') {
    nextOverride.forcedProliferatorLevel = '';
  } else if (nextOverride.forcedProliferatorMode === 'none') {
    nextOverride.forcedProliferatorLevel = 0;
  } else if (nextOverride.forcedProliferatorLevel === 0) {
    nextOverride.forcedProliferatorLevel = '';
  }

  const remainingOverrides = currentOverrides.filter(
    override => override.recipeId !== recipeId
  );
  const hasValue = Boolean(
    nextOverride.forcedBuildingId ||
    nextOverride.forcedProliferatorMode ||
    nextOverride.forcedProliferatorLevel !== ''
  );

  return hasValue ? [...remainingOverrides, nextOverride] : remainingOverrides;
}

function findWorkbenchConfig(
  configs: WorkbenchPersistedConfig[],
  configId: string
): WorkbenchPersistedConfig | null {
  return configs.find(config => config.id === configId) ?? null;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
  const locale = DEFAULT_APP_LOCALE;
  const bundle = useMemo(() => getLocaleBundle(locale), [locale]);
  const browserStorage = useMemo(() => getBrowserStorage(), []);
  const browserSessionStorage = useMemo(() => getBrowserSessionStorage(), []);
  const initialCachedSource = useMemo(
    () => readActiveWorkbenchCacheSource(browserStorage),
    [browserStorage]
  );
  const fallbackPreset = DATASET_PRESETS[0];
  const initialPreset =
    DATASET_PRESETS.find(
      preset =>
        preset.id === initialCachedSource?.presetId ||
        (initialCachedSource &&
          preset.datasetPath === initialCachedSource.datasetPath &&
          (preset.defaultConfigPath ?? '') === initialCachedSource.defaultConfigPath)
    ) ??
    (initialCachedSource?.presetId === 'custom'
      ? DATASET_PRESETS[DATASET_PRESETS.length - 1]
      : fallbackPreset);

  // -------------------------------------------------------------------------
  // State declarations
  // -------------------------------------------------------------------------

  const [presetId, setPresetId] = useState<DatasetPresetId>(
    initialCachedSource?.presetId ?? initialPreset.id
  );
  const [datasetPath, setDatasetPath] = useState(
    initialCachedSource?.datasetPath ?? initialPreset.datasetPath
  );
  const [defaultConfigPath, setDefaultConfigPath] = useState(
    initialCachedSource?.defaultConfigPath ?? initialPreset.defaultConfigPath ?? ''
  );
  const [catalogLabel, setCatalogLabel] = useState(
    getDatasetPresetText(initialCachedSource?.presetId ?? initialPreset.id, locale).label
  );
  const [catalog, setCatalog] = useState<ResolvedCatalogModel | null>(null);
  const [loadedSource, setLoadedSource] = useState<WorkbenchCacheSource | null>(null);
  const [loadedDatasetText, setLoadedDatasetText] = useState('');
  const [loadedDefaultConfigText, setLoadedDefaultConfigText] = useState('{}');
  const [datasetEditorText, setDatasetEditorText] = useState('');
  const [defaultConfigEditorText, setDefaultConfigEditorText] = useState('{}');
  const [datasetEditorError, setDatasetEditorError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workbenchConfigs, setWorkbenchConfigs] = useState<WorkbenchPersistedConfig[]>([]);
  const [activeWorkbenchConfigId, setActiveWorkbenchConfigId] = useState('');
  const [hydratingWorkbenchConfig, setHydratingWorkbenchConfig] = useState<{
    configId: string;
    expectedInputKey: string;
  } | null>(null);

  const [targets, setTargets] = useState<EditableTarget[]>([]);
  const [targetDraftItemId, setTargetDraftItemId] = useState('');
  const [targetDraftRatePerMin, setTargetDraftRatePerMin] = useState(60);
  const [targetPickerQuery, setTargetPickerQuery] = useState('');
  const [objective, setObjective] = useState<SolveObjective>('min_buildings');
  const [balancePolicy, setBalancePolicy] = useState<BalancePolicy>('force_balance');
  const [autoPromoteUnavailableItemsToRawInputs, setAutoPromoteUnavailableItemsToRawInputs] =
    useState(false);
  const [proliferatorPolicy, setProliferatorPolicy] =
    useState<WorkbenchProliferatorPolicy>('auto');
  const [globalProliferatorLevel, setGlobalProliferatorLevel] = useState<'' | number>('');
  const [rawInputItemIds, setRawInputItemIds] = useState<string[]>([]);
  const [disabledRawInputItemIds, setDisabledRawInputItemIds] = useState<string[]>([]);
  const [disabledRecipeIds, setDisabledRecipeIds] = useState<string[]>([]);
  const [disabledBuildingIds, setDisabledBuildingIds] = useState<string[]>([]);
  const [disabledBuildingDraftId, setDisabledBuildingDraftId] = useState('');
  const [allowedRecipesByItem, setAllowedRecipesByItem] = useState<Record<string, string[]>>({});
  const [recipePreferences, setRecipePreferences] = useState<EditableRecipePreference[]>([]);
  const [recipeStrategyOverrides, setRecipeStrategyOverrides] = useState<
    EditableRecipeStrategyOverride[]
  >([]);
  const [recipePreferenceDraftId, setRecipePreferenceDraftId] = useState('');
  const [advancedOverridesText, setAdvancedOverridesText] = useState('');
  const [recipeStrategyWarning, setRecipeStrategyWarning] = useState('');
  const [preferredBuildings, setPreferredBuildings] = useState<EditablePreferredBuilding[]>([]);
  const [revealedRecipePlanKey, setRevealedRecipePlanKey] = useState('');
  const [revealedRecipePlanNonce, setRevealedRecipePlanNonce] = useState(0);

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------

  const itemLedgerScrollRef = useRef<HTMLDivElement | null>(null);
  const itemLedgerSectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // -------------------------------------------------------------------------
  // Functions: applyWorkbenchEditorState & buildCurrentWorkbenchEditorState
  // -------------------------------------------------------------------------

  function applyWorkbenchEditorState(
    nextCatalog: ResolvedCatalogModel,
    editorState: WorkbenchEditorState
  ) {
    setTargets(editorState.targets);
    setTargetDraftItemId(
      pickSuggestedTargetItemId(
        nextCatalog,
        nextCatalog.items.filter(item => item.kind !== 'utility'),
        editorState.targets
      )
    );
    setTargetDraftRatePerMin(60);
    setTargetPickerQuery('');
    setObjective(editorState.objective);
    setBalancePolicy(editorState.balancePolicy);
    setAutoPromoteUnavailableItemsToRawInputs(
      editorState.autoPromoteUnavailableItemsToRawInputs
    );
    setProliferatorPolicy(editorState.proliferatorPolicy);
    setGlobalProliferatorLevel(editorState.globalProliferatorLevel ?? '');
    setRawInputItemIds(editorState.rawInputItemIds);
    setDisabledRawInputItemIds(editorState.disabledRawInputItemIds);
    setDisabledRecipeIds(editorState.disabledRecipeIds);
    setDisabledBuildingIds(editorState.disabledBuildingIds);
    setDisabledBuildingDraftId('');
    setAllowedRecipesByItem(editorState.allowedRecipesByItem);
    setRecipePreferences(editorState.recipePreferences);
    setRecipeStrategyOverrides(editorState.recipeStrategyOverrides);
    setRecipePreferenceDraftId(pickDefaultRecipePreference(nextCatalog));
    setAdvancedOverridesText(editorState.advancedOverridesText);
    setRecipeStrategyWarning('');
    setPreferredBuildings(editorState.preferredBuildings);
  }

  function buildCurrentWorkbenchEditorState(): WorkbenchEditorState {
    return {
      targets,
      objective,
      balancePolicy,
      autoPromoteUnavailableItemsToRawInputs,
      proliferatorPolicy,
      globalProliferatorLevel,
      rawInputItemIds,
      disabledRawInputItemIds,
      disabledRecipeIds,
      disabledBuildingIds,
      allowedRecipesByItem,
      recipePreferences,
      recipeStrategyOverrides,
      preferredBuildings,
      advancedOverridesText,
    };
  }

  const currentWorkbenchEditorState = useMemo(
    () => buildCurrentWorkbenchEditorState(),
    [
      advancedOverridesText,
      autoPromoteUnavailableItemsToRawInputs,
      balancePolicy,
      disabledBuildingIds,
      disabledRawInputItemIds,
      disabledRecipeIds,
      objective,
      allowedRecipesByItem,
      preferredBuildings,
      proliferatorPolicy,
      globalProliferatorLevel,
      rawInputItemIds,
      recipePreferences,
      recipeStrategyOverrides,
      targets,
    ]
  );

  function restoreReusableSolveInputKey(nextInputKey: string | null) {
    restoredSolveInputKeyAwaitingMatchRef.current = Boolean(nextInputKey);
    setRestoredSolveInputKey(nextInputKey);
  }

  function beginWorkbenchConfigHydration(
    config: Pick<WorkbenchPersistedConfig, 'id' | 'editorState'>,
    signature: string
  ) {
    setHydratingWorkbenchConfig({
      configId: config.id,
      expectedInputKey: buildExpectedSolveInputKeyForWorkbenchEditorState({
        editorState: config.editorState,
        catalogSignature: signature,
        locale,
      }),
    });
  }

  // -------------------------------------------------------------------------
  // loadCatalog
  // -------------------------------------------------------------------------

  async function loadCatalog(
    nextDatasetPath: string,
    nextDefaultConfigPath: string,
    nextLabel: string,
    nextPresetId: DatasetPresetId
  ) {
    if (!nextDatasetPath.trim()) {
      setLoadError(bundle.datasetSource.datasetPathRequired);
      setCatalog(null);
      setLoadedSource(null);
      return;
    }

    try {
      const trimmedDatasetPath = nextDatasetPath.trim();
      const trimmedDefaultConfigPath = nextDefaultConfigPath.trim();
      setIsLoading(true);
      setLoadError('');
      setDatasetEditorError('');
      setCatalog(null);
      const loaded = await loadCatalogSourceFromUrl(
        trimmedDatasetPath,
        trimmedDefaultConfigPath || undefined
      );
      const nextSource: WorkbenchCacheSource = {
        presetId: nextPresetId,
        datasetPath: trimmedDatasetPath,
        defaultConfigPath: trimmedDefaultConfigPath,
      };
      const cachedDraft = readWorkbenchDatasetDraft(browserStorage, nextSource);
      let restoredSource = loaded;
      if (cachedDraft) {
        try {
          restoredSource = resolveCatalogSourceTexts(
            cachedDraft.datasetText,
            cachedDraft.defaultConfigText
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          setDatasetEditorError(`${bundle.datasetSource.editorApplyFailedPrefix}${detail}`);
        }
      }
      const nextCatalog = restoredSource.catalog;
      const nextCatalogSolveSignature = buildWorkbenchCatalogSolveSignature(
        restoredSource.datasetText,
        restoredSource.defaultConfigText
      );
      const defaultEditorState = buildDefaultWorkbenchEditorState(nextCatalog);
      const cachedConfigCollection = sanitizeWorkbenchConfigCollectionForCatalog(
        nextCatalog,
        readWorkbenchConfigCollection(browserStorage, nextSource),
        defaultEditorState
      );
      const hydratedConfigCollection = {
        ...cachedConfigCollection,
        configs: backfillWorkbenchConfigSolveInputKeys({
          configs: cachedConfigCollection.configs,
          catalogSignature: nextCatalogSolveSignature,
          locale,
        }),
      };
      const nextActiveConfig =
        findWorkbenchConfig(hydratedConfigCollection.configs, hydratedConfigCollection.activeConfigId) ??
        hydratedConfigCollection.configs[0];

      setCatalog(nextCatalog);
      setLoadedSource(nextSource);
      setLoadedDatasetText(loaded.datasetText);
      setLoadedDefaultConfigText(loaded.defaultConfigText);
      setDatasetEditorText(restoredSource.datasetText);
      setDefaultConfigEditorText(restoredSource.defaultConfigText);
      setCatalogLabel(nextLabel);
      setWorkbenchConfigs(hydratedConfigCollection.configs);
      setActiveWorkbenchConfigId(nextActiveConfig.id);
      beginWorkbenchConfigHydration(nextActiveConfig, nextCatalogSolveSignature);
      setBlockedSolveInputKey(null);
      restoreReusableSolveInputKey(
        findReusableSolveInputKeyForConfig({
          config: nextActiveConfig,
          catalogSignature: nextCatalogSolveSignature,
          locale,
        })
      );
      setAutoSolveState(restoreWorkbenchSolveState(nextActiveConfig.solveState));
      applyWorkbenchEditorState(nextCatalog, nextActiveConfig.editorState);
    } catch (error) {
      setCatalog(null);
      setLoadedSource(null);
      setLoadedDatasetText('');
      setLoadedDefaultConfigText('{}');
      setWorkbenchConfigs([]);
      setActiveWorkbenchConfigId('');
      setAutoSolveState(buildIdleWorkbenchSolveState());
      const detail = error instanceof Error ? error.message : String(error);
      setLoadError(`${bundle.datasetSource.loadFailedPrefix}${detail}`);
    } finally {
      setIsLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // Initial catalog load
  useEffect(() => {
    void loadCatalog(
      initialCachedSource?.datasetPath ?? datasetPath,
      initialCachedSource?.defaultConfigPath ?? defaultConfigPath,
      catalogLabel,
      initialCachedSource?.presetId ?? presetId
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist active workbench cache source
  useEffect(() => {
    writeActiveWorkbenchCacheSource(browserStorage, {
      presetId,
      datasetPath,
      defaultConfigPath,
    });
  }, [browserStorage, defaultConfigPath, datasetPath, presetId]);

  // -------------------------------------------------------------------------
  // Derived: itemOptions
  // -------------------------------------------------------------------------

  const itemOptions = useMemo<ItemPickerOption[]>(
    () =>
      catalog?.items
        .filter(item => item.kind !== 'utility')
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(item => ({
          itemId: item.itemId,
          name: item.name,
          icon: item.icon,
        })) ?? [],
    [catalog]
  );

  // Sync targetDraftItemId when catalog/options/targets change
  useEffect(() => {
    if (!catalog) {
      setTargetDraftItemId('');
      return;
    }

    const suggestedItemId = pickSuggestedTargetItemId(catalog, itemOptions, targets);
    if (!targetDraftItemId || !itemOptions.some(item => item.itemId === targetDraftItemId)) {
      setTargetDraftItemId(suggestedItemId);
    }
  }, [catalog, itemOptions, targetDraftItemId, targets]);

  // -------------------------------------------------------------------------
  // Derived: recipeOptions, buildingOptions
  // -------------------------------------------------------------------------

  const recipeOptions = useMemo(
    () =>
      catalog?.recipes.slice().sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const buildingOptions = useMemo(
    () =>
      catalog?.buildings.slice().sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  // -------------------------------------------------------------------------
  // Derived: disableBuildingOptions, recipePreferenceOptions
  // -------------------------------------------------------------------------

  const disableBuildingOptions = useMemo(
    () =>
      buildingOptions.filter(building => !disabledBuildingIds.includes(building.buildingId)),
    [buildingOptions, disabledBuildingIds]
  );

  const recipePreferenceOptions = useMemo(
    () =>
      recipeOptions.filter(
        recipe => !recipePreferences.some(preference => preference.recipeId === recipe.recipeId)
      ),
    [recipeOptions, recipePreferences]
  );

  // Sync disabledBuildingDraftId
  useEffect(() => {
    if (!disabledBuildingDraftId && disableBuildingOptions.length > 0) {
      setDisabledBuildingDraftId(disableBuildingOptions[0].buildingId);
      return;
    }
    if (
      disabledBuildingDraftId &&
      disableBuildingOptions.length > 0 &&
      !disableBuildingOptions.some(
        building => building.buildingId === disabledBuildingDraftId
      )
    ) {
      setDisabledBuildingDraftId(disableBuildingOptions[0].buildingId);
    }
  }, [disabledBuildingDraftId, disableBuildingOptions]);

  // Sync recipePreferenceDraftId
  useEffect(() => {
    if (!recipePreferenceDraftId && recipePreferenceOptions.length > 0) {
      setRecipePreferenceDraftId(recipePreferenceOptions[0].recipeId);
      return;
    }
    if (
      recipePreferenceDraftId &&
      recipePreferenceOptions.length > 0 &&
      !recipePreferenceOptions.some(recipe => recipe.recipeId === recipePreferenceDraftId)
    ) {
      setRecipePreferenceDraftId(recipePreferenceOptions[0].recipeId);
    }
  }, [recipePreferenceDraftId, recipePreferenceOptions]);

  // -------------------------------------------------------------------------
  // Effects: persist editor state and dataset draft
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!loadedSource || !activeWorkbenchConfigId) {
      return;
    }

    if (hydratingWorkbenchConfig?.configId === activeWorkbenchConfigId) {
      return;
    }

    setWorkbenchConfigs(current => {
      const nextCollection = replaceWorkbenchConfigEditorState(
        {
          activeConfigId: activeWorkbenchConfigId,
          configs: current,
        },
        activeWorkbenchConfigId,
        currentWorkbenchEditorState
      );
      return nextCollection.configs === current ? current : nextCollection.configs;
    });
  }, [
    activeWorkbenchConfigId,
    currentWorkbenchEditorState,
    hydratingWorkbenchConfig,
    loadedSource,
  ]);

  useEffect(() => {
    if (!browserStorage || !loadedSource || !activeWorkbenchConfigId || workbenchConfigs.length === 0) {
      return;
    }

    writeWorkbenchConfigCollection(browserStorage, loadedSource, {
      activeConfigId: activeWorkbenchConfigId,
      configs: workbenchConfigs,
    });
  }, [activeWorkbenchConfigId, browserStorage, loadedSource, workbenchConfigs]);

  useEffect(() => {
    if (!browserStorage || !loadedSource) {
      return;
    }

    writeWorkbenchDatasetDraft(browserStorage, loadedSource, {
      datasetText: datasetEditorText,
      defaultConfigText: defaultConfigEditorText,
    });
  }, [browserStorage, datasetEditorText, defaultConfigEditorText, loadedSource]);

  // -------------------------------------------------------------------------
  // Derived: parsedOverrides, solveInputs, autoSolveState
  // -------------------------------------------------------------------------

  const parsedOverrides = useMemo(
    () => parseAdvancedSolveOverrides(advancedOverridesText, locale),
    [advancedOverridesText, locale]
  );

  const solveInputs = useMemo(
    () => ({
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
      preferredBuildings,
      recipePreferences,
      recipeStrategyOverrides,
      advancedOverridesText,
      locale,
      isLoading,
    }),
    [
      advancedOverridesText,
      autoPromoteUnavailableItemsToRawInputs,
      balancePolicy,
      catalog,
      disabledRawInputItemIds,
      disabledBuildingIds,
      disabledRecipeIds,
      isLoading,
      locale,
      objective,
      allowedRecipesByItem,
      preferredBuildings,
      proliferatorPolicy,
      globalProliferatorLevel,
      rawInputItemIds,
      preferredBuildings,
      recipePreferences,
      recipeStrategyOverrides,
      targets,
    ]
  );
  const deferredSolveInputs = useDeferredValue(solveInputs);
  const [autoSolveState, setAutoSolveState] = useState<WorkbenchSolveState>(() =>
    buildIdleWorkbenchSolveState()
  );
  const autoSolveSequenceRef = useRef(0);
  const [manualSolveNonce, setManualSolveNonce] = useState(0);
  const [blockedSolveInputKey, setBlockedSolveInputKey] = useState<string | null>(null);
  const [restoredSolveInputKey, setRestoredSolveInputKey] = useState<string | null>(null);
  const restoredSolveInputKeyAwaitingMatchRef = useRef(false);
  const activeSolveInputKeyRef = useRef<string | null>(null);
  const activeSolveCancellerRef = useRef<(() => void) | null>(null);
  const catalogSolveSignature = useMemo(
    () =>
      loadedSource
        ? buildWorkbenchCatalogSolveSignature(loadedDatasetText, loadedDefaultConfigText)
        : 'no-catalog',
    [loadedDefaultConfigText, loadedDatasetText, loadedSource]
  );
  const deferredSolveInputKey = useMemo(
    () =>
      buildWorkbenchSolveInputKey({
        catalogSignature: catalogSolveSignature,
        targets: deferredSolveInputs.targets,
        objective: deferredSolveInputs.objective,
        balancePolicy: deferredSolveInputs.balancePolicy,
        proliferatorPolicy: deferredSolveInputs.proliferatorPolicy,
        globalProliferatorLevel: deferredSolveInputs.globalProliferatorLevel,
        autoPromoteUnavailableItemsToRawInputs:
          deferredSolveInputs.autoPromoteUnavailableItemsToRawInputs,
        rawInputItemIds: deferredSolveInputs.rawInputItemIds,
        disabledRawInputItemIds: deferredSolveInputs.disabledRawInputItemIds,
        disabledRecipeIds: deferredSolveInputs.disabledRecipeIds,
        disabledBuildingIds: deferredSolveInputs.disabledBuildingIds,
        allowedRecipesByItem: deferredSolveInputs.allowedRecipesByItem,
        preferredBuildings: deferredSolveInputs.preferredBuildings,
        recipePreferences: deferredSolveInputs.recipePreferences,
        recipeStrategyOverrides: deferredSolveInputs.recipeStrategyOverrides,
        advancedOverridesText: deferredSolveInputs.advancedOverridesText,
        locale: deferredSolveInputs.locale,
        isLoading: deferredSolveInputs.isLoading,
      }),
    [catalogSolveSignature, deferredSolveInputs]
  );
  const persistedAutoSolveState = useMemo(
    () =>
      persistWorkbenchSolveState(autoSolveState, {
        inputKey: autoSolveState.activity.status === 'settled' ? deferredSolveInputKey : undefined,
      }),
    [autoSolveState, deferredSolveInputKey]
  );

  useEffect(() => {
    if (!hydratingWorkbenchConfig || hydratingWorkbenchConfig.configId !== activeWorkbenchConfigId) {
      return;
    }

    if (hydratingWorkbenchConfig.expectedInputKey !== deferredSolveInputKey) {
      return;
    }

    setHydratingWorkbenchConfig(null);
  }, [activeWorkbenchConfigId, deferredSolveInputKey, hydratingWorkbenchConfig]);

  useEffect(() => {
    if (blockedSolveInputKey && blockedSolveInputKey !== deferredSolveInputKey) {
      setBlockedSolveInputKey(null);
    }
  }, [blockedSolveInputKey, deferredSolveInputKey]);

  useEffect(() => {
    if (!restoredSolveInputKey) {
      restoredSolveInputKeyAwaitingMatchRef.current = false;
      return;
    }

    if (restoredSolveInputKey === deferredSolveInputKey) {
      restoredSolveInputKeyAwaitingMatchRef.current = false;
      return;
    }

    if (!restoredSolveInputKeyAwaitingMatchRef.current) {
      setRestoredSolveInputKey(null);
    }
  }, [deferredSolveInputKey, restoredSolveInputKey]);

  const startSolve = useCallback(() => {
    setHydratingWorkbenchConfig(null);
    setBlockedSolveInputKey(null);
    setRestoredSolveInputKey(null);
    restoredSolveInputKeyAwaitingMatchRef.current = false;
    setManualSolveNonce(current => current + 1);
  }, []);

  const cancelSolve = useCallback(() => {
    if (autoSolveState.activity.status !== 'running') {
      return;
    }

    autoSolveSequenceRef.current += 1;
    activeSolveCancellerRef.current?.();
    activeSolveCancellerRef.current = null;
    setBlockedSolveInputKey(activeSolveInputKeyRef.current ?? deferredSolveInputKey);
    activeSolveInputKeyRef.current = null;
    startTransition(() => {
      setAutoSolveState(current => buildCancelledWorkbenchSolveState(current));
    });
  }, [autoSolveState.activity.status, deferredSolveInputKey]);

  useEffect(() => {
    if (!deferredSolveInputs.catalog || deferredSolveInputs.isLoading) {
      activeSolveCancellerRef.current = null;
      activeSolveInputKeyRef.current = null;
      startTransition(() => {
        setAutoSolveState(current => {
          const shouldPreserveRestoredSolveState =
            (Boolean(restoredSolveInputKey) ||
              hydratingWorkbenchConfig?.configId === activeWorkbenchConfigId) &&
            (current.activity.status === 'settled' || current.activity.status === 'cancelled');

          return shouldPreserveRestoredSolveState
            ? current
            : buildIdleWorkbenchSolveState();
        });
      });
      return;
    }

    if (hydratingWorkbenchConfig?.configId === activeWorkbenchConfigId) {
      return;
    }

    if (
      blockedSolveInputKey === deferredSolveInputKey ||
      restoredSolveInputKey === deferredSolveInputKey
    ) {
      return;
    }

    const activeCatalog = deferredSolveInputs.catalog;
    const sequence = autoSolveSequenceRef.current + 1;
    autoSolveSequenceRef.current = sequence;
    let disposed = false;
    activeSolveInputKeyRef.current = deferredSolveInputKey;
    activeSolveCancellerRef.current = cancelSolveWorker;

    setAutoSolveState(current =>
      buildRunningWorkbenchSolveState(current, {
        stage: 'preparing_request',
      })
    );

    void (async () => {
      await waitForNextPaint();
      if (disposed || autoSolveSequenceRef.current !== sequence) {
        return;
      }

      const nextState = await computeWorkbenchSolveAsync(
        {
          catalog: activeCatalog,
          targets: deferredSolveInputs.targets,
          objective: deferredSolveInputs.objective,
          balancePolicy: deferredSolveInputs.balancePolicy,
          proliferatorPolicy: deferredSolveInputs.proliferatorPolicy,
          globalProliferatorLevel: deferredSolveInputs.globalProliferatorLevel,
          autoPromoteUnavailableItemsToRawInputs:
            deferredSolveInputs.autoPromoteUnavailableItemsToRawInputs,
          rawInputItemIds: deferredSolveInputs.rawInputItemIds,
          disabledRawInputItemIds: deferredSolveInputs.disabledRawInputItemIds,
          disabledRecipeIds: deferredSolveInputs.disabledRecipeIds,
          disabledBuildingIds: deferredSolveInputs.disabledBuildingIds,
          allowedRecipesByItem: deferredSolveInputs.allowedRecipesByItem,
          preferredBuildings: deferredSolveInputs.preferredBuildings,
          recipePreferences: deferredSolveInputs.recipePreferences,
          recipeStrategyOverrides: deferredSolveInputs.recipeStrategyOverrides,
          advancedOverridesText: deferredSolveInputs.advancedOverridesText,
          locale: deferredSolveInputs.locale,
        },
        solveCatalogRequestWithWorker,
        progress => {
          if (disposed || autoSolveSequenceRef.current !== sequence) {
            return;
          }

          setAutoSolveState(current =>
            buildRunningWorkbenchSolveState(current, {
              stage: progress.stage,
              activeRequest: progress.activeRequest,
            })
          );
        }
      );
      if (disposed || autoSolveSequenceRef.current !== sequence) {
        return;
      }

      startTransition(() => {
        setAutoSolveState(nextState);
      });
      if (autoSolveSequenceRef.current === sequence) {
        activeSolveInputKeyRef.current = null;
        activeSolveCancellerRef.current = null;
      }
    })();

    return () => {
      disposed = true;
      if (autoSolveSequenceRef.current === sequence) {
        activeSolveInputKeyRef.current = null;
        activeSolveCancellerRef.current = null;
      }
    };
  }, [
    blockedSolveInputKey,
    deferredSolveInputKey,
    deferredSolveInputs,
    hydratingWorkbenchConfig,
    manualSolveNonce,
    restoredSolveInputKey,
    activeWorkbenchConfigId,
  ]);

  const snapshotSolveRequest = useMemo(
    () =>
      catalog
        ? buildWorkbenchSnapshotSolveRequest({
            catalog,
            editorState: currentWorkbenchEditorState,
            advancedOverrides: parsedOverrides.value,
          })
        : undefined,
    [catalog, currentWorkbenchEditorState, parsedOverrides.value]
  );
  const activeWorkbenchConfig = useMemo(
    () => findWorkbenchConfig(workbenchConfigs, activeWorkbenchConfigId),
    [activeWorkbenchConfigId, workbenchConfigs]
  );
  const reusableDisplayedSolveInputKey = useMemo(
    () =>
      activeWorkbenchConfig
        ? findReusableSolveInputKeyForConfig({
            config: activeWorkbenchConfig,
            catalogSignature: catalogSolveSignature,
            locale,
          })
        : null,
    [activeWorkbenchConfig, catalogSolveSignature, locale]
  );
  const displayedSolveState = useMemo(
    () =>
      buildDisplayedWorkbenchSolveState({
        liveState: autoSolveState,
        persistedState: activeWorkbenchConfig?.solveState,
        reusableInputKey: reusableDisplayedSolveInputKey,
      }),
    [activeWorkbenchConfig?.solveState, autoSolveState, reusableDisplayedSolveInputKey]
  );
  const lastRequest = displayedSolveState.request;
  const activeSolveRequest =
    displayedSolveState.activeRequest ?? displayedSolveState.request ?? snapshotSolveRequest;
  const canStartSolve = Boolean(deferredSolveInputs.catalog) && !deferredSolveInputs.isLoading;
  const canCancelSolve = autoSolveState.activity.status === 'running';
  const solveCancelledForCurrentInputs =
    autoSolveState.activity.status === 'cancelled' &&
    blockedSolveInputKey === deferredSolveInputKey;
  const result = displayedSolveState.result;
  const solveError = displayedSolveState.error;
  const fallbackSolve = displayedSolveState.fallback;
  const hasTargets = targets.length > 0;

  useEffect(() => {
    if (!loadedSource || !activeWorkbenchConfigId) {
      return;
    }

    if (hydratingWorkbenchConfig?.configId === activeWorkbenchConfigId) {
      return;
    }

    setWorkbenchConfigs(current => {
      const existingActiveConfig = findWorkbenchConfig(current, activeWorkbenchConfigId);
      const nextCollection = syncActiveWorkbenchConfigCollection(
        {
          activeConfigId: activeWorkbenchConfigId,
          configs: current,
        },
        activeWorkbenchConfigId,
        existingActiveConfig?.editorState ?? currentWorkbenchEditorState,
        resolvePersistedWorkbenchConfigSolveState({
          existingState: existingActiveConfig?.solveState,
          nextState: mergePersistedSolveStateInputKey(
            existingActiveConfig?.solveState,
            persistedAutoSolveState
          ),
          editorState: existingActiveConfig?.editorState ?? currentWorkbenchEditorState,
          catalogSignature: catalogSolveSignature,
          locale,
        }),
        {
          skipConfigId: hydratingWorkbenchConfig?.configId,
        }
      );
      return nextCollection.configs === current ? current : nextCollection.configs;
    });
  }, [
    activeWorkbenchConfigId,
    catalogSolveSignature,
    currentWorkbenchEditorState,
    hydratingWorkbenchConfig,
    loadedSource,
    locale,
    persistedAutoSolveState,
  ]);

  // -------------------------------------------------------------------------
  // Derived: model, fallbackModel
  // -------------------------------------------------------------------------

  const model = useMemo(() => {
    if (!catalog) {
      return null;
    }

    const startedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const nextModel = buildPresentationModel({
      catalog,
      request: lastRequest,
      result,
      datasetLabel: catalogLabel,
      datasetPath,
      defaultConfigPath: defaultConfigPath || undefined,
      locale,
    });
    const finishedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    recordWorkbenchPerf({
      phase: 'presentation',
      status: result?.status ?? 'idle',
      durationMs: finishedAt - startedAt,
      recordedAt: Date.now(),
    });
    return nextModel;
  }, [catalog, lastRequest, result, catalogLabel, datasetPath, defaultConfigPath, locale]);

  const iconAtlasIds =
    model?.catalogSummary.iconAtlasIds ?? catalog?.iconAtlasIds ?? ['Vanilla'];
  const displayedSolveRequest = activeSolveRequest ?? lastRequest ?? snapshotSolveRequest;
  const requestSummary = useMemo(
    () =>
      catalog && displayedSolveRequest
        ? buildPresentationRequestSummary(catalog, displayedSolveRequest, locale)
        : undefined,
    [catalog, displayedSolveRequest, locale]
  );

  const fallbackModel = useMemo(() => {
    if (!catalog || !fallbackSolve) {
      return null;
    }

    return buildPresentationModel({
      catalog,
      request: fallbackSolve.request,
      result: fallbackSolve.result,
      datasetLabel: catalogLabel,
      datasetPath,
      defaultConfigPath: defaultConfigPath || undefined,
      locale,
    });
  }, [catalog, fallbackSolve, catalogLabel, datasetPath, defaultConfigPath, locale]);

  // -------------------------------------------------------------------------
  // Derived: recipeStrategyOverrideMap, preferredRecipeOptionsByItem, etc.
  // -------------------------------------------------------------------------

  const recipeStrategyOverrideMap = useMemo(
    () => new Map(recipeStrategyOverrides.map(override => [override.recipeId, override])),
    [recipeStrategyOverrides]
  );

  const preferredRecipeOptionsByItem = useMemo(
    () => buildRecipeOptionsByOutputItem(catalog),
    [catalog]
  );

  const globalProliferatorLevelOptions = useMemo(
    () =>
      catalog
        ? catalog.proliferatorLevels
            .map(level => level.level)
            .filter(level => level > 0)
            .sort((left, right) => left - right)
        : [],
    [catalog]
  );

  const globalProliferatorLevelDisabled =
    proliferatorPolicy === 'auto' ||
    proliferatorPolicy === 'none' ||
    globalProliferatorLevelOptions.length === 0;

  const isCustomPreset = presetId === 'custom';

  const targetDraftItemOption = useMemo(
    () => itemOptions.find(item => item.itemId === targetDraftItemId) ?? null,
    [itemOptions, targetDraftItemId]
  );

  const isHydratingActiveWorkbenchConfig =
    hydratingWorkbenchConfig?.configId === activeWorkbenchConfigId;

  const workbenchConfigDisplayModels = useMemo(() => {
    if (!catalog) {
      return [];
    }

    return workbenchConfigs.map(config =>
      buildWorkbenchConfigDisplayModel(
        catalog,
        config.id === activeWorkbenchConfigId && !isHydratingActiveWorkbenchConfig
          ? {
              ...config,
              editorState: currentWorkbenchEditorState,
            }
          : config,
        locale,
        config.id === activeWorkbenchConfigId && !isHydratingActiveWorkbenchConfig
          ? autoSolveState
          : config.solveState
      )
    );
  }, [
    activeWorkbenchConfigId,
    autoSolveState,
    catalog,
    currentWorkbenchEditorState,
    isHydratingActiveWorkbenchConfig,
    locale,
    workbenchConfigs,
  ]);

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  function onPresetChange(nextPresetId: DatasetPresetId) {
    setPresetId(nextPresetId);
    const preset = DATASET_PRESETS.find(entry => entry.id === nextPresetId);
    if (!preset || preset.id === 'custom') {
      setCatalogLabel(getDatasetPresetText('custom', locale).label);
      return;
    }

    setCatalogLabel(getDatasetPresetText(preset.id, locale).label);
    setDatasetPath(preset.datasetPath);
    setDefaultConfigPath(preset.defaultConfigPath ?? '');
    void loadCatalog(
      preset.datasetPath,
      preset.defaultConfigPath ?? '',
      getDatasetPresetText(preset.id, locale).label,
      preset.id
    );
  }

  function reloadCatalog() {
    const source: WorkbenchCacheSource = {
      presetId,
      datasetPath: datasetPath.trim(),
      defaultConfigPath: defaultConfigPath.trim(),
    };
    clearWorkbenchDatasetDraft(browserStorage, source);
    void loadCatalog(datasetPath, defaultConfigPath, catalogLabel, presetId);
  }

  function clearCachedWorkbenchState() {
    clearNamespacedStorage(browserStorage);
    clearNamespacedStorage(browserSessionStorage);
    setDatasetEditorText(loadedDatasetText);
    setDefaultConfigEditorText(loadedDefaultConfigText);
    setDatasetEditorError('');

    if (typeof window !== 'undefined') {
      window.location.reload();
      return;
    }

    if (catalog) {
      clearWorkbenchCache(browserStorage);
      const defaultWorkbenchState = buildDefaultWorkbenchEditorState(catalog);
      const nextConfig = createWorkbenchPersistedConfig(defaultWorkbenchState);
      setWorkbenchConfigs([nextConfig]);
      setActiveWorkbenchConfigId(nextConfig.id);
      beginWorkbenchConfigHydration(nextConfig, catalogSolveSignature);
      setAutoSolveState(buildIdleWorkbenchSolveState());
      applyWorkbenchEditorState(catalog, defaultWorkbenchState);
    }
  }

  const buildSyncedWorkbenchConfigCollection = useCallback(
    function buildSyncedWorkbenchConfigCollection() {
      const existingActiveConfig = findWorkbenchConfig(workbenchConfigs, activeWorkbenchConfigId);
      return syncActiveWorkbenchConfigCollection(
        {
          activeConfigId: activeWorkbenchConfigId,
          configs: workbenchConfigs,
        },
        activeWorkbenchConfigId,
        currentWorkbenchEditorState,
        resolvePersistedWorkbenchConfigSolveState({
          existingState: existingActiveConfig?.solveState,
          nextState: mergePersistedSolveStateInputKey(
            existingActiveConfig?.solveState,
            persistedAutoSolveState
          ),
          editorState: currentWorkbenchEditorState,
          catalogSignature: catalogSolveSignature,
          locale,
        }),
        {
          skipConfigId: hydratingWorkbenchConfig?.configId,
        }
      );
    },
    [
      activeWorkbenchConfigId,
      catalogSolveSignature,
      currentWorkbenchEditorState,
      hydratingWorkbenchConfig,
      locale,
      persistedAutoSolveState,
      workbenchConfigs,
    ]
  );

  const switchWorkbenchConfig = useCallback(
    function switchWorkbenchConfig(nextConfigId: string) {
      if (!catalog || nextConfigId === activeWorkbenchConfigId) {
        return;
      }

      const nextCollection = buildSyncedWorkbenchConfigCollection();
      const nextConfig = findWorkbenchConfig(nextCollection.configs, nextConfigId);
      if (!nextConfig) {
        return;
      }

      setWorkbenchConfigs(nextCollection.configs);
      setActiveWorkbenchConfigId(nextConfig.id);
      beginWorkbenchConfigHydration(nextConfig, catalogSolveSignature);
      setBlockedSolveInputKey(null);
      restoreReusableSolveInputKey(
        findReusableSolveInputKeyForConfig({
          config: nextConfig,
          catalogSignature: catalogSolveSignature,
          locale,
        })
      );
      setAutoSolveState(restoreWorkbenchSolveState(nextConfig.solveState));
      applyWorkbenchEditorState(catalog, nextConfig.editorState);
    },
    [
      activeWorkbenchConfigId,
      buildSyncedWorkbenchConfigCollection,
      catalogSolveSignature,
      catalog,
      locale,
    ]
  );

  const renameWorkbenchConfig = useCallback(function renameWorkbenchConfig(
    configId: string,
    name: string
  ) {
    setWorkbenchConfigs(current =>
      renameWorkbenchConfigCollection(
        {
          activeConfigId: activeWorkbenchConfigId,
          configs: current,
        },
        configId,
        name.trim()
      ).configs
    );
  }, [activeWorkbenchConfigId]);

  const createDefaultWorkbenchConfig = useCallback(function createDefaultWorkbenchConfig() {
    if (!catalog) {
      return;
    }

    const defaultWorkbenchState = buildDefaultWorkbenchEditorState(catalog);
    const nextCollection = createWorkbenchConfigCollection(
      buildSyncedWorkbenchConfigCollection(),
      {
        editorState: defaultWorkbenchState,
      }
    );
    const nextConfig =
      findWorkbenchConfig(nextCollection.configs, nextCollection.activeConfigId) ??
      nextCollection.configs[nextCollection.configs.length - 1];

    if (!nextConfig) {
      return;
    }

    setWorkbenchConfigs(nextCollection.configs);
    setActiveWorkbenchConfigId(nextConfig.id);
    beginWorkbenchConfigHydration(nextConfig, catalogSolveSignature);
    setBlockedSolveInputKey(null);
    restoreReusableSolveInputKey(null);
    setAutoSolveState(buildIdleWorkbenchSolveState());
    applyWorkbenchEditorState(catalog, nextConfig.editorState);
  }, [buildSyncedWorkbenchConfigCollection, catalog]);

  const forkActiveWorkbenchConfig = useCallback(function forkActiveWorkbenchConfig() {
    if (!activeWorkbenchConfigId) {
      return;
    }

    const nextCollection = forkWorkbenchConfigCollection(
      buildSyncedWorkbenchConfigCollection(),
      activeWorkbenchConfigId,
      {
        editorState: currentWorkbenchEditorState,
        solveState: persistedAutoSolveState,
      }
    );
    const nextConfig =
      findWorkbenchConfig(nextCollection.configs, nextCollection.activeConfigId) ??
      nextCollection.configs[nextCollection.configs.length - 1] ??
      createWorkbenchPersistedConfig(currentWorkbenchEditorState, {
        solveState: persistedAutoSolveState,
      });

    setWorkbenchConfigs(nextCollection.configs);
    setActiveWorkbenchConfigId(nextConfig.id);
    beginWorkbenchConfigHydration(nextConfig, catalogSolveSignature);
    setBlockedSolveInputKey(null);
    restoreReusableSolveInputKey(
      findReusableSolveInputKeyForConfig({
        config: nextConfig,
        catalogSignature: catalogSolveSignature,
        locale,
      })
    );
    setAutoSolveState(restoreWorkbenchSolveState(nextConfig.solveState));
    if (catalog) {
      applyWorkbenchEditorState(catalog, nextConfig.editorState);
    }
  }, [
    activeWorkbenchConfigId,
    buildSyncedWorkbenchConfigCollection,
    catalogSolveSignature,
    catalog,
    currentWorkbenchEditorState,
    locale,
    persistedAutoSolveState,
  ]);

  const deleteWorkbenchConfig = useCallback(function deleteWorkbenchConfig(configId: string) {
    if (!catalog) {
      return;
    }

    const nextCollection = deleteWorkbenchConfigCollection(
      buildSyncedWorkbenchConfigCollection(),
      configId,
      buildDefaultWorkbenchEditorState(catalog)
    );

    setWorkbenchConfigs(nextCollection.configs);

    if (configId !== activeWorkbenchConfigId) {
      return;
    }

    const nextConfig =
      findWorkbenchConfig(nextCollection.configs, nextCollection.activeConfigId) ??
      nextCollection.configs[0];
    if (!nextConfig) {
      return;
    }

    setActiveWorkbenchConfigId(nextConfig.id);
    beginWorkbenchConfigHydration(nextConfig, catalogSolveSignature);
    setBlockedSolveInputKey(null);
    restoreReusableSolveInputKey(
      findReusableSolveInputKeyForConfig({
        config: nextConfig,
        catalogSignature: catalogSolveSignature,
        locale,
      })
    );
    setAutoSolveState(restoreWorkbenchSolveState(nextConfig.solveState));
    applyWorkbenchEditorState(catalog, nextConfig.editorState);
  }, [
    activeWorkbenchConfigId,
    buildSyncedWorkbenchConfigCollection,
    catalog,
    catalogSolveSignature,
    locale,
  ]);

  const applyAllowSurplusFallback = useCallback(() => {
    setBalancePolicy('allow_surplus');
  }, []);

  function resetDatasetEditorToLoadedSource() {
    setDatasetEditorText(loadedDatasetText);
    setDefaultConfigEditorText(loadedDefaultConfigText);
    setDatasetEditorError('');
  }

  function updateDatasetEditorTexts(nextDatasetText: string, nextDefaultConfigText: string) {
    setDatasetEditorText(nextDatasetText);
    setDefaultConfigEditorText(nextDefaultConfigText);
    setDatasetEditorError('');
  }

  function applyDatasetEditorChanges() {
    try {
      const resolved = resolveCatalogSourceTexts(datasetEditorText, defaultConfigEditorText);
      const nextCatalog = resolved.catalog;
      const nextCatalogSolveSignature = buildWorkbenchCatalogSolveSignature(
        resolved.datasetText,
        resolved.defaultConfigText
      );
      const currentWorkbenchState = sanitizeWorkbenchEditorState(
        nextCatalog,
        currentWorkbenchEditorState
      );
      const defaultWorkbenchState = buildDefaultWorkbenchEditorState(nextCatalog);
      const nextConfigCollection = sanitizeWorkbenchConfigCollectionForCatalog(
        nextCatalog,
        {
          activeConfigId: activeWorkbenchConfigId,
          configs: syncActiveWorkbenchConfigCollection(
            {
              activeConfigId: activeWorkbenchConfigId,
              configs: workbenchConfigs,
            },
            activeWorkbenchConfigId,
            currentWorkbenchState,
            resolvePersistedWorkbenchConfigSolveState({
              existingState: findWorkbenchConfig(workbenchConfigs, activeWorkbenchConfigId)
                ?.solveState,
              nextState: mergePersistedSolveStateInputKey(
                findWorkbenchConfig(workbenchConfigs, activeWorkbenchConfigId)?.solveState,
                persistedAutoSolveState
              ),
              editorState: currentWorkbenchState,
              catalogSignature: nextCatalogSolveSignature,
              locale,
            }),
            {
              skipConfigId: hydratingWorkbenchConfig?.configId,
            }
          ).configs,
        },
        defaultWorkbenchState
      );
      const hydratedConfigCollection = {
        ...nextConfigCollection,
        configs: backfillWorkbenchConfigSolveInputKeys({
          configs: nextConfigCollection.configs,
          catalogSignature: nextCatalogSolveSignature,
          locale,
        }),
      };
      const nextActiveConfig =
        findWorkbenchConfig(hydratedConfigCollection.configs, hydratedConfigCollection.activeConfigId) ??
        hydratedConfigCollection.configs[0];

      setCatalog(nextCatalog);
      setLoadedSource({
        presetId,
        datasetPath,
        defaultConfigPath,
      });
      setLoadedDatasetText(resolved.datasetText);
      setLoadedDefaultConfigText(resolved.defaultConfigText);
      setDatasetEditorText(resolved.datasetText);
      setDefaultConfigEditorText(resolved.defaultConfigText);
      setLoadError('');
      setDatasetEditorError('');
      setWorkbenchConfigs(hydratedConfigCollection.configs);
      setActiveWorkbenchConfigId(nextActiveConfig.id);
      beginWorkbenchConfigHydration(nextActiveConfig, nextCatalogSolveSignature);
      setBlockedSolveInputKey(null);
      restoreReusableSolveInputKey(
        findReusableSolveInputKeyForConfig({
          config: nextActiveConfig,
          catalogSignature: nextCatalogSolveSignature,
          locale,
        })
      );
      setAutoSolveState(restoreWorkbenchSolveState(nextActiveConfig.solveState));
      applyWorkbenchEditorState(nextCatalog, nextActiveConfig.editorState);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setDatasetEditorError(`${bundle.datasetSource.editorApplyFailedPrefix}${detail}`);
    }
  }

  const scrollItemLedgerToTop = useCallback(function scrollItemLedgerToTop() {
    itemLedgerScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollItemLedgerToBottom = useCallback(function scrollItemLedgerToBottom() {
    const container = itemLedgerScrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, []);

  const scrollItemLedgerToSection = useCallback(function scrollItemLedgerToSection(
    sectionKey: string
  ) {
    const container = itemLedgerScrollRef.current;
    const section = itemLedgerSectionRefs.current[sectionKey];
    if (!container || !section) {
      return;
    }

    const nextTop = computeLedgerSectionScrollTop({
      currentScrollTop: container.scrollTop,
      containerTop: container.getBoundingClientRect().top,
      sectionTop: section.getBoundingClientRect().top,
    });

    container.scrollTo({
      top: nextTop,
      behavior: 'smooth',
    });
  }, []);

  function addTarget(nextTarget?: EditableTarget) {
    if (!catalog) {
      return;
    }

    const nextItemId = nextTarget?.itemId ?? targetDraftItemId;
    const nextRatePerMin = nextTarget?.ratePerMin ?? targetDraftRatePerMin;
    if (nextItemId) {
      setTargets(current => [...current, { itemId: nextItemId, ratePerMin: nextRatePerMin }]);
      const followingItemId = pickSuggestedTargetItemId(
        catalog,
        itemOptions,
        [...targets, { itemId: nextItemId, ratePerMin: nextRatePerMin }]
      );
      setTargetDraftItemId(followingItemId);
      setTargetDraftRatePerMin(60);
      setTargetPickerQuery('');
    }
  }

  function updateTarget(index: number, patch: Partial<EditableTarget>) {
    setTargets(current =>
      current.map((target, targetIndex) =>
        targetIndex === index ? { ...target, ...patch } : target
      )
    );
  }

  function removeTarget(index: number) {
    setTargets(current => {
      const removedTarget = current[index];
      const nextTargets = current.filter((_, targetIndex) => targetIndex !== index);
      if (removedTarget && nextTargets.length === 0) {
        setTargetDraftItemId(removedTarget.itemId);
        setTargetDraftRatePerMin(removedTarget.ratePerMin);
      }
      return nextTargets;
    });
  }

  const markItemAsRawInput = useCallback(
    function markItemAsRawInput(itemId: string) {
      if (!itemId) {
        return;
      }

      const isDatasetRawItem = catalog?.rawItemIds.includes(itemId) ?? false;
      setDisabledRawInputItemIds(current => current.filter(entry => entry !== itemId));
      if (!isDatasetRawItem) {
        setRawInputItemIds(current =>
          current.includes(itemId) ? current : [...current, itemId]
        );
      }
    },
    [catalog]
  );

  const unmarkItemAsRawInput = useCallback(
    function unmarkItemAsRawInput(itemId: string) {
      if (!itemId) {
        return;
      }

      const isDatasetRawItem = catalog?.rawItemIds.includes(itemId) ?? false;
      setRawInputItemIds(current => current.filter(entry => entry !== itemId));
      if (isDatasetRawItem) {
        setDisabledRawInputItemIds(current =>
          current.includes(itemId) ? current : [...current, itemId]
        );
      }
    },
    [catalog]
  );

  function addDisabledRecipe(recipeId: string) {
    if (!recipeId || disabledRecipeIds.includes(recipeId)) {
      return;
    }
    setDisabledRecipeIds(current => [...current, recipeId]);
  }

  function removeDisabledRecipe(recipeId: string) {
    setDisabledRecipeIds(current => current.filter(entry => entry !== recipeId));
  }

  function addDisabledBuilding() {
    if (!disabledBuildingDraftId || disabledBuildingIds.includes(disabledBuildingDraftId)) {
      return;
    }
    setDisabledBuildingIds(current => [...current, disabledBuildingDraftId]);
  }

  function removeDisabledBuilding(buildingId: string) {
    setDisabledBuildingIds(current => current.filter(entry => entry !== buildingId));
  }

  function addRecipePreference() {
    if (
      !recipePreferenceDraftId ||
      recipePreferences.some(entry => entry.recipeId === recipePreferenceDraftId)
    ) {
      return;
    }
    setRecipePreferences(current => [
      ...current,
      {
        recipeId: recipePreferenceDraftId,
        preferredBuildingId: '',
        preferredProliferatorMode: '',
        preferredProliferatorLevel: '',
      },
    ]);
  }

  function updateRecipePreference(
    recipeId: string,
    patch: Partial<EditableRecipePreference>
  ) {
    setRecipePreferences(current =>
      upsertRecipePreferenceEntry(current, recipeId, patch)
    );
  }

  function removeRecipePreference(recipeId: string) {
    setRecipePreferences(current =>
      upsertRecipePreferenceEntry(current, recipeId, {
        preferredProliferatorMode: '',
        preferredProliferatorLevel: '',
      })
    );
    setRecipeStrategyOverrides(current =>
      patchRecipeStrategyOverrideEntry(current, recipeId, {
        forcedProliferatorMode: '',
        forcedProliferatorLevel: '',
      })
    );
  }

  function setRecipePreferredBuilding(recipeId: string, buildingId: string) {
    setRecipePreferences(current =>
      upsertRecipePreferenceEntry(current, recipeId, {
        preferredBuildingId: buildingId,
      })
    );
    setPreferredBuildings(current => {
      const remainingEntries = current.filter(entry => entry.recipeId !== recipeId);
      return buildingId
        ? [...remainingEntries, { recipeId, buildingId }]
        : remainingEntries;
    });
  }

  function setRecipePreferredProliferator(
    recipeId: string,
    mode: '' | ProliferatorMode,
    level: '' | number
  ) {
    setRecipePreferences(current =>
      upsertRecipePreferenceEntry(current, recipeId, {
        preferredProliferatorMode: mode,
        preferredProliferatorLevel: level,
      })
    );
  }

  function getRecipeDefinition(recipeId: string): ResolvedRecipeSpec | undefined {
    return catalog?.recipeMap.get(recipeId);
  }

  function getRecipeBuildingOptions(recipeId: string) {
    const recipe = getRecipeDefinition(recipeId);
    if (!catalog || !recipe) {
      return [];
    }

    return recipe.allowedBuildingIds
      .map(buildingId => catalog.buildingMap.get(buildingId))
      .filter((building): building is NonNullable<typeof building> => Boolean(building))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  function getRecipeModeOptions(recipeId: string): ProliferatorMode[] {
    const recipe = getRecipeDefinition(recipeId);
    if (!recipe) {
      return [];
    }
    return sortModeOptions(Array.from(new Set(recipe.supportsProliferatorModes)));
  }

  function getRecipeLevelOptions(recipeId: string): number[] {
    const recipe = getRecipeDefinition(recipeId);
    if (!catalog || !recipe || recipe.maxProliferatorLevel <= 0) {
      return [];
    }
    return catalog.proliferatorLevels
      .map(level => level.level)
      .filter(level => level > 0 && level <= recipe.maxProliferatorLevel)
      .sort((left, right) => left - right);
  }

  const applyRecipeStrategyPatch = useCallback(
    function applyRecipeStrategyPatch(
      recipeId: string,
      patch: Partial<EditableRecipeStrategyOverride>
    ) {
      if (!catalog) {
        return false;
      }

      const nextResult = tryApplyRecipeStrategyOverride({
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
        locale,
      });

      if (!nextResult.accepted) {
        setRecipeStrategyWarning(nextResult.message);
        return false;
      }

      setRecipeStrategyOverrides(nextResult.nextOverrides);
      setRecipeStrategyWarning('');
      return true;
    },
    [
      advancedOverridesText,
      autoPromoteUnavailableItemsToRawInputs,
      balancePolicy,
      catalog,
      disabledBuildingIds,
      disabledRawInputItemIds,
      disabledRecipeIds,
      locale,
      objective,
      allowedRecipesByItem,
      proliferatorPolicy,
      globalProliferatorLevel,
      rawInputItemIds,
      recipePreferences,
      recipeStrategyOverrides,
      targets,
    ]
  );

  const applyAllowedRecipesForItem = useCallback(
    function applyAllowedRecipesForItem(
      itemId: string,
      recipeIds: string[]
    ) {
      if (!catalog) {
        return { accepted: true, message: '' };
      }

      const nextAllowedRecipesByItem = { ...allowedRecipesByItem };
      if (recipeIds.length === 0) {
        delete nextAllowedRecipesByItem[itemId];
      } else {
        nextAllowedRecipesByItem[itemId] = recipeIds;
      }

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
        allowedRecipesByItem: nextAllowedRecipesByItem,
        preferredBuildings,
        recipePreferences,
        recipeStrategyOverrides,
        advancedOverridesText,
        locale,
      });

      if (
        nextSolveState.error ||
        !nextSolveState.result ||
        nextSolveState.result.status !== 'optimal'
      ) {
        const message =
          nextSolveState.error ||
          nextSolveState.result?.diagnostics.messages[0] ||
          nextSolveState.result?.diagnostics.unmetPreferences[0] ||
          bundle.solveRequest.invalidAllowedRecipeSelectionMessage;
        setRecipeStrategyWarning(message);
        return { accepted: false, message };
      }

      setAllowedRecipesByItem(nextAllowedRecipesByItem);
      setRecipeStrategyWarning('');
      return { accepted: true, message: '' };
    },
    [
      advancedOverridesText,
      autoPromoteUnavailableItemsToRawInputs,
      allowedRecipesByItem,
      balancePolicy,
      bundle.solveRequest.invalidAllowedRecipeSelectionMessage,
      catalog,
      disabledBuildingIds,
      disabledRawInputItemIds,
      disabledRecipeIds,
      globalProliferatorLevel,
      locale,
      objective,
      proliferatorPolicy,
      rawInputItemIds,
      recipePreferences,
      recipeStrategyOverrides,
      targets,
    ]
  );

  const clearAllowedRecipesForItem = useCallback(function clearAllowedRecipesForItem(
    itemId: string
  ) {
    setAllowedRecipesByItem(current => {
      if (!current[itemId]) {
        return current;
      }
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const removeAllowedRecipeForItem = useCallback(function removeAllowedRecipeForItem(
    itemId: string,
    recipeId: string
  ) {
    setAllowedRecipesByItem(current => {
      const existing = current[itemId];
      if (!existing) return current;
      const filtered = existing.filter(id => id !== recipeId);
      if (filtered.length === 0) {
        const next = { ...current };
        delete next[itemId];
        return next;
      }
      return { ...current, [itemId]: filtered };
    });
  }, []);

  const addPreferredBuilding = useCallback(function addPreferredBuilding(
    entry: EditablePreferredBuilding
  ) {
    if (!entry.buildingId) {
      return;
    }

    setPreferredBuildings(current => {
      if (!entry.recipeId) {
        return current.some(
          existing => !existing.recipeId && existing.buildingId === entry.buildingId
        )
          ? current
          : [...current, entry];
      }

      const remainingEntries = current.filter(existing => existing.recipeId !== entry.recipeId);
      return [...remainingEntries, entry];
    });
  }, []);

  const removePreferredBuilding = useCallback(function removePreferredBuilding(index: number) {
    const entry = preferredBuildings[index];
    if (!entry) {
      return;
    }

    setPreferredBuildings(current => current.filter((_, i) => i !== index));

    if (!entry.recipeId) {
      return;
    }

    setRecipePreferences(current =>
      upsertRecipePreferenceEntry(current, entry.recipeId, {
        preferredBuildingId: '',
      })
    );
    setRecipeStrategyOverrides(current =>
      patchRecipeStrategyOverrideEntry(current, entry.recipeId, {
        forcedBuildingId: '',
      })
    );
  }, [preferredBuildings]);

  const locateItemInLedger = useCallback(
    function locateItemInLedger(itemId: string) {
      const targetSection =
        model?.itemLedgerSections.find(section =>
          section.items.some(item => item.itemId === itemId)
        ) ?? null;

      if (!targetSection) {
        return;
      }

      scrollItemLedgerToSection(targetSection.key);
    },
    [model, scrollItemLedgerToSection]
  );

  const revealRecipePlan = useCallback(function revealRecipePlan(planKey: string) {
    if (!planKey) {
      return;
    }

    setRevealedRecipePlanKey(planKey);
    setRevealedRecipePlanNonce(current => current + 1);
  }, []);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const contextValue = useMemo<WorkbenchContextValue>(
    () => ({
      // Locale / bundle
      locale,
      bundle,

      // Dataset source state
      presetId,
      setPresetId,
      datasetPath,
      setDatasetPath,
      defaultConfigPath,
      setDefaultConfigPath,
      catalogLabel,
      setCatalogLabel,
      catalog,
      loadedSource,
      loadedDatasetText,
      loadedDefaultConfigText,
      datasetEditorText,
      setDatasetEditorText,
      defaultConfigEditorText,
      setDefaultConfigEditorText,
      datasetEditorError,
      loadError,
      isLoading,

      // Workbench editor state
      workbenchConfigs,
      activeWorkbenchConfigId,
      workbenchConfigDisplayModels,
      targets,
      setTargets,
      targetDraftItemId,
      setTargetDraftItemId,
      targetDraftRatePerMin,
      setTargetDraftRatePerMin,
      targetPickerQuery,
      setTargetPickerQuery,
      objective,
      setObjective,
      balancePolicy,
      setBalancePolicy,
      autoPromoteUnavailableItemsToRawInputs,
      setAutoPromoteUnavailableItemsToRawInputs,
      proliferatorPolicy,
      setProliferatorPolicy,
      globalProliferatorLevel,
      setGlobalProliferatorLevel,
      rawInputItemIds,
      setRawInputItemIds,
      disabledRawInputItemIds,
      setDisabledRawInputItemIds,
      disabledRecipeIds,
      setDisabledRecipeIds,
      disabledBuildingIds,
      setDisabledBuildingIds,
      disabledBuildingDraftId,
      setDisabledBuildingDraftId,
      allowedRecipesByItem,
      setAllowedRecipesByItem,
      recipePreferences,
      setRecipePreferences,
      recipeStrategyOverrides,
      setRecipeStrategyOverrides,
      recipePreferenceDraftId,
      setRecipePreferenceDraftId,
      advancedOverridesText,
      setAdvancedOverridesText,
      recipeStrategyWarning,
      setRecipeStrategyWarning,
      preferredBuildings,
      setPreferredBuildings,

      // Refs
      itemLedgerScrollRef,
      itemLedgerSectionRefs,

      // Derived data
      itemOptions,
      recipeOptions,
      buildingOptions,
      parsedOverrides,
      autoSolveState,
      model,
      fallbackModel,
      preferredRecipeOptionsByItem,
      globalProliferatorLevelOptions,
      recipeStrategyOverrideMap,
      isCustomPreset,
      hasTargets,
      lastRequest,
      activeSolveRequest,
      canStartSolve,
      canCancelSolve,
      solveCancelledForCurrentInputs,
      result,
      solveError,
      fallbackSolve,
      requestSummary,
      iconAtlasIds,
      targetDraftItemOption,
      disableBuildingOptions,
      recipePreferenceOptions,
      globalProliferatorLevelDisabled,
      revealedRecipePlanKey,
      revealedRecipePlanNonce,

      // Event handlers
      applyWorkbenchEditorState,
      buildCurrentWorkbenchEditorState,
      loadCatalog,
      reloadCatalog,
      onPresetChange,
      clearCachedWorkbenchState,
      switchWorkbenchConfig,
      createDefaultWorkbenchConfig,
      renameWorkbenchConfig,
      forkActiveWorkbenchConfig,
      deleteWorkbenchConfig,
      resetDatasetEditorToLoadedSource,
      updateDatasetEditorTexts,
      applyDatasetEditorChanges,
      addTarget,
      updateTarget,
      removeTarget,
      markItemAsRawInput,
      unmarkItemAsRawInput,
      addDisabledRecipe,
      removeDisabledRecipe,
      addDisabledBuilding,
      removeDisabledBuilding,
      addRecipePreference,
      updateRecipePreference,
      removeRecipePreference,
      setRecipePreferredBuilding,
      setRecipePreferredProliferator,
      getRecipeDefinition,
      getRecipeBuildingOptions,
      getRecipeModeOptions,
      getRecipeLevelOptions,
      applyRecipeStrategyPatch,
      applyAllowedRecipesForItem,
      clearAllowedRecipesForItem,
      removeAllowedRecipeForItem,
      addPreferredBuilding,
      removePreferredBuilding,
      locateItemInLedger,
      revealRecipePlan,
      scrollItemLedgerToTop,
      scrollItemLedgerToBottom,
      scrollItemLedgerToSection,
      applyAllowSurplusFallback,
      startSolve,
      cancelSolve,
    }),
    // This memo has a large dependency list because the context value includes
    // all state, derived data, and handlers. We list every value explicitly to
    // ensure React re-creates the context object only when something changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      locale,
      bundle,
      presetId,
      datasetPath,
      defaultConfigPath,
      catalogLabel,
      catalog,
      loadedSource,
      loadedDatasetText,
      loadedDefaultConfigText,
      datasetEditorText,
      defaultConfigEditorText,
      datasetEditorError,
      loadError,
      isLoading,
      workbenchConfigs,
      activeWorkbenchConfigId,
      workbenchConfigDisplayModels,
      targets,
      targetDraftItemId,
      targetDraftRatePerMin,
      targetPickerQuery,
      objective,
      balancePolicy,
      autoPromoteUnavailableItemsToRawInputs,
      proliferatorPolicy,
      globalProliferatorLevel,
      rawInputItemIds,
      disabledRawInputItemIds,
      disabledRecipeIds,
      disabledBuildingIds,
      disabledBuildingDraftId,
      allowedRecipesByItem,
      recipePreferences,
      recipeStrategyOverrides,
      recipePreferenceDraftId,
      advancedOverridesText,
      recipeStrategyWarning,
      preferredBuildings,
      itemOptions,
      recipeOptions,
      buildingOptions,
      parsedOverrides,
      autoSolveState,
      model,
      fallbackModel,
      preferredRecipeOptionsByItem,
      globalProliferatorLevelOptions,
      recipeStrategyOverrideMap,
      isCustomPreset,
      hasTargets,
      lastRequest,
      activeSolveRequest,
      canStartSolve,
      canCancelSolve,
      solveCancelledForCurrentInputs,
      result,
      solveError,
      fallbackSolve,
      requestSummary,
      iconAtlasIds,
      targetDraftItemOption,
      disableBuildingOptions,
      recipePreferenceOptions,
      globalProliferatorLevelDisabled,
      revealedRecipePlanKey,
      revealedRecipePlanNonce,
      markItemAsRawInput,
      unmarkItemAsRawInput,
      applyRecipeStrategyPatch,
      applyAllowedRecipesForItem,
      clearAllowedRecipesForItem,
      removeAllowedRecipeForItem,
      setRecipePreferredBuilding,
      setRecipePreferredProliferator,
      addPreferredBuilding,
      removePreferredBuilding,
      locateItemInLedger,
      revealRecipePlan,
      scrollItemLedgerToTop,
      scrollItemLedgerToBottom,
      startSolve,
      cancelSolve,
      scrollItemLedgerToSection,
      applyAllowSurplusFallback,
      switchWorkbenchConfig,
      createDefaultWorkbenchConfig,
      renameWorkbenchConfig,
      forkActiveWorkbenchConfig,
      deleteWorkbenchConfig,
    ]
  );

  return (
    <WorkbenchContext.Provider value={contextValue}>{children}</WorkbenchContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkbench(): WorkbenchContextValue {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error('useWorkbench must be used within a WorkbenchProvider');
  }
  return context;
}
