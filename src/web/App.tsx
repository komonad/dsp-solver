import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProliferatorMode, ResolvedCatalogModel, ResolvedRecipeSpec } from '../catalog';
import {
  DEFAULT_APP_LOCALE,
  type DatasetPresetId,
  formatBalancePolicy,
  formatPower,
  formatProliferatorMode,
  formatRate,
  formatSolveObjective,
  formatSolveStatus,
  getDatasetPresetText,
  getLocaleBundle,
} from '../i18n';
import { getWorkbenchExtraBundle } from '../i18n/workbenchExtra';
import { buildPresentationModel } from '../presentation';
import type { BalancePolicy, SolveObjective } from '../solver';
import {
  DATASET_PRESETS,
  loadCatalogSourceFromUrl,
  resolveCatalogSourceTexts,
} from './catalogClient';
import { computeWorkbenchSolve } from './autoSolve';
import DatasetEditorPanel from './DatasetEditorPanel';
import { EntityLabel, EntityLabelButton } from './EntityIcon';
import ItemSlicePanel from './ItemSlicePanel';
import { computeLedgerSectionScrollTop } from './ledgerScroll';
import StructuredDatasetEditor from './StructuredDatasetEditor';
import {
  parseAdvancedSolveOverrides,
  type EditableRecipePreference,
  type EditableTarget,
  type WorkbenchProliferatorPolicy,
} from './requestBuilder';
import {
  clearWorkbenchCache,
  readActiveWorkbenchCacheSource,
  readWorkbenchDatasetDraft,
  readWorkbenchEditorState,
  sanitizeWorkbenchEditorState,
  writeActiveWorkbenchCacheSource,
  writeWorkbenchDatasetDraft,
  writeWorkbenchEditorState,
  type WorkbenchCacheSource,
  type WorkbenchEditorState,
} from './persistence';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  background:
    'radial-gradient(circle at top left, rgba(244, 194, 102, 0.28), transparent 35%), linear-gradient(135deg, #f5efe2 0%, #dce7ef 48%, #f7f8fb 100%)',
  color: '#183359',
  fontFamily: '"IBM Plex Sans", "Noto Sans SC", sans-serif',
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: '40px 24px 64px',
  display: 'grid',
  gap: 20,
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.76)',
  border: '1px solid rgba(18, 45, 77, 0.12)',
  borderRadius: 22,
  padding: 20,
  boxShadow: '0 24px 80px rgba(24, 51, 89, 0.12)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.18)',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.94)',
  color: '#183359',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.16)',
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#183359',
  color: '#fff',
};

const subtleButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(24, 51, 89, 0.08)',
  color: '#183359',
};

const resultBodyGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 20,
  gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 320px)',
  alignItems: 'start',
};

const resultMainColumnStyle: React.CSSProperties = {
  display: 'grid',
  gap: 20,
};

const resultSideColumnStyle: React.CSSProperties = {
  position: 'sticky',
  top: 24,
  alignSelf: 'start',
  // Keep the side column height constrained to the viewport. Without an
  // explicit height, the ledger card will expand to content height and the
  // inner ledger scroller stops working.
  height: 'calc(100vh - 24px)',
  maxHeight: 'calc(100vh - 24px)',
  minHeight: 0,
  display: 'grid',
  gap: 20,
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 24, 41, 0.38)',
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'flex-start',
  padding: 24,
  zIndex: 1000,
};

const modalPanelStyle: React.CSSProperties = {
  width: 'min(520px, calc(100vw - 48px))',
  maxHeight: 'calc(100vh - 48px)',
  overflow: 'auto',
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(18, 45, 77, 0.12)',
  borderRadius: 22,
  padding: 20,
  boxShadow: '0 24px 80px rgba(24, 51, 89, 0.24)',
};

const compactLedgerButtonStyle: React.CSSProperties = {
  ...subtleButtonStyle,
  minHeight: 34,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 700,
};

const collapsibleSectionStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(24, 51, 89, 0.10)',
  paddingTop: 12,
};

const summaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontWeight: 700,
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.08em',
};

function pickDefaultTarget(catalog: ResolvedCatalogModel): string {
  return (
    catalog.items.find(item => item.kind === 'product')?.itemId ??
    catalog.items.find(item => item.kind === 'intermediate')?.itemId ??
    catalog.items.find(item => item.kind !== 'utility')?.itemId ??
    ''
  );
}

function pickDefaultRecipePreference(catalog: ResolvedCatalogModel): string {
  return catalog.recipes[0]?.recipeId ?? '';
}

