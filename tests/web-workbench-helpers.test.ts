import {
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import {
  buildDefaultWorkbenchEditorState,
  buildGlobalProliferatorPreferenceDisplayEntry,
  buildRecipePlanCardDisplayModel,
  buildRecipeOptionsByOutputItem,
  buildRecipeProliferatorPreferenceDisplayEntries,
  filterItemOptionsByRecipeAvailability,
  filterRecipeOptionsByExclusion,
  formatRecipePlanBuildingCount,
} from '../src/web/app/workbenchHelpers';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildRecipeOptionCatalog() {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1002, Type: 1, Name: 'Scrap', IconName: 'scrap', GridIndex: 2 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 3 },
      { ID: 1102, Type: 2, Name: 'Byproduct', IconName: 'byproduct', GridIndex: 4 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Smelter',
        IconName: 'smelter',
        GridIndex: 5,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
    ],
    recipes: [
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Plate Recycling',
        Items: [1002],
        ItemCounts: [2],
        Results: [1101, 1102],
        ResultCounts: [1, 1],
        TimeSpend: 120,
        Proliferator: 0,
        IconName: 'plate',
      },
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Plate Smelting',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'plate',
      },
    ],
  };
  const defaults: CatalogDefaultConfigSpec = {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };

  return resolveCatalogModel(dataset, defaults);
}

function buildRecipePlanDisplayCatalog() {
  const dataset: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      { ID: 1201, Type: 5, Name: 'Spray', IconName: 'spray', GridIndex: 3 },
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
        Name: 'Plate Smelting',
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
        ItemID: 1201,
        SprayCount: 13,
        SpeedMultiplier: 1.25,
        ProductivityMultiplier: 1.125,
        PowerMultiplier: 1.3,
      },
    ],
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
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

  return resolveCatalogModel(dataset, defaults);
}

test('buildRecipeOptionsByOutputItem groups recipe details by produced item and sorts by recipe name', () => {
  const catalog = buildRecipeOptionCatalog();
  const optionsByItem = buildRecipeOptionsByOutputItem(catalog);

  expect(optionsByItem['1101']).toEqual([
    {
      recipeId: '2',
      recipeName: 'Plate Recycling',
      recipeIconKey: 'plate',
      cycleTimeSec: 2,
      inputs: [{ itemId: '1002', itemName: 'Scrap', iconKey: 'scrap', amount: 2 }],
      outputs: [
        { itemId: '1101', itemName: 'Plate', iconKey: 'plate', amount: 1 },
        { itemId: '1102', itemName: 'Byproduct', iconKey: 'byproduct', amount: 1 },
      ],
    },
    {
      recipeId: '1',
      recipeName: 'Plate Smelting',
      recipeIconKey: 'plate',
      cycleTimeSec: 1,
      inputs: [{ itemId: '1001', itemName: 'Ore', iconKey: 'ore', amount: 1 }],
      outputs: [{ itemId: '1101', itemName: 'Plate', iconKey: 'plate', amount: 1 }],
    },
  ]);
  expect(optionsByItem['1102']).toEqual([
    expect.objectContaining({
      recipeId: '2',
      recipeName: 'Plate Recycling',
    }),
  ]);
});

test('buildDefaultWorkbenchEditorState falls back when dataset recommends hidden min_complexity objective', () => {
  const catalog = buildRecipeOptionCatalog();
  catalog.recommendedSolve.objective = 'min_complexity';

  const state = buildDefaultWorkbenchEditorState(catalog);

  expect(state.objective).toBe('min_buildings');
});

test('recipe availability helpers hide items whose remaining recipes are fully excluded', () => {
  const catalog = buildRecipeOptionCatalog();
  const optionsByItem = buildRecipeOptionsByOutputItem(catalog);
  const itemOptions = catalog.items.map(item => ({
    itemId: item.itemId,
    name: item.name,
    icon: item.icon,
  }));

  expect(
    filterRecipeOptionsByExclusion(optionsByItem['1101'], ['1']).map(option => option.recipeId)
  ).toEqual(['2']);
  expect(
    filterItemOptionsByRecipeAvailability(itemOptions, optionsByItem, itemId =>
      itemId === '1101' ? ['1', '2'] : []
    ).map(item => item.itemId)
  ).not.toContain('1101');
  expect(
    filterItemOptionsByRecipeAvailability(itemOptions, optionsByItem, itemId =>
      itemId === '1102' ? ['2'] : []
    ).map(item => item.itemId)
  ).not.toContain('1102');
});

