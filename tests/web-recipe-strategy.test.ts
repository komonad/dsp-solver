import type { EditableRecipeStrategyOverride } from '../src/web/workbench/requestBuilder';
import { resolveCatalogModel, type CatalogDefaultConfigSpec, type VanillaDatasetSpec } from '../src/catalog';
import { tryApplyRecipeStrategyOverride } from '../src/web/workbench/recipeStrategy';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildStrategyDemoCatalog() {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1141, Type: 2, Name: 'Spray', IconName: 'spray', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Smelter A',
        IconName: 'smelter-a',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
      {
        ID: 5002,
        Type: 6,
        Name: 'Smelter B',
        IconName: 'smelter-b',
        GridIndex: 5,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1.2),
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001, 5002],
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
    buildingRules: [
      { ID: 5001, Category: 'smelter' },
      { ID: 5002, Category: 'smelter' },
    ],
    recipeModifierRules: [
      { Code: 3, Kind: 'proliferator', SupportedModes: ['none', 'speed', 'productivity'], MaxLevel: 1 },
    ],
    recommendedRawItemIds: [1001, 1141],
  };

  return resolveCatalogModel(dataset, defaults);
}

test('tryApplyRecipeStrategyOverride accepts valid forced overrides and normalizes none to level 0', () => {
  const catalog = buildStrategyDemoCatalog();

  const result = tryApplyRecipeStrategyOverride({
    catalog,
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicy: 'auto',
    autoPromoteUnavailableItemsToRawInputs: false,
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: ['5002'],
    allowedRecipesByItem: {},
    recipePreferences: [],
    recipeStrategyOverrides: [],
    preferredBuildings: [],

    advancedOverridesText: '',
    recipeId: '1',
    patch: {
      forcedBuildingId: '5001',
      forcedProliferatorMode: 'none',
    },
  });

  expect(result.accepted).toBe(true);
  expect(result.message).toBe('');
  expect(result.nextOverrides).toEqual([
    {
      recipeId: '1',
      forcedBuildingId: '5001',
      forcedProliferatorMode: 'none',
      forcedProliferatorLevel: 0,
    },
  ]);
});

test('tryApplyRecipeStrategyOverride rejects an override that makes the request infeasible', () => {
  const catalog = buildStrategyDemoCatalog();
  const currentOverrides: EditableRecipeStrategyOverride[] = [
    {
      recipeId: '1',
      forcedBuildingId: '5001',
      forcedProliferatorMode: '',
      forcedProliferatorLevel: '',
    },
  ];
  const result = tryApplyRecipeStrategyOverride({
    catalog,
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicy: 'auto',
    autoPromoteUnavailableItemsToRawInputs: false,
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: ['5002'],
    allowedRecipesByItem: {},
    recipePreferences: [],
    recipeStrategyOverrides: currentOverrides,
    preferredBuildings: [],

    advancedOverridesText: '',
    recipeId: '1',
    patch: {
      forcedBuildingId: '5002',
    },
  });

  expect(result.accepted).toBe(false);
  expect(result.nextOverrides).toEqual(currentOverrides);
  expect(result.message.length).toBeGreaterThan(0);
});

test('tryApplyRecipeStrategyOverride does not carry level 0 from none into speed mode', () => {
  const catalog = buildStrategyDemoCatalog();
  const currentOverrides: EditableRecipeStrategyOverride[] = [
    {
      recipeId: '1',
      forcedBuildingId: '5001',
      forcedProliferatorMode: 'none',
      forcedProliferatorLevel: 0,
    },
  ];
  const result = tryApplyRecipeStrategyOverride({
    catalog,
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicy: 'auto',
    autoPromoteUnavailableItemsToRawInputs: false,
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: ['5002'],
    allowedRecipesByItem: {},
    recipePreferences: [],
    recipeStrategyOverrides: currentOverrides,
    preferredBuildings: [],

    advancedOverridesText: '',
    recipeId: '1',
    patch: {
      forcedProliferatorMode: 'speed',
      forcedProliferatorLevel: 0,
    },
  });

  expect(result.accepted).toBe(true);
  expect(result.nextOverrides).toEqual([
    {
      recipeId: '1',
      forcedBuildingId: '5001',
      forcedProliferatorMode: 'speed',
      forcedProliferatorLevel: '',
    },
  ]);
});


