import { GameData, Recipe } from '../types';

function recipeTransitivelyDependsOnItem(
  recipe: Recipe,
  targetItemId: string,
  gameData: GameData,
  visitingRecipes: Set<string>,
  memo: Map<string, boolean>
): boolean {
  const memoKey = `${recipe.id}=>${targetItemId}`;
  if (memo.has(memoKey)) return memo.get(memoKey)!;
  if (visitingRecipes.has(recipe.id)) return false;

  visitingRecipes.add(recipe.id);
  for (const input of recipe.inputs) {
    if (input.itemId === targetItemId) {
      memo.set(memoKey, true);
      visitingRecipes.delete(recipe.id);
      return true;
    }

    const producers = gameData.itemToRecipes.get(input.itemId) || [];
    if (producers.some(producer => recipeTransitivelyDependsOnItem(producer, targetItemId, gameData, visitingRecipes, memo))) {
      memo.set(memoKey, true);
      visitingRecipes.delete(recipe.id);
      return true;
    }
  }

  visitingRecipes.delete(recipe.id);
  memo.set(memoKey, false);
  return false;
}

export function inferTargetRawOverrides(targetItemIds: string[], gameData: GameData): string[] {
  const forcedRaw = new Set<string>();
  const memo = new Map<string, boolean>();

  for (const item of gameData.items) {
    if (targetItemIds.includes(item.id)) continue;
    const producers = gameData.itemToRecipes.get(item.id) || [];
    if (producers.length === 0) continue;

    for (const targetItemId of targetItemIds) {
      const allProducersDependOnTarget = producers.every(producer =>
        recipeTransitivelyDependsOnItem(producer, targetItemId, gameData, new Set<string>(), memo)
      );

      if (allProducersDependOnTarget) {
        forcedRaw.add(item.id);
      }
    }
  }

  return Array.from(forcedRaw);
}

