import { resolveCatalogModel, type CatalogDefaultConfigSpec, type VanillaDatasetSpec } from '../src/catalog';
import { buildPresentationModel, buildPresentationOverviewSections, type PresentationModel } from '../src/presentation';
import { SOLVER_VERSION, solveCatalogRequest } from '../src/solver';

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
    iconAtlasIds: ['Vanilla'],
  });
  expect(model.requestSummary).toEqual({
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicyLabel: '自动',
    targets: [{ itemId: '1101', itemName: 'Demo Plate', iconKey: 'demo-plate', ratePerMin: 60 }],
    rawInputs: [],
    forcedRecipeSettings: [],
    disabledRecipes: [],
    disabledBuildings: [],
    preferredRecipeSettings: [],
    hasAdvancedOverrides: false,
  });
  expect(model.status).toBe('optimal');
  expect(model.solvedSummary).toMatchObject({
    netInputs: [{ itemId: '1001', itemName: 'Demo Ore', iconKey: 'demo-ore', ratePerMin: 60 }],
    netOutputs: [{ itemId: '1101', itemName: 'Demo Plate', iconKey: 'demo-plate', ratePerMin: 60 }],
    buildingTypeCount: 1,
    roundedBuildingCount: 1,
    recipeTypeCount: 1,
  });
  expect(model.solvedSummary?.roundedPlacementPowerMW).toBeCloseTo(4, 6);
  expect(model.targets).toEqual([
    {
      itemId: '1101',
      itemName: 'Demo Plate',
      iconKey: 'demo-plate',
      requestedRatePerMin: 60,
      actualRatePerMin: 60,
    },
  ]);
  expect(model.externalInputs).toEqual([
    {
      itemId: '1001',
      itemName: 'Demo Ore',
      iconKey: 'demo-ore',
      ratePerMin: 60,
    },
  ]);
  expect(model.buildingSummary).toHaveLength(1);
  expect(model.buildingSummary[0]).toMatchObject({
    buildingId: '5002',
    buildingName: 'Turbo Smelter',
    buildingIconKey: 'turbo-smelter',
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
    recipeIconKey: 'demo-plate',
    buildingId: '5002',
    buildingName: 'Turbo Smelter',
    buildingIconKey: 'turbo-smelter',
    proliferatorLabel: '无增产剂',
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
  expect(model.solvedSummary).toBeNull();
  expect(model.targets).toEqual([]);
  expect(model.externalInputs).toEqual([]);
  expect(model.recipePlans).toEqual([]);
  expect(model.itemBalance).toEqual([]);
  expect(model.itemLedgerSections).toEqual([]);
  expect(model.itemSlicesById).toEqual({});
  expect(model.catalogSummary.itemCount).toBe(4);
});

test('overview sections keep surplus outputs separate from buildings and power', () => {
  const model: PresentationModel = {
    catalogSummary: {
      itemCount: 0,
      recipeCount: 0,
      buildingCount: 0,
      proliferatorLevelCount: 0,
      rawItemCount: 0,
      targetableItemCount: 0,
      iconAtlasIds: [],
    },
    status: 'optimal',
    diagnostics: { messages: [], unmetPreferences: [] },
    solvedSummary: {
      netInputs: [{ itemId: '1001', itemName: 'Demo Ore', iconKey: 'demo-ore', ratePerMin: 60 }],
      netOutputs: [{ itemId: '1101', itemName: 'Demo Plate', iconKey: 'demo-plate', ratePerMin: 60 }],
      buildingTypeCount: 1,
      roundedBuildingCount: 1,
      recipeTypeCount: 0,
      roundedPlacementPowerMW: 4,
    },
    targets: [{ itemId: '1101', itemName: 'Demo Plate', iconKey: 'demo-plate', requestedRatePerMin: 60, actualRatePerMin: 60 }],
    recipePlans: [],
    buildingSummary: [
      {
        buildingId: '5002',
        buildingName: 'Turbo Smelter',
        buildingIconKey: 'turbo-smelter',
        category: 'smelter',
        exactCount: 0.5,
        roundedUpCount: 1,
        activePowerMW: 4,
        roundedPlacementPowerMW: 4,
      },
    ],
    powerSummary: {
      activePowerMW: 4,
      roundedPlacementPowerMW: 4,
    },
    externalInputs: [{ itemId: '1001', itemName: 'Demo Ore', iconKey: 'demo-ore', ratePerMin: 60 }],
    surplusOutputs: [{ itemId: '1116', itemName: 'Heavy Oil', iconKey: undefined, ratePerMin: 30 }],
    itemBalance: [],
    itemLedgerSections: [],
    itemSlicesById: {},
  };

  const overview = buildPresentationOverviewSections(model);

  expect(overview.targetsAndExternalInputs).toEqual({
    title: '目标与外部输入',
    targets: model.targets,
    externalInputs: model.externalInputs,
  });
  expect(overview.buildingsAndPower).toEqual({
    title: '建筑与功耗',
    buildingSummary: model.buildingSummary,
    activePowerMW: 4,
    roundedPlacementPowerMW: 4,
  });
  expect(overview.surplusOutputs).toEqual({
    title: '冗余产物',
    items: model.surplusOutputs,
  });
  expect(Object.keys(overview.buildingsAndPower)).toEqual([
    'title',
    'buildingSummary',
    'activePowerMW',
    'roundedPlacementPowerMW',
  ]);
});

