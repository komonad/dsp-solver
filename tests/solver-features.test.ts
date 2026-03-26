import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseJsonText,
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import { solveCatalogRequest } from '../src/solver';

const workEnergyForOneMW = 1_000_000 / 60;

function buildSingleRecipeDataset(allowedFactoryIds: number[] = [5001]): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1141, Type: 5, Name: 'Proliferator Mk.I', IconName: 'spray-1', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Test Smelter',
        IconName: 'smelter-1',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
      {
        ID: 5002,
        Type: 6,
        Name: 'Fast Smelter',
        IconName: 'smelter-2',
        GridIndex: 5,
        Speed: 2,
        WorkEnergyPerTick: workEnergyForOneMW * 4,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: allowedFactoryIds,
        Name: 'Ore to Plate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 3600,
        Proliferator: 3,
        IconName: 'plate',
      },
    ],
  };
}

function buildNoProliferatorDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [{ ID: 5001, Category: 'smelter' }, { ID: 5002, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 3, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };
}

function buildVanillaLikeProliferatorDefaults(): CatalogDefaultConfigSpec {
  return {
    proliferatorLevels: [
      {
        Level: 1,
        ItemID: 1141,
        SprayCount: 13,
        SpeedMultiplier: 1.25,
        ProductivityMultiplier: 1.125,
        PowerMultiplier: 1.3,
      },
    ],
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [
      { Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 },
      {
        Code: 3,
        Kind: 'proliferator',
        SupportedModes: ['none', 'speed', 'productivity'],
        MaxLevel: 1,
      },
    ],
    recommendedRawItemTypeIds: [1],
  };
}

function buildIntrinsicProductivityDefaults(): CatalogDefaultConfigSpec {
  return {
    proliferatorLevels: [
      {
        Level: 1,
        ItemID: 1141,
        SprayCount: 13,
        SpeedMultiplier: 1.25,
        ProductivityMultiplier: 1.125,
        PowerMultiplier: 1.3,
      },
    ],
    buildingRules: [
      {
        ID: 5001,
        Category: 'smelter',
        IntrinsicProductivityBonus: 0.25,
      },
    ],
    recipeModifierRules: [
      {
        Code: 3,
        Kind: 'proliferator',
        SupportedModes: ['none', 'speed', 'productivity'],
        MaxLevel: 1,
      },
    ],
    recommendedRawItemTypeIds: [1],
  };
}

function buildTieBreakerDefaults(): CatalogDefaultConfigSpec {
  return {
    proliferatorLevels: [
      {
        Level: 1,
        SprayCount: 10,
        SpeedMultiplier: 2,
        ProductivityMultiplier: 2,
        PowerMultiplier: 2,
      },
      {
        Level: 2,
        SprayCount: 10,
        SpeedMultiplier: 2,
        ProductivityMultiplier: 2,
        PowerMultiplier: 2,
      },
    ],
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [
      {
        Code: 3,
        Kind: 'proliferator',
        SupportedModes: ['none', 'speed', 'productivity'],
        MaxLevel: 2,
      },
    ],
    recommendedRawItemTypeIds: [1],
  };
}

function buildUnavailableUpstreamDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1201, Type: 2, Name: 'Core', IconName: 'core', GridIndex: 2 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Assembler',
        IconName: 'assembler',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
      {
        ID: 5009,
        Type: 6,
        Name: 'Exclusive Plant',
        IconName: 'exclusive',
        GridIndex: 5,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5009],
        Name: 'Ore to Core',
        Items: [1001],
        ItemCounts: [1],
        Results: [1201],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'core',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Core to Plate',
        Items: [1201],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'plate',
      },
    ],
  };
}

function buildUnavailableUpstreamDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [
      { ID: 5001, Category: 'assembler' },
      { ID: 5009, Category: 'special' },
    ],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };
}

function buildAlternativeRecipeDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Assembler',
        IconName: 'assembler',
        GridIndex: 3,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
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

function buildComplexityTradeoffDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1201, Type: 2, Name: 'Intermediate', IconName: 'intermediate', GridIndex: 2 },
      { ID: 1301, Type: 2, Name: 'Target', IconName: 'target', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Efficient Assembler',
        IconName: 'assembler-efficient',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
      {
        ID: 5002,
        Type: 6,
        Name: 'Direct Synthesizer',
        IconName: 'assembler-direct',
        GridIndex: 5,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW * 5,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5002],
        Name: 'Direct Target',
        Items: [1001],
        ItemCounts: [1],
        Results: [1301],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'target',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Ore to Intermediate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1201],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'intermediate',
      },
      {
        ID: 3,
        Type: 1,
        Factories: [5001],
        Name: 'Intermediate to Target',
        Items: [1201],
        ItemCounts: [1],
        Results: [1301],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'target',
      },
    ],
  };
}

function buildPartialPreferredRecipeDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate A', IconName: 'plate-a', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Plate B', IconName: 'plate-b', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Assembler',
        IconName: 'assembler',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
      {
        ID: 5009,
        Type: 6,
        Name: 'Exclusive Plant',
        IconName: 'exclusive',
        GridIndex: 5,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Cheap A',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'plate-a',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Preferred A',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 120,
        Proliferator: 0,
        IconName: 'plate-a',
      },
      {
        ID: 3,
        Type: 1,
        Factories: [5001],
        Name: 'Cheap B',
        Items: [1001],
        ItemCounts: [1],
        Results: [1201],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'plate-b',
      },
      {
        ID: 4,
        Type: 1,
        Factories: [5009],
        Name: 'Preferred B',
        Items: [1001],
        ItemCounts: [1],
        Results: [1201],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'plate-b',
      },
    ],
  };
}

test('solver chooses speed proliferator variant for min_buildings', () => {
  const catalog = resolveCatalogModel(buildSingleRecipeDataset([5001]), buildVanillaLikeProliferatorDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0]).toMatchObject({
    recipeId: '1',
    buildingId: '5001',
    proliferatorLevel: 1,
    proliferatorMode: 'speed',
    runsPerMin: 60,
    roundedUpBuildingCount: 48,
  });
  expect(result.recipePlans[0].exactBuildingCount).toBeCloseTo(48, 6);
  expect(result.recipePlans[0].activePowerMW).toBeCloseTo(62.4, 6);
  expect(result.externalInputs).toHaveLength(2);
  expect(result.externalInputs[0]).toEqual({ itemId: '1001', ratePerMin: 60 });
  expect(result.externalInputs[1].itemId).toBe('1141');
  expect(result.externalInputs[1].ratePerMin).toBeCloseTo(60 / 13, 6);
});

test('solver chooses productivity proliferator variant for min_external_input', () => {
  const catalog = resolveCatalogModel(buildSingleRecipeDataset([5001]), buildVanillaLikeProliferatorDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0].proliferatorMode).toBe('productivity');
  expect(result.recipePlans[0].proliferatorLevel).toBe(1);
  expect(result.recipePlans[0].runsPerMin).toBeCloseTo(60 / 1.125, 6);
  expect(result.recipePlans[0].exactBuildingCount).toBeCloseTo(60 / 1.125, 6);
  expect(result.externalInputs).toHaveLength(2);
  expect(result.externalInputs[0].itemId).toBe('1001');
  expect(result.externalInputs[0].ratePerMin).toBeCloseTo(60 / 1.125, 6);
  expect(result.externalInputs[1].itemId).toBe('1141');
  expect(result.externalInputs[1].ratePerMin).toBeCloseTo((60 / 1.125) / 13, 6);
});

test('intrinsic productivity multiplies with proliferator productivity', () => {
  const catalog = resolveCatalogModel(buildSingleRecipeDataset([5001]), buildIntrinsicProductivityDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    forcedProliferatorLevelByRecipe: { '1': 1 },
    forcedProliferatorModeByRecipe: { '1': 'productivity' },
  });

  const combinedProductivity = 1.25 * 1.125;
  const expectedRunsPerMin = 60 / combinedProductivity;

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0]).toMatchObject({
    recipeId: '1',
    proliferatorLevel: 1,
    proliferatorMode: 'productivity',
  });
  expect(result.recipePlans[0].runsPerMin).toBeCloseTo(expectedRunsPerMin, 6);
  expect(result.recipePlans[0].outputs).toHaveLength(1);
  expect(result.recipePlans[0].outputs[0].itemId).toBe('1101');
  expect(result.recipePlans[0].outputs[0].ratePerMin).toBeCloseTo(60, 6);
  expect(result.externalInputs).toHaveLength(2);
  expect(result.externalInputs[0]).toEqual({
    itemId: '1001',
    ratePerMin: expect.closeTo(expectedRunsPerMin, 6),
  });
  expect(result.externalInputs[1]).toEqual({
    itemId: '1141',
    ratePerMin: expect.closeTo(expectedRunsPerMin / 13, 6),
  });
});

