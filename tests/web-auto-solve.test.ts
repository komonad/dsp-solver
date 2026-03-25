import { resolveCatalogModel, type CatalogDefaultConfigSpec, type VanillaDatasetSpec } from '../src/catalog';
import { getLocaleBundle } from '../src/i18n';
import { computeWorkbenchSolve } from '../src/web/workbench/autoSolve';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildDemoDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Smelter',
        IconName: 'smelter',
        GridIndex: 3,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Cheap Plate',
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
        Name: 'Preferred Plate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 120,
        Proliferator: 0,
        IconName: 'plate',
      },
    ],
  };
}

function buildDemoDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };
}

function buildSurplusDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Target', IconName: 'target', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Byproduct', IconName: 'byproduct', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Assembler',
        IconName: 'assembler',
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
        Name: 'Ore to Target + Byproduct',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1201],
        ResultCounts: [1, 1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'target',
      },
    ],
  };
}

test('computeWorkbenchSolve auto-builds the request and solver result from editor state', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const autoSolve = computeWorkbenchSolve({
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
  });

  expect(autoSolve.error).toBe('');
  expect(autoSolve.request).toEqual({
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: [],
  });
  expect(autoSolve.result?.status).toBe('optimal');
  expect(autoSolve.result?.externalInputs).toEqual([{ itemId: '1001', ratePerMin: 60 }]);
  expect(autoSolve.result?.recipePlans[0].recipeId).toBe('1');
});

test('computeWorkbenchSolve surfaces advanced-override parse errors without emitting a request', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const autoSolve = computeWorkbenchSolve({
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
    advancedOverridesText: '{',
  });

  expect(autoSolve.request).toBeUndefined();
  expect(autoSolve.result).toBeNull();
  expect(autoSolve.error).toContain(getLocaleBundle().advancedOverrides.invalidJsonPrefix);
});

test('computeWorkbenchSolve rejects empty effective targets', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const autoSolve = computeWorkbenchSolve({
    catalog,
    targets: [{ itemId: '', ratePerMin: 60 }],
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
  });

  expect(autoSolve.request).toEqual({
    targets: [],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: [],
  });
  expect(autoSolve.result).toBeNull();
  expect(autoSolve.error).toBe(getLocaleBundle().solveRequest.validTargetRequired);
});

test('computeWorkbenchSolve applies allowedRecipesByItem as a hard item-level constraint', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const autoSolve = computeWorkbenchSolve({
    catalog,
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicy: 'auto',
    autoPromoteUnavailableItemsToRawInputs: false,
    rawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: [],
    allowedRecipesByItem: { '1101': ['2'] },
    recipePreferences: [],
    recipeStrategyOverrides: [],
    preferredBuildings: [],
    advancedOverridesText: '',
  });

  expect(autoSolve.error).toBe('');
  expect(autoSolve.request?.allowedRecipesByItem).toEqual({ '1101': ['2'] });
  expect(autoSolve.result?.status).toBe('optimal');
  expect(autoSolve.result?.recipePlans[0].recipeId).toBe('2');
});

test('computeWorkbenchSolve emits forced per-recipe strategy overrides from card controls', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const autoSolve = computeWorkbenchSolve({
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
    recipeStrategyOverrides: [
      {
        recipeId: '1',
        forcedBuildingId: '5001',
        forcedProliferatorMode: '',
        forcedProliferatorLevel: '',
      },
    ],
    preferredBuildings: [],
    advancedOverridesText: '',
  });

  expect(autoSolve.error).toBe('');
  expect(autoSolve.request?.forcedBuildingByRecipe).toEqual({ '1': '5001' });
  expect(autoSolve.result?.status).toBe('optimal');
});

test('computeWorkbenchSolve returns an allow_surplus fallback when force_balance is infeasible', () => {
  const catalog = resolveCatalogModel(buildSurplusDataset(), buildDemoDefaults());
  const autoSolve = computeWorkbenchSolve({
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
  });

  expect(autoSolve.error).toBe('');
  expect(autoSolve.result?.status).toBe('infeasible');
  expect(autoSolve.fallback).toBeDefined();
  expect(autoSolve.fallback?.request.balancePolicy).toBe('allow_surplus');
  expect(autoSolve.fallback?.result.status).toBe('optimal');
  expect(autoSolve.fallback?.result.surplusOutputs).toEqual([
    { itemId: '1201', ratePerMin: 60 },
  ]);
});

