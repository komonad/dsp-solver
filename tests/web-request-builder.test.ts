import {
  buildForcedRecipeStrategyOverrides,
  buildGlobalProliferatorOverrides,
  buildPreferredRecipeOverrides,
  buildWorkbenchRequest,
  mergeAdvancedSolveOverrides,
  parseAdvancedSolveOverrides,
} from '../src/web/workbench/requestBuilder';
import { resolveCatalogModel, type CatalogDefaultConfigSpec, type VanillaDatasetSpec } from '../src/catalog';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildProliferatorDemoCatalog() {
  const dataset: VanillaDatasetSpec = {
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
        Name: 'Ore to Plate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 3,
        IconName: 'plate',
      },
    ],
  };
  const defaults: CatalogDefaultConfigSpec = {
    proliferatorLevels: [
      {
        Level: 1,
        SprayCount: 13,
        SpeedMultiplier: 1.25,
        ProductivityMultiplier: 1.125,
        PowerMultiplier: 1.3,
      },
    ],
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [
      { Code: 3, Kind: 'proliferator', SupportedModes: ['none', 'speed', 'productivity'], MaxLevel: 1 },
    ],
  };

  return resolveCatalogModel(dataset, defaults);
}

test('buildWorkbenchRequest merges base request fields with advanced overrides', () => {
  const request = buildWorkbenchRequest({
    targets: [
      { itemId: '1101', ratePerMin: 60 },
      { itemId: '', ratePerMin: 10 },
    ],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    rawInputItemIds: ['1001'],
    advancedOverrides: {
      disabledRecipeIds: ['1'],
      preferredBuildingByRecipe: { '2': '5002' },
    },
  });

  expect(request).toEqual({
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    rawInputItemIds: ['1001'],
    disabledRecipeIds: ['1'],
    preferredBuildingByRecipe: { '2': '5002' },
  });
});

test('parseAdvancedSolveOverrides accepts supported override fields', () => {
  const parsed = parseAdvancedSolveOverrides(`{
    "disabledRecipeIds": ["1"],
    "disabledBuildingIds": ["5001"],
    "forcedBuildingByRecipe": { "2": "5002" },
    "preferredProliferatorModeByRecipe": { "2": "speed" },
    "forcedProliferatorLevelByRecipe": { "2": 3 }
  }`);

  expect(parsed.error).toBe('');
  expect(parsed.value).toEqual({
    disabledRecipeIds: ['1'],
    disabledBuildingIds: ['5001'],
    forcedBuildingByRecipe: { '2': '5002' },
    preferredProliferatorModeByRecipe: { '2': 'speed' },
    forcedProliferatorLevelByRecipe: { '2': 3 },
  });
});

test('parseAdvancedSolveOverrides rejects invalid payloads with a readable error', () => {
  expect(parseAdvancedSolveOverrides('[]')).toEqual({
    value: {},
    error: '高级覆盖必须是一个 JSON 对象。',
  });

  expect(parseAdvancedSolveOverrides('{')).toEqual({
    value: {},
    error: expect.stringContaining('JSON 无效：'),
  });

  expect(
    parseAdvancedSolveOverrides(`{
      "disabledRecipeIds": [1],
      "preferredProliferatorModeByRecipe": { "2": "turbo" }
    }`)
  ).toEqual({
    value: {},
    error:
      'disabledRecipeIds 在提供时必须是字符串数组。 preferredProliferatorModeByRecipe 在提供时必须是值为 none、speed 或 productivity 的对象。',
  });
});

test('buildPreferredRecipeOverrides converts editable rows into request maps', () => {
  const overrides = buildPreferredRecipeOverrides([
    {
      recipeId: '1',
      preferredBuildingId: '5001',
      preferredProliferatorMode: 'speed',
      preferredProliferatorLevel: 1,
    },
    {
      recipeId: '2',
      preferredBuildingId: '',
      preferredProliferatorMode: '',
      preferredProliferatorLevel: '',
    },
  ]);

  expect(overrides).toEqual({
    preferredBuildingByRecipe: { '1': '5001' },
    preferredProliferatorModeByRecipe: { '1': 'speed' },
    preferredProliferatorLevelByRecipe: { '1': 1 },
  });
});

test('buildForcedRecipeStrategyOverrides converts per-recipe hard overrides into request maps', () => {
  const overrides = buildForcedRecipeStrategyOverrides([
    {
      recipeId: '1',
      forcedBuildingId: '5001',
      forcedProliferatorMode: 'speed',
      forcedProliferatorLevel: 1,
    },
    {
      recipeId: '2',
      forcedBuildingId: '',
      forcedProliferatorMode: '',
      forcedProliferatorLevel: '',
    },
  ]);

  expect(overrides).toEqual({
    forcedBuildingByRecipe: { '1': '5001' },
    forcedProliferatorModeByRecipe: { '1': 'speed' },
    forcedProliferatorLevelByRecipe: { '1': 1 },
  });
});

test('mergeAdvancedSolveOverrides deep merges arrays and per-recipe records', () => {
  const merged = mergeAdvancedSolveOverrides(
    {
      disabledRecipeIds: ['1'],
      disabledBuildingIds: ['5001'],
      preferredBuildingByRecipe: { '1': '5001' },
      preferredProliferatorModeByRecipe: { '1': 'speed' },
    },
    {
      disabledRecipeIds: ['2'],
      disabledBuildingIds: ['5002'],
      preferredBuildingByRecipe: { '2': '5002' },
      preferredProliferatorModeByRecipe: { '1': 'productivity' },
      preferredProliferatorLevelByRecipe: { '1': 3 },
    }
  );

  expect(merged).toEqual({
    disabledRecipeIds: ['1', '2'],
    disabledBuildingIds: ['5001', '5002'],
    preferredBuildingByRecipe: {
      '1': '5001',
      '2': '5002',
    },
    preferredProliferatorModeByRecipe: {
      '1': 'productivity',
    },
    preferredProliferatorLevelByRecipe: {
      '1': 3,
    },
  });
});

test('buildGlobalProliferatorOverrides disables all configurable recipes when requested', () => {
  const catalog = buildProliferatorDemoCatalog();
  const overrides = buildGlobalProliferatorOverrides(catalog, 'none');

  expect(overrides).toEqual({
    preferredProliferatorModeByRecipe: { '1': 'none' },
    preferredProliferatorLevelByRecipe: { '1': 0 },
  });
});

test('buildGlobalProliferatorOverrides applies a global mode and level to compatible recipes only', () => {
  const catalog = buildProliferatorDemoCatalog();
  const overrides = buildGlobalProliferatorOverrides(catalog, 'speed', 1);

  expect(overrides).toEqual({
    preferredProliferatorModeByRecipe: { '1': 'speed' },
    preferredProliferatorLevelByRecipe: { '1': 1 },
  });
});
