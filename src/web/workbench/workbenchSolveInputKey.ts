import type { AppLocale } from '../../i18n';
import {
  buildWorkbenchSolveInputKey,
  findReusableWorkbenchSolveInputKey,
  preserveReusableSettledWorkbenchSolveState,
  persistWorkbenchSolveState,
} from './autoSolve';
import type { WorkbenchEditorState, WorkbenchPersistedConfig } from './persistence';

export function waitForNextPaint(): Promise<void> {
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

export function buildWorkbenchCatalogSolveSignature(
  datasetText: string,
  defaultConfigText: string
): string {
  return `${hashWorkbenchText(datasetText)}:${hashWorkbenchText(defaultConfigText)}`;
}

export function findReusableSolveInputKeyForConfig(params: {
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

export function buildExpectedSolveInputKeyForWorkbenchEditorState(params: {
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

export function backfillWorkbenchConfigSolveInputKeys(params: {
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

export function resolvePersistedWorkbenchConfigSolveState(params: {
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

export function mergePersistedSolveStateInputKey(
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
