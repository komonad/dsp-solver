import { resolveCatalogModel, type CatalogDefaultConfigSpec, type VanillaDatasetSpec } from '../src/catalog';
import { buildPresentationModel } from '../src/presentation';
import { solveCatalogRequest } from '../src/solver';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildDemoDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Demo Ore', IconName: 'demo-ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Demo Plate', IconName: 'demo-plate', GridIndex: 2 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Compact Smelter',
        IconName: 'compact-smelter',
        GridIndex: 3,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
      {
        ID: 5002,
        Type: 6,
        Name: 'Turbo Smelter',
        IconName: 'turbo-smelter',
        GridIndex: 4,
        Speed: 2,
        WorkEnergyPerTick: workEnergyForMW(4),
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
        Proliferator: 0,
        IconName: 'demo-plate',
      },
    ],
  };
}

function buildDemoDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [
      { ID: 5001, Category: 'smelter' },
      { ID: 5002, Category: 'smelter' },
    ],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };
}

test('presentation model carries frontend-visible names and totals from a solved result', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const request = {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings' as const,
    balancePolicy: 'force_balance' as const,
    rawInputItemIds: [],
  };
  const result = solveCatalogRequest(catalog, request);
  const model = buildPresentationModel({
    catalog,
    request,
    result,
    datasetLabel: 'Demo Smelting',
    datasetPath: './DemoSmelting.json',
    defaultConfigPath: './DemoSmelting.defaults.json',
  });

  expect(model.catalogSummary).toEqual({
    datasetLabel: 'Demo Smelting',
    datasetPath: './DemoSmelting.json',
    defaultConfigPath: './DemoSmelting.defaults.json',
    itemCount: 4,
    recipeCount: 1,
    buildingCount: 2,
    proliferatorLevelCount: 0,
    rawItemCount: 1,
    targetableItemCount: 2,
  });
  expect(model.requestSummary).toEqual({
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicyLabel: 'Auto',
    targets: [{ itemId: '1101', itemName: 'Demo Plate', ratePerMin: 60 }],
    rawInputs: [],
    disabledRecipes: [],
    disabledBuildings: [],
    preferredRecipeSettings: [],
    hasAdvancedOverrides: false,
  });
  expect(model.status).toBe('optimal');
  expect(model.targets).toEqual([
    {
      itemId: '1101',
      itemName: 'Demo Plate',
      requestedRatePerMin: 60,
      actualRatePerMin: 60,
    },
  ]);
  expect(model.externalInputs).toEqual([
    {
      itemId: '1001',
      itemName: 'Demo Ore',
      ratePerMin: 60,
    },
  ]);
  expect(model.buildingSummary).toHaveLength(1);
  expect(model.buildingSummary[0]).toMatchObject({
    buildingId: '5002',
    buildingName: 'Turbo Smelter',
    category: 'smelter',
    exactCount: 0.5,
    roundedUpCount: 1,
  });
  expect(model.buildingSummary[0].activePowerMW).toBeCloseTo(4, 6);
  expect(model.buildingSummary[0].roundedPlacementPowerMW).toBeCloseTo(4, 6);
  expect(model.recipePlans).toHaveLength(1);
  expect(model.recipePlans[0]).toMatchObject({
    recipeId: '1',
    recipeName: 'Ore to Plate',
    buildingId: '5002',
    buildingName: 'Turbo Smelter',
    proliferatorLabel: 'None',
    runsPerMin: 60,
    exactBuildingCount: 0.5,
    roundedUpBuildingCount: 1,
  });
  expect(model.recipePlans[0].activePowerMW).toBeCloseTo(4, 6);
});

test('presentation model still exposes catalog summary before solving', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const model = buildPresentationModel({
    catalog,
    datasetLabel: 'Demo Smelting',
    datasetPath: './DemoSmelting.json',
    defaultConfigPath: './DemoSmelting.defaults.json',
  });

  expect(model.status).toBeNull();
  expect(model.targets).toEqual([]);
  expect(model.externalInputs).toEqual([]);
  expect(model.recipePlans).toEqual([]);
  expect(model.itemBalance).toEqual([]);
  expect(model.catalogSummary.itemCount).toBe(4);
});

test('presentation model exposes named recipe preference summaries from the request', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const model = buildPresentationModel({
    catalog,
    request: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
      preferredBuildingByRecipe: { '1': '5001' },
      preferredProliferatorModeByRecipe: { '1': 'speed' },
      preferredProliferatorLevelByRecipe: { '1': 1 },
    },
    datasetLabel: 'Demo Smelting',
  });

  expect(model.requestSummary).toEqual({
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicyLabel: 'Auto',
    targets: [{ itemId: '1101', itemName: 'Demo Plate', ratePerMin: 60 }],
    rawInputs: [],
    disabledRecipes: [],
    disabledBuildings: [],
    preferredRecipeSettings: [
      {
        recipeId: '1',
        recipeName: 'Ore to Plate',
        buildingName: 'Compact Smelter',
        proliferatorPreferenceLabel: 'Speed Lv.1',
      },
    ],
    hasAdvancedOverrides: true,
  });
});

test('presentation model detects global proliferator disable requests', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), {
    ...buildDemoDefaults(),
    proliferatorLevels: [
      {
        Level: 1,
        SprayCount: 13,
        SpeedMultiplier: 1.25,
        ProductivityMultiplier: 1.125,
        PowerMultiplier: 1.3,
      },
    ],
    recipeModifierRules: [
      { Code: 0, Kind: 'proliferator', SupportedModes: ['none', 'speed', 'productivity'], MaxLevel: 1 },
    ],
  });

  const model = buildPresentationModel({
    catalog,
    request: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
      forcedProliferatorModeByRecipe: { '1': 'none' },
      forcedProliferatorLevelByRecipe: { '1': 0 },
    },
  });

  expect(model.requestSummary?.proliferatorPolicyLabel).toBe('Disabled');
});
