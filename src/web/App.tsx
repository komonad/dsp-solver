import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
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
import { buildPresentationModel } from '../presentation';
import type { BalancePolicy, SolveObjective } from '../solver';
import {
  DATASET_PRESETS,
  loadCatalogSourceFromUrl,
  resolveCatalogSourceTexts,
} from './catalog/catalogClient';
import { computeWorkbenchSolve } from './workbench/autoSolve';
import DatasetEditorPanel from './catalog/DatasetEditorPanel';
import { EntityIcon, EntityLabel, EntityLabelButton } from './shared/EntityIcon';
import ItemSliceOverlayHost from './itemSlice/ItemSliceOverlayHost';
import { openItemSliceOverlay } from './itemSlice/itemSliceStore';
import { computeLedgerSectionScrollTop } from './shared/ledgerScroll';
import ItemGridPicker from './shared/ItemGridPicker';
import type { ItemPickerOption } from './shared/itemPickerModel';
import { tryApplyRecipeStrategyOverride } from './workbench/recipeStrategy';
import StructuredDatasetEditor from './catalog/StructuredDatasetEditor';
import { buildRecipeFlowDisplay } from './shared/recipeDisplay';
import {
  parseAdvancedSolveOverrides,
  type EditableRecipePreference,
  type EditableRecipeStrategyOverride,
  type EditableTarget,
  type WorkbenchProliferatorPolicy,
} from './workbench/requestBuilder';
import {
  clearNamespacedStorage,
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
} from './workbench/persistence';
import { recordWorkbenchPerf } from './workbench/workbenchPerf';

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
  borderRadius: 20,
  padding: 16,
  boxShadow: '0 10px 26px rgba(24, 51, 89, 0.07)',
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

const compactSelectFieldSx = {
  minWidth: 0,
  '& .MuiInputBase-root': {
    minWidth: 0,
  },
  '& .MuiSelect-select': {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    pr: '32px !important',
  },
  '& .MuiSelect-select > *': {
    minWidth: 0,
    maxWidth: '100%',
  },
} as const;

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
  gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 2fr) minmax(280px, 1fr)',
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

function formatRecipeAmount(amount: number, locale: string): string {
  return Number.isInteger(amount)
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
}

function shouldOmitRecipeAmount(amount: number): boolean {
  return Math.abs(amount - 1) < 1e-9;
}

function formatRecipeCycleTime(seconds: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: seconds < 10 && !Number.isInteger(seconds) ? 1 : 0,
    maximumFractionDigits: seconds < 10 ? 1 : 2,
  }).format(seconds);
}

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

function pickSuggestedTargetItemId(
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

function sortModeOptions(modes: ProliferatorMode[]): ProliferatorMode[] {
  const order: ProliferatorMode[] = ['none', 'speed', 'productivity'];
  return order.filter(mode => modes.includes(mode));
}

function pickDefaultGlobalProliferatorLevel(catalog: ResolvedCatalogModel | null): '' | number {
  if (!catalog) {
    return '';
  }

  const levels = catalog.proliferatorLevels
    .map(level => level.level)
    .filter(level => level > 0)
    .sort((left, right) => right - left);

  return levels[0] ?? '';
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

function getBrowserSessionStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.sessionStorage;
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
    globalProliferatorLevel: '',
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: catalog.recommendedDisabledRecipeIds,
    disabledBuildingIds: catalog.recommendedDisabledBuildingIds,
    forcedRecipeByItem: {},
    recipePreferences: [],
    recipeStrategyOverrides: [],
    advancedOverridesText: '',
  };
}

