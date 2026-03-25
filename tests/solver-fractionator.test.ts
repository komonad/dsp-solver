import {
  loadResolvedCatalogFromFiles,
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import { solveCatalogRequest } from '../src/solver';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildFractionatorDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1120, Type: 1, Name: 'Hydrogen', IconName: 'hydrogen' },
      { ID: 1121, Type: 2, Name: 'Deuterium', IconName: 'deuterium' },
      { ID: 1143, Type: 2, Name: 'Proliferator Mk.III', IconName: 'spray3' },
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
        Proliferator: 1,
        IconName: 'deuterium-formula',
      },
    ],
  };
}

function buildFractionatorDefaults(): CatalogDefaultConfigSpec {
  return {
    proliferatorLevels: [
      { Level: 0, SpeedMultiplier: 1, ProductivityMultiplier: 1, PowerMultiplier: 1 },
      {
        Level: 3,
        ItemID: 1143,
        SprayCount: 75,
        SpeedMultiplier: 2,
        ProductivityMultiplier: 1.25,
        PowerMultiplier: 2.5,
      },
    ],
    buildingRules: [
      {
        ID: 2314,
        Category: 'fractionator',
        FractionatorBeltSpeedItemsPerMin: 1800,
        FractionatorMaxItemStack: 4,
      },
    ],
    recipeRules: [
      {
        ID: 115,
        FractionationProbability: 0.01,
      },
    ],
    recipeModifierRules: [
      { Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 },
      { Code: 1, Kind: 'proliferator', SupportedModes: ['none', 'speed'], MaxLevel: 3 },
    ],
    recommendedRawItemTypeIds: [1],
  };
}

test('fractionation recipes use belt speed, stack size, and probability to derive 72 per minute throughput', () => {
  const catalog = resolveCatalogModel(buildFractionatorDataset(), buildFractionatorDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1121', ratePerMin: 72 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['1120'],
    forcedProliferatorModeByRecipe: { '115': 'none' },
    forcedProliferatorLevelByRecipe: { '115': 0 },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0]).toMatchObject({
    recipeId: '115',
    buildingId: '2314',
    proliferatorMode: 'none',
    proliferatorLevel: 0,
  });
  expect(result.recipePlans[0].runsPerMin).toBeCloseTo(72, 6);
  expect(result.recipePlans[0].exactBuildingCount).toBeCloseTo(1, 6);
  expect(result.recipePlans[0].inputs).toEqual([{ itemId: '1120', ratePerMin: 72 }]);
  expect(result.recipePlans[0].outputs).toEqual([{ itemId: '1121', ratePerMin: 72 }]);
});

test('fractionation recipes still support speed proliferator variants on top of the derived throughput', () => {
  const catalog = resolveCatalogModel(buildFractionatorDataset(), buildFractionatorDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1121', ratePerMin: 72 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['1120', '1143'],
    forcedProliferatorModeByRecipe: { '115': 'speed' },
    forcedProliferatorLevelByRecipe: { '115': 3 },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0]).toMatchObject({
    proliferatorMode: 'speed',
    proliferatorLevel: 3,
  });
  expect(result.recipePlans[0].runsPerMin).toBeCloseTo(72, 6);
  expect(result.recipePlans[0].exactBuildingCount).toBeCloseTo(0.5, 6);
  expect(result.recipePlans[0].inputs[0]).toEqual({ itemId: '1120', ratePerMin: 72 });
  expect(result.recipePlans[0].inputs[1]).toMatchObject({ itemId: '1143' });
  expect(result.recipePlans[0].inputs[1]?.ratePerMin ?? 0).toBeCloseTo(72 / 75, 6);
  expect(result.recipePlans[0].outputs[0]).toEqual({ itemId: '1121', ratePerMin: 72 });
});

test('fractionation recipes reject forced productivity because they are speed-only', () => {
  const catalog = resolveCatalogModel(buildFractionatorDataset(), buildFractionatorDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1121', ratePerMin: 72 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['1120', '1143'],
    forcedProliferatorModeByRecipe: { '115': 'productivity' },
    forcedProliferatorLevelByRecipe: { '115': 3 },
  });

  expect(result.status).toBe('infeasible');
  expect(result.recipePlans).toEqual([]);
});

test('OrbitalRing heavy-water fractionation uses the configured probability and ignores universal buildings without throughput config', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    './data/OrbitalRing.json',
    './data/OrbitalRing.defaults.json'
  );
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '7018', ratePerMin: 72 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['1000', '1143'],
    allowedRecipesByItem: { '7018': ['106'] },
    forcedProliferatorModeByRecipe: { '106': 'speed' },
    forcedProliferatorLevelByRecipe: { '106': 3 },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0]).toMatchObject({
    recipeId: '106',
    buildingId: '2314',
    proliferatorMode: 'speed',
    proliferatorLevel: 3,
    runsPerMin: 72,
  });
  expect(result.recipePlans[0].exactBuildingCount).toBeCloseTo(0.5, 6);
  expect(result.recipePlans[0].inputs[0]).toEqual({ itemId: '1000', ratePerMin: 72 });
  expect(result.recipePlans[0].outputs[0]).toEqual({ itemId: '7018', ratePerMin: 72 });
  expect(result.diagnostics.messages).toContain(
    'Fractionation recipe 106 skips building 6215 because it lacks FractionatorBeltSpeedItemsPerMin or FractionatorMaxItemStack.'
  );
});
