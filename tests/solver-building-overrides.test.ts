import {
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import { solveCatalogRequest } from '../src/solver';
import { parseAdvancedSolveOverrides } from '../src/web/workbench/requestBuilder';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildLabDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 6001, Type: 1, Name: 'Matrix', IconName: 'matrix' },
      { ID: 6002, Type: 2, Name: 'Cube', IconName: 'cube' },
      {
        ID: 2901,
        Type: 6,
        Name: 'Matrix Lab',
        IconName: 'lab',
        Speed: 1,
        Space: 12,
        WorkEnergyPerTick: workEnergyForMW(0.48),
      },
      {
        ID: 2902,
        Type: 6,
        Name: 'Self-evolution Lab',
        IconName: 'lab2',
        Speed: 3,
        Space: 36,
        WorkEnergyPerTick: workEnergyForMW(1.44),
      },
    ],
    recipes: [
      {
        ID: 201,
        Type: 4,
        Factories: [2901, 2902],
        Name: 'Matrix Research',
        Items: [6001],
        ItemCounts: [1],
        Results: [6002],
        ResultCounts: [1],
        TimeSpend: 600,
        Proliferator: 0,
        IconName: 'cube',
      },
    ],
  };
}

function buildLabDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [
      { ID: 2901, Category: 'lab' },
      { ID: 2902, Category: 'lab' },
    ],
    recipeModifierRules: [
      { Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 },
    ],
    recommendedRawItemTypeIds: [1],
  };
}

test('stackLayers override reduces effective space making stacked building preferred over larger alternative', () => {
  const catalog = resolveCatalogModel(buildLabDataset(), buildLabDefaults());

  // Without override: both buildings have same space/speed ratio (12/1 = 12, 36/3 = 12)
  // so the solver is indifferent (or prefers lower power). Self-evolution lab uses 3x speed.
  const baseResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '6002', ratePerMin: 10 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['6001'],
  });

  // With stackLayers=15 on Matrix Lab (2901): effective space = 12/15 = 0.8
  // Cost ratio: 2901 = 0.8/1 = 0.8, 2902 = 36/3 = 12. Lab is now strongly preferred.
  const stackedResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '6002', ratePerMin: 10 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['6001'],
    buildingOverrides: { '2901': { stackLayers: 15 } },
  });

  expect(baseResult.status).toBe('optimal');
  expect(stackedResult.status).toBe('optimal');
  expect(stackedResult.recipePlans).toHaveLength(1);
  expect(stackedResult.recipePlans[0].buildingId).toBe('2901');
});

function buildFractionatorDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1120, Type: 1, Name: 'Hydrogen', IconName: 'hydrogen' },
      { ID: 1121, Type: 2, Name: 'Deuterium', IconName: 'deuterium' },
      {
        ID: 2314,
        Type: 6,
        Name: 'Fractionator',
        IconName: 'fractionator',
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(0.72),
      },
    ],
    recipes: [
      {
        ID: 115,
        Type: 8,
        Factories: [2314],
        Name: 'Deuterium Fractionation',
        Items: [1120],
        ItemCounts: [100],
        Results: [1121],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'deuterium-formula',
      },
    ],
  };
}

function buildFractionatorDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [
      {
        ID: 2314,
        Category: 'fractionator',
        FractionatorBeltSpeedItemsPerMin: 1800,
        FractionatorMaxItemStack: 4,
      },
    ],
    recipeRules: [{ ID: 115, FractionationProbability: 0.01 }],
    recipeModifierRules: [
      { Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 },
    ],
    recommendedRawItemTypeIds: [1],
  };
}

test('beltSpeedItemsPerMin override changes fractionator throughput', () => {
  const catalog = resolveCatalogModel(buildFractionatorDataset(), buildFractionatorDefaults());

  const baseResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1121', ratePerMin: 72 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['1120'],
  });

  const overriddenResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1121', ratePerMin: 72 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['1120'],
    buildingOverrides: { '2314': { beltSpeedItemsPerMin: 3600 } },
  });

  expect(baseResult.status).toBe('optimal');
  expect(overriddenResult.status).toBe('optimal');
  expect(baseResult.recipePlans[0].runsPerMin).toBeCloseTo(72, 6);
  expect(overriddenResult.recipePlans[0].runsPerMin).toBeCloseTo(72, 6);
  expect(baseResult.recipePlans[0].exactBuildingCount).toBeCloseTo(1, 6);
  expect(overriddenResult.recipePlans[0].exactBuildingCount).toBeCloseTo(0.5, 6);
});

test('parseAdvancedSolveOverrides accepts buildingOverrides', () => {
  const parsed = parseAdvancedSolveOverrides(`{
    "buildingOverrides": {
      "2901": { "stackLayers": 15 },
      "2314": { "beltSpeedItemsPerMin": 3600 }
    }
  }`);
  expect(parsed.error).toBe('');
  expect(parsed.value.buildingOverrides).toEqual({
    '2901': { stackLayers: 15 },
    '2314': { beltSpeedItemsPerMin: 3600 },
  });
});

test('parseAdvancedSolveOverrides rejects invalid stackLayers', () => {
  const parsed = parseAdvancedSolveOverrides(`{
    "buildingOverrides": { "2901": { "stackLayers": 0 } }
  }`);
  expect(parsed.error).toContain('stackLayers');
  expect(parsed.value.buildingOverrides).toBeUndefined();
});

test('parseAdvancedSolveOverrides rejects non-integer stackLayers', () => {
  const parsed = parseAdvancedSolveOverrides(`{
    "buildingOverrides": { "2901": { "stackLayers": 2.5 } }
  }`);
  expect(parsed.error).toContain('stackLayers');
});

test('parseAdvancedSolveOverrides rejects invalid beltSpeedItemsPerMin', () => {
  const parsed = parseAdvancedSolveOverrides(`{
    "buildingOverrides": { "2314": { "beltSpeedItemsPerMin": -1 } }
  }`);
  expect(parsed.error).toContain('beltSpeedItemsPerMin');
});

test('parseAdvancedSolveOverrides rejects non-object entry', () => {
  const parsed = parseAdvancedSolveOverrides(`{
    "buildingOverrides": { "2314": 123 }
  }`);
  expect(parsed.error).toContain('2314');
});