export default function App() {
  const locale = DEFAULT_APP_LOCALE;
  const bundle = useMemo(() => getLocaleBundle(locale), [locale]);
  const pageTitle = 'DSP 产线求解工作台';
  const pageDescription =
    '切换数据集、编辑求解请求并直接查看当前浏览器实际展示的产线结果。页面只负责装载数据、构造请求和渲染展示模型，不在前端重复计算隐藏业务公式。';
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
  const [forcedRecipeByItem, setForcedRecipeByItem] = useState<Record<string, string>>({});
  const [recipePreferences, setRecipePreferences] = useState<EditableRecipePreference[]>([]);
  const [recipeStrategyOverrides, setRecipeStrategyOverrides] = useState<
    EditableRecipeStrategyOverride[]
  >([]);
  const [recipePreferenceDraftId, setRecipePreferenceDraftId] = useState('');
  const [advancedOverridesText, setAdvancedOverridesText] = useState('');
  const [recipeStrategyWarning, setRecipeStrategyWarning] = useState('');
  const itemLedgerScrollRef = useRef<HTMLDivElement | null>(null);
  const itemLedgerSectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function applyWorkbenchEditorState(
    nextCatalog: ResolvedCatalogModel,
    editorState: WorkbenchEditorState
  ) {
    setTargets(editorState.targets);
    setTargetDraftItemId(
      pickSuggestedTargetItemId(nextCatalog, nextCatalog.items.filter(item => item.kind !== 'utility'), editorState.targets)
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
    setForcedRecipeByItem(editorState.forcedRecipeByItem);
    setRecipePreferences(editorState.recipePreferences);
    setRecipeStrategyOverrides(editorState.recipeStrategyOverrides);
    setRecipePreferenceDraftId(pickDefaultRecipePreference(nextCatalog));
    setAdvancedOverridesText(editorState.advancedOverridesText);
    setRecipeStrategyWarning('');
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
      forcedRecipeByItem,
      recipePreferences,
      recipeStrategyOverrides,
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
      globalProliferatorLevel,
      rawInputItemIds,
      disabledRawInputItemIds,
      disabledRecipeIds,
      disabledBuildingIds,
      forcedRecipeByItem,
      recipePreferences,
      recipeStrategyOverrides,
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
    forcedRecipeByItem,
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
      forcedRecipeByItem,
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
      forcedRecipeByItem,
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
      forcedRecipeByItem: deferredSolveInputs.forcedRecipeByItem,
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
  const iconAtlasIds = model?.catalogSummary.iconAtlasIds ?? catalog?.iconAtlasIds ?? ['Vanilla'];
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

  const markItemAsRawInput = useCallback(function markItemAsRawInput(itemId: string) {
    if (!itemId) {
      return;
    }

    const isDatasetRawItem = catalog?.rawItemIds.includes(itemId) ?? false;
    setDisabledRawInputItemIds(current => current.filter(entry => entry !== itemId));
    if (!isDatasetRawItem) {
      setRawInputItemIds(current => (current.includes(itemId) ? current : [...current, itemId]));
    }
  }, [catalog]);

  const unmarkItemAsRawInput = useCallback(function unmarkItemAsRawInput(itemId: string) {
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
  }, [catalog]);

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

  const recipeStrategyOverrideMap = useMemo(
    () => new Map(recipeStrategyOverrides.map(override => [override.recipeId, override])),
    [recipeStrategyOverrides]
  );

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
        forcedRecipeByItem,
        recipePreferences,
        recipeStrategyOverrides,
        currentResolvedRawInputItemIds: result?.resolvedRawInputItemIds ?? [],
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
      forcedRecipeByItem,
      proliferatorPolicy,
      globalProliferatorLevel,
      rawInputItemIds,
      result,
      recipePreferences,
      recipeStrategyOverrides,
      targets,
    ]
  );

  const preferredRecipeOptionsByItem = useMemo(() => {
    const next: Record<
      string,
      Array<{
        recipeId: string;
        recipeName: string;
        recipeIconKey?: string;
      }>
    > = {};

    if (!catalog) {
      return next;
    }

    for (const recipe of catalog.recipes) {
      for (const output of recipe.outputs) {
        if (!next[output.itemId]) {
          next[output.itemId] = [];
        }
        next[output.itemId].push({
          recipeId: recipe.recipeId,
          recipeName: recipe.name,
          recipeIconKey: recipe.icon,
        });
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
  const targetDraftItemOption = useMemo(
    () => itemOptions.find(item => item.itemId === targetDraftItemId) ?? null,
    [itemOptions, targetDraftItemId]
  );

  const updateForcedRecipeForItem = useCallback(function updateForcedRecipeForItem(
    itemId: string,
    recipeId: string
  ) {
    setForcedRecipeByItem(current => {
      const next = { ...current };
      if (!recipeId) {
        delete next[itemId];
      } else {
        next[itemId] = recipeId;
      }
      return next;
    });
  }, []);

  const clearForcedRecipeForItem = useCallback(function clearForcedRecipeForItem(
    itemId: string
  ) {
    setForcedRecipeByItem(current => {
      if (!current[itemId]) {
        return current;
      }
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const locateItemInLedger = useCallback(function locateItemInLedger(itemId: string) {
    const targetSection =
      model?.itemLedgerSections.find(section => section.items.some(item => item.itemId === itemId)) ??
      null;

    if (!targetSection) {
      return;
    }

    scrollItemLedgerToSection(targetSection.key);
  }, [model]);

  function renderClickableItemLabel(
    item: {
    itemId: string;
    itemName: string;
    iconKey?: string;
    },
    options?: {
      iconOnly?: boolean;
      iconSize?: number;
    }
  ) {
    const iconOnly = options?.iconOnly ?? false;
    const iconSize = options?.iconSize ?? 18;
    return (
      <button
        type="button"
        onClick={() => openItemSliceOverlay(item.itemId)}
        style={{
          border: 'none',
          padding: 0,
          margin: 0,
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          minWidth: 0,
        }}
        title={item.itemName}
      >
        {iconOnly ? (
          <EntityIcon
            label={item.itemName}
            iconKey={item.iconKey}
            atlasIds={iconAtlasIds}
            size={iconSize}
          />
        ) : (
          <EntityLabelButton
            label={item.itemName}
            iconKey={item.iconKey}
            atlasIds={iconAtlasIds}
            size={iconSize}
            gap={8}
            onClick={() => openItemSliceOverlay(item.itemId)}
          />
        )}
      </button>
    );
  }

  function renderFlowRateToken(item: {
    itemId: string;
    itemName: string;
    iconKey?: string;
    ratePerMin: number;
  }) {
    return (
      <Box
        key={`${item.itemId}:${item.ratePerMin}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          minWidth: 0,
        }}
      >
        <EntityLabelButton
          label={item.itemName}
          iconKey={item.iconKey}
          atlasIds={iconAtlasIds}
          size={18}
          gap={6}
          textStyle={{ fontSize: 13, fontWeight: 600 }}
          buttonStyle={{ display: 'inline-flex', alignItems: 'center' }}
          onClick={() => openItemSliceOverlay(item.itemId)}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}
        >
          {formatRate(item.ratePerMin, locale)}
        </Typography>
      </Box>
    );
  }

  function renderFlowRateSequence(
    items: Array<{
      itemId: string;
      itemName: string;
      iconKey?: string;
      ratePerMin: number;
    }>
  ) {
    if (items.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          {bundle.common.none}
        </Typography>
      );
    }

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {items.map((item, index) => (
          <React.Fragment key={`${item.itemId}:${index}`}>
            {index > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                +
              </Typography>
            ) : null}
            {renderFlowRateToken(item)}
          </React.Fragment>
        ))}
      </Box>
    );
  }

  function renderRecipeIoSequence(
    items: Array<{
      itemId: string;
      itemName: string;
      iconKey?: string;
      ratePerMin: number;
    }>
  ) {
    if (items.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          {bundle.common.none}
        </Typography>
      );
    }

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.75,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {items.map((item, index) => (
          <React.Fragment key={`${item.itemId}:${index}`}>
            {index > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                +
              </Typography>
            ) : null}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              {shouldOmitRecipeAmount(item.ratePerMin) ? null : (
                <Typography
                  variant="caption"
                  sx={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#183359' }}
                >
                  {formatRecipeAmount(item.ratePerMin, locale)}
                </Typography>
              )}
              <EntityIcon
                label={item.itemName}
                iconKey={item.iconKey}
                atlasIds={iconAtlasIds}
                size={20}
              />
            </Box>
          </React.Fragment>
        ))}
      </Box>
    );
  }

  function renderSelectOption(option: { label: string; iconKey?: string }, size = 18) {
    return (
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: size <= 16 ? 13 : 14,
          verticalAlign: 'middle',
        }}
      >
        {option.label}
      </Box>
    );
  }

  const recipePlanNodes = useMemo(() => {
    if (!catalog || !model) {
      return null;
    }

    return model.recipePlans.map(plan => {
      const { visibleInputs, auxiliaryProliferatorInput } = buildRecipeFlowDisplay(catalog, plan);
      const override = recipeStrategyOverrideMap.get(plan.recipeId);
      const buildingChoices = getRecipeBuildingOptions(plan.recipeId);
      const modeChoices = getRecipeModeOptions(plan.recipeId);
      const levelChoices = getRecipeLevelOptions(plan.recipeId);
      const selectedMode = override?.forcedProliferatorMode ?? '';
      const selectedLevel =
        selectedMode === 'none'
          ? ''
          : typeof override?.forcedProliferatorLevel === 'number' &&
              override.forcedProliferatorLevel > 0
            ? String(override.forcedProliferatorLevel)
            : '';
      const levelSelectDisabled =
        levelChoices.length === 0 || selectedMode === '' || selectedMode === 'none';

      return (
        <Card
          key={`${plan.recipeId}:${plan.buildingId}:${plan.proliferatorLabel}`}
          sx={{
            borderRadius: '20px',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 'none',
            backgroundColor: 'rgba(255,255,255,0.68)',
            overflow: 'hidden',
            contentVisibility: 'auto',
            containIntrinsicSize: '152px 480px',
            contain: 'layout paint style',
          }}
        >
          <CardContent
            sx={{
              display: 'grid',
              gap: 1.5,
              p: 2,
              borderRadius: '18px',
              '&:last-child': { pb: 2 },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1.25,
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 1,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ minWidth: 0, flex: '1 1 220px' }}
                >
                  <EntityLabel
                    label={plan.recipeName}
                    iconKey={plan.recipeIconKey}
                    atlasIds={iconAtlasIds}
                    size={20}
                    gap={8}
                    textStyle={{ fontWeight: 700 }}
                  />
                </Typography>
                <Stack
                  direction="row"
                  useFlexGap
                  flexWrap="wrap"
                  gap={0.75}
                  sx={{
                    color: 'text.secondary',
                    justifyContent: { xs: 'flex-start', md: 'flex-end' },
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                    <EntityLabel
                      label={`${bundle.summary.buildingsLabel} ${plan.buildingName} X ${plan.exactBuildingCount.toFixed(2)}`}
                      iconKey={plan.buildingIconKey}
                      atlasIds={iconAtlasIds}
                      size={16}
                    />
                  </Typography>
                  <Typography variant="caption">{plan.proliferatorLabel}</Typography>
                  <Typography variant="caption">
                    {bundle.overview.requestLabel} {formatRate(plan.runsPerMin, locale)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {bundle.recipePlans.powerLabel} {formatPower(plan.activePowerMW, locale)}
                  </Typography>
                </Stack>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  建筑
                </Typography>
                <Select
                  size="small"
                  displayEmpty
                  value={override?.forcedBuildingId ?? ''}
                  onChange={event =>
                    applyRecipeStrategyPatch(plan.recipeId, {
                      forcedBuildingId: String(event.target.value),
                    })
                  }
                  sx={{
                    ...compactSelectFieldSx,
                    minWidth: 128,
                    '& .MuiSelect-select': {
                      py: 0.75,
                      pr: '28px !important',
                      fontSize: 13,
                    },
                  }}
                  renderValue={selected =>
                    selected
                      ? renderSelectOption(
                          {
                            label:
                              buildingChoices.find(building => building.buildingId === selected)?.name ??
                              String(selected),
                            iconKey: buildingChoices.find(building => building.buildingId === selected)
                              ?.icon,
                          },
                          16
                        )
                      : bundle.common.auto
                  }
                >
                  <MenuItem value="">{bundle.common.auto}</MenuItem>
                  {buildingChoices.map(building => (
                    <MenuItem key={building.buildingId} value={building.buildingId}>
                      {renderSelectOption({ label: building.name, iconKey: building.icon }, 16)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  增产
                </Typography>
                <Select
                  size="small"
                  displayEmpty
                  value={selectedMode}
                  onChange={event => {
                    const nextMode = event.target.value as '' | ProliferatorMode;
                    applyRecipeStrategyPatch(plan.recipeId, {
                      forcedProliferatorMode: nextMode,
                      forcedProliferatorLevel:
                        nextMode === 'none'
                          ? 0
                          : nextMode
                            ? typeof override?.forcedProliferatorLevel === 'number' &&
                                override.forcedProliferatorLevel > 0
                              ? override.forcedProliferatorLevel
                              : ''
                            : '',
                    });
                  }}
                  sx={{
                    ...compactSelectFieldSx,
                    minWidth: 118,
                    '& .MuiSelect-select': {
                      py: 0.75,
                      pr: '28px !important',
                      fontSize: 13,
                    },
                  }}
                  renderValue={selected =>
                    selected
                      ? formatProliferatorMode(selected as ProliferatorMode, locale)
                      : bundle.common.auto
                  }
                >
                  <MenuItem value="">{bundle.common.auto}</MenuItem>
                  {modeChoices.map(mode => (
                    <MenuItem key={mode} value={mode}>
                      {formatProliferatorMode(mode, locale)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  等级
                </Typography>
                <Select
                  size="small"
                  displayEmpty
                  value={selectedLevel}
                  disabled={levelSelectDisabled}
                  onChange={event =>
                    applyRecipeStrategyPatch(plan.recipeId, {
                      forcedProliferatorLevel: event.target.value
                        ? Number(event.target.value)
                        : '',
                    })
                  }
                  sx={{
                    ...compactSelectFieldSx,
                    minWidth: 88,
                    '& .MuiSelect-select': {
                      py: 0.75,
                      pr: '28px !important',
                      fontSize: 13,
                    },
                  }}
                  renderValue={selected =>
                    selected
                      ? `${bundle.solveRequest.levelPrefix} ${selected}`
                      : bundle.common.auto
                  }
                >
                  <MenuItem value="">{bundle.common.auto}</MenuItem>
                  {levelChoices.map(level => (
                    <MenuItem key={level} value={String(level)}>
                      {`${bundle.solveRequest.levelPrefix} ${level}`}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
                borderRadius: '16px',
                px: 1.25,
                py: 1,
                backgroundColor: 'rgba(22, 54, 89, 0.035)',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                  flex: '1 1 260px',
                  minWidth: 0,
                }}
              >
                {renderFlowRateSequence(visibleInputs)}
              </Box>
              <EastRoundedIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                  flex: '1 1 220px',
                  minWidth: 0,
                }}
              >
                {renderFlowRateSequence(plan.outputs)}
                {auxiliaryProliferatorInput ? (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      whiteSpace: 'nowrap',
                      color: 'text.secondary',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span>（</span>
                    <EntityLabelButton
                      label={auxiliaryProliferatorInput.itemName}
                      iconKey={auxiliaryProliferatorInput.iconKey}
                      atlasIds={iconAtlasIds}
                      size={16}
                      gap={6}
                      textStyle={{ fontSize: 12, fontWeight: 600 }}
                      buttonStyle={{
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      onClick={() => openItemSliceOverlay(auxiliaryProliferatorInput.itemId)}
                    />
                    <span>{formatRate(auxiliaryProliferatorInput.ratePerMin, locale)}）</span>
                  </Box>
                ) : null}
              </Box>
            </Box>
          </CardContent>
        </Card>
      );
    });
  }, [
    applyRecipeStrategyPatch,
    bundle.common.auto,
    bundle.overview.requestLabel,
    bundle.recipePlans.powerLabel,
    bundle.solveRequest.levelPrefix,
    bundle.summary.buildingsLabel,
    catalog,
    iconAtlasIds,
    locale,
    model,
    recipeStrategyOverrideMap,
  ]);

  const itemLedgerSectionNodes = useMemo(() => {
    if (!model) {
      return null;
    }

    return model.itemLedgerSections.map(section => (
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
                  contentVisibility: 'auto',
                  containIntrinsicSize: '56px 280px',
                  contain: 'layout paint style',
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
                      onClick={() => openItemSliceOverlay(entry.itemId)}
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
    ));
  }, [bundle.diagnostics.consumedLabel, bundle.diagnostics.netLabel, bundle.diagnostics.producedLabel, bundle.itemLedger.markRawButton, bundle.itemLedger.noItems, bundle.itemLedger.rawBadge, bundle.itemLedger.surplusBadge, bundle.itemLedger.targetBadge, bundle.itemLedger.unmarkRawButton, iconAtlasIds, locale, markItemAsRawInput, model, unmarkItemAsRawInput]);

  const isCustomPreset = presetId === 'custom';

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(244, 194, 102, 0.24), transparent 35%), linear-gradient(135deg, #f5efe2 0%, #dce7ef 48%, #f7f8fb 100%)',
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1560, py: 3, display: 'grid', gap: 3 }}>
        <Box sx={{ px: 0.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            DSP 产线求解工作台
          </Typography>
        </Box>
        <section style={{ display: 'grid', gap: 20 }}>
          <Paper
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: '24px',
              display: 'grid',
              gap: 2.5,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: { xs: '1fr' },
                alignItems: 'start',
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    lg: 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)',
                  },
                  alignItems: 'start',
                }}
              >
            <article style={{ ...cardStyle, display: 'grid', gap: 10 }}>
              <Typography variant="h6">{bundle.datasetSource.title}</Typography>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'grid', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {bundle.summary.datasetLabel}
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    sx={compactSelectFieldSx}
                    value={presetId}
                    onChange={event => onPresetChange(event.target.value as DatasetPresetId)}
                    inputProps={{ 'aria-label': bundle.summary.datasetLabel }}
                  >
                    {DATASET_PRESETS.map(preset => (
                      <MenuItem key={preset.id} value={preset.id}>
                        {getDatasetPresetText(preset.id, locale).label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void loadCatalog(datasetPath, defaultConfigPath, catalogLabel, presetId)}
                  disabled={isLoading}
                  sx={{ minHeight: 40, px: 1.75 }}
                >
                  {isLoading ? bundle.datasetSource.loadingButton : bundle.datasetSource.loadButton}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={clearCachedWorkbenchState}
                  sx={{ minHeight: 40, px: 1.75 }}
                >
                  {bundle.datasetSource.clearCacheButton}
                </Button>
                </Stack>
              </Box>

              {isCustomPreset ? (
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    label={bundle.summary.datasetPathLabel}
                    value={datasetPath}
                    onChange={event => {
                      setPresetId('custom');
                      setCatalogLabel(getDatasetPresetText('custom', locale).label);
                      setDatasetPath(event.target.value);
                    }}
                    placeholder={bundle.datasetSource.datasetPathPlaceholder}
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label={bundle.summary.defaultsPathLabel}
                    value={defaultConfigPath}
                    onChange={event => {
                      setPresetId('custom');
                      setCatalogLabel(getDatasetPresetText('custom', locale).label);
                      setDefaultConfigPath(event.target.value);
                    }}
                    placeholder={bundle.datasetSource.defaultsPathPlaceholder}
                  />
                </Box>
              ) : (
                <Stack spacing={0.35}>
                  <Typography variant="caption" color="text.secondary">
                    {bundle.summary.datasetPathLabel}: {datasetPath || bundle.common.notSet}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {bundle.summary.defaultsPathLabel}: {defaultConfigPath || bundle.common.none}
                  </Typography>
                </Stack>
              )}

              <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                {model ? (
                  <>
                    <Chip
                      size="small"
                      label={`${bundle.summary.datasetLabel} ${
                        model.catalogSummary.datasetLabel ?? bundle.common.custom
                      }`}
                    />
                    <Chip size="small" label={`${bundle.summary.itemsLabel} ${model.catalogSummary.itemCount}`} />
                    <Chip size="small" label={`${bundle.summary.recipesLabel} ${model.catalogSummary.recipeCount}`} />
                    <Chip size="small" label={`${bundle.summary.buildingsLabel} ${model.catalogSummary.buildingCount}`} />
                  </>
                ) : (
                  <Chip size="small" label={bundle.summary.loadDatasetToStart} />
                )}
              </Stack>
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
            </article>

            <article style={{ ...cardStyle, display: 'grid', gap: 14 }}>
              <Typography variant="h6">{bundle.solveRequest.title}</Typography>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Typography variant="body2" color="text.secondary">
                    {bundle.solveRequest.editTargetsHint}
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.25,
                      p: 1.75,
                      borderRadius: '16px',
                      border: '1px dashed',
                      borderColor: 'divider',
                      backgroundColor: 'rgba(22, 54, 89, 0.03)',
                    }}
                  >
                    <Typography variant="subtitle2">{bundle.solveRequest.addTargetTitle}</Typography>

                    <ItemGridPicker
                      items={itemOptions}
                      selectedItemId={targetDraftItemId}
                      query={targetPickerQuery}
                      onQueryChange={setTargetPickerQuery}
                      onSelect={setTargetDraftItemId}
                      atlasIds={iconAtlasIds}
                      searchLabel={bundle.solveRequest.targetSearchLabel}
                      searchPlaceholder={bundle.solveRequest.targetSearchPlaceholder}
                      emptyText={bundle.solveRequest.targetPickerEmpty}
                    />

                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1,
                        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 104px auto' },
                        alignItems: 'center',
                      }}
                    >
                      <Box
                        sx={{
                          minHeight: 40,
                          px: 1.25,
                          borderRadius: '12px',
                          border: '1px solid rgba(24, 51, 89, 0.12)',
                          backgroundColor: 'rgba(255,255,255,0.86)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {targetDraftItemOption ? (
                          <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                            <Typography variant="caption" color="text.secondary">
                              {bundle.solveRequest.selectedTargetLabel}
                            </Typography>
                            <EntityLabel
                              label={targetDraftItemOption.name}
                              iconKey={targetDraftItemOption.icon}
                              atlasIds={iconAtlasIds}
                              size={18}
                            />
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {bundle.common.notSet}
                          </Typography>
                        )}
                      </Box>

                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        label={bundle.overview.requestLabel}
                        value={targetDraftRatePerMin}
                        inputProps={{ min: 0, step: 1 }}
                        onChange={event =>
                          setTargetDraftRatePerMin(Number(event.target.value) || 0)
                        }
                      />

                      <Button
                        variant="contained"
                        size="small"
                        onClick={() =>
                          addTarget({
                            itemId: targetDraftItemId,
                            ratePerMin: targetDraftRatePerMin,
                          })
                        }
                        disabled={!catalog || !targetDraftItemId}
                        sx={{ minHeight: 40, px: 1.5 }}
                      >
                        {bundle.solveRequest.addTarget}
                      </Button>
                    </Box>
                  </Box>
                </div>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(150px, 188px))' },
                  }}
                >
                  <TextField
                    select
                    size="small"
                    sx={compactSelectFieldSx}
                    label={bundle.summary.objectiveLabel}
                    value={objective}
                    onChange={event => setObjective(event.target.value as SolveObjective)}
                  >
                    <MenuItem value="min_buildings">{bundle.solveRequest.objectiveOptions.min_buildings}</MenuItem>
                    <MenuItem value="min_power">{bundle.solveRequest.objectiveOptions.min_power}</MenuItem>
                    <MenuItem value="min_external_input">{bundle.solveRequest.objectiveOptions.min_external_input}</MenuItem>
                  </TextField>

                  <TextField
                    select
                    size="small"
                    sx={compactSelectFieldSx}
                    label={bundle.summary.balanceLabel}
                    value={balancePolicy}
                    onChange={event => setBalancePolicy(event.target.value as BalancePolicy)}
                  >
                    <MenuItem value="force_balance">{bundle.solveRequest.balancePolicyOptions.force_balance}</MenuItem>
                    <MenuItem value="allow_surplus">{bundle.solveRequest.balancePolicyOptions.allow_surplus}</MenuItem>
                  </TextField>

                  <TextField
                    select
                    size="small"
                    sx={compactSelectFieldSx}
                    label={bundle.summary.sprayLabel}
                    value={proliferatorPolicy}
                    onChange={event => {
                      const nextPolicy = event.target.value as WorkbenchProliferatorPolicy;
                      setProliferatorPolicy(nextPolicy);
                      setGlobalProliferatorLevel(current =>
                        nextPolicy === 'auto' || nextPolicy === 'none'
                          ? ''
                          : typeof current === 'number' && current > 0
                            ? current
                            : pickDefaultGlobalProliferatorLevel(catalog)
                      );
                    }}
                  >
                    <MenuItem value="auto">{bundle.solveRequest.proliferatorPolicyOptions.auto}</MenuItem>
                    <MenuItem value="none">{bundle.solveRequest.proliferatorPolicyOptions.none}</MenuItem>
                    <MenuItem value="speed">{bundle.solveRequest.proliferatorPolicyOptions.speed}</MenuItem>
                    <MenuItem value="productivity">{bundle.solveRequest.proliferatorPolicyOptions.productivity}</MenuItem>
                  </TextField>

                  <TextField
                    select
                    size="small"
                    sx={compactSelectFieldSx}
                    label={bundle.solveRequest.preferredSprayLevelLabel}
                    value={globalProliferatorLevel === '' ? '' : String(globalProliferatorLevel)}
                    disabled={globalProliferatorLevelDisabled}
                    onChange={event =>
                      setGlobalProliferatorLevel(
                        event.target.value ? Number(event.target.value) : ''
                      )
                    }
                  >
                    <MenuItem value="">{bundle.common.auto}</MenuItem>
                    {globalProliferatorLevelOptions.map(level => (
                      <MenuItem key={level} value={String(level)}>
                        {`${bundle.solveRequest.levelPrefix} ${level}`}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={autoPromoteUnavailableItemsToRawInputs}
                      onChange={event =>
                        setAutoPromoteUnavailableItemsToRawInputs(event.target.checked)
                      }
                    />
                  }
                  label={bundle.solveRequest.autoPromoteUnavailableItemsLabel}
                />

                <details style={collapsibleSectionStyle}>
                  <summary style={summaryStyle}>{bundle.solveRequest.disabledRecipesLabel}</summary>
                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1,
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 240px) auto' },
                        alignItems: 'start',
                      }}
                    >
                      <TextField
                        select
                        fullWidth
                        size="small"
                        sx={compactSelectFieldSx}
                        label={bundle.solveRequest.disabledRecipesLabel}
                        value={disabledRecipeDraftId}
                        onChange={event => setDisabledRecipeDraftId(event.target.value)}
                        disabled={!catalog || disableRecipeOptions.length === 0}
                      >
                        {disableRecipeOptions.map(recipe => (
                          <MenuItem key={recipe.recipeId} value={recipe.recipeId}>
                            {renderSelectOption({ label: recipe.name, iconKey: recipe.icon }, 18)}
                          </MenuItem>
                        ))}
                      </TextField>

                      <Button
                        variant="outlined"
                        size="small"
                        onClick={addDisabledRecipe}
                        disabled={!disabledRecipeDraftId}
                        sx={{ minHeight: 40, px: 1.5 }}
                      >
                        {bundle.solveRequest.disableButton}
                      </Button>
                    </Box>

                    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                      {disabledRecipeIds.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">{bundle.solveRequest.noDisabledRecipes}</Typography>
                      ) : (
                        disabledRecipeIds.map(recipeId => (
                          <Chip
                            key={recipeId}
                            label={(catalog?.recipeMap.get(recipeId)?.name ?? recipeId) + ` ${bundle.common.removeSuffix}`}
                            onDelete={() => removeDisabledRecipe(recipeId)}
                          />
                        ))
                      )}
                    </Stack>
                  </div>
                </details>

                <details style={collapsibleSectionStyle}>
                  <summary style={summaryStyle}>{bundle.solveRequest.disabledBuildingsLabel}</summary>
                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1,
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 240px) auto' },
                        alignItems: 'start',
                      }}
                    >
                      <TextField
                        select
                        fullWidth
                        size="small"
                        sx={compactSelectFieldSx}
                        label={bundle.solveRequest.disabledBuildingsLabel}
                        value={disabledBuildingDraftId}
                        onChange={event => setDisabledBuildingDraftId(event.target.value)}
                        disabled={!catalog || disableBuildingOptions.length === 0}
                      >
                        {disableBuildingOptions.map(building => (
                          <MenuItem key={building.buildingId} value={building.buildingId}>
                            {renderSelectOption({ label: building.name, iconKey: building.icon }, 18)}
                          </MenuItem>
                        ))}
                      </TextField>

                      <Button
                        variant="outlined"
                        size="small"
                        onClick={addDisabledBuilding}
                        disabled={!disabledBuildingDraftId}
                        sx={{ minHeight: 40, px: 1.5 }}
                      >
                        {bundle.solveRequest.disableButton}
                      </Button>
                    </Box>

                    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                      {disabledBuildingIds.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">{bundle.solveRequest.noDisabledBuildings}</Typography>
                      ) : (
                        disabledBuildingIds.map(buildingId => (
                          <Chip
                            key={buildingId}
                            label={
                              (catalog?.buildingMap.get(buildingId)?.name ?? buildingId) +
                              ` ${bundle.common.removeSuffix}`
                            }
                            onDelete={() => removeDisabledBuilding(buildingId)}
                          />
                        ))
                      )}
                    </Stack>
                  </div>
                </details>

                <details style={collapsibleSectionStyle}>
                  <summary style={summaryStyle}>{bundle.solveRequest.recipePreferencesLabel}</summary>
                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1,
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 240px) auto' },
                        alignItems: 'start',
                      }}
                    >
                      <TextField
                        select
                        fullWidth
                        size="small"
                        sx={compactSelectFieldSx}
                        label={bundle.solveRequest.recipePreferencesLabel}
                        value={recipePreferenceDraftId}
                        onChange={event => setRecipePreferenceDraftId(event.target.value)}
                        disabled={!catalog || recipePreferenceOptions.length === 0}
                      >
                        {recipePreferenceOptions.map(recipe => (
                          <MenuItem key={recipe.recipeId} value={recipe.recipeId}>
                            {renderSelectOption({ label: recipe.name, iconKey: recipe.icon }, 18)}
                          </MenuItem>
                        ))}
                      </TextField>

                      <Button
                        variant="outlined"
                        size="small"
                        onClick={addRecipePreference}
                        disabled={!recipePreferenceDraftId}
                        sx={{ minHeight: 40, px: 1.5 }}
                      >
                        {bundle.solveRequest.addPreference}
                      </Button>
                    </Box>

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
                            proliferatorPolicy === 'none' ||
                            levelChoices.length === 0 ||
                            preference.preferredProliferatorMode === 'none';

                          return (
                            <div
                              key={preference.recipeId}
                              style={{
                                borderRadius: 14,
                                border: '1px solid rgba(24, 51, 89, 0.12)',
                                background: 'rgba(255,255,255,0.6)',
                                padding: 12,
                                display: 'grid',
                                gap: 10,
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: 1.5,
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Typography fontWeight={700}>{recipe?.name ?? preference.recipeId}</Typography>
                                <Button
                                  variant="outlined"
                                  color="inherit"
                                  size="small"
                                  onClick={() => removeRecipePreference(preference.recipeId)}
                                >
                                  {bundle.solveRequest.removeTarget}
                                </Button>
                              </Box>

                              <Box
                                sx={{
                                  display: 'grid',
                                  gap: 1,
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                }}
                              >
                                <Box sx={{ display: 'grid', gap: 0.75 }}>
                                  <Typography variant="overline" color="text.secondary">
                                    {bundle.solveRequest.preferredBuildingLabel}
                                  </Typography>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    sx={compactSelectFieldSx}
                                    value={preference.preferredBuildingId}
                                    onChange={event =>
                                      updateRecipePreference(preference.recipeId, {
                                        preferredBuildingId: event.target.value,
                                      })
                                    }
                                  >
                                    <MenuItem value="">{bundle.common.auto}</MenuItem>
                                    {buildingChoices.map(building => (
                                      <MenuItem key={building.buildingId} value={building.buildingId}>
                                        {renderSelectOption({ label: building.name, iconKey: building.icon }, 18)}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                </Box>

                                <Box sx={{ display: 'grid', gap: 0.75 }}>
                                  <Typography variant="overline" color="text.secondary">
                                    {bundle.solveRequest.preferredSprayModeLabel}
                                  </Typography>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    sx={compactSelectFieldSx}
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
                                    disabled={proliferatorPolicy === 'none'}
                                  >
                                    <MenuItem value="">{bundle.common.auto}</MenuItem>
                                    {modeChoices.map(mode => (
                                      <MenuItem key={mode} value={mode}>
                                        {formatProliferatorMode(mode, locale)}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                </Box>

                                <Box sx={{ display: 'grid', gap: 0.75 }}>
                                  <Typography variant="overline" color="text.secondary">
                                    {bundle.solveRequest.preferredSprayLevelLabel}
                                  </Typography>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    sx={compactSelectFieldSx}
                                    value={preference.preferredProliferatorLevel === '' ? '' : String(preference.preferredProliferatorLevel)}
                                    onChange={event =>
                                      updateRecipePreference(preference.recipeId, {
                                        preferredProliferatorLevel: event.target.value
                                          ? Number(event.target.value)
                                          : '',
                                      })
                                    }
                                    disabled={levelSelectDisabled}
                                  >
                                    <MenuItem value="">{bundle.common.auto}</MenuItem>
                                    {levelChoices.map(level => (
                                      <MenuItem key={level} value={String(level)}>
                                        {`${bundle.solveRequest.levelPrefix} ${level}`}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                </Box>
                              </Box>
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

              </div>
            </article>
            <article style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <Typography variant="h6">{bundle.summary.solveSnapshotTitle}</Typography>
              {solveError && hasTargets ? <Alert severity="error">{solveError}</Alert> : null}
              {requestSummary ? (
                <>
                  <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                    {requestSummary.solverVersion ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${bundle.summary.solverVersionLabel}: ${requestSummary.solverVersion}`}
                      />
                    ) : null}
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${bundle.summary.objectiveLabel}: ${formatSolveObjective(
                        objective,
                        locale
                      )}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${bundle.summary.balanceLabel}: ${formatBalancePolicy(
                        balancePolicy,
                        locale
                      )}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${bundle.summary.sprayLabel}: ${
                        requestSummary.proliferatorPolicyLabel ?? bundle.common.notSet
                      }`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      color={model?.status === 'optimal' ? 'success' : 'default'}
                      label={`${bundle.summary.statusLabel}: ${formatSolveStatus(
                        model?.status ?? null,
                        locale
                      )}`}
                    />
                  </Stack>

                  <Divider />

                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                      {bundle.summary.targetsLabel}
                    </Typography>
                    {requestSummary.targets.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {bundle.common.none}
                      </Typography>
                    ) : (
                      requestSummary.targets.map((target, index) => (
                        <Box
                          key={`${target.itemId}:${index}`}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 84px auto',
                            gap: 0.75,
                            alignItems: 'center',
                            justifyContent: 'start',
                          }}
                        >
                          <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center' }}>
                            {renderClickableItemLabel(target, { iconOnly: true, iconSize: 22 })}
                          </Box>
                          <TextField
                            type="number"
                            size="small"
                            fullWidth
                            label={bundle.overview.requestLabel}
                            sx={{
                              '& .MuiInputBase-input': { px: 1, py: 0.75, fontSize: 13 },
                              '& .MuiInputLabel-root': { fontSize: 12 },
                            }}
                            value={targets[index]?.ratePerMin ?? target.ratePerMin}
                            inputProps={{ min: 0, step: 1 }}
                            onChange={event =>
                              updateTarget(index, {
                                ratePerMin: Number(event.target.value) || 0,
                              })
                            }
                          />
                          <Tooltip title={bundle.solveRequest.removeTarget}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => removeTarget(index)}
                                disabled={!catalog}
                                sx={{
                                  border: '1px solid rgba(24, 51, 89, 0.12)',
                                  borderRadius: '10px',
                                }}
                              >
                                <CloseRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      ))
                    )}
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                      {bundle.summary.forcedRecipesLabel}
                    </Typography>
                    {requestSummary.forcedRecipeSettings.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {bundle.common.none}
                      </Typography>
                    ) : (
                      requestSummary.forcedRecipeSettings.map(setting => (
                        <Box
                          key={`${setting.itemId}:${setting.recipeId}`}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            gap: 0.75,
                            alignItems: 'center',
                          }}
                        >
                          <Box
                            sx={{
                              minWidth: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              flexWrap: 'nowrap',
                              overflowX: 'auto',
                              overflowY: 'hidden',
                              px: 0.25,
                              py: 0.4,
                              minHeight: 0,
                            }}
                          >
                            <Box
                              sx={{
                                display: 'inline-grid',
                                gridTemplateColumns: 'auto auto auto',
                                alignItems: 'center',
                                gap: 0.5,
                                minWidth: 0,
                                flex: '0 0 auto',
                              }}
                            >
                              <Box
                                sx={{
                                  minWidth: 0,
                                  display: 'flex',
                                  justifyContent: 'flex-end',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {renderRecipeIoSequence(setting.inputs)}
                              </Box>
                              <Box
                                sx={{
                                  position: 'relative',
                                  display: 'inline-grid',
                                  gridTemplateRows: '10px 10px',
                                  justifyItems: 'center',
                                  alignItems: 'center',
                                  minWidth: 28,
                                  flex: '0 0 auto',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    whiteSpace: 'nowrap',
                                    fontWeight: 700,
                                    color: '#183359',
                                    letterSpacing: '0.02em',
                                    fontSize: 10,
                                    lineHeight: 1,
                                  }}
                                >
                                  {`${formatRecipeCycleTime(setting.cycleTimeSec, locale)} s`}
                                </Typography>
                                <Box
                                  sx={{
                                    position: 'relative',
                                    width: '100%',
                                    minWidth: 24,
                                    height: 2,
                                    borderRadius: '999px',
                                    background:
                                      'linear-gradient(90deg, rgba(24, 51, 89, 0.22) 0%, rgba(24, 51, 89, 0.75) 100%)',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      right: -1,
                                      top: '50%',
                                      width: 8,
                                      height: 8,
                                      borderTop: '2px solid #183359',
                                      borderRight: '2px solid #183359',
                                      transform: 'translateY(-50%) rotate(45deg)',
                                    }}
                                  />
                                </Box>
                              </Box>
                              <Box
                                sx={{
                                  minWidth: 0,
                                  display: 'flex',
                                  justifyContent: 'flex-start',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {renderRecipeIoSequence(setting.outputs)}
                              </Box>
                            </Box>
                          </Box>
                          <Tooltip title={bundle.summary.clearForcedRecipeButton}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => clearForcedRecipeForItem(setting.itemId)}
                                disabled={!catalog}
                                sx={{
                                  border: '1px solid rgba(24, 51, 89, 0.12)',
                                  borderRadius: '10px',
                                }}
                              >
                                <CloseRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      ))
                    )}
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                      {bundle.summary.recipePreferencesLabel}
                    </Typography>
                    {requestSummary.preferredRecipeSettings.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {bundle.common.none}
                      </Typography>
                    ) : (
                      requestSummary.preferredRecipeSettings.map(setting => (
                        <Typography key={setting.recipeId} variant="body2">
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
                        </Typography>
                      ))
                    )}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {bundle.summary.loadDatasetToStart}
                </Typography>
              )}
            </article>
              </Box>
            </Box>
          </Paper>

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
                  <div style={{ ...resultMainColumnStyle, gridColumn: '1', gridRow: '1 / span 2' }}>
                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>{bundle.overview.summaryTitle}</h2>
                      <div
                        style={{
                          display: 'grid',
                          gap: 16,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        }}
                      >
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={sectionHeadingStyle}>{bundle.itemLedger.netInputsTitle}</div>
                          {(model.solvedSummary?.netInputs.length ?? 0) === 0 ? (
                            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              {model.solvedSummary?.netInputs.map(item => (
                                <div
                                  key={item.itemId}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  title={`${item.itemName}: ${formatRate(item.ratePerMin, locale)}`}
                                >
                                  {renderClickableItemLabel(item, { iconOnly: true, iconSize: 18 })}
                                  <span style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.72)', whiteSpace: 'nowrap' }}>
                                    {formatRate(item.ratePerMin, locale)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={sectionHeadingStyle}>{bundle.itemLedger.netOutputsTitle}</div>
                          {(model.solvedSummary?.netOutputs.length ?? 0) === 0 ? (
                            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              {model.solvedSummary?.netOutputs.map(item => (
                                <div
                                  key={item.itemId}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  title={`${item.itemName}: ${formatRate(item.ratePerMin, locale)}`}
                                >
                                  {renderClickableItemLabel(item, { iconOnly: true, iconSize: 18 })}
                                  <span style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.72)', whiteSpace: 'nowrap' }}>
                                    {formatRate(item.ratePerMin, locale)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            border: '1px solid rgba(24, 51, 89, 0.10)',
                            borderRadius: 16,
                            padding: 14,
                            display: 'grid',
                            gap: 10,
                            alignContent: 'start',
                            gridColumn: 'span 2',
                          }}
                        >
                          <div style={sectionHeadingStyle}>{bundle.summary.buildingsLabel}</div>
                          {model.buildingSummary.length === 0 ? (
                            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
                          ) : (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {model.buildingSummary.map(summary => (
                                <div
                                  key={summary.buildingId}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                                    gap: 10,
                                    alignItems: 'center',
                                  }}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <EntityLabel
                                      label={summary.buildingName}
                                      iconKey={summary.buildingIconKey}
                                      atlasIds={iconAtlasIds}
                                      size={18}
                                      gap={8}
                                      textStyle={{ fontWeight: 600 }}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      color: 'rgba(24, 51, 89, 0.78)',
                                      whiteSpace: 'nowrap',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {summary.exactCount.toFixed(2)} / {summary.roundedUpCount}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.62)' }}>
                            {bundle.recipePlans.exactLabel} / {bundle.overview.roundedLabel}
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
                      <h2 style={{ marginTop: 0 }}>{bundle.diagnostics.title}</h2>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {fallbackModel && fallbackSolve?.reason === 'force_balance_infeasible' ? (
                          <Alert
                            severity="warning"
                            action={
                              <Button color="inherit" size="small" onClick={applyAllowSurplusFallback}>
                                {bundle.diagnostics.fallbackApplyButton}
                              </Button>
                            }
                          >
                            <div style={{ display: 'grid', gap: 8 }}>
                              <div style={{ fontWeight: 700 }}>
                                {bundle.diagnostics.fallbackTitle}
                              </div>
                              <div>{bundle.diagnostics.fallbackDescription}</div>
                              {fallbackModel.solvedSummary?.netInputs.length ? (
                                <div>
                                  <strong>{bundle.diagnostics.fallbackNetInputsLabel}</strong>{' '}
                                  {renderFlowRateSequence(fallbackModel.solvedSummary.netInputs)}
                                </div>
                              ) : null}
                              {fallbackModel.surplusOutputs.length ? (
                                <div>
                                  <strong>{bundle.diagnostics.fallbackSurplusLabel}</strong>{' '}
                                  {renderFlowRateSequence(fallbackModel.surplusOutputs)}
                                </div>
                              ) : null}
                            </div>
                          </Alert>
                        ) : null}
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

                  <div style={{ gridColumn: '2', gridRow: '1 / span 2' }}>
                    <article style={{ ...cardStyle, width: '100%', maxWidth: 'none', justifySelf: 'stretch' }}>
                      <h2 style={{ marginTop: 0 }}>{bundle.recipePlans.title}</h2>
                      <div style={{ display: 'grid', gap: 12 }}>{recipePlanNodes}</div>
                    </article>
                  </div>

                    <aside style={{ ...resultSideColumnStyle, gridColumn: '3', gridRow: '1 / span 2' }}>
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
                        <Stack spacing={1}>
                          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                            {model.itemLedgerSections.map(section => (
                              <Button
                                key={`jump-${section.key}`}
                                onClick={() => scrollItemLedgerToSection(section.key)}
                                variant="outlined"
                                size="small"
                                color="inherit"
                              >
                                {section.title}
                              </Button>
                            ))}
                          </Stack>
                          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                            <Button onClick={scrollItemLedgerToTop} variant="outlined" size="small" color="inherit">
                              {bundle.itemLedger.jumpToTopButton}
                            </Button>
                            <Button onClick={scrollItemLedgerToBottom} variant="outlined" size="small" color="inherit">
                              {bundle.itemLedger.jumpToBottomButton}
                            </Button>
                          </Stack>
                        </Stack>
                        <div
                          ref={itemLedgerScrollRef}
                          style={{
                            display: 'grid',
                            gap: 16,
                            overflow: 'auto',
                            minHeight: 0,
                            paddingRight: 4,
                            paddingBottom: 24,
                            scrollPaddingBottom: 24,
                          }}
                        >
                          {itemLedgerSectionNodes}
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
      <ItemSliceOverlayHost
        locale={locale}
        atlasIds={iconAtlasIds}
        itemSlicesById={model?.itemSlicesById ?? {}}
        forcedRecipeByItem={forcedRecipeByItem}
        forcedRecipeOptionsByItem={preferredRecipeOptionsByItem}
        onMarkRaw={markItemAsRawInput}
        onUnmarkRaw={unmarkItemAsRawInput}
        onPreferredRecipeChange={updateForcedRecipeForItem}
        onClearPreferredRecipe={clearForcedRecipeForItem}
        onLocateInLedger={locateItemInLedger}
      />
      <Snackbar
        open={Boolean(recipeStrategyWarning)}
        autoHideDuration={3600}
        onClose={() => setRecipeStrategyWarning('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          variant="filled"
          onClose={() => setRecipeStrategyWarning('')}
          sx={{ width: '100%' }}
        >
          {recipeStrategyWarning}
        </Alert>
      </Snackbar>
      </Container>
    </Box>
  );
}
