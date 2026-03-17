import { GameData, Building, Recipe } from '../types';

function collectProductivityCriticalRecipes(
  gameData: GameData,
  demandItemIds: string[]
): Set<string> {
  const criticalRecipes = new Set<string>();
  const visitedItems = new Set<string>();
  const queue = [...demandItemIds];

  while (queue.length > 0) {
    const itemId = queue.shift()!;
    if (visitedItems.has(itemId)) continue;
    visitedItems.add(itemId);

    for (const recipe of gameData.itemToRecipes.get(itemId) || []) {
      if (criticalRecipes.has(recipe.id)) continue;
      criticalRecipes.add(recipe.id);

      for (const input of recipe.inputs) {
        if (!gameData.defaultRawItemIds.includes(input.itemId)) {
          queue.push(input.itemId);
        }
      }
    }
  }

  return criticalRecipes;
}

export function buildLayeredRecipeBuildings(
  gameData: GameData,
  demandItemIds: string[]
): Map<string, string> {
  const result = new Map<string, string>();
  const buildingsByCategory = new Map<string, Building[]>();

  for (const building of gameData.buildings) {
    if (!buildingsByCategory.has(building.category)) {
      buildingsByCategory.set(building.category, []);
    }
    buildingsByCategory.get(building.category)!.push(building);
  }

  for (const [, buildings] of buildingsByCategory) {
    buildings.sort((a, b) => (a.intrinsicProductivity || 0) - (b.intrinsicProductivity || 0));
  }

  const targetRecipes = collectProductivityCriticalRecipes(gameData, demandItemIds);

  for (const recipe of gameData.recipes) {
    const defaultBuilding = gameData.buildings.find(b => recipe.factoryIds.includes(b.originalId));
    if (!defaultBuilding) continue;
    const categoryBuildings = buildingsByCategory.get(defaultBuilding.category) || [];

    let picked: Building | undefined;
    if (targetRecipes.has(recipe.id)) {
      picked = categoryBuildings[categoryBuildings.length - 1];
    } else {
      picked = categoryBuildings.find(b => !(b.intrinsicProductivity && b.intrinsicProductivity > 0)) || categoryBuildings[0];
    }

    if (picked) {
      result.set(recipe.id, picked.id);
    }
  }

  return result;
}
