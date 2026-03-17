import { GameData } from '../types';

export function inferImplicitRawItems(gameData: GameData): string[] {
  const producible = new Set<string>();
  for (const recipe of gameData.recipes) {
    for (const output of recipe.outputs) {
      producible.add(output.itemId);
    }
  }

  return gameData.items
    .filter(item => !producible.has(item.id))
    .map(item => item.id);
}

