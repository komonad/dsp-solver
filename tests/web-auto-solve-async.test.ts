import { resolveCatalogModel, type CatalogDefaultConfigSpec, type VanillaDatasetSpec } from '../src/catalog';
import { solveCatalogRequest } from '../src/solver';
import {
  buildWorkbenchSolveInputKey,
  buildRunningWorkbenchSolveState,
  computeWorkbenchSolveAsync,
  findReusableWorkbenchSolveInputKey,
  preserveReusableSettledWorkbenchSolveState,
  persistWorkbenchSolveState,
  restoreWorkbenchSolveState,
} from '../src/web/workbench/autoSolve';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };
}

function buildDemoDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Byproduct', IconName: 'byproduct', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Smelter',
        IconName: 'smelter',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Plate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'plate',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Plate with Byproduct',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1201],
        ResultCounts: [1, 1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'byproduct',
      },
    ],
  };
}

test('computeWorkbenchSolveAsync builds the same request and result shape as the sync path', async () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDefaults());

  const result = await computeWorkbenchSolveAsync(
    {
      catalog,
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      proliferatorPolicy: 'auto',
      autoPromoteUnavailableItemsToRawInputs: false,
      rawInputItemIds: [],
      disabledRecipeIds: [],
      disabledBuildingIds: [],
      allowedRecipesByItem: { '1101': ['1'] },
      recipePreferences: [],
      recipeStrategyOverrides: [],
      preferredBuildings: [],
      advancedOverridesText: '',
    },
    async (solveCatalog, request) => solveCatalogRequest(solveCatalog, request)
  );

  expect(result.error).toBe('');
  expect(result.request?.allowedRecipesByItem).toEqual({ '1101': ['1'] });
  expect(result.result?.status).toBe('optimal');
  expect(result.result?.recipePlans[0].recipeId).toBe('1');
});

test('computeWorkbenchSolveAsync preserves the allow_surplus fallback behavior', async () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDefaults());
  let solveCount = 0;

  const result = await computeWorkbenchSolveAsync(
    {
      catalog,
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      proliferatorPolicy: 'auto',
      autoPromoteUnavailableItemsToRawInputs: false,
      rawInputItemIds: [],
      disabledRecipeIds: ['1'],
      disabledBuildingIds: [],
      allowedRecipesByItem: {},
      recipePreferences: [],
      recipeStrategyOverrides: [],
      preferredBuildings: [],
      advancedOverridesText: '',
    },
    async (solveCatalog, request) => {
      solveCount += 1;
      return solveCatalogRequest(solveCatalog, request);
    }
  );

  expect(solveCount).toBe(2);
  expect(result.error).toBe('');
  expect(result.request?.balancePolicy).toBe('allow_surplus');
  expect(result.result?.surplusOutputs).toEqual([{ itemId: '1201', ratePerMin: 60 }]);
});

test('computeWorkbenchSolveAsync keeps the strict infeasible result when the relaxed retry throws', async () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDefaults());

  const result = await computeWorkbenchSolveAsync(
    {
      catalog,
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      proliferatorPolicy: 'auto',
      autoPromoteUnavailableItemsToRawInputs: false,
      rawInputItemIds: [],
      disabledRecipeIds: ['1'],
      disabledBuildingIds: [],
      allowedRecipesByItem: {},
      recipePreferences: [],
      recipeStrategyOverrides: [],
      preferredBuildings: [],
      advancedOverridesText: '',
    },
    async (solveCatalog, request) => {
      if (request.balancePolicy === 'allow_surplus') {
        throw new Error('relaxed fallback exploded');
      }
      return solveCatalogRequest(solveCatalog, request);
    }
  );

  expect(result.error).toBe('');
  expect(result.request?.balancePolicy).toBe('force_balance');
  expect(result.result?.status).toBe('infeasible');
});

