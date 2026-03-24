import React, {
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
import { buildPresentationModel, type PresentationModel } from '../../presentation';
import type { BalancePolicy, SolveObjective, SolveRequest, SolveResult } from '../../solver';
import {
  DATASET_PRESETS,
  loadCatalogSourceFromUrl,
  resolveCatalogSourceTexts,
} from '../catalog/catalogClient';
import { computeWorkbenchSolve, type WorkbenchSolveState } from '../workbench/autoSolve';
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
  readWorkbenchDatasetDraft,
  readWorkbenchEditorState,
  sanitizeWorkbenchEditorState,
  writeActiveWorkbenchCacheSource,
  writeWorkbenchDatasetDraft,
  writeWorkbenchEditorState,
  type WorkbenchCacheSource,
  type WorkbenchEditorState,
} from '../workbench/persistence';
import { recordWorkbenchPerf } from '../workbench/workbenchPerf';
import {
  buildDefaultWorkbenchEditorState,
  getBrowserSessionStorage,
  getBrowserStorage,
  pickDefaultGlobalProliferatorLevel,
  pickDefaultRecipePreference,
  pickDefaultTarget,
  pickSuggestedTargetItemId,
  sortModeOptions,
} from './workbenchHelpers';

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
  disabledRecipeDraftId: string;
  setDisabledRecipeDraftId: React.Dispatch<React.SetStateAction<string>>;
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
  preferredBuildingDraftBuildingId: string;
  setPreferredBuildingDraftBuildingId: React.Dispatch<React.SetStateAction<string>>;
  preferredBuildingDraftRecipeId: string;
  setPreferredBuildingDraftRecipeId: React.Dispatch<React.SetStateAction<string>>;

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
  preferredRecipeOptionsByItem: Record<
    string,
    Array<{
      recipeId: string;
      recipeName: string;
      recipeIconKey?: string;
      cycleTimeSec: number;
      inputs: Array<{ itemId: string; itemName: string; iconKey?: string; amount: number }>;
      outputs: Array<{ itemId: string; itemName: string; iconKey?: string; amount: number }>;
    }>
  >;
  globalProliferatorLevelOptions: number[];
  recipeStrategyOverrideMap: Map<string, EditableRecipeStrategyOverride>;
  isCustomPreset: boolean;
  hasTargets: boolean;
  lastRequest: SolveRequest | undefined;
  result: SolveResult | null;
  solveError: string;
  fallbackSolve: WorkbenchSolveState['fallback'];
  requestSummary: PresentationModel['requestSummary'] | undefined;
  iconAtlasIds: string[];
  targetDraftItemOption: ItemPickerOption | null;
  disableRecipeOptions: ResolvedRecipeSpec[];
  disableBuildingOptions: ResolvedCatalogModel['buildings'];
  recipePreferenceOptions: ResolvedRecipeSpec[];
  globalProliferatorLevelDisabled: boolean;

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
  resetDatasetEditorToLoadedSource: () => void;
  updateDatasetEditorTexts: (nextDatasetText: string, nextDefaultConfigText: string) => void;
  applyDatasetEditorChanges: () => void;
  addTarget: (nextTarget?: EditableTarget) => void;
  updateTarget: (index: number, patch: Partial<EditableTarget>) => void;
  removeTarget: (index: number) => void;
  markItemAsRawInput: (itemId: string) => void;
  unmarkItemAsRawInput: (itemId: string) => void;
  addDisabledRecipe: () => void;
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
  ) => void;
  applyAllowedRecipesForItem: (
    itemId: string,
    recipeIds: string[]
  ) => { accepted: boolean; message: string };
  clearAllowedRecipesForItem: (itemId: string) => void;
  removeAllowedRecipeForItem: (itemId: string, recipeId: string) => void;
  addPreferredBuilding: () => void;
  removePreferredBuilding: (index: number) => void;
  locateItemInLedger: (itemId: string) => void;
  scrollItemLedgerToTop: () => void;
  scrollItemLedgerToBottom: () => void;
  scrollItemLedgerToSection: (sectionKey: string) => void;
  applyAllowSurplusFallback: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

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
  const [disabledRecipeDraftId, setDisabledRecipeDraftId] = useState('');
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
  const [preferredBuildingDraftBuildingId, setPreferredBuildingDraftBuildingId] = useState('');
  const [preferredBuildingDraftRecipeId, setPreferredBuildingDraftRecipeId] = useState('');

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
    setDisabledRecipeDraftId(nextCatalog.recipes[0]?.recipeId ?? '');
    setDisabledBuildingIds(editorState.disabledBuildingIds);
    setDisabledBuildingDraftId('');
    setAllowedRecipesByItem(editorState.allowedRecipesByItem);
    setRecipePreferences(editorState.recipePreferences);
    setRecipeStrategyOverrides(editorState.recipeStrategyOverrides);
    setRecipePreferenceDraftId(pickDefaultRecipePreference(nextCatalog));
    setAdvancedOverridesText(editorState.advancedOverridesText);
    setRecipeStrategyWarning('');
    setPreferredBuildings(editorState.preferredBuildings);
    setPreferredBuildingDraftBuildingId('');
    setPreferredBuildingDraftRecipeId('');
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
      const cachedEditorState = readWorkbenchEditorState(browserStorage, nextSource);
      const defaultEditorState = buildDefaultWorkbenchEditorState(nextCatalog);
      const restoredEditorState = cachedEditorState
        ? sanitizeWorkbenchEditorState(nextCatalog, cachedEditorState)
        : null;
      const nextEditorState = restoredEditorState
        ? {
            ...defaultEditorState,
            ...restoredEditorState,
            targets: restoredEditorState.targets.length
              ? restoredEditorState.targets
              : defaultEditorState.targets,
          }
        : defaultEditorState;

      setCatalog(nextCatalog);
      setLoadedSource(nextSource);
      setLoadedDatasetText(loaded.datasetText);
      setLoadedDefaultConfigText(loaded.defaultConfigText);
      setDatasetEditorText(restoredSource.datasetText);
      setDefaultConfigEditorText(restoredSource.defaultConfigText);
      setCatalogLabel(nextLabel);
      applyWorkbenchEditorState(nextCatalog, nextEditorState);
    } catch (error) {
      setCatalog(null);
      setLoadedSource(null);
      setLoadedDatasetText('');
      setLoadedDefaultConfigText('{}');
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
  // Derived: disableRecipeOptions, disableBuildingOptions, recipePreferenceOptions
  // -------------------------------------------------------------------------

  const disableRecipeOptions = useMemo(
    () => recipeOptions.filter(recipe => !disabledRecipeIds.includes(recipe.recipeId)),
    [recipeOptions, disabledRecipeIds]
  );

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

  // Sync disabledRecipeDraftId
  useEffect(() => {
    if (!disabledRecipeDraftId && disableRecipeOptions.length > 0) {
      setDisabledRecipeDraftId(disableRecipeOptions[0].recipeId);
      return;
    }
    if (
      disabledRecipeDraftId &&
      disableRecipeOptions.length > 0 &&
      !disableRecipeOptions.some(recipe => recipe.recipeId === disabledRecipeDraftId)
    ) {
      setDisabledRecipeDraftId(disableRecipeOptions[0].recipeId);
    }
  }, [disabledRecipeDraftId, disableRecipeOptions]);

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
    if (!browserStorage || !loadedSource) {
      return;
    }

    writeWorkbenchEditorState(browserStorage, loadedSource, {
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
    });
  }, [
    advancedOverridesText,
    autoPromoteUnavailableItemsToRawInputs,
    balancePolicy,
    browserStorage,
    disabledBuildingIds,
    disabledRawInputItemIds,
    disabledRecipeIds,
    loadedSource,
    objective,
    allowedRecipesByItem,
    preferredBuildings,
    proliferatorPolicy,
    globalProliferatorLevel,
    rawInputItemIds,
    recipePreferences,
    recipeStrategyOverrides,
    targets,
  ]);

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
      recipePreferences,
      recipeStrategyOverrides,
      targets,
    ]
  );
  const deferredSolveInputs = useDeferredValue(solveInputs);

  const autoSolveState = useMemo(() => {
    if (!deferredSolveInputs.catalog || deferredSolveInputs.isLoading) {
      return {
        request: undefined,
        result: null,
        error: '',
      };
    }

    return computeWorkbenchSolve({
      catalog: deferredSolveInputs.catalog,
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
    });
  }, [deferredSolveInputs]);

  const lastRequest = autoSolveState.request;
  const result = autoSolveState.result;
  const solveError = autoSolveState.error;
  const fallbackSolve = autoSolveState.fallback;
  const hasTargets = targets.length > 0;

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

  const requestSummary = model?.requestSummary;
  const iconAtlasIds =
    model?.catalogSummary.iconAtlasIds ?? catalog?.iconAtlasIds ?? ['Vanilla'];

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

  const preferredRecipeOptionsByItem = useMemo(() => {
    const next: Record<
      string,
      Array<{
        recipeId: string;
        recipeName: string;
        recipeIconKey?: string;
        cycleTimeSec: number;
        inputs: Array<{ itemId: string; itemName: string; iconKey?: string; amount: number }>;
        outputs: Array<{ itemId: string; itemName: string; iconKey?: string; amount: number }>;
      }>
    > = {};

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
  }, [catalog]);

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
      applyWorkbenchEditorState(catalog, buildDefaultWorkbenchEditorState(catalog));
    }
  }

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
      const currentWorkbenchState = sanitizeWorkbenchEditorState(
        nextCatalog,
        buildCurrentWorkbenchEditorState()
      );
      const defaultWorkbenchState = buildDefaultWorkbenchEditorState(nextCatalog);

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
      applyWorkbenchEditorState(nextCatalog, {
        ...defaultWorkbenchState,
        ...currentWorkbenchState,
        targets: currentWorkbenchState.targets.length
          ? currentWorkbenchState.targets
          : defaultWorkbenchState.targets,
      });
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

  function addDisabledRecipe() {
    if (!disabledRecipeDraftId || disabledRecipeIds.includes(disabledRecipeDraftId)) {
      return;
    }
    setDisabledRecipeIds(current => [...current, disabledRecipeDraftId]);
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
      current.map(preference =>
        preference.recipeId === recipeId ? { ...preference, ...patch } : preference
      )
    );
  }

  function removeRecipePreference(recipeId: string) {
    setRecipePreferences(current => current.filter(entry => entry.recipeId !== recipeId));
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
        return;
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
        return;
      }

      setRecipeStrategyOverrides(nextResult.nextOverrides);
      setRecipeStrategyWarning('');
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

  const addPreferredBuilding = useCallback(function addPreferredBuilding() {
    setPreferredBuildings(current => {
      if (!preferredBuildingDraftBuildingId) return current;
      return [...current, {
        buildingId: preferredBuildingDraftBuildingId,
        recipeId: preferredBuildingDraftRecipeId,
      }];
    });
    setPreferredBuildingDraftBuildingId('');
    setPreferredBuildingDraftRecipeId('');
  }, [preferredBuildingDraftBuildingId, preferredBuildingDraftRecipeId]);

  const removePreferredBuilding = useCallback(function removePreferredBuilding(index: number) {
    setPreferredBuildings(current => current.filter((_, i) => i !== index));
  }, []);

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
      disabledRecipeDraftId,
      setDisabledRecipeDraftId,
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
      preferredBuildingDraftBuildingId,
      setPreferredBuildingDraftBuildingId,
      preferredBuildingDraftRecipeId,
      setPreferredBuildingDraftRecipeId,

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
      result,
      solveError,
      fallbackSolve,
      requestSummary,
      iconAtlasIds,
      targetDraftItemOption,
      disableRecipeOptions,
      disableBuildingOptions,
      recipePreferenceOptions,
      globalProliferatorLevelDisabled,

      // Event handlers
      applyWorkbenchEditorState,
      buildCurrentWorkbenchEditorState,
      loadCatalog,
      reloadCatalog,
      onPresetChange,
      clearCachedWorkbenchState,
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
      scrollItemLedgerToTop,
      scrollItemLedgerToBottom,
      scrollItemLedgerToSection,
      applyAllowSurplusFallback,
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
      disabledRecipeDraftId,
      disabledBuildingIds,
      disabledBuildingDraftId,
      allowedRecipesByItem,
      recipePreferences,
      recipeStrategyOverrides,
      recipePreferenceDraftId,
      advancedOverridesText,
      recipeStrategyWarning,
      preferredBuildings,
      preferredBuildingDraftBuildingId,
      preferredBuildingDraftRecipeId,
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
      result,
      solveError,
      fallbackSolve,
      requestSummary,
      iconAtlasIds,
      targetDraftItemOption,
      disableRecipeOptions,
      disableBuildingOptions,
      recipePreferenceOptions,
      globalProliferatorLevelDisabled,
      markItemAsRawInput,
      unmarkItemAsRawInput,
      applyRecipeStrategyPatch,
      applyAllowedRecipesForItem,
      clearAllowedRecipesForItem,
      removeAllowedRecipeForItem,
      addPreferredBuilding,
      removePreferredBuilding,
      locateItemInLedger,
      scrollItemLedgerToTop,
      scrollItemLedgerToBottom,
      scrollItemLedgerToSection,
      applyAllowSurplusFallback,
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
