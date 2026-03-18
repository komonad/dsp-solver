import { readFileSync } from 'fs';
import {
  loadCatalogDefaultConfigFromFile,
  loadResolvedCatalogFromFiles,
  resolveCatalogModel,
  type VanillaDatasetSpec,
  validateCatalogDefaultConfigSpec,
} from '../src/catalog';

function loadVanillaDataset(): VanillaDatasetSpec {
  const rawText = readFileSync('./data/Vanilla.json', 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(rawText) as VanillaDatasetSpec;
}

test('Vanilla.defaults.json is internally valid', async () => {
  const rawText = readFileSync('./data/Vanilla.defaults.json', 'utf8').replace(/^\uFEFF/, '');
  const raw = JSON.parse(rawText) as unknown;
  const validation = validateCatalogDefaultConfigSpec(raw);

  expect(validation.valid).toBe(true);
  expect(validation.errors).toEqual([]);

  const defaultConfig = await loadCatalogDefaultConfigFromFile('./data/Vanilla.defaults.json');
  expect(defaultConfig.proliferatorLevels?.find(level => level.Level === 1)).toMatchObject({
    ItemID: 1141,
    SprayCount: 13,
    SpeedMultiplier: 1.25,
    ProductivityMultiplier: 1.125,
    PowerMultiplier: 1.3,
  });
  expect(defaultConfig.recommendedDisabledBuildingIds).toEqual([1]);
  expect(defaultConfig.recommendedRawItemTypeIds).toEqual([1]);
});

test('proliferator level config does not require ItemID for calculation-only usage', () => {
  const validation = validateCatalogDefaultConfigSpec({
    proliferatorLevels: [
      {
        Level: 1,
        SprayCount: 13,
        SpeedMultiplier: 1.25,
        ProductivityMultiplier: 1.125,
        PowerMultiplier: 1.3,
      },
    ],
  });

  expect(validation.valid).toBe(true);
  expect(validation.errors).toEqual([]);
});

test('resolveCatalogModel compiles Vanilla.json into the internal catalog model', async () => {
  const dataset = loadVanillaDataset();
  const defaultConfig = await loadCatalogDefaultConfigFromFile('./data/Vanilla.defaults.json');
  const resolved = resolveCatalogModel(dataset, defaultConfig);

  expect(resolved.version).toBe('vanilla-compatible@1');
  expect(resolved.items).toHaveLength(174);
  expect(resolved.recipes).toHaveLength(238);
  expect(resolved.buildings).toHaveLength(24);
  expect(resolved.proliferatorLevels.map(level => level.level)).toEqual([0, 1, 2, 3]);
  expect(resolved.proliferatorLevelMap.get(1)).toMatchObject({
    itemId: '1141',
    sprayCount: 13,
    speedMultiplier: 1.25,
    productivityMultiplier: 1.125,
    powerMultiplier: 1.3,
  });
  expect(resolved.proliferatorLevelMap.get(2)).toMatchObject({
    sprayCount: 28,
    speedMultiplier: 1.5,
    productivityMultiplier: 1.2,
    powerMultiplier: 1.7,
  });
  expect(resolved.proliferatorLevelMap.get(3)).toMatchObject({
    sprayCount: 75,
    speedMultiplier: 2,
    productivityMultiplier: 1.25,
    powerMultiplier: 2.5,
  });
  expect(resolved.recommendedDisabledBuildingIds).toEqual(['1']);
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

test('resolveCatalogModel still returns a valid fallback model without default config', () => {
  const dataset = loadVanillaDataset();
  const resolved = resolveCatalogModel(dataset);

  expect(resolved.defaultConfig).toEqual({});
  expect(resolved.proliferatorLevels).toEqual([]);

  const ironSmelting = resolved.recipeMap.get('1');
  const assembler4 = resolved.buildingMap.get('2318');
  const ironOre = resolved.itemMap.get('1001');

  expect(ironSmelting?.supportsProliferatorModes).toEqual(['none']);
  expect(ironSmelting?.maxProliferatorLevel).toBe(0);
  expect(assembler4?.category).toBe('factory');
  expect(ironOre?.kind).toBe('intermediate');
  expect(resolved.rawItemIds).not.toContain('1001');
});

test.each([
  {
    datasetPath: './data/LegacyRefinery.json',
    defaultsPath: './data/LegacyRefinery.defaults.json',
    expectedRecipeCount: 2,
    expectedBuildingCount: 1,
    expectedRecommendedSolve: {
      objective: 'min_external_input',
      balancePolicy: 'force_balance',
    },
  },
  {
    datasetPath: './data/LegacyCycle.json',
    defaultsPath: './data/LegacyCycle.defaults.json',
    expectedRecipeCount: 4,
    expectedBuildingCount: 3,
    expectedRecommendedSolve: {
      objective: 'min_external_input',
      balancePolicy: 'allow_surplus',
    },
  },
])(
  'loadResolvedCatalogFromFiles supports scenario dataset $datasetPath',
  async ({
    datasetPath,
    defaultsPath,
    expectedRecipeCount,
    expectedBuildingCount,
    expectedRecommendedSolve,
  }) => {
    const resolved = await loadResolvedCatalogFromFiles(datasetPath, defaultsPath);

    expect(resolved.recipes).toHaveLength(expectedRecipeCount);
    expect(resolved.buildings).toHaveLength(expectedBuildingCount);
    expect(resolved.recommendedSolve).toEqual(expectedRecommendedSolve);
  }
);
