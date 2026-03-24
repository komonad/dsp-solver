import {
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import {
  buildRecipeOptionsByOutputItem,
  filterItemOptionsByRecipeAvailability,
  filterRecipeOptionsByExclusion,
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

test('buildRecipeOptionsByOutputItem groups recipe details by produced item and sorts by recipe name', () => {
  const catalog = buildRecipeOptionCatalog();
  const optionsByItem = buildRecipeOptionsByOutputItem(catalog);

  expect(optionsByItem['1101']).toEqual([
    {
      recipeId: '2',
      recipeName: 'Plate Recycling',
      recipeIconKey: 'plate',
      cycleTimeSec: 2,
      inputs: [
        { itemId: '1002', itemName: 'Scrap', iconKey: 'scrap', amount: 2 },
      ],
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
      inputs: [
        { itemId: '1001', itemName: 'Ore', iconKey: 'ore', amount: 1 },
      ],
      outputs: [
        { itemId: '1101', itemName: 'Plate', iconKey: 'plate', amount: 1 },
      ],
    },
  ]);
  expect(optionsByItem['1102']).toEqual([
    expect.objectContaining({
      recipeId: '2',
      recipeName: 'Plate Recycling',
    }),
  ]);
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
    filterItemOptionsByRecipeAvailability(
      itemOptions,
      optionsByItem,
      itemId => (itemId === '1101' ? ['1', '2'] : []),
    ).map(item => item.itemId)
  ).not.toContain('1101');
  expect(
    filterItemOptionsByRecipeAvailability(
      itemOptions,
      optionsByItem,
      itemId => (itemId === '1102' ? ['2'] : []),
    ).map(item => item.itemId)
  ).not.toContain('1102');
});
