import { readFileSync } from 'fs';
import {
  loadCatalogRuleSetFromFile,
  resolveCatalogModel,
  type VanillaDatasetSpec,
  validateCatalogRuleSetSpec,
} from '../src/catalog';

function loadVanillaDataset(): VanillaDatasetSpec {
  const rawText = readFileSync('./data/Vanilla.json', 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(rawText) as VanillaDatasetSpec;
}

test('Vanilla.rules.json is internally valid', async () => {
  const rawText = readFileSync('./data/Vanilla.rules.json', 'utf8').replace(/^\uFEFF/, '');
  const raw = JSON.parse(rawText) as unknown;
  const validation = validateCatalogRuleSetSpec(raw);

  expect(validation.valid).toBe(true);
  expect(validation.errors).toEqual([]);
  const rules = await loadCatalogRuleSetFromFile('./data/Vanilla.rules.json');
  expect(rules.proliferatorLevels.find(level => level.Level === 1)).toMatchObject({
    ItemID: 1141,
    SprayCount: 12,
  });
});

test('resolveCatalogModel compiles Vanilla.json into the internal catalog model', async () => {
  const dataset = loadVanillaDataset();
  const rules = await loadCatalogRuleSetFromFile('./data/Vanilla.rules.json');
  const resolved = resolveCatalogModel(dataset, rules);

  expect(resolved.version).toBe('vanilla-compatible@1');
  expect(resolved.items).toHaveLength(174);
  expect(resolved.recipes).toHaveLength(238);
  expect(resolved.buildings).toHaveLength(24);
  expect(resolved.proliferatorLevels.map(level => level.level)).toEqual([0, 1, 2, 3]);
  expect(resolved.proliferatorLevelMap.get(1)).toMatchObject({
    itemId: '1141',
    sprayCount: 12,
  });
  expect(resolved.rawItemIds).toHaveLength(16);
  expect(resolved.syntheticRecipeIds).toHaveLength(78);

  const assembler4 = resolved.buildingMap.get('2318');
  expect(assembler4).toBeDefined();
  expect(assembler4?.category).toBe('assembler');
  expect(assembler4?.speedMultiplier).toBe(3);
  expect(assembler4?.workPowerMW).toBeCloseTo(2.7, 6);

  const ironSmelting = resolved.recipeMap.get('1');
  expect(ironSmelting).toBeDefined();
  expect(ironSmelting?.cycleTimeSec).toBe(1);
  expect(ironSmelting?.allowedBuildingIds).toEqual(['2302', '2315', '2319']);
  expect(ironSmelting?.modifierCode).toBe(3);
  expect(ironSmelting?.modifierKind).toBe('proliferator');
  expect(ironSmelting?.supportsProliferatorModes).toEqual(['none', 'speed', 'productivity']);
  expect(ironSmelting?.maxProliferatorLevel).toBe(3);

  const fractionation = resolved.recipeMap.get('115');
  expect(fractionation).toBeDefined();
  expect(fractionation?.modifierCode).toBe(1);
  expect(fractionation?.supportsProliferatorModes).toEqual(['none', 'speed']);
  expect(fractionation?.maxProliferatorLevel).toBe(3);

  const lensRecipe = resolved.recipeMap.get('21208');
  expect(lensRecipe).toBeDefined();
  expect(lensRecipe?.modifierCode).toBe(4);
  expect(lensRecipe?.modifierKind).toBe('special');
  expect(lensRecipe?.supportsProliferatorModes).toEqual(['none']);
  expect(lensRecipe?.maxProliferatorLevel).toBe(0);
  expect(lensRecipe?.tags).toContain('ray-receiver-lens');
  expect(lensRecipe?.isSynthetic).toBe(true);

  const syntheticOre = resolved.recipeMap.get('11001');
  expect(syntheticOre).toBeDefined();
  expect(syntheticOre?.isSynthetic).toBe(true);
  expect(syntheticOre?.tags).toContain('synthetic');

  const ironOre = resolved.itemMap.get('1001');
  const universeMatrix = resolved.itemMap.get('6006');
  expect(ironOre?.kind).toBe('raw');
  expect(universeMatrix?.kind).toBe('product');
});