test('solver respects forced proliferator mode and level', () => {
  const catalog = resolveCatalogModel(buildSingleRecipeDataset([5001]), buildVanillaLikeProliferatorDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    forcedProliferatorLevelByRecipe: { '1': 1 },
    forcedProliferatorModeByRecipe: { '1': 'productivity' },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0]).toMatchObject({
    recipeId: '1',
    proliferatorLevel: 1,
    proliferatorMode: 'productivity',
  });
});

test('preferred proliferator mode breaks ties when the objective is otherwise equal', () => {
  const catalog = resolveCatalogModel(buildSingleRecipeDataset([5001]), buildTieBreakerDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'force_balance',
    preferredProliferatorModeByRecipe: { '1': 'productivity' },
    preferredProliferatorLevelByRecipe: { '1': 2 },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0]).toMatchObject({
    recipeId: '1',
    proliferatorMode: 'productivity',
    proliferatorLevel: 2,
  });
  expect(result.diagnostics.unmetPreferences).toEqual([]);
});

test('min_complexity prefers the shorter production chain before lower power', () => {
  const catalog = resolveCatalogModel(buildComplexityTradeoffDataset(), {
    buildingRules: [
      { ID: 5001, Category: 'assembler' },
      { ID: 5002, Category: 'assembler' },
    ],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  });

  const lowPowerResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1301', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'force_balance',
  });
  expect(lowPowerResult.status).toBe('optimal');
  expect(lowPowerResult.recipePlans.map(plan => plan.recipeId)).toEqual(['2', '3']);

  const lowComplexityResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1301', ratePerMin: 60 }],
    objective: 'min_complexity',
    balancePolicy: 'force_balance',
  });
  expect(lowComplexityResult.status).toBe('optimal');
  expect(lowComplexityResult.recipePlans).toHaveLength(1);
  expect(lowComplexityResult.recipePlans[0].recipeId).toBe('1');
  expect(lowComplexityResult.powerSummary.activePowerMW).toBeGreaterThan(
    lowPowerResult.powerSummary.activePowerMW
  );
});

test('solver supports multiple target item rates in one request', () => {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Gear', IconName: 'gear', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Test Smelter',
        IconName: 'smelter-1',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
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
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'plate',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Ore to Gear',
        Items: [1001],
        ItemCounts: [1],
        Results: [1201],
        ResultCounts: [1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'gear',
      },
    ],
  };
  const catalog = resolveCatalogModel(dataset, {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  });

  const result = solveCatalogRequest(catalog, {
    targets: [
      { itemId: '1101', ratePerMin: 60 },
      { itemId: '1201', ratePerMin: 30 },
    ],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(2);
  expect(result.externalInputs).toEqual([{ itemId: '1001', ratePerMin: 90 }]);
  expect(result.targets).toEqual([
    { itemId: '1101', requestedRatePerMin: 60, actualRatePerMin: 60 },
    { itemId: '1201', requestedRatePerMin: 30, actualRatePerMin: 30 },
  ]);
});

test('allow_surplus keeps byproducts as explicit surplus output', () => {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Slag', IconName: 'slag', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Test Smelter',
        IconName: 'smelter-1',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Ore to Plate and Slag',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1201],
        ResultCounts: [1, 1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'plate',
      },
    ],
  };
  const catalog = resolveCatalogModel(dataset, {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  });

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'allow_surplus',
  });

  expect(result.status).toBe('optimal');
  expect(result.externalInputs).toEqual([{ itemId: '1001', ratePerMin: 60 }]);
  expect(result.surplusOutputs).toEqual([{ itemId: '1201', ratePerMin: 60 }]);
  expect(result.solveAudit).toMatchObject({
    prunedRecipeCount: 1,
    prunedOptionCount: 1,
  });
  expect(result.solveAudit?.attempts[0]).toMatchObject({
    phase: 'initial_lp',
    modelKind: 'lp',
    status: 'optimal',
    recipeCount: 1,
    optionCount: 1,
  });
  expect(result.itemBalance).toEqual([
    {
      itemId: '1001',
      producedRatePerMin: 60,
      consumedRatePerMin: 60,
      netRatePerMin: 0,
    },
    {
      itemId: '1101',
      producedRatePerMin: 60,
      consumedRatePerMin: 60,
      netRatePerMin: 0,
    },
    {
      itemId: '1201',
      producedRatePerMin: 60,
      consumedRatePerMin: 0,
      netRatePerMin: 60,
    },
  ]);
});