test('presentation model exposes named recipe preference summaries from the request', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const model = buildPresentationModel({
    catalog,
    request: {
      solverVersion: SOLVER_VERSION,
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
    solverVersion: SOLVER_VERSION,
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    proliferatorPolicyLabel: '自动',
    targets: [{ itemId: '1101', itemName: 'Demo Plate', iconKey: 'demo-plate', ratePerMin: 60 }],
    rawInputs: [],
    forcedRecipeSettings: [],
    disabledRecipes: [],
    disabledBuildings: [],
    preferredRecipeSettings: [
      {
        recipeId: '1',
        recipeName: 'Ore to Plate',
        recipeIconKey: 'demo-plate',
        buildingName: 'Compact Smelter',
        buildingIconKey: 'compact-smelter',
        proliferatorPreferenceLabel: '加速 等级 1',
      },
    ],
    hasAdvancedOverrides: true,
  });
});

test('presentation model exposes forced recipe flow details for snapshot rendering', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const model = buildPresentationModel({
    catalog,
    request: {
      solverVersion: SOLVER_VERSION,
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
      forcedRecipeByItem: { '1101': '1' },
    },
    datasetLabel: 'Demo Smelting',
  });

  expect(model.requestSummary?.forcedRecipeSettings).toEqual([
    {
      itemId: '1101',
      itemName: 'Demo Plate',
      iconKey: 'demo-plate',
      recipeId: '1',
      recipeName: 'Ore to Plate',
      recipeIconKey: 'demo-plate',
      cycleTimeSec: 1,
      inputs: [
        {
          itemId: '1001',
          itemName: 'Demo Ore',
          iconKey: 'demo-ore',
          ratePerMin: 1,
        },
      ],
      outputs: [
        {
          itemId: '1101',
          itemName: 'Demo Plate',
          iconKey: 'demo-plate',
          ratePerMin: 1,
        },
      ],
    },
  ]);
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
      solverVersion: SOLVER_VERSION,
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
      forcedProliferatorModeByRecipe: { '1': 'none' },
      forcedProliferatorLevelByRecipe: { '1': 0 },
    },
  });

  expect(model.requestSummary?.proliferatorPolicyLabel).toBe('无增产剂');
});

test('presentation model groups the item ledger into net inputs, outputs, and intermediates', () => {
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
  });

  expect(model.itemLedgerSections).toEqual([
    {
      key: 'net_inputs',
      title: '净输入',
      items: [
        {
          itemId: '1001',
          itemName: 'Demo Ore',
          iconKey: 'demo-ore',
          producedRatePerMin: 0,
          consumedRatePerMin: 60,
          netRatePerMin: -60,
          throughputRatePerMin: 60,
          isRawInput: true,
          isTarget: false,
          isSurplusOutput: false,
          externalInputRatePerMin: 60,
          targetRatePerMin: 0,
          surplusRatePerMin: 0,
        },
      ],
    },
    {
      key: 'net_outputs',
      title: '净输出',
      items: [
        {
          itemId: '1101',
          itemName: 'Demo Plate',
          iconKey: 'demo-plate',
          producedRatePerMin: 60,
          consumedRatePerMin: 0,
          netRatePerMin: 60,
          throughputRatePerMin: 60,
          isRawInput: false,
          isTarget: true,
          isSurplusOutput: false,
          externalInputRatePerMin: 0,
          targetRatePerMin: 60,
          surplusRatePerMin: 0,
        },
      ],
    },
    {
      key: 'intermediates',
      title: '中间流转',
      items: [],
    },
  ]);
  expect(model.solvedSummary).toMatchObject({
    netInputs: [{ itemId: '1001', itemName: 'Demo Ore', iconKey: 'demo-ore', ratePerMin: 60 }],
    netOutputs: [{ itemId: '1101', itemName: 'Demo Plate', iconKey: 'demo-plate', ratePerMin: 60 }],
    buildingTypeCount: 1,
    roundedBuildingCount: 1,
    recipeTypeCount: 1,
  });
  expect(model.solvedSummary?.roundedPlacementPowerMW).toBeCloseTo(4, 6);
});