test('formatRecipePlanBuildingCount renders exact and rounded building counts together', () => {
  expect(formatRecipePlanBuildingCount(1.25, 2, 'zh-CN')).toBe('1.25(2)');
  expect(formatRecipePlanBuildingCount(2, 2, 'zh-CN')).toBe('2');
});

test('buildRecipePlanCardDisplayModel keeps recipe card display data independently testable', () => {
  const catalog = buildRecipePlanDisplayCatalog();
  const displayModel = buildRecipePlanCardDisplayModel(
    catalog,
    {
      recipeId: '1',
      recipeName: 'Plate Smelting',
      recipeIconKey: 'plate',
      buildingId: '5001',
      buildingName: 'Smelter',
      buildingIconKey: 'smelter',
      proliferatorLevel: 1,
      proliferatorMode: 'speed',
      proliferatorLabel: '\u52a0\u901f \u7b49\u7ea7 1',
      runsPerMin: 60,
      exactBuildingCount: 0.5,
      roundedUpBuildingCount: 1,
      activePowerMW: 4,
      roundedPlacementPowerMW: 4,
      inputs: [
        { itemId: '1001', itemName: 'Ore', iconKey: 'ore', ratePerMin: 60 },
        { itemId: '1201', itemName: 'Spray', iconKey: 'spray', ratePerMin: 4.62 },
      ],
      outputs: [{ itemId: '1101', itemName: 'Plate', iconKey: 'plate', ratePerMin: 60 }],
    },
    'zh-CN'
  );

  expect(displayModel).toEqual({
    buildingCountLabel: '0.50(1)',
    powerLabel: '4.00 MW',
    proliferatorLabel: '\u52a0\u901f \u7b49\u7ea7 1',
    visibleInputs: [{ itemId: '1001', itemName: 'Ore', iconKey: 'ore', ratePerMin: 60 }],
    outputs: [{ itemId: '1101', itemName: 'Plate', iconKey: 'plate', ratePerMin: 60 }],
    auxiliaryProliferatorInput: {
      itemId: '1201',
      itemName: 'Spray',
      iconKey: 'spray',
      ratePerMin: 4.62,
    },
  });
});

test('buildRecipeProliferatorPreferenceDisplayEntries only returns explicit recipe-level proliferator preferences', () => {
  const catalog = buildRecipePlanDisplayCatalog();
  const entries = buildRecipeProliferatorPreferenceDisplayEntries(
    catalog,
    [
      {
        recipeId: '1',
        preferredBuildingId: '5001',
        preferredProliferatorMode: '',
        preferredProliferatorLevel: '',
      },
      {
        recipeId: '1',
        preferredBuildingId: '',
        preferredProliferatorMode: 'none',
        preferredProliferatorLevel: 0,
      },
    ],
    'zh-CN'
  );

  expect(entries).toEqual([
    {
      recipeId: '1',
      recipeName: 'Plate Smelting',
      recipeIconKey: 'plate',
      proliferatorPreferenceLabel: '\u65e0\u589e\u4ea7\u5242',
    },
  ]);
});

test('buildGlobalProliferatorPreferenceDisplayEntry returns a displayable global preference entry', () => {
  expect(buildGlobalProliferatorPreferenceDisplayEntry('auto', '', 'zh-CN')).toBeNull();
  expect(buildGlobalProliferatorPreferenceDisplayEntry('none', '', 'zh-CN')).toEqual({
    recipeId: '*',
    recipeName: '*',
    proliferatorPreferenceLabel: '\u65e0\u589e\u4ea7\u5242',
  });
  expect(buildGlobalProliferatorPreferenceDisplayEntry('speed', 2, 'zh-CN')).toEqual({
    recipeId: '*',
    recipeName: '*',
    proliferatorPreferenceLabel: '\u52a0\u901f \u7b49\u7ea7 2',
  });
});