test('computeWorkbenchSolveAsync reports the active request before awaiting the solve result', async () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDefaults());
  const progressUpdates: Array<{ stage: string; activeRequest?: { objective: string } }> = [];
  let releaseSolve: (() => void) | undefined;
  const gate = new Promise<void>(resolve => {
    releaseSolve = resolve;
  });

  const solvePromise = computeWorkbenchSolveAsync(
    {
      catalog,
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      proliferatorPolicy: 'auto',
      autoPromoteUnavailableItemsToRawInputs: false,
      rawInputItemIds: [],
      disabledRecipeIds: [],
      disabledBuildingIds: [],
      allowedRecipesByItem: { '1101': ['1'] },
      recipePreferences: [],
      recipeStrategyOverrides: [],
      preferredBuildings: [],
      advancedOverridesText: '',
    },
    async (solveCatalog, request) => {
      await gate;
      return solveCatalogRequest(solveCatalog, request);
    },
    progress => {
      progressUpdates.push(progress as { stage: string; activeRequest?: { objective: string } });
    }
  );

  expect(progressUpdates[0]).toMatchObject({
    stage: 'preparing_request',
    activeRequest: {
      objective: 'min_buildings',
    },
  });

  releaseSolve?.();
  await solvePromise;
});

test('computeWorkbenchSolveAsync treats user cancellation as cancelled instead of exception', async () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDefaults());

  const result = await computeWorkbenchSolveAsync(
    {
      catalog,
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      proliferatorPolicy: 'auto',
      autoPromoteUnavailableItemsToRawInputs: false,
      rawInputItemIds: [],
      disabledRecipeIds: [],
      disabledBuildingIds: [],
      allowedRecipesByItem: {},
      recipePreferences: [],
      recipeStrategyOverrides: [],
      preferredBuildings: [],
      advancedOverridesText: '',
    },
    async () => {
      throw new Error('Solve cancelled by user.');
    }
  );

  expect(result.error).toBe('');
  expect(result.activity.status).toBe('cancelled');
});

test('persistWorkbenchSolveState normalizes in-flight activity before restoring it', () => {
  const runningState = buildRunningWorkbenchSolveState({
    request: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
    },
    activeRequest: undefined,
    result: null,
    error: '',
    fallback: undefined,
    activity: {
      status: 'idle',
      staleResult: false,
      stage: undefined,
    },
  });

  const persisted = persistWorkbenchSolveState(runningState);
  const restored = restoreWorkbenchSolveState(persisted);

  expect(persisted.activityStatus).toBe('settled');
  expect(restored.activity.status).toBe('settled');
  expect(restored.result).toBeNull();
  expect(restored.request).toEqual(runningState.request);
});

