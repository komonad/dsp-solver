import { GameData, Recipe, Building } from '../types';
import { MultiDemandResult } from '../core/multiDemandSolver';
import { calculateProductionParams } from '../core/productionModel';

export interface DisplayRecipeRow {
  recipeId: string;
  outputItemId: string;
  executionsPerMinute: number;
  buildingId?: string;
  buildingName?: string;
  actualBuildingCount: number;
  displayedBuildingCount: number;
  totalPower: number;
}

export interface DisplayIoRate {
  itemId: string;
  baseRate: number;
  actualRate: number;
  multiplier: number;
}

export function calculateDisplayIoRates(
  recipe: Recipe,
  executionsPerMinute: number,
  building: Building | undefined,
  proliferator: { level: number; mode: string }
): { inputs: DisplayIoRate[]; outputs: DisplayIoRate[] } {
  const buildingOutputMultiplier = building?.intrinsicProductivity ? (1 + building.intrinsicProductivity) : 1;
  const proliferatorOutputMultiplier = proliferator.level > 0 && proliferator.mode === 'productivity'
    ? 1.125
    : 1;
  const outputMultiplier = buildingOutputMultiplier * proliferatorOutputMultiplier;

  return {
    inputs: recipe.inputs.map(input => ({
      itemId: input.itemId,
      baseRate: input.count * executionsPerMinute,
      actualRate: input.count * executionsPerMinute,
      multiplier: 1,
    })),
    outputs: recipe.outputs.map(output => ({
      itemId: output.itemId,
      baseRate: output.count * executionsPerMinute,
      actualRate: output.count * executionsPerMinute * outputMultiplier,
      multiplier: outputMultiplier,
    })),
  };
}

export function calculateDisplayRecipeRow(
  recipe: Recipe,
  executionsPerMinute: number,
  building: Building | undefined,
  proliferator: { level: number; mode: string }
): DisplayRecipeRow {
  if (!building) {
    return {
      recipeId: recipe.id,
      outputItemId: recipe.outputs[0]?.itemId || '',
      executionsPerMinute,
      actualBuildingCount: 0,
      displayedBuildingCount: 0,
      totalPower: 0,
    };
  }

  const params = calculateProductionParams({
    recipe,
    building,
    proliferator: proliferator.level > 0 ? {
      level: proliferator.level as 0 | 1 | 2 | 3,
      mode: proliferator.mode as 'none' | 'speed' | 'productivity',
      sprayCount: 0,
    } : undefined,
  });

  const executionsPerBuildingPerMinute = 60 / params.cycleTime;
  const actualBuildingCount = executionsPerBuildingPerMinute > 0
    ? executionsPerMinute / executionsPerBuildingPerMinute
    : 0;
  const displayedBuildingCount = Math.ceil(actualBuildingCount);
  const totalPower = displayedBuildingCount * (building.workPower || 0);

  return {
    recipeId: recipe.id,
    outputItemId: recipe.outputs[0]?.itemId || '',
    executionsPerMinute,
    buildingId: building.id,
    buildingName: building.name,
    actualBuildingCount,
    displayedBuildingCount,
    totalPower,
  };
}

export function buildDisplayRecipeRows(
  result: MultiDemandResult,
  gameData: GameData,
  getBuilding: (recipe: Recipe) => Building | undefined,
  getProliferator: (recipe: Recipe, building: Building | undefined) => { level: number; mode: string }
): DisplayRecipeRow[] {
  const rows: DisplayRecipeRow[] = [];

  for (const [recipeId, executionsPerMinute] of result.recipes) {
    const recipe = gameData.recipeMap.get(recipeId);
    if (!recipe) continue;
    const building = getBuilding(recipe);
    const proliferator = getProliferator(recipe, building);
    rows.push(calculateDisplayRecipeRow(recipe, executionsPerMinute, building, proliferator));
  }

  return rows;
}
