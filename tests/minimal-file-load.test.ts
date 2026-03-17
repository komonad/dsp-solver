import {
  loadCatalogRuleSetFromFile,
  loadResolvedCatalogFromFiles,
  loadVanillaDatasetFromFile,
} from '../src/catalog';

test('minimal config files load end-to-end into a resolved catalog model', async () => {
  const dataset = await loadVanillaDatasetFromFile('./data/MinimalVanilla.json');
  const rules = await loadCatalogRuleSetFromFile('./data/MinimalRules.json');
  const resolved = await loadResolvedCatalogFromFiles(
    './data/MinimalVanilla.json',
    './data/MinimalRules.json'
  );

  expect(dataset.items).toHaveLength(4);
  expect(dataset.recipes).toHaveLength(1);
  expect(rules.buildingRules).toHaveLength(1);
  expect(rules.recipeModifierRules).toHaveLength(2);
  expect(rules.proliferatorLevels).toHaveLength(1);

  const recipe = resolved.recipeMap.get('1');
  const building = resolved.buildingMap.get('5001');
  const level1 = resolved.proliferatorLevelMap.get(1);

  expect(recipe).toBeDefined();
  expect(building).toBeDefined();
  expect(level1).toBeDefined();

  expect(recipe?.allowedBuildingIds).toEqual(['5001']);
  expect(recipe?.supportsProliferatorModes).toEqual(['none', 'speed', 'productivity']);
  expect(recipe?.maxProliferatorLevel).toBe(1);

  expect(building?.name).toBe('测试熔炉');
  expect(building?.category).toBe('smelter');
  expect(building?.speedMultiplier).toBe(1);
  expect(building?.workPowerMW).toBeCloseTo(1, 6);

  expect(level1?.itemId).toBe('1141');
  expect(level1?.sprayCount).toBe(10);
  expect(level1?.speedMultiplier).toBe(2);
  expect(level1?.productivityMultiplier).toBe(2);
  expect(level1?.powerMultiplier).toBe(2);
});

test('minimal config files contain enough information to derive spray consumption and variant coefficients', async () => {
  const resolved = await loadResolvedCatalogFromFiles(
    './data/MinimalVanilla.json',
    './data/MinimalRules.json'
  );

  const recipe = resolved.recipeMap.get('1');
  const building = resolved.buildingMap.get('5001');
  const level1 = resolved.proliferatorLevelMap.get(1);

  expect(recipe).toBeDefined();
  expect(building).toBeDefined();
  expect(level1).toBeDefined();

  const totalInputAmountPerRun = recipe!.inputs.reduce((sum, input) => sum + input.amount, 0);
  const sprayPerRun = totalInputAmountPerRun / level1!.sprayCount!;
  const speedVariantSingleBuildingRunsPerMin =
    (60 / recipe!.cycleTimeSec) * building!.speedMultiplier * level1!.speedMultiplier;
  const productivityVariantOutputPerRun =
    recipe!.outputs[0].amount * (1 + building!.intrinsicProductivityBonus) * level1!.productivityMultiplier;

  expect(sprayPerRun).toBe(0.1);
  expect(speedVariantSingleBuildingRunsPerMin).toBe(2);
  expect(productivityVariantOutputPerRun).toBe(2);
});
