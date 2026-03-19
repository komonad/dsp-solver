import { resolveCatalogSourceTexts } from '../src/web/catalog/catalogClient';

test('resolveCatalogSourceTexts parses dataset/default texts and resolves a catalog', () => {
  const resolved = resolveCatalogSourceTexts(
    JSON.stringify({
      items: [
        { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore' },
        {
          ID: 5001,
          Type: 6,
          Name: 'Smelter',
          IconName: 'smelter',
          Speed: 1,
          WorkEnergyPerTick: (1_000_000 / 60),
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
          Results: [1001],
          ResultCounts: [1],
          TimeSpend: 60,
          Proliferator: 0,
          IconName: 'ore',
        },
      ],
    }),
    JSON.stringify({
      buildingRules: [{ ID: 5001, Category: 'smelter' }],
      recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    })
  );

  expect(resolved.dataset.items).toHaveLength(2);
  expect(resolved.defaultConfig.buildingRules).toHaveLength(1);
  expect(resolved.catalog.items).toHaveLength(2);
  expect(resolved.catalog.recipes[0]).toMatchObject({
    recipeId: '1',
    icon: 'ore',
  });
  expect(resolved.catalog.buildings[0]).toMatchObject({
    buildingId: '5001',
    icon: 'smelter',
  });
});
