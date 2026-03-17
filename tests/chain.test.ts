/**
 * 链式生产测试
 * 2A→B, 2B→C, 2C→D, 2D→E
 * 生产60个E需要多少A？
 */

import { solveMultiDemand } from '../src/legacy/core/multiDemandSolver';
import type { GameData, Recipe, Item, Building } from '../src/legacy/types';

function createChainTestData(): GameData {
  const items: Item[] = [
    { id: 'A', name: 'A（原矿）', originalId: 1, type: 1, iconName: 'a', isRaw: true },
    { id: 'B', name: 'B', originalId: 2, type: 2, iconName: 'b' },
    { id: 'C', name: 'C', originalId: 3, type: 2, iconName: 'c' },
    { id: 'D', name: 'D', originalId: 4, type: 2, iconName: 'd' },
    { id: 'E', name: 'E', originalId: 5, type: 3, iconName: 'e' },
  ];

  const recipes: Recipe[] = [
    // 2A → B (time=1)
    { id: 'rAB', name: '2A→B', originalId: 1, 
      inputs: [{ itemId: 'A', count: 2 }], 
      outputs: [{ itemId: 'B', count: 1 }], 
      time: 1, factoryIds: [1], isMultiProduct: false, proliferatorLevel: 3, iconName: 'r1', type: 1 },
    // 2B → C (time=1)
    { id: 'rBC', name: '2B→C', originalId: 2, 
      inputs: [{ itemId: 'B', count: 2 }], 
      outputs: [{ itemId: 'C', count: 1 }], 
      time: 1, factoryIds: [1], isMultiProduct: false, proliferatorLevel: 3, iconName: 'r2', type: 1 },
    // 2C → D (time=1)
    { id: 'rCD', name: '2C→D', originalId: 3, 
      inputs: [{ itemId: 'C', count: 2 }], 
      outputs: [{ itemId: 'D', count: 1 }], 
      time: 1, factoryIds: [1], isMultiProduct: false, proliferatorLevel: 3, iconName: 'r3', type: 1 },
    // 2D → E (time=1)
    { id: 'rDE', name: '2D→E', originalId: 4, 
      inputs: [{ itemId: 'D', count: 2 }], 
      outputs: [{ itemId: 'E', count: 1 }], 
      time: 1, factoryIds: [1], isMultiProduct: false, proliferatorLevel: 3, iconName: 'r4', type: 1 },
  ];

  const buildings: Building[] = [
    { id: '1', originalId: 1, name: '制造台', category: 'assembler', speed: 1, workPower: 1, idlePower: 0.1, hasProliferatorSlot: true },
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

describe('链式生产测试', () => {
  const gameData = createChainTestData();

  test('生产60个E需要多少A？', () => {
    // 理论计算：
    // E: 60/min
    // D: 60 * 2 = 120/min
    // C: 120 * 2 = 240/min  
    // B: 240 * 2 = 480/min
    // A: 480 * 2 = 960/min
    
    const result = solveMultiDemand(
      [{ itemId: 'E', rate: 60 }],
      gameData
    );

    console.log('\n=== 链式生产测试：60 E/min ===');
    console.log('可行:', result.feasible);
    console.log('消息:', result.message);
    
    console.log('\n配方执行:');
    for (const [recipeId, count] of result.recipes) {
      const recipe = gameData.recipeMap.get(recipeId);
      console.log(`  ${recipe?.name || recipeId}: ${count.toFixed(4)}/min`);
    }
    
    console.log('\n需求满足:');
    for (const [itemId, rate] of result.satisfiedDemands) {
      const item = gameData.itemMap.get(itemId);
      console.log(`  ${item?.name || itemId}: ${rate.toFixed(2)}/min`);
    }
    
    console.log('\n原材料消耗:');
    for (const [itemId, rate] of result.rawMaterials) {
      const item = gameData.itemMap.get(itemId);
      console.log(`  ${item?.name || itemId}: ${rate.toFixed(2)}/min`);
    }

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('E') || 0).toBeGreaterThanOrEqual(59.9);
    
    // 验证A的消耗量是960/min
    const aConsumption = result.rawMaterials.get('A') || 0;
    console.log(`\nA消耗: ${aConsumption}/min, 期望: 960/min`);
    expect(aConsumption).toBeCloseTo(960, 0);
  });
});
