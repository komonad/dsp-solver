import {
  buildEditableBuildingEntries,
  createEditableBuildingRule,
  createEditableItem,
  createEditableRecipe,
  parseEditableCatalogSource,
  stringifyEditableCatalogSource,
  upsertEditableBuildingRule,
  upsertEditableItem,
  upsertEditableRecipe,
} from '../src/web/catalogEditor';

test('catalog editor can parse and round-trip dataset/default config text', () => {
  const source = parseEditableCatalogSource(
    JSON.stringify({
      items: [{ ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore' }],
      recipes: [],
    }),
    JSON.stringify({
      iconAtlasIds: ['Vanilla'],
      recommendedRawItemTypeIds: [1],
    })
  );

  const serialized = stringifyEditableCatalogSource(source);
  expect(JSON.parse(serialized.datasetText)).toEqual(source.dataset);
  expect(JSON.parse(serialized.defaultConfigText)).toEqual(source.defaultConfig);
});

test('catalog editor can create and upsert items, recipes, and building rules', () => {
  let source = parseEditableCatalogSource(
    JSON.stringify({
      items: [
        {
          ID: 5001,
          Type: 6,
          Name: 'Smelter',
          IconName: 'smelter',
          Speed: 1,
          WorkEnergyPerTick: 1000,
        },
      ],
      recipes: [],
    }),
    JSON.stringify({})
  );

  const nextItem = createEditableItem(source);
  source = upsertEditableItem(source, {
    ...nextItem,
    Name: 'Plate',
    Type: 2,
    IconName: 'plate',
  });

  const nextRecipe = createEditableRecipe(source);
  source = upsertEditableRecipe(source, {
    ...nextRecipe,
    Name: 'Ore to Plate',
    Factories: [5001],
    Items: [1001],
    ItemCounts: [1],
    Results: [1101],
    ResultCounts: [1],
  });

  const nextRule = createEditableBuildingRule(source);
  source = upsertEditableBuildingRule(source, {
    ...nextRule,
    ID: 5001,
    Category: 'smelter',
    IntrinsicProductivityBonus: 0.25,
    Tags: ['demo'],
  });

  expect(source.dataset.items.some(item => item.Name === 'Plate')).toBe(true);
  expect(source.dataset.recipes.some(recipe => recipe.Name === 'Ore to Plate')).toBe(true);
  expect(source.defaultConfig.buildingRules).toEqual([
    {
      ID: 5001,
      Category: 'smelter',
      IntrinsicProductivityBonus: 0.25,
      Tags: ['demo'],
    },
  ]);
});

test('catalog editor derives building entries from both dataset items and defaults rules', () => {
  const source = parseEditableCatalogSource(
    JSON.stringify({
      items: [
        {
          ID: 5001,
          Type: 6,
          Name: 'Smelter',
          IconName: 'smelter',
          Speed: 1,
          WorkEnergyPerTick: 1000,
        },
      ],
      recipes: [
        {
          ID: 1,
          Type: 1,
          Factories: [5001, 5002],
          Name: 'Recipe',
          Items: [],
          ItemCounts: [],
          Results: [],
          ResultCounts: [],
          TimeSpend: 60,
          Proliferator: 0,
          IconName: '',
        },
      ],
    }),
    JSON.stringify({
      buildingRules: [{ ID: 5002, Category: 'chemical' }],
    })
  );

  expect(buildEditableBuildingEntries(source)).toEqual([
    {
      id: 5001,
      item: source.dataset.items[0],
      rule: undefined,
      label: 'Smelter (#5001)',
    },
    {
      id: 5002,
      item: undefined,
      rule: { ID: 5002, Category: 'chemical' },
      label: '#5002',
    },
  ]);
});