test('allowedRecipesByItem is enforced as a hard solver constraint even under allow_surplus', () => {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Titanium Ore', IconName: 'ti-ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Titanium Ingot', IconName: 'ti-ingot', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Titanium Alloy', IconName: 'ti-alloy', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Smelter',
        IconName: 'smelter',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Titanium Smelting',
        Items: [1001],
        ItemCounts: [2],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'ti-ingot',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Titanium-Iron Co-Production',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1201],
        ResultCounts: [1, 5],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'ti-alloy',
      },
    ],
  };
  const catalog = resolveCatalogModel(dataset, {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  });

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'allow_surplus',
    allowedRecipesByItem: { '1101': ['1'] },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0].recipeId).toBe('1');
  expect(result.surplusOutputs).toEqual([]);
});

test('allow_surplus still minimizes unnecessary byproduct magnitude and variety', () => {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Target Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Byproduct A', IconName: 'by-a', GridIndex: 3 },
      { ID: 1202, Type: 2, Name: 'Byproduct B', IconName: 'by-b', GridIndex: 4 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Smelter',
        IconName: 'smelter',
        GridIndex: 5,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Clean Plate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 120,
        Proliferator: 0,
        IconName: 'plate',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Messy Plate A',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1201],
        ResultCounts: [1, 8],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'by-a',
      },
      {
        ID: 3,
        Type: 1,
        Factories: [5001],
        Name: 'Messy Plate B',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1202],
        ResultCounts: [1, 8],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'by-b',
      },
    ],
  };
  const catalog = resolveCatalogModel(dataset, {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  });

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'allow_surplus',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0].recipeId).toBe('1');
  expect(result.surplusOutputs).toEqual([]);
});

test('allow_surplus prefers consolidating surplus into fewer item types before lower power', () => {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Target Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Byproduct A', IconName: 'by-a', GridIndex: 3 },
      { ID: 1202, Type: 2, Name: 'Byproduct B', IconName: 'by-b', GridIndex: 4 },
      { ID: 1203, Type: 2, Name: 'Byproduct C', IconName: 'by-c', GridIndex: 5 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Low-Power Smelter',
        IconName: 'smelter-low',
        GridIndex: 6,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
      {
        ID: 5002,
        Type: 6,
        Name: 'High-Power Smelter',
        IconName: 'smelter-high',
        GridIndex: 7,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW * 2,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Split Byproducts',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1201, 1202],
        ResultCounts: [1, 1, 1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'by-a',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5002],
        Name: 'Single Byproduct',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1203],
        ResultCounts: [1, 2],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'by-c',
      },
    ],
  };
  const catalog = resolveCatalogModel(dataset, {
    buildingRules: [
      { ID: 5001, Category: 'smelter' },
      { ID: 5002, Category: 'smelter' },
    ],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  });

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0].recipeId).toBe('2');
  expect(result.surplusOutputs).toEqual([{ itemId: '1203', ratePerMin: 120 }]);
  expect(result.solveAudit?.attempts.some(attempt => attempt.phase === 'reweighted_lp')).toBe(true);
});

test('allow_surplus can trade higher total surplus for fewer surplus item types when reweighting', () => {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Target Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Byproduct A', IconName: 'by-a', GridIndex: 3 },
      { ID: 1202, Type: 2, Name: 'Byproduct B', IconName: 'by-b', GridIndex: 4 },
      { ID: 1203, Type: 2, Name: 'Byproduct C', IconName: 'by-c', GridIndex: 5 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Efficient Splitter',
        IconName: 'smelter-low',
        GridIndex: 6,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
      {
        ID: 5002,
        Type: 6,
        Name: 'Single-Surplus Furnace',
        IconName: 'smelter-high',
        GridIndex: 7,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW * 2,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Two Surplus Types',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1201, 1202],
        ResultCounts: [1, 1, 1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'by-a',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5002],
        Name: 'One Large Surplus Type',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1203],
        ResultCounts: [1, 5],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'by-c',
      },
    ],
  };
  const catalog = resolveCatalogModel(dataset, {
    buildingRules: [
      { ID: 5001, Category: 'smelter' },
      { ID: 5002, Category: 'smelter' },
    ],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  });

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0].recipeId).toBe('2');
  expect(result.surplusOutputs).toEqual([{ itemId: '1203', ratePerMin: 300 }]);
  expect(result.solveAudit?.attempts.some(attempt => attempt.phase === 'reweighted_lp')).toBe(true);
});

