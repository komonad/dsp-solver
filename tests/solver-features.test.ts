import {
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
  expect(fallbackResult.diagnostics.messages).toContain(
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
