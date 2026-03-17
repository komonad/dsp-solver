type ProliferatorMode = 'none' | 'speed' | 'productivity';

interface MinimalItemSpec {
  itemId: string;
  name: string;
  kind: 'raw' | 'product' | 'utility';
}

interface MinimalBuildingSpec {
  buildingId: string;
  name: string;
  speedMultiplier: number;
  workPowerMW: number;
  intrinsicProductivityBonus?: number;
}

interface MinimalProliferatorLevelSpec {
  level: number;
  itemId: string;
  sprayCount: number;
  speedMultiplier: number;
  productivityMultiplier: number;
  powerMultiplier: number;
}

interface MinimalRecipeSpec {
  recipeId: string;
  name: string;
  cycleTimeSec: number;
  inputs: Array<{ itemId: string; amount: number }>;
  outputs: Array<{ itemId: string; amount: number }>;
  allowedBuildingIds: string[];
  supportedProliferatorModes: ProliferatorMode[];
  maxProliferatorLevel: number;
}

interface MinimalCatalogSpec {
  items: MinimalItemSpec[];
  buildings: MinimalBuildingSpec[];
  proliferatorLevels: MinimalProliferatorLevelSpec[];
  recipes: MinimalRecipeSpec[];
}

interface CompiledVariant {
  recipeId: string;
  buildingId: string;
  mode: ProliferatorMode;
  level: number;
  singleBuildingRunsPerMin: number;
  inputPerRun: Record<string, number>;
  outputPerRun: Record<string, number>;
  powerCostMWPerRunPerMin: number;
}

const minimalCatalog: MinimalCatalogSpec = {
  items: [
    { itemId: 'ore', name: 'Test Ore', kind: 'raw' },
    { itemId: 'plate', name: 'Test Plate', kind: 'product' },
    { itemId: 'spray_mk1', name: 'Proliferator Mk.I', kind: 'utility' },
  ],
  buildings: [
    {
      buildingId: 'smelter',
      name: 'Test Smelter',
      speedMultiplier: 1,
      workPowerMW: 1,
    },
  ],
  proliferatorLevels: [
    {
      level: 1,
      itemId: 'spray_mk1',
      sprayCount: 10,
      speedMultiplier: 2,
      productivityMultiplier: 2,
      powerMultiplier: 2,
    },
  ],
  recipes: [
    {
      recipeId: 'ore_to_plate',
      name: 'Ore to Plate',
      cycleTimeSec: 60,
      inputs: [{ itemId: 'ore', amount: 1 }],
      outputs: [{ itemId: 'plate', amount: 1 }],
      allowedBuildingIds: ['smelter'],
      supportedProliferatorModes: ['none', 'speed', 'productivity'],
      maxProliferatorLevel: 1,
    },
  ],
};

function compileVariant(
  recipe: MinimalRecipeSpec,
  building: MinimalBuildingSpec,
  proliferator: MinimalProliferatorLevelSpec | null,
  mode: ProliferatorMode
): CompiledVariant {
  const baseRunsPerMin = 60 / recipe.cycleTimeSec;
  const speedModeMultiplier = mode === 'speed' && proliferator ? proliferator.speedMultiplier : 1;
  const productivityModeMultiplier =
    mode === 'productivity' && proliferator ? proliferator.productivityMultiplier : 1;
  const powerMultiplier = mode === 'none' || !proliferator ? 1 : proliferator.powerMultiplier;
  const singleBuildingRunsPerMin = baseRunsPerMin * building.speedMultiplier * speedModeMultiplier;
  const inputPerRun = Object.fromEntries(recipe.inputs.map(input => [input.itemId, input.amount]));
  const totalInputAmountPerRun = recipe.inputs.reduce((sum, input) => sum + input.amount, 0);

  if (mode !== 'none' && proliferator) {
    inputPerRun[proliferator.itemId] = totalInputAmountPerRun / proliferator.sprayCount;
  }

  const outputPerRun = Object.fromEntries(
    recipe.outputs.map(output => [
      output.itemId,
      output.amount * (1 + (building.intrinsicProductivityBonus ?? 0)) * productivityModeMultiplier,
    ])
  );

  return {
    recipeId: recipe.recipeId,
    buildingId: building.buildingId,
    mode,
    level: proliferator?.level ?? 0,
    singleBuildingRunsPerMin,
    inputPerRun,
    outputPerRun,
    powerCostMWPerRunPerMin: (building.workPowerMW * powerMultiplier) / singleBuildingRunsPerMin,
  };
}

test('minimal abstract config expands to three self-consistent recipe variants', () => {
  const recipe = minimalCatalog.recipes[0];
  const building = minimalCatalog.buildings[0];
  const level1 = minimalCatalog.proliferatorLevels[0];

  const none = compileVariant(recipe, building, null, 'none');
  const speed = compileVariant(recipe, building, level1, 'speed');
  const productivity = compileVariant(recipe, building, level1, 'productivity');

  expect(none).toEqual({
    recipeId: 'ore_to_plate',
    buildingId: 'smelter',
    mode: 'none',
    level: 0,
    singleBuildingRunsPerMin: 1,
    inputPerRun: { ore: 1 },
    outputPerRun: { plate: 1 },
    powerCostMWPerRunPerMin: 1,
  });

  expect(speed).toEqual({
    recipeId: 'ore_to_plate',
    buildingId: 'smelter',
    mode: 'speed',
    level: 1,
    singleBuildingRunsPerMin: 2,
    inputPerRun: { ore: 1, spray_mk1: 0.1 },
    outputPerRun: { plate: 1 },
    powerCostMWPerRunPerMin: 1,
  });

  expect(productivity).toEqual({
    recipeId: 'ore_to_plate',
    buildingId: 'smelter',
    mode: 'productivity',
    level: 1,
    singleBuildingRunsPerMin: 1,
    inputPerRun: { ore: 1, spray_mk1: 0.1 },
    outputPerRun: { plate: 2 },
    powerCostMWPerRunPerMin: 2,
  });
});
