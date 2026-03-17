import type { Building, GameData, Recipe } from '../types';
import type { MultiDemandResult } from '../core/multiDemandSolver';
import { calculateNetFlow } from '../core/productionModel';

export interface ResultRecipeModel {
  recipeId: string;
  recipeName: string;
  buildingId: string;
  buildingName: string;
  executionsPerMinute: number;
  perBuildingExecutionsPerMinute: number;
  buildingCount: number;
  inputs: Array<{ itemId: string; itemName: string; rate: number }>;
  outputs: Array<{ itemId: string; itemName: string; rate: number }>;
}

export interface ResultModel {
  recipes: ResultRecipeModel[];
  rawMaterials: Array<{ itemId: string; itemName: string; rate: number }>;
}

export function buildResultModel(
  result: MultiDemandResult,
  gameData: GameData,
  recipeBuildings: Map<string, string>
): ResultModel {
  const recipes: ResultRecipeModel[] = [];

  // 使用 recipes（LP 求解器的变量单位）而不是 recipeRatesPerMinute
  const recipeCounts = result.recipes;
  for (const [recipeId, count] of recipeCounts.entries()) {
    const recipe = gameData.recipeMap.get(recipeId);
    if (!recipe) continue;
    const buildingId = recipeBuildings.get(recipeId) || String(recipe.factoryIds[0]);
    const building = gameData.buildings.find(b => b.id === buildingId || String(b.originalId) === buildingId);
    if (!building) continue;

    const netFlow = calculateNetFlow(recipe, count, { recipe, building });
    const perBuildingExecutionsPerMinute = building.speed * (60 / recipe.time);
    
    // 修正：LP 模型的变量 count 本身就是建筑数量！
    const buildingCount = count;
    // 实际执行次数 = 建筑数量 * 单建筑每分钟执行次数
    const executionsPerMinute = buildingCount * perBuildingExecutionsPerMinute;

    recipes.push({
      recipeId,
      recipeName: recipe.name,
      buildingId: building.id,
      buildingName: building.name,
      executionsPerMinute,
      perBuildingExecutionsPerMinute,
      buildingCount,
      inputs: recipe.inputs.map(input => ({
        itemId: input.itemId,
        itemName: gameData.itemMap.get(input.itemId)?.name || input.itemId,
        rate: Math.abs(Math.min(netFlow.get(input.itemId) || 0, 0)),
      })),
      outputs: recipe.outputs.map(output => ({
        itemId: output.itemId,
        itemName: gameData.itemMap.get(output.itemId)?.name || output.itemId,
        rate: Math.max(netFlow.get(output.itemId) || 0, 0),
      })),
    });
  }

  return {
    recipes,
    rawMaterials: Array.from(result.rawMaterials.entries()).map(([itemId, rate]) => ({
      itemId,
      itemName: gameData.itemMap.get(itemId)?.name || itemId,
      rate,
    })),
  };
}
