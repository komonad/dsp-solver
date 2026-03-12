/**
 * 配方修改器测试 (简化版)
 */

import { recalculateWithModifications } from '../src/core/recipeModifier';
import type { GameData, Recipe, Item, Building } from '../src/types';

function createTestData(): GameData {
  const items: Item[] = [
    { id: 'A', name: 'A', originalId: 1, type: 1, iconName: 'a', isRaw: true },
    { id: 'B', name: 'B', originalId: 2, type: 2, iconName: 'b' },
    { id: 'C', name: 'C', originalId: 3, type: 2, iconName: 'c' },
    { id: 'E', name: 'E', originalId: 5, type: 3, iconName: 'e' },
  ];

  const recipes: Recipe[] = [
    { id: 'r1', name: 'A→B+2C', originalId: 1, inputs: [{ itemId: 'A', count: 1 }], outputs: [{ itemId: 'B', count: 1 }, { itemId: 'C', count: 2 }], time: 1, factoryIds: [1], isMultiProduct: true, proliferatorLevel: 3, iconName: 'r1', type: 1 },
    { id: 'r3', name: '3B+2C→E', originalId: 3, inputs: [{ itemId: 'B', count: 3 }, { itemId: 'C', count: 2 }], outputs: [{ itemId: 'E', count: 1 }], time: 1, factoryIds: [1], isMultiProduct: false, proliferatorLevel: 3, iconName: 'r3', type: 1 },
  ];

  const buildings: Building[] = [
    { id: '1', originalId: 1, name: '测试建筑', category: 'assembler', speed: 1, workPower: 1, idlePower: 0.1, hasProliferatorSlot: true },
  ];

  const itemMap = new Map(items.map(i => [i.id, i]));
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const itemToRecipes = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    for (const output of recipe.outputs) {
      if (!itemToRecipes.has(output.itemId)) itemToRecipes.set(output.itemId, []);
      itemToRecipes.get(output.itemId)!.push(recipe);
    }
  }

  return { version: 'test', items, recipes, buildings, proliferators: [], rawItemIds: ['A'], itemMap, recipeMap, itemToRecipes };
}

describe('Recipe Modifier', () => {
  const gameData = createTestData();

  test('功能待重新实现', () => {
    const result = recalculateWithModifications(
      {
        targetItemId: 'E',
        targetRate: 60,
        modifications: [],
      },
      gameData
    );

    // 暂时返回失败
    expect(result.success).toBe(false);
    expect(result.error).toContain('待重新实现');
  });
});