test('presentation model exposes per-item slices with producer and consumer plans', () => {
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
  });

  expect(model.itemSlicesById['1101']).toMatchObject({
    itemId: '1101',
    itemName: 'Demo Plate',
    producedRatePerMin: 60,
    consumedRatePerMin: 0,
    netRatePerMin: 60,
    targetRatePerMin: 60,
    externalInputRatePerMin: 0,
    isTarget: true,
  });
  expect(model.itemSlicesById['1101'].producerPlans).toEqual([
    expect.objectContaining({
      recipeId: '1',
      buildingId: '5002',
      itemRatePerMin: 60,
    }),
  ]);
  expect(model.itemSlicesById['1101'].consumerPlans).toEqual([]);
  expect(model.itemSlicesById['1001']).toMatchObject({
    itemId: '1001',
    itemName: 'Demo Ore',
    producedRatePerMin: 0,
    consumedRatePerMin: 60,
    netRatePerMin: -60,
    externalInputRatePerMin: 60,
    isRawInput: true,
  });
  expect(model.itemSlicesById['1001'].producerPlans).toEqual([]);
  expect(model.itemSlicesById['1001'].consumerPlans).toEqual([
    expect.objectContaining({
      recipeId: '1',
      buildingId: '5002',
      itemRatePerMin: 60,
    }),
  ]);
});

test('item ledger keeps internal production and consumption separate from external supplementation', () => {
  const catalog = resolveCatalogModel(
    {
      items: [
        { ID: 1120, Type: 2, Name: 'Hydrogen', IconName: 'hydrogen', GridIndex: 1 },
        { ID: 1201, Type: 2, Name: 'Loop Product', IconName: 'loop-product', GridIndex: 2 },
        { ID: 5001, Type: 6, Name: 'Loop Plant', IconName: 'loop-plant', GridIndex: 3, Speed: 1, WorkEnergyPerTick: workEnergyForMW(1) },
      ],
      recipes: [
        {
          ID: 1,
          Type: 1,
          Factories: [5001],
          Name: 'Hydrogen Producer',
          Items: [],
          ItemCounts: [],
          Results: [1120],
          ResultCounts: [10],
          TimeSpend: 60,
          Proliferator: 0,
          IconName: 'hydrogen',
        },
        {
          ID: 2,
          Type: 1,
          Factories: [5001],
          Name: 'Hydrogen Consumer',
          Items: [1120],
          ItemCounts: [70],
          Results: [1201],
          ResultCounts: [1],
          TimeSpend: 60,
          Proliferator: 0,
          IconName: 'loop-product',
        },
      ],
    },
    {
      buildingRules: [{ ID: 5001, Category: 'chemical' }],
      recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    }
  );

  const model = buildPresentationModel({
    catalog,
    request: {
      solverVersion: SOLVER_VERSION,
      targets: [{ itemId: '1201', ratePerMin: 1 }],
      objective: 'min_external_input',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
    },
    result: {
      solverVersion: SOLVER_VERSION,
      status: 'optimal',
      diagnostics: { messages: [], unmetPreferences: [] },
      resolvedRawInputItemIds: ['1120'],
      targets: [{ itemId: '1201', requestedRatePerMin: 1, actualRatePerMin: 1 }],
      recipePlans: [
        {
          recipeId: '1',
          buildingId: '5001',
          proliferatorLevel: 0,
          proliferatorMode: 'none',
          runsPerMin: 1,
          exactBuildingCount: 1,
          roundedUpBuildingCount: 1,
          activePowerMW: 1,
          roundedPlacementPowerMW: 1,
          inputs: [],
          outputs: [{ itemId: '1120', ratePerMin: 10 }],
        },
        {
          recipeId: '2',
          buildingId: '5001',
          proliferatorLevel: 0,
          proliferatorMode: 'none',
          runsPerMin: 1,
          exactBuildingCount: 1,
          roundedUpBuildingCount: 1,
          activePowerMW: 1,
          roundedPlacementPowerMW: 1,
          inputs: [{ itemId: '1120', ratePerMin: 70 }],
          outputs: [{ itemId: '1201', ratePerMin: 1 }],
        },
      ],
      buildingSummary: [
        {
          buildingId: '5001',
          exactCount: 2,
          roundedUpCount: 2,
          activePowerMW: 2,
          roundedPlacementPowerMW: 2,
        },
      ],
      powerSummary: {
        activePowerMW: 2,
        roundedPlacementPowerMW: 2,
      },
      externalInputs: [{ itemId: '1120', ratePerMin: 60 }],
      surplusOutputs: [],
      itemBalance: [
        {
          itemId: '1120',
          producedRatePerMin: 70,
          consumedRatePerMin: 70,
          netRatePerMin: 0,
        },
        {
          itemId: '1201',
          producedRatePerMin: 1,
          consumedRatePerMin: 1,
          netRatePerMin: 0,
        },
      ],
    },
  });

  expect(model.itemLedgerSections[0].items).toContainEqual(
    expect.objectContaining({
      itemId: '1120',
      producedRatePerMin: 10,
      consumedRatePerMin: 70,
      netRatePerMin: -60,
      externalInputRatePerMin: 60,
    })
  );
  expect(model.itemSlicesById['1120']).toMatchObject({
    producedRatePerMin: 10,
    consumedRatePerMin: 70,
    netRatePerMin: -60,
    externalInputRatePerMin: 60,
  });
});