function sortModeOptions(modes: ProliferatorMode[]): ProliferatorMode[] {
  const order: ProliferatorMode[] = ['none', 'speed', 'productivity'];
  return order.filter(mode => modes.includes(mode));
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function buildDefaultWorkbenchEditorState(
  catalog: ResolvedCatalogModel
): WorkbenchEditorState {
  const nextTargetId = pickDefaultTarget(catalog);
  return {
    targets: nextTargetId ? [{ itemId: nextTargetId, ratePerMin: 60 }] : [],
    objective: catalog.recommendedSolve.objective ?? 'min_buildings',
    balancePolicy: catalog.recommendedSolve.balancePolicy ?? 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: 'auto',
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: catalog.recommendedDisabledBuildingIds,
    preferredRecipeByItem: {},
    recipePreferences: [],
    advancedOverridesText: '',
  };
}

export default function App() {
  const locale = DEFAULT_APP_LOCALE;
  const bundle = getLocaleBundle(locale);
  const workbenchExtra = getWorkbenchExtraBundle(locale);
  const browserStorage = useMemo(() => getBrowserStorage(), []);
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
    ) ?? (initialCachedSource?.presetId === 'custom' ? DATASET_PRESETS[DATASET_PRESETS.length - 1] : fallbackPreset);
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
  const [objective, setObjective] = useState<SolveObjective>('min_buildings');
  const [balancePolicy, setBalancePolicy] = useState<BalancePolicy>('force_balance');
  const [autoPromoteUnavailableItemsToRawInputs, setAutoPromoteUnavailableItemsToRawInputs] =
    useState(false);
  const [proliferatorPolicy, setProliferatorPolicy] =
    useState<WorkbenchProliferatorPolicy>('auto');
  const [rawInputItemIds, setRawInputItemIds] = useState<string[]>([]);
  const [disabledRawInputItemIds, setDisabledRawInputItemIds] = useState<string[]>([]);
  const [disabledRecipeIds, setDisabledRecipeIds] = useState<string[]>([]);
  const [disabledRecipeDraftId, setDisabledRecipeDraftId] = useState('');
  const [disabledBuildingIds, setDisabledBuildingIds] = useState<string[]>([]);
  const [disabledBuildingDraftId, setDisabledBuildingDraftId] = useState('');
  const [preferredRecipeByItem, setPreferredRecipeByItem] = useState<Record<string, string>>({});
  const [recipePreferences, setRecipePreferences] = useState<EditableRecipePreference[]>([]);
  const [recipePreferenceDraftId, setRecipePreferenceDraftId] = useState('');
  const [advancedOverridesText, setAdvancedOverridesText] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isItemSliceOpen, setIsItemSliceOpen] = useState(false);
  const itemLedgerScrollRef = useRef<HTMLDivElement | null>(null);
  const itemLedgerSectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function applyWorkbenchEditorState(
    nextCatalog: ResolvedCatalogModel,
    editorState: WorkbenchEditorState
  ) {
    setTargets(editorState.targets);
    setObjective(editorState.objective);
    setBalancePolicy(editorState.balancePolicy);
    setAutoPromoteUnavailableItemsToRawInputs(
      editorState.autoPromoteUnavailableItemsToRawInputs
    );
    setProliferatorPolicy(editorState.proliferatorPolicy);
    setRawInputItemIds(editorState.rawInputItemIds);
    setDisabledRawInputItemIds(editorState.disabledRawInputItemIds);
    setDisabledRecipeIds(editorState.disabledRecipeIds);
    setDisabledRecipeDraftId(nextCatalog.recipes[0]?.recipeId ?? '');
    setDisabledBuildingIds(editorState.disabledBuildingIds);
    setDisabledBuildingDraftId('');
    setPreferredRecipeByItem(editorState.preferredRecipeByItem);
    setRecipePreferences(editorState.recipePreferences);
    setRecipePreferenceDraftId(pickDefaultRecipePreference(nextCatalog));
    setAdvancedOverridesText(editorState.advancedOverridesText);
    setSelectedItemId(
      editorState.targets[0]?.itemId ??
        nextCatalog.items.find(item => item.kind !== 'utility')?.itemId ??
        ''
    );
    setIsItemSliceOpen(false);
  }

  function buildCurrentWorkbenchEditorState(): WorkbenchEditorState {
    return {
      targets,
      objective,
      balancePolicy,
      autoPromoteUnavailableItemsToRawInputs,
      proliferatorPolicy,
      rawInputItemIds,
      disabledRawInputItemIds,
      disabledRecipeIds,
      disabledBuildingIds,
      preferredRecipeByItem,
      recipePreferences,
      advancedOverridesText,
    };
  }

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

  useEffect(() => {
    void loadCatalog(
      initialCachedSource?.datasetPath ?? datasetPath,
      initialCachedSource?.defaultConfigPath ?? defaultConfigPath,
      catalogLabel,
      initialCachedSource?.presetId ?? presetId
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeActiveWorkbenchCacheSource(browserStorage, {
      presetId,
      datasetPath,
      defaultConfigPath,
    });
  }, [browserStorage, defaultConfigPath, datasetPath, presetId]);

  const itemOptions = useMemo(
    () =>
      catalog?.items
        .filter(item => item.kind !== 'utility')
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const recipeOptions = useMemo(
    () => catalog?.recipes.slice().sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const buildingOptions = useMemo(
    () => catalog?.buildings.slice().sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const disableRecipeOptions = useMemo(
    () => recipeOptions.filter(recipe => !disabledRecipeIds.includes(recipe.recipeId)),
    [recipeOptions, disabledRecipeIds]
  );

  const disableBuildingOptions = useMemo(
    () => buildingOptions.filter(building => !disabledBuildingIds.includes(building.buildingId)),
    [buildingOptions, disabledBuildingIds]
  );

  const recipePreferenceOptions = useMemo(
    () =>
      recipeOptions.filter(
        recipe => !recipePreferences.some(preference => preference.recipeId === recipe.recipeId)
      ),
    [recipeOptions, recipePreferences]
  );

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

  useEffect(() => {
    if (!disabledBuildingDraftId && disableBuildingOptions.length > 0) {
      setDisabledBuildingDraftId(disableBuildingOptions[0].buildingId);
      return;
    }
    if (
      disabledBuildingDraftId &&
      disableBuildingOptions.length > 0 &&
      !disableBuildingOptions.some(building => building.buildingId === disabledBuildingDraftId)
    ) {
      setDisabledBuildingDraftId(disableBuildingOptions[0].buildingId);
    }
  }, [disabledBuildingDraftId, disableBuildingOptions]);

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
      rawInputItemIds,
      disabledRawInputItemIds,
      disabledRecipeIds,
      disabledBuildingIds,
      preferredRecipeByItem,
      recipePreferences,
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
    preferredRecipeByItem,
    proliferatorPolicy,
    rawInputItemIds,
    recipePreferences,
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
  }, [
    browserStorage,
    datasetEditorText,
    defaultConfigEditorText,
    loadedSource,
  ]);

  const parsedOverrides = useMemo(
    () => parseAdvancedSolveOverrides(advancedOverridesText, locale),
    [advancedOverridesText, locale]
  );

  const autoSolveState = useMemo(() => {
    if (!catalog || isLoading) {
      return {
        request: undefined,
        result: null,
        error: '',
      };
    }

    return computeWorkbenchSolve({
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
      advancedOverridesText,
      locale,
    });
  }, [
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
    preferredRecipeByItem,
    proliferatorPolicy,
    rawInputItemIds,
    recipePreferences,
    targets,
  ]);

  const lastRequest = autoSolveState.request;
  const result = autoSolveState.result;
  const solveError = autoSolveState.error;

  const model = useMemo(
    () =>
      catalog
        ? buildPresentationModel({
            catalog,
            request: lastRequest,
            result,
            datasetLabel: catalogLabel,
            datasetPath,
            defaultConfigPath: defaultConfigPath || undefined,
            locale,
          })
        : null,
    [catalog, lastRequest, result, catalogLabel, datasetPath, defaultConfigPath, locale]
  );
  const requestSummary = model?.requestSummary;
  const iconAtlasIds = model?.catalogSummary.iconAtlasIds ?? catalog?.iconAtlasIds ?? ['Vanilla'];

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

  function clearCachedWorkbenchState() {
    clearWorkbenchCache(browserStorage);
    setDatasetEditorText(loadedDatasetText);
    setDefaultConfigEditorText(loadedDefaultConfigText);
    setDatasetEditorError('');

    if (catalog) {
      applyWorkbenchEditorState(catalog, buildDefaultWorkbenchEditorState(catalog));
    }
  }

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

  function scrollItemLedgerToTop() {
    itemLedgerScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollItemLedgerToBottom() {
    const container = itemLedgerScrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }

  function scrollItemLedgerToSection(sectionKey: string) {
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
  }

  function addTarget() {
    if (!catalog) {
      return;
    }
    const nextItemId =
      itemOptions.find(item => !targets.some(target => target.itemId === item.itemId))?.itemId ??
      pickDefaultTarget(catalog);
    if (nextItemId) {
      setTargets(current => [...current, { itemId: nextItemId, ratePerMin: 60 }]);
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
    setTargets(current => current.filter((_, targetIndex) => targetIndex !== index));
  }

  function markItemAsRawInput(itemId: string) {
    if (!itemId) {
      return;
    }

    const isDatasetRawItem = catalog?.rawItemIds.includes(itemId) ?? false;
    setDisabledRawInputItemIds(current => current.filter(entry => entry !== itemId));
    if (!isDatasetRawItem) {
      setRawInputItemIds(current => (current.includes(itemId) ? current : [...current, itemId]));
    }
  }

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
  }

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
    if (!recipePreferenceDraftId || recipePreferences.some(entry => entry.recipeId === recipePreferenceDraftId)) {
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

  function updateRecipePreference(recipeId: string, patch: Partial<EditableRecipePreference>) {
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

  useEffect(() => {
    if (!catalog) {
      setSelectedItemId('');
      setIsItemSliceOpen(false);
      return;
    }

    const validItemIds = new Set(model ? Object.keys(model.itemSlicesById) : []);
    if (selectedItemId && validItemIds.has(selectedItemId)) {
      return;
    }

    const fallbackItemId =
      targets[0]?.itemId ??
      model?.targets[0]?.itemId ??
      model?.itemLedgerSections[0]?.items[0]?.itemId ??
      catalog.items.find(item => item.kind !== 'utility')?.itemId ??
      '';

    setSelectedItemId(fallbackItemId);
  }, [catalog, model, selectedItemId, targets]);

  const selectedItemSlice =
    selectedItemId && model ? model.itemSlicesById[selectedItemId] : undefined;

  useEffect(() => {
    if (isItemSliceOpen && !selectedItemSlice) {
      setIsItemSliceOpen(false);
    }
  }, [isItemSliceOpen, selectedItemSlice]);

  useEffect(() => {
    if (!isItemSliceOpen || typeof window === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsItemSliceOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isItemSliceOpen]);

  const selectedItemPreferredRecipeOptions = useMemo(() => {
    if (!catalog || !selectedItemSlice) {
      return [];
    }

    return catalog.recipes
      .filter(recipe => recipe.outputs.some(output => output.itemId === selectedItemSlice.itemId))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(recipe => ({
        recipeId: recipe.recipeId,
        recipeName: recipe.name,
        recipeIconKey: recipe.icon,
      }));
  }, [catalog, selectedItemSlice]);

  function updatePreferredRecipeForItem(itemId: string, recipeId: string) {
    setPreferredRecipeByItem(current => {
      const next = { ...current };
      if (!recipeId) {
        delete next[itemId];
      } else {
        next[itemId] = recipeId;
      }
      return next;
    });
  }

  function clearPreferredRecipeForItem(itemId: string) {
    setPreferredRecipeByItem(current => {
      if (!current[itemId]) {
        return current;
      }
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  function locateItemInLedger(itemId: string) {
    const targetSection =
      model?.itemLedgerSections.find(section => section.items.some(item => item.itemId === itemId)) ??
      null;

    if (!targetSection) {
      return;
    }

    setSelectedItemId(itemId);
    scrollItemLedgerToSection(targetSection.key);
  }

  function openItemSlice(itemId: string) {
    setSelectedItemId(itemId);
    setIsItemSliceOpen(true);
  }

  function renderClickableItemLabel(item: {
    itemId: string;
    itemName: string;
    iconKey?: string;
  }) {
    return (
      <EntityLabelButton
        label={item.itemName}
        iconKey={item.iconKey}
        atlasIds={iconAtlasIds}
        size={18}
        gap={8}
        onClick={() => openItemSlice(item.itemId)}
      />
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{bundle.page.eyebrow}</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.2rem, 4vw, 4rem)', lineHeight: 1.02 }}>
            {bundle.page.title}
          </h1>
          <p style={{ margin: 0, maxWidth: 880, fontSize: 18, lineHeight: 1.65, color: 'rgba(24, 51, 89, 0.82)' }}>
            {bundle.page.description}
          </p>
        </section>

        <section
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 20 }}>
            <article style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>{bundle.datasetSource.title}</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <select
                  value={presetId}
                  onChange={event => onPresetChange(event.target.value as DatasetPresetId)}
                  style={inputStyle}
                >
                  {DATASET_PRESETS.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {getDatasetPresetText(preset.id, locale).label}
                    </option>
                  ))}
                </select>

                <input
                  value={datasetPath}
                  onChange={event => {
                    setPresetId('custom');
                    setCatalogLabel(getDatasetPresetText('custom', locale).label);
                    setDatasetPath(event.target.value);
                  }}
                  placeholder={bundle.datasetSource.datasetPathPlaceholder}
                  style={inputStyle}
                />

                <input
                  value={defaultConfigPath}
                  onChange={event => {
                    setPresetId('custom');
                    setCatalogLabel(getDatasetPresetText('custom', locale).label);
                    setDefaultConfigPath(event.target.value);
                  }}
                  placeholder={bundle.datasetSource.defaultsPathPlaceholder}
                  style={inputStyle}
                />

                <button
                  type="button"
                  onClick={() =>
                    void loadCatalog(datasetPath, defaultConfigPath, catalogLabel, presetId)
                  }
                  style={buttonStyle}
                  disabled={isLoading}
                >
                  {isLoading ? bundle.datasetSource.loadingButton : bundle.datasetSource.loadButton}
                </button>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: 'rgba(24, 51, 89, 0.66)',
                    }}
                  >
                    {bundle.datasetSource.autoCacheHint}
                  </div>
                  <button
                    type="button"
                    onClick={clearCachedWorkbenchState}
                    style={subtleButtonStyle}
                  >
                    {bundle.datasetSource.clearCacheButton}
                  </button>
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(24, 51, 89, 0.72)' }}>
                  {getDatasetPresetText(
                    DATASET_PRESETS.find(preset => preset.id === presetId)?.id ?? 'custom',
                    locale
                  ).description}
                </div>

                <section style={{ ...collapsibleSectionStyle, display: 'grid', gap: 12 }}>
                  <h3 style={sectionHeadingStyle}>{bundle.summary.catalogTitle}</h3>
                  {model ? (
                    <>
                      <div
                        style={{
                          display: 'grid',
                          gap: 12,
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        }}
                      >
                        <div>
                          <div style={sectionHeadingStyle}>{bundle.summary.datasetLabel}</div>
                          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                            {model.catalogSummary.datasetLabel ?? bundle.common.custom}
                          </div>
                        </div>
                        <div>
                          <div style={sectionHeadingStyle}>{bundle.summary.itemsLabel}</div>
                          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                            {model.catalogSummary.itemCount}
                          </div>
                        </div>
                        <div>
                          <div style={sectionHeadingStyle}>{bundle.summary.recipesLabel}</div>
                          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                            {model.catalogSummary.recipeCount}
                          </div>
                        </div>
                        <div>
                          <div style={sectionHeadingStyle}>{bundle.summary.buildingsLabel}</div>
                          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                            {model.catalogSummary.buildingCount}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(24, 51, 89, 0.72)', lineHeight: 1.6 }}>
                        <div>
                          {bundle.summary.datasetPathLabel}: {model.catalogSummary.datasetPath ?? bundle.common.notSet}
                        </div>
                        <div>
                          {bundle.summary.defaultsPathLabel}: {model.catalogSummary.defaultConfigPath ?? bundle.common.none}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.summary.loadDatasetToStart}</div>
                  )}
                </section>

                <DatasetEditorPanel
                  title={bundle.datasetSource.editorTitle}
                  helpText={bundle.datasetSource.editorHelp}
                  datasetLabel={bundle.datasetSource.editorDatasetLabel}
                  defaultsLabel={bundle.datasetSource.editorDefaultsLabel}
                  datasetText={datasetEditorText}
                  defaultConfigText={defaultConfigEditorText}
                  applyButtonLabel={bundle.datasetSource.editorApplyButton}
                  resetButtonLabel={bundle.datasetSource.editorResetButton}
                  errorText={datasetEditorError}
                  onDatasetTextChange={setDatasetEditorText}
                  onDefaultConfigTextChange={setDefaultConfigEditorText}
                  onApply={applyDatasetEditorChanges}
                  onReset={resetDatasetEditorToLoadedSource}
                >
                  <StructuredDatasetEditor
                    title={bundle.datasetSource.structuredEditorTitle}
                    helpText={bundle.datasetSource.structuredEditorHelp}
                    unavailableText={bundle.datasetSource.structuredEditorUnavailable}
                    tabs={{
                      items: bundle.datasetSource.structuredEditorTabs.items,
                      recipes: bundle.datasetSource.structuredEditorTabs.recipes,
                      buildingRules: bundle.datasetSource.structuredEditorTabs.buildingRules,
                      defaults: bundle.datasetSource.structuredEditorTabs.defaults,
                    }}
                    actions={{
                      add: bundle.datasetSource.structuredEditorAddButton,
                      remove: bundle.datasetSource.structuredEditorRemoveButton,
                    }}
                    datasetText={datasetEditorText}
                    defaultConfigText={defaultConfigEditorText}
                    onSourceTextsChange={updateDatasetEditorTexts}
                  />
                </DatasetEditorPanel>
              </div>
            </article>

            <article style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>{bundle.solveRequest.title}</h2>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  {targets.map((target, index) => (
                    <div
                      key={`${target.itemId}-${index}`}
                      style={{
                        display: 'grid',
                        gap: 10,
                        gridTemplateColumns: 'minmax(0, 1fr) 120px auto',
                        alignItems: 'end',
                      }}
                    >
                      <select
                        value={target.itemId}
                        onChange={event => updateTarget(index, { itemId: event.target.value })}
                        style={inputStyle}
                        disabled={!catalog}
                      >
                        {itemOptions.map(item => (
                          <option key={item.itemId} value={item.itemId}>
                            {item.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={target.ratePerMin}
                        onChange={event =>
                          updateTarget(index, {
                            ratePerMin: Number(event.target.value) || 0,
                          })
                        }
                        style={inputStyle}
                      />

                      <button
                        type="button"
                        onClick={() => removeTarget(index)}
                        style={subtleButtonStyle}
                        disabled={targets.length <= 1}
                      >
                        {bundle.solveRequest.removeTarget}
                      </button>
                    </div>
                  ))}

                  <button type="button" onClick={addTarget} style={subtleButtonStyle} disabled={!catalog}>
                    {bundle.solveRequest.addTarget}
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <select
                    value={objective}
                    onChange={event => setObjective(event.target.value as SolveObjective)}
                    style={inputStyle}
                  >
                    <option value="min_buildings">{bundle.solveRequest.objectiveOptions.min_buildings}</option>
                    <option value="min_power">{bundle.solveRequest.objectiveOptions.min_power}</option>
                    <option value="min_external_input">{bundle.solveRequest.objectiveOptions.min_external_input}</option>
                  </select>

                  <select
                    value={balancePolicy}
                    onChange={event => setBalancePolicy(event.target.value as BalancePolicy)}
                    style={inputStyle}
                  >
                    <option value="force_balance">{bundle.solveRequest.balancePolicyOptions.force_balance}</option>
                    <option value="allow_surplus">{bundle.solveRequest.balancePolicyOptions.allow_surplus}</option>
                  </select>

                  <select
                    value={proliferatorPolicy}
                    onChange={event =>
                      setProliferatorPolicy(event.target.value as WorkbenchProliferatorPolicy)
                    }
                    style={inputStyle}
                  >
                    <option value="auto">{bundle.solveRequest.proliferatorPolicyOptions.auto}</option>
                    <option value="disable_all">{bundle.solveRequest.proliferatorPolicyOptions.disable_all}</option>
                  </select>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoPromoteUnavailableItemsToRawInputs}
                    onChange={event =>
                      setAutoPromoteUnavailableItemsToRawInputs(event.target.checked)
                    }
                  />
                  <span>{bundle.solveRequest.autoPromoteUnavailableItemsLabel}</span>
                </label>

                <details style={collapsibleSectionStyle}>
                  <summary style={summaryStyle}>{bundle.solveRequest.disabledRecipesLabel}</summary>
                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                      <select
                        value={disabledRecipeDraftId}
                        onChange={event => setDisabledRecipeDraftId(event.target.value)}
                        style={inputStyle}
                        disabled={!catalog || disableRecipeOptions.length === 0}
                      >
                        {disableRecipeOptions.map(recipe => (
                          <option key={recipe.recipeId} value={recipe.recipeId}>
                            {recipe.name}
                          </option>
                        ))}
                      </select>

                      <button type="button" onClick={addDisabledRecipe} style={subtleButtonStyle} disabled={!disabledRecipeDraftId}>
                        {bundle.solveRequest.disableButton}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {disabledRecipeIds.length === 0 ? (
                        <span style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>{bundle.solveRequest.noDisabledRecipes}</span>
                      ) : (
                        disabledRecipeIds.map(recipeId => (
                          <button
                            key={recipeId}
                            type="button"
                            onClick={() => removeDisabledRecipe(recipeId)}
                            style={{
                              borderRadius: 999,
                              border: '1px solid rgba(24, 51, 89, 0.16)',
                              background: 'rgba(24, 51, 89, 0.06)',
                              color: '#183359',
                              padding: '6px 12px',
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            {(catalog?.recipeMap.get(recipeId)?.name ?? recipeId) + ` ${bundle.common.removeSuffix}`}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </details>

                <details style={collapsibleSectionStyle}>
                  <summary style={summaryStyle}>{bundle.solveRequest.disabledBuildingsLabel}</summary>
                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                      <select
                        value={disabledBuildingDraftId}
                        onChange={event => setDisabledBuildingDraftId(event.target.value)}
                        style={inputStyle}
                        disabled={!catalog || disableBuildingOptions.length === 0}
                      >
                        {disableBuildingOptions.map(building => (
                          <option key={building.buildingId} value={building.buildingId}>
                            {building.name}
                          </option>
                        ))}
                      </select>

                      <button type="button" onClick={addDisabledBuilding} style={subtleButtonStyle} disabled={!disabledBuildingDraftId}>
                        {bundle.solveRequest.disableButton}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {disabledBuildingIds.length === 0 ? (
                        <span style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>{bundle.solveRequest.noDisabledBuildings}</span>
                      ) : (
                        disabledBuildingIds.map(buildingId => (
                          <button
                            key={buildingId}
                            type="button"
                            onClick={() => removeDisabledBuilding(buildingId)}
                            style={{
                              borderRadius: 999,
                              border: '1px solid rgba(24, 51, 89, 0.16)',
                              background: 'rgba(24, 51, 89, 0.06)',
                              color: '#183359',
                              padding: '6px 12px',
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            {(catalog?.buildingMap.get(buildingId)?.name ?? buildingId) + ` ${bundle.common.removeSuffix}`}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </details>

                <details style={collapsibleSectionStyle}>
                  <summary style={summaryStyle}>{bundle.solveRequest.recipePreferencesLabel}</summary>
                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                      <select
                        value={recipePreferenceDraftId}
                        onChange={event => setRecipePreferenceDraftId(event.target.value)}
                        style={inputStyle}
                        disabled={!catalog || recipePreferenceOptions.length === 0}
                      >
                        {recipePreferenceOptions.map(recipe => (
                          <option key={recipe.recipeId} value={recipe.recipeId}>
                            {recipe.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={addRecipePreference}
                        style={subtleButtonStyle}
                        disabled={!recipePreferenceDraftId}
                      >
                        {bundle.solveRequest.addPreference}
                      </button>
                    </div>

                    <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13, lineHeight: 1.5 }}>
                      {bundle.solveRequest.recipePreferencesHelp}
                    </div>

                    {recipePreferences.length === 0 ? (
                      <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>{bundle.solveRequest.noRecipePreferences}</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 12 }}>
                        {recipePreferences.map(preference => {
                          const recipe = catalog?.recipeMap.get(preference.recipeId);
                          const buildingChoices = getRecipeBuildingOptions(preference.recipeId);
                          const modeChoices = getRecipeModeOptions(preference.recipeId);
                          const levelChoices = getRecipeLevelOptions(preference.recipeId);
                          const levelSelectDisabled =
                            proliferatorPolicy === 'disable_all' ||
                            levelChoices.length === 0 ||
                            preference.preferredProliferatorMode === 'none';

                          return (
                            <div
                              key={preference.recipeId}
                              style={{
                                borderRadius: 16,
                                border: '1px solid rgba(24, 51, 89, 0.12)',
                                background: 'rgba(255,255,255,0.6)',
                                padding: 14,
                                display: 'grid',
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div style={{ fontWeight: 700 }}>{recipe?.name ?? preference.recipeId}</div>
                                <button
                                  type="button"
                                  onClick={() => removeRecipePreference(preference.recipeId)}
                                  style={subtleButtonStyle}
                                >
                                  {bundle.solveRequest.removeTarget}
                                </button>
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gap: 10,
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                }}
                              >
                                <div style={{ display: 'grid', gap: 6 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                                    {bundle.solveRequest.preferredBuildingLabel}
                                  </div>
                                  <select
                                    value={preference.preferredBuildingId}
                                    onChange={event =>
                                      updateRecipePreference(preference.recipeId, {
                                        preferredBuildingId: event.target.value,
                                      })
                                    }
                                    style={inputStyle}
                                  >
                                    <option value="">{bundle.common.auto}</option>
                                    {buildingChoices.map(building => (
                                      <option key={building.buildingId} value={building.buildingId}>
                                        {building.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div style={{ display: 'grid', gap: 6 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                                    {bundle.solveRequest.preferredSprayModeLabel}
                                  </div>
                                  <select
                                    value={preference.preferredProliferatorMode}
                                    onChange={event => {
                                      const nextMode = event.target.value as '' | ProliferatorMode;
                                      updateRecipePreference(preference.recipeId, {
                                        preferredProliferatorMode: nextMode,
                                        preferredProliferatorLevel:
                                          nextMode === 'none'
                                            ? ''
                                            : preference.preferredProliferatorLevel,
                                      });
                                    }}
                                    style={inputStyle}
                                    disabled={proliferatorPolicy === 'disable_all'}
                                  >
                                    <option value="">{bundle.common.auto}</option>
                                    {modeChoices.map(mode => (
                                      <option key={mode} value={mode}>
                                        {formatProliferatorMode(mode, locale)}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div style={{ display: 'grid', gap: 6 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                                    {bundle.solveRequest.preferredSprayLevelLabel}
                                  </div>
                                  <select
                                    value={preference.preferredProliferatorLevel === '' ? '' : String(preference.preferredProliferatorLevel)}
                                    onChange={event =>
                                      updateRecipePreference(preference.recipeId, {
                                        preferredProliferatorLevel: event.target.value
                                          ? Number(event.target.value)
                                          : '',
                                      })
                                    }
                                    style={inputStyle}
                                    disabled={levelSelectDisabled}
                                  >
                                    <option value="">{bundle.common.auto}</option>
                                    {levelChoices.map(level => (
                                      <option key={level} value={String(level)}>
                                        {`${bundle.solveRequest.levelPrefix} ${level}`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </details>

                <details style={collapsibleSectionStyle}>
                  <summary style={summaryStyle}>{bundle.solveRequest.advancedOverridesLabel}</summary>
                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <textarea
                      value={advancedOverridesText}
                      onChange={event => setAdvancedOverridesText(event.target.value)}
                      placeholder={'{\n  "preferredBuildingByRecipe": { "1": "5002" },\n  "forcedProliferatorModeByRecipe": { "2": "speed" }\n}'}
                      style={{
                        ...inputStyle,
                        minHeight: 140,
                        resize: 'vertical',
                        fontFamily: '"IBM Plex Mono", monospace',
                      }}
                    />
                    {parsedOverrides.error ? (
                      <div style={{ color: '#8e2020', fontSize: 13 }}>{parsedOverrides.error}</div>
                    ) : (
                      <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>
                        {bundle.solveRequest.advancedOverridesHelp}
                      </div>
                    )}
                  </div>
                </details>

                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(24, 51, 89, 0.72)' }}>
                  {bundle.solveRequest.autoSolveHint}
                </div>

                <section style={{ ...collapsibleSectionStyle, display: 'grid', gap: 12 }}>
                  <h3 style={sectionHeadingStyle}>{bundle.summary.solveSnapshotTitle}</h3>
                  {solveError ? <div style={{ color: '#8e2020', fontWeight: 700 }}>{solveError}</div> : null}
                  {requestSummary ? (
                    <>
                      <div
                        style={{
                          display: 'grid',
                          gap: 10,
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        }}
                      >
                        <div>
                          <div style={sectionHeadingStyle}>{bundle.summary.objectiveLabel}</div>
                          <div style={{ marginTop: 6 }}>{formatSolveObjective(requestSummary.objective, locale)}</div>
                        </div>
                        <div>
                          <div style={sectionHeadingStyle}>{bundle.summary.balanceLabel}</div>
                          <div style={{ marginTop: 6 }}>{formatBalancePolicy(requestSummary.balancePolicy, locale)}</div>
                        </div>
                        <div>
                          <div style={sectionHeadingStyle}>{bundle.summary.sprayLabel}</div>
                          <div style={{ marginTop: 6 }}>{requestSummary.proliferatorPolicyLabel}</div>
                        </div>
                        <div>
                          <div style={sectionHeadingStyle}>{bundle.summary.statusLabel}</div>
                          <div style={{ marginTop: 6 }}>{formatSolveStatus(model?.status ?? null, locale)}</div>
                        </div>
                      </div>

                      <div>
                        <div style={sectionHeadingStyle}>{bundle.summary.targetsLabel}</div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                          {requestSummary.targets.map(target => (
                            <div key={target.itemId}>
                              {renderClickableItemLabel(target)}{' '}
                              : {formatRate(target.ratePerMin, locale)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <details>
                        <summary style={summaryStyle}>{bundle.summary.recipePreferencesLabel}</summary>
                        <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 13 }}>
                          {requestSummary.preferredRecipeSettings.length === 0 ? (
                            <div>{bundle.common.none}</div>
                          ) : (
                            requestSummary.preferredRecipeSettings.map(setting => (
                              <div key={setting.recipeId}>
                                <EntityLabel
                                  label={setting.recipeName}
                                  iconKey={setting.recipeIconKey}
                                  atlasIds={iconAtlasIds}
                                  size={18}
                                />
                                {setting.buildingName ? (
                                  <>
                                    {' '}
                                    |{' '}
                                    <EntityLabel
                                      label={setting.buildingName}
                                      iconKey={setting.buildingIconKey}
                                      atlasIds={iconAtlasIds}
                                      size={18}
                                    />
                                  </>
                                ) : null}
                                {setting.proliferatorPreferenceLabel
                                  ? ` | ${setting.proliferatorPreferenceLabel}`
                                  : ''}
                              </div>
                            ))
                          )}
                        </div>
                      </details>
                    </>
                  ) : (
                    <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.summary.loadDatasetToStart}</div>
                  )}
                </section>
              </div>
            </article>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            {loadError ? (
              <article style={{ ...cardStyle, borderColor: 'rgba(180, 41, 41, 0.2)' }}>
                <h2 style={{ marginTop: 0, color: '#8e2020' }}>{bundle.datasetSource.loadErrorTitle}</h2>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{loadError}</pre>
              </article>
            ) : null}

            {model ? (
              model.status ? (
                <section style={resultBodyGridStyle}>
                  <div style={resultMainColumnStyle}>
                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>{bundle.overview.summaryTitle}</h2>
                      <div
                        style={{
                          display: 'grid',
                          gap: 16,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        }}
                      >
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={sectionHeadingStyle}>{bundle.itemLedger.netInputsTitle}</div>
                          {(model.solvedSummary?.netInputs.length ?? 0) === 0 ? (
                            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
                          ) : (
                            model.solvedSummary?.netInputs.map(item => (
                              <div key={item.itemId}>
                                {renderClickableItemLabel(item)}:{' '}
                                {formatRate(item.ratePerMin, locale)}
                              </div>
                            ))
                          )}
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={sectionHeadingStyle}>{bundle.itemLedger.netOutputsTitle}</div>
                          {(model.solvedSummary?.netOutputs.length ?? 0) === 0 ? (
                            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
                          ) : (
                            model.solvedSummary?.netOutputs.map(item => (
                              <div key={item.itemId}>
                                {renderClickableItemLabel(item)}:{' '}
                                {formatRate(item.ratePerMin, locale)}
                              </div>
                            ))
                          )}
                        </div>

                        <div style={{ border: '1px solid rgba(24, 51, 89, 0.10)', borderRadius: 16, padding: 14, display: 'grid', gap: 6, alignContent: 'start' }}>
                          <div style={sectionHeadingStyle}>{bundle.summary.buildingsLabel}</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{model.solvedSummary?.buildingTypeCount ?? 0}</div>
                          <div style={{ fontSize: 13, color: 'rgba(24, 51, 89, 0.72)' }}>
                            {bundle.overview.roundedLabel} {model.solvedSummary?.roundedBuildingCount ?? 0}
                          </div>
                        </div>

                        <div style={{ border: '1px solid rgba(24, 51, 89, 0.10)', borderRadius: 16, padding: 14, display: 'grid', gap: 6, alignContent: 'start' }}>
                          <div style={sectionHeadingStyle}>{bundle.overview.powerLabel}</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>
                            {formatPower(model.solvedSummary?.roundedPlacementPowerMW ?? 0, locale)}
                          </div>
                          <div style={{ fontSize: 13, color: 'rgba(24, 51, 89, 0.72)' }}>
                            {bundle.overview.roundedPlacementLabel}
                          </div>
                        </div>

                        <div style={{ border: '1px solid rgba(24, 51, 89, 0.10)', borderRadius: 16, padding: 14, display: 'grid', gap: 6, alignContent: 'start' }}>
                          <div style={sectionHeadingStyle}>{bundle.summary.recipesLabel}</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{model.solvedSummary?.recipeTypeCount ?? 0}</div>
                          <div style={{ fontSize: 13, color: 'rgba(24, 51, 89, 0.72)' }}>{bundle.recipePlans.title}</div>
                        </div>
                      </div>
                    </article>

                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>{bundle.recipePlans.title}</h2>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {model.recipePlans.map(plan => (
                          <div
                            key={`${plan.recipeId}:${plan.buildingId}:${plan.proliferatorLabel}`}
                            style={{ border: '1px solid rgba(24, 51, 89, 0.12)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>
                                  <EntityLabel
                                    label={plan.recipeName}
                                    iconKey={plan.recipeIconKey}
                                    atlasIds={iconAtlasIds}
                                    size={22}
                                  />
                                </div>
                                <div style={{ marginTop: 4, fontSize: 14, color: 'rgba(24, 51, 89, 0.72)' }}>
                                  <EntityLabel
                                    label={plan.buildingName}
                                    iconKey={plan.buildingIconKey}
                                    atlasIds={iconAtlasIds}
                                    size={18}
                                  />{' '}
                                  | {plan.proliferatorLabel}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div>{formatRate(plan.runsPerMin, locale)}</div>
                                <div style={{ marginTop: 4, fontSize: 14 }}>
                                  {bundle.recipePlans.exactLabel} {plan.exactBuildingCount.toFixed(2)} / {bundle.recipePlans.roundedLabel} {plan.roundedUpBuildingCount}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{bundle.recipePlans.inputsLabel}</div>
                                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                                  {plan.inputs.map(input => (
                                    <div key={input.itemId}>
                                      {renderClickableItemLabel(input)}{' '}
                                      : {formatRate(input.ratePerMin, locale)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{bundle.recipePlans.outputsLabel}</div>
                                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                                  {plan.outputs.map(output => (
                                    <div key={output.itemId}>
                                      {renderClickableItemLabel(output)}{' '}
                                      : {formatRate(output.ratePerMin, locale)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{bundle.recipePlans.powerLabel}</div>
                                <div style={{ marginTop: 8 }}>{formatPower(plan.activePowerMW, locale)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>{bundle.diagnostics.title}</h2>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {model.diagnostics &&
                        model.diagnostics.messages.length === 0 &&
                        model.diagnostics.unmetPreferences.length === 0 ? (
                          <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.diagnostics.noDiagnostics}</div>
                        ) : (
                          <>
                            {(model.diagnostics?.messages ?? []).map((message, index) => (
                              <div key={`message-${index}`}>{message}</div>
                            ))}
                            {(model.diagnostics?.unmetPreferences ?? []).map((message, index) => (
                              <div key={`pref-${index}`}>{message}</div>
                            ))}
                          </>
                        )}
                      </div>

                      <details style={{ marginTop: 14 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{bundle.diagnostics.itemBalanceLabel}</summary>
                        <div style={{ marginTop: 12, display: 'grid', gap: 6, maxHeight: 260, overflow: 'auto' }}>
                          {model.itemBalance.map(entry => (
                            <div key={entry.itemId} style={{ paddingBottom: 6, borderBottom: '1px solid rgba(24, 51, 89, 0.08)' }}>
                              <div style={{ fontWeight: 700 }}>
                                {renderClickableItemLabel(entry)}
                              </div>
                              <div style={{ fontSize: 13 }}>
                                {bundle.diagnostics.producedLabel} {formatRate(entry.producedRatePerMin, locale)} / {bundle.diagnostics.consumedLabel} {formatRate(entry.consumedRatePerMin, locale)} / {bundle.diagnostics.netLabel} {formatRate(entry.netRatePerMin, locale)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>

                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{bundle.diagnostics.solveRequestJson}</summary>
                        <pre style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'rgba(24, 51, 89, 0.06)', overflow: 'auto', fontSize: 13 }}>
                          {JSON.stringify(lastRequest, null, 2)}
                        </pre>
                      </details>
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{bundle.diagnostics.solveResultJson}</summary>
                        <pre style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'rgba(24, 51, 89, 0.06)', overflow: 'auto', fontSize: 13 }}>
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </details>
                    </article>
                    </div>

                    <aside style={resultSideColumnStyle}>
                      <article
                        style={{
                          ...cardStyle,
                          padding: 16,
                          height: '100%',
                          maxHeight: '100%',
                          minHeight: 0,
                          overflow: 'hidden',
                          display: 'grid',
                          gridTemplateRows: 'auto auto minmax(0, 1fr)',
                          gap: 12,
                        }}
                      >
                        <h2 style={{ marginTop: 0, marginBottom: 0 }}>{bundle.itemLedger.title}</h2>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {model.itemLedgerSections.map(section => (
                              <button
                                key={`jump-${section.key}`}
                                type="button"
                                onClick={() => scrollItemLedgerToSection(section.key)}
                                style={compactLedgerButtonStyle}
                              >
                                {section.title}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={scrollItemLedgerToTop}
                              style={compactLedgerButtonStyle}
                            >
                              {bundle.itemLedger.jumpToTopButton}
                            </button>
                            <button
                              type="button"
                              onClick={scrollItemLedgerToBottom}
                              style={compactLedgerButtonStyle}
                            >
                              {bundle.itemLedger.jumpToBottomButton}
                            </button>
                          </div>
                        </div>
                        <div
                          ref={itemLedgerScrollRef}
                          style={{ display: 'grid', gap: 16, overflow: 'auto', minHeight: 0, paddingRight: 4 }}
                        >
                          {model.itemLedgerSections.map(section => (
                            <section
                              key={section.key}
                              ref={node => {
                                itemLedgerSectionRefs.current[section.key] = node;
                              }}
                              style={{ display: 'grid', gap: 8 }}
                            >
                              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(24, 51, 89, 0.72)' }}>
                                {section.title}
                              </div>
                              {section.items.length === 0 ? (
                                <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>{bundle.itemLedger.noItems}</div>
                              ) : (
                                <div style={{ display: 'grid', gap: 0, borderTop: '1px solid rgba(24, 51, 89, 0.10)' }}>
                                  {section.items.map(entry => (
                                    <div
                                      key={entry.itemId}
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                        gap: 10,
                                        alignItems: 'center',
                                        padding: '10px 0',
                                        borderBottom: '1px solid rgba(24, 51, 89, 0.10)',
                                      }}
                                    >
                                      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                          <EntityLabelButton
                                            label={entry.itemName}
                                            iconKey={entry.iconKey}
                                            atlasIds={iconAtlasIds}
                                            size={20}
                                            textStyle={{ fontWeight: 700 }}
                                            onClick={() => openItemSlice(entry.itemId)}
                                          />
                                          {entry.isRawInput ? (
                                            <span style={{ padding: '2px 6px', borderRadius: 999, background: 'rgba(24, 51, 89, 0.10)', fontSize: 11, fontWeight: 700 }}>
                                              {bundle.itemLedger.rawBadge}
                                            </span>
                                          ) : null}
                                          {entry.isTarget ? (
                                            <span style={{ padding: '2px 6px', borderRadius: 999, background: 'rgba(212, 120, 48, 0.14)', fontSize: 11, fontWeight: 700 }}>
                                              {bundle.itemLedger.targetBadge}
                                            </span>
                                          ) : null}
                                          {entry.isSurplusOutput ? (
                                            <span style={{ padding: '2px 6px', borderRadius: 999, background: 'rgba(56, 143, 122, 0.14)', fontSize: 11, fontWeight: 700 }}>
                                              {bundle.itemLedger.surplusBadge}
                                            </span>
                                          ) : null}
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'rgba(24, 51, 89, 0.78)' }}>
                                          <span>{bundle.diagnostics.producedLabel} {formatRate(entry.producedRatePerMin, locale)}</span>
                                          <span>{bundle.diagnostics.consumedLabel} {formatRate(entry.consumedRatePerMin, locale)}</span>
                                          {Math.abs(entry.netRatePerMin) > 1e-8 ? (
                                            <span>{bundle.diagnostics.netLabel} {formatRate(entry.netRatePerMin, locale)}</span>
                                          ) : null}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          entry.isRawInput
                                            ? unmarkItemAsRawInput(entry.itemId)
                                            : markItemAsRawInput(entry.itemId)
                                        }
                                        style={compactLedgerButtonStyle}
                                      >
                                        {entry.isRawInput
                                          ? bundle.itemLedger.unmarkRawButton
                                          : bundle.itemLedger.markRawButton}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </section>
                          ))}
                        </div>
                      </article>
                    </aside>
                  </section>
                ) : (
                  <article style={cardStyle}>
                    <h2 style={{ marginTop: 0 }}>{bundle.ready.title}</h2>
                    <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
                      {bundle.ready.description}
                    </p>
                  </article>
                )
            ) : (
              <article style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>{bundle.datasetSource.waitingTitle}</h2>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
                  {bundle.datasetSource.waitingDescription}
                </p>
              </article>
            )}
          </div>
        </section>
      </div>
      {isItemSliceOpen && selectedItemSlice ? (
        <div
          style={modalBackdropStyle}
          onClick={() => setIsItemSliceOpen(false)}
        >
          <div
            style={modalPanelStyle}
            onClick={event => event.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setIsItemSliceOpen(false)}
                style={subtleButtonStyle}
              >
                {workbenchExtra.itemSlice.closeButton}
              </button>
            </div>
            <ItemSlicePanel
              locale={locale}
              atlasIds={iconAtlasIds}
              slice={selectedItemSlice}
              preferredRecipeId={preferredRecipeByItem[selectedItemSlice.itemId]}
              preferredRecipeOptions={selectedItemPreferredRecipeOptions}
              onSelectItem={openItemSlice}
              onMarkRaw={markItemAsRawInput}
              onUnmarkRaw={unmarkItemAsRawInput}
              onPreferredRecipeChange={updatePreferredRecipeForItem}
              onClearPreferredRecipe={clearPreferredRecipeForItem}
              onLocateInLedger={locateItemInLedger}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