test('orbital ring request honors forced graphite recipe instead of delayed coking', () => {
  const datasetText = readFileSync(join(__dirname, '..', 'data', 'OrbitalRing.json'), 'utf8');
  const defaultsText = readFileSync(
    join(__dirname, '..', 'data', 'OrbitalRing.defaults.json'),
    'utf8'
  );
  const catalog = resolveCatalogModel(
    parseJsonText<VanillaDatasetSpec>(datasetText),
    parseJsonText<CatalogDefaultConfigSpec>(defaultsText)
  );

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '6003', ratePerMin: 120 }],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
    autoPromoteUnavailableItemsToRawInputs: true,
    rawInputItemIds: ['1000'],
    disabledRawInputItemIds: ['7015', '7101', '1116'],
    disabledRecipeIds: ['510', '105', '778', '422', '523'],
    disabledBuildingIds: ['6215', '2319', '6265', '6264', '2902', '2318'],
    allowedRecipesByItem: {
      '1030': ['776'],
      '1106': ['65'],
      '1109': ['17'],
      '1124': ['33'],
      '1206': ['99'],
    },
    forcedProliferatorLevelByRecipe: {
      '32': 0,
      '104': 0,
      '121': 0,
      '409': 0,
      '509': 0,
      '518': 0,
      '550': 0,
      '705': 0,
      '716': 0,
      '717': 0,
      '775': 0,
      '777': 0,
      '797': 0,
      '813': 0,
      '845': 0,
    },
    forcedProliferatorModeByRecipe: {
      '32': 'none',
      '104': 'none',
      '121': 'none',
      '409': 'none',
      '509': 'none',
      '518': 'none',
      '550': 'none',
      '705': 'none',
      '716': 'none',
      '717': 'none',
      '775': 'none',
      '777': 'none',
      '797': 'none',
      '813': 'none',
      '845': 'none',
    },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans.some(plan => plan.recipeId === '423')).toBe(false);
});

test('orbital ring magnetic fluid surplus solving prefers fewer surplus item types over lower total surplus', () => {
  const datasetText = readFileSync(join(__dirname, '..', 'data', 'OrbitalRing.json'), 'utf8');
  const defaultsText = readFileSync(
    join(__dirname, '..', 'data', 'OrbitalRing.defaults.json'),
    'utf8'
  );
  const catalog = resolveCatalogModel(
    parseJsonText<VanillaDatasetSpec>(datasetText),
    parseJsonText<CatalogDefaultConfigSpec>(defaultsText)
  );

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '7705', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
    autoPromoteUnavailableItemsToRawInputs: true,
    rawInputItemIds: ['1143', '1007', '1000'],
    disabledRawInputItemIds: ['7015', '7101'],
    disabledRecipeIds: ['510', '704', '705'],
    disabledBuildingIds: ['6215'],
    allowedRecipesByItem: {
      '1030': ['777'],
      '1114': ['701', '16'],
      '7022': ['849'],
    },
    globalForcedProliferatorMode: 'none',
    globalForcedProliferatorLevel: 0,
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans.some(plan => plan.recipeId === '419')).toBe(true);
  expect(result.recipePlans.some(plan => plan.recipeId === '422')).toBe(false);
  expect(result.surplusOutputs.map(entry => entry.itemId)).toEqual(['6251', '7009']);
  expect(result.solveAudit?.attempts.some(attempt => attempt.phase === 'reweighted_lp')).toBe(true);
});

test('force_balance rejects unresolved byproducts', () => {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Slag', IconName: 'slag', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Test Smelter',
        IconName: 'smelter-1',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Ore to Plate and Slag',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101, 1201],
        ResultCounts: [1, 1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'plate',
      },
    ],
  };
  const catalog = resolveCatalogModel(dataset, {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  });

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
  });

  expect(result.status).toBe('infeasible');
});

test('disabled buildings remove those options from the solver', () => {
  const catalog = resolveCatalogModel(buildSingleRecipeDataset([5001, 5002]), buildNoProliferatorDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    disabledBuildingIds: ['5002'],
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0].buildingId).toBe('5001');
});

test('disabled recipes can make an otherwise simple request infeasible', () => {
  const catalog = resolveCatalogModel(buildSingleRecipeDataset([5001]), buildNoProliferatorDefaults());
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    disabledRecipeIds: ['1'],
  });

  expect(result.status).toBe('infeasible');
});