test('persistWorkbenchSolveState stores a settled input key and allows reuse checks', () => {
  const inputKey = buildWorkbenchSolveInputKey({
    catalogSignature: 'demo-catalog',
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicy: 'auto',
    autoPromoteUnavailableItemsToRawInputs: false,
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: [],
    allowedRecipesByItem: {},
    preferredBuildings: [],
    recipePreferences: [],
    recipeStrategyOverrides: [],
    advancedOverridesText: '',
    locale: 'zh-CN',
    isLoading: false,
  });
  const settledState = restoreWorkbenchSolveState({
    request: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
    },
    result: null,
    error: 'invalid input',
    activityStatus: 'settled',
  });

  const persisted = persistWorkbenchSolveState(settledState, { inputKey });

  expect(persisted.inputKey).toBe(inputKey);
  expect(
    findReusableWorkbenchSolveInputKey(persisted, {
      catalogSignature: 'demo-catalog',
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      proliferatorPolicy: 'auto',
      autoPromoteUnavailableItemsToRawInputs: false,
      rawInputItemIds: [],
      disabledRawInputItemIds: [],
      disabledRecipeIds: [],
      disabledBuildingIds: [],
      allowedRecipesByItem: {},
      preferredBuildings: [],
      recipePreferences: [],
      recipeStrategyOverrides: [],
      advancedOverridesText: '',
      locale: 'zh-CN',
      isLoading: false,
    })
  ).toBe(inputKey);
  expect(
    findReusableWorkbenchSolveInputKey(persisted, {
      catalogSignature: 'demo-catalog',
      targets: [{ itemId: '1101', ratePerMin: 120 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      proliferatorPolicy: 'auto',
      autoPromoteUnavailableItemsToRawInputs: false,
      rawInputItemIds: [],
      disabledRawInputItemIds: [],
      disabledRecipeIds: [],
      disabledBuildingIds: [],
      allowedRecipesByItem: {},
      preferredBuildings: [],
      recipePreferences: [],
      recipeStrategyOverrides: [],
      advancedOverridesText: '',
      locale: 'zh-CN',
      isLoading: false,
    })
  ).toBeNull();
});

test('persisted worker crash states do not block a retry for the same input', () => {
  const inputKey = buildWorkbenchSolveInputKey({
    catalogSignature: 'demo-catalog',
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicy: 'auto',
    autoPromoteUnavailableItemsToRawInputs: false,
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: [],
    allowedRecipesByItem: {},
    preferredBuildings: [],
    recipePreferences: [],
    recipeStrategyOverrides: [],
    advancedOverridesText: '',
    locale: 'zh-CN',
    isLoading: false,
  });
  const crashedState = restoreWorkbenchSolveState({
    request: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
    },
    result: null,
    error: 'Solve worker crashed.',
    activityStatus: 'settled',
  });

  const persisted = persistWorkbenchSolveState(crashedState, { inputKey });

  expect(persisted.inputKey).toBeUndefined();
  expect(
    findReusableWorkbenchSolveInputKey(
      {
        ...persisted,
        inputKey,
      },
      {
        catalogSignature: 'demo-catalog',
        targets: [{ itemId: '1101', ratePerMin: 60 }],
        objective: 'min_buildings',
        balancePolicy: 'force_balance',
        proliferatorPolicy: 'auto',
        autoPromoteUnavailableItemsToRawInputs: false,
        rawInputItemIds: [],
        disabledRawInputItemIds: [],
        disabledRecipeIds: [],
        disabledBuildingIds: [],
        allowedRecipesByItem: {},
        preferredBuildings: [],
        recipePreferences: [],
        recipeStrategyOverrides: [],
        advancedOverridesText: '',
        locale: 'zh-CN',
        isLoading: false,
      }
    )
  ).toBeNull();
});

test('preserveReusableSettledWorkbenchSolveState keeps a matching settled solve when the next state is empty idle', () => {
  const existingState = {
    request: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings' as const,
      balancePolicy: 'force_balance' as const,
      rawInputItemIds: [],
    },
    result: null,
    error: '',
    activityStatus: 'settled' as const,
    inputKey: 'matching-key',
  };

  expect(
    preserveReusableSettledWorkbenchSolveState({
      existingState,
      nextState: {
        request: undefined,
        result: null,
        error: '',
        activityStatus: 'idle',
      },
      expectedInputKey: 'matching-key',
    })
  ).toBe(existingState);
  expect(
    preserveReusableSettledWorkbenchSolveState({
      existingState,
      nextState: {
        request: undefined,
        result: null,
        error: '',
        activityStatus: 'idle',
      },
      expectedInputKey: 'other-key',
    })
  ).toEqual({
    request: undefined,
    result: null,
    error: '',
    activityStatus: 'idle',
  });
});

test('preserveReusableSettledWorkbenchSolveState does not keep transient worker crashes', () => {
  expect(
    preserveReusableSettledWorkbenchSolveState({
      existingState: {
        request: {
          targets: [{ itemId: '1101', ratePerMin: 60 }],
          objective: 'min_buildings',
          balancePolicy: 'force_balance',
          rawInputItemIds: [],
        },
        result: null,
        error: 'Solve worker crashed.',
        activityStatus: 'settled',
        inputKey: 'matching-key',
      },
      nextState: {
        request: undefined,
        result: null,
        error: '',
        activityStatus: 'idle',
      },
      expectedInputKey: 'matching-key',
    })
  ).toEqual({
    request: undefined,
    result: null,
    error: '',
    activityStatus: 'idle',
  });
});