test('unavailable upstream items can be auto-promoted to raw inputs', () => {
  const catalog = resolveCatalogModel(
    buildUnavailableUpstreamDataset(),
    buildUnavailableUpstreamDefaults()
  );

  const strictResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    disabledBuildingIds: ['5009'],
  });

  expect(strictResult.status).toBe('infeasible');

  const fallbackResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    disabledBuildingIds: ['5009'],
    autoPromoteUnavailableItemsToRawInputs: true,
  });

  expect(fallbackResult.status).toBe('optimal');
  expect(fallbackResult.resolvedRawInputItemIds).toEqual(['1001', '1201']);
  expect(fallbackResult.externalInputs).toEqual([{ itemId: '1201', ratePerMin: 60 }]);
  expect(fallbackResult.recipePlans).toHaveLength(1);
  expect(fallbackResult.recipePlans[0]).toMatchObject({
    recipeId: '2',
    buildingId: '5001',
    runsPerMin: 60,
  });
  expect(fallbackResult.diagnostics.infoMessages).toContain(
    'Unavailable item 1201 (Core) was treated as an external/raw input.'
  );
});

test('disabledRawInputItemIds can cancel a dataset default raw item', () => {
  const catalog = resolveCatalogModel(buildSingleRecipeDataset([5001]), buildNoProliferatorDefaults());

  const defaultRawResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1001', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
  });

  expect(defaultRawResult.status).toBe('optimal');
  expect(defaultRawResult.externalInputs).toEqual([{ itemId: '1001', ratePerMin: 60 }]);

  const disabledRawResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1001', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    disabledRawInputItemIds: ['1001'],
  });

  expect(disabledRawResult.status).toBe('infeasible');
});

test('allowedRecipesByItem enforces the selected recipe when feasible', () => {
  const catalog = resolveCatalogModel(
    buildAlternativeRecipeDataset(),
    buildNoProliferatorDefaults()
  );

  const defaultResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
  });

  expect(defaultResult.status).toBe('optimal');
  expect(defaultResult.recipePlans).toHaveLength(1);
  expect(defaultResult.recipePlans[0].recipeId).toBe('1');

  const preferredResult = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    allowedRecipesByItem: { '1101': ['2'] },
  });

  expect(preferredResult.status).toBe('optimal');
  expect(preferredResult.recipePlans).toHaveLength(1);
  expect(preferredResult.recipePlans[0].recipeId).toBe('2');
});

test('allowedRecipesByItem makes the solve infeasible when the only allowed recipe is unavailable', () => {
  const catalog = resolveCatalogModel(
    buildAlternativeRecipeDataset(),
    buildNoProliferatorDefaults()
  );

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    disabledRecipeIds: ['2'],
    allowedRecipesByItem: { '1101': ['2'] },
  });

  expect(result.status).toBe('infeasible');
});

test('allowedRecipesByItem only constrains the listed items and recipes', () => {
  const catalog = resolveCatalogModel(
    buildPartialPreferredRecipeDataset(),
    {
      buildingRules: [
        { ID: 5001, Category: 'assembler' },
        { ID: 5009, Category: 'special' },
      ],
      recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
      recommendedRawItemTypeIds: [1],
    }
  );

  const result = solveCatalogRequest(catalog, {
    targets: [
      { itemId: '1101', ratePerMin: 60 },
      { itemId: '1201', ratePerMin: 60 },
    ],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    disabledBuildingIds: ['5009'],
    allowedRecipesByItem: { '1101': ['2'] },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(2);
  expect(result.recipePlans.map(plan => plan.recipeId)).toEqual(['2', '3']);
});

test('vanilla proliferator items can be produced through their own recipe chain', () => {
  const vanillaDataset = parseJsonText<VanillaDatasetSpec>(
    readFileSync(join(__dirname, '..', 'data', 'Vanilla.json'), 'utf8')
  );
  const vanillaDefaults = parseJsonText<CatalogDefaultConfigSpec>(
    readFileSync(join(__dirname, '..', 'data', 'Vanilla.defaults.json'), 'utf8')
  );
  const catalog = resolveCatalogModel(vanillaDataset, vanillaDefaults);

  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1141', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans.some(plan => plan.recipeId === '106')).toBe(true);
  expect(result.recipePlans.some(plan => plan.outputs.some(output => output.itemId === '1141'))).toBe(
    true
  );
  expect(result.externalInputs.some(input => input.itemId === '1141')).toBe(false);
});
