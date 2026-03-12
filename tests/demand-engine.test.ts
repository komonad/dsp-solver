/**
 * 需求引擎测试
 * 
 * 演示各种配方选择策略
 */

import {
  solveDemand,
  createAutoDemand,
  createSingleRecipeDemand,
  createRatioDemand,
  createPriorityDemand,
  createExcludeDemand,
  createDemandBatch,
  type DemandConfig,
} from '../src/core/demandEngine';
import type { GameData, Recipe, Item, Building } from '../src/types';

function createTestData(): GameData {
  const items: Item[] = [
    { id: 'A', name: 'A', originalId: 1, type: 1, iconName: 'a', isRaw: true },
    { id: 'B', name: 'B', originalId: 2, type: 2, iconName: 'b' },
    { id: 'C', name: 'C', originalId: 3, type: 2, iconName: 'c' },
    { id: 'D', name: 'D', originalId: 4, type: 1, iconName: 'd', isRaw: true },
    { id: 'E', name: 'E', originalId: 5, type: 3, iconName: 'e' },
  ];

  // A→B+2C, A+D→2B+C, 3B+2C→E
  const recipes: Recipe[] = [
    { id: 'r1', name: 'A→B+2C', originalId: 1, inputs: [{ itemId: 'A', count: 1 }], outputs: [{ itemId: 'B', count: 1 }, { itemId: 'C', count: 2 }], time: 1, factoryIds: [1], isMultiProduct: true, proliferatorLevel: 3, iconName: 'r1', type: 1 },
    { id: 'r2', name: 'A+D→2B+C', originalId: 2, inputs: [{ itemId: 'A', count: 1 }, { itemId: 'D', count: 1 }], outputs: [{ itemId: 'B', count: 2 }, { itemId: 'C', count: 1 }], time: 1, factoryIds: [1], isMultiProduct: true, proliferatorLevel: 3, iconName: 'r2', type: 1 },
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

  return { version: 'test', items, recipes, buildings, proliferators: [], rawItemIds: ['A', 'D'], itemMap, recipeMap, itemToRecipes };
}

describe('Demand Engine', () => {
  const gameData = createTestData();

  test('用法1: 自动选择配方', () => {
    const config: DemandConfig = {
      demands: [
        createAutoDemand('E', 60, { note: '自动选择最优配方' })
      ]
    };

    const result = solveDemand(config, gameData);

    console.log('\n=== 用法1: 自动选择 ===');
    console.log('可行:', result.feasible);
    console.log('配方执行:');
    for (const [id, count] of result.recipeExecutions.entries()) {
      const recipe = gameData.recipeMap.get(id);
      console.log(`  ${recipe?.name}: ${count.toFixed(2)}/min`);
    }

    expect(result.feasible).toBe(true);
  });

  test('用法2: 指定单一配方', () => {
    // 强制使用 r1 生产 B（即使这不是最优的）
    const config: DemandConfig = {
      demands: [
        createSingleRecipeDemand('B', 60, 'r1', { note: '只用r1生产B' })
      ]
    };

    const result = solveDemand(config, gameData);

    console.log('\n=== 用法2: 指定配方 r1 ===');
    console.log('可行:', result.feasible);
    console.log('配方执行:');
    for (const [id, count] of result.recipeExecutions.entries()) {
      const recipe = gameData.recipeMap.get(id);
      console.log(`  ${recipe?.name}: ${count.toFixed(2)}/min`);
    }
    
    // 验证确实使用了r1
    expect(result.recipeExecutions.has('r1')).toBe(true);
    expect(result.recipeExecutions.get('r1')).toBeGreaterThan(0);
  });

  test('用法3: 多配方按比例混合', () => {
    // 70%用r1，30%用r2生产B
    const config: DemandConfig = {
      demands: [
        createRatioDemand('B', 100, { r1: 70, r2: 30 }, { note: '7:3混合' })
      ]
    };

    const result = solveDemand(config, gameData);

    console.log('\n=== 用法3: 按比例混合 7:3 ===');
    console.log('可行:', result.feasible);
    console.log('配方执行:');
    for (const [id, count] of result.recipeExecutions.entries()) {
      const recipe = gameData.recipeMap.get(id);
      console.log(`  ${recipe?.name}: ${count.toFixed(2)}/min`);
    }

    // 验证比例接近7:3
    const r1 = result.recipeExecutions.get('r1') || 0;
    const r2 = result.recipeExecutions.get('r2') || 0;
    if (r2 > 0) {
      const ratio = r1 / r2;
      console.log(`实际比例 r1:r2 = ${ratio.toFixed(2)}:1`);
    }
  });

  test('用法4: 配方优先级', () => {
    // 优先用r2，如果不可用再用r1
    const config: DemandConfig = {
      demands: [
        createPriorityDemand('B', 60, ['r2', 'r1'], { note: '优先r2' })
      ]
    };

    const result = solveDemand(config, gameData);

    console.log('\n=== 用法4: 优先级 r2 > r1 ===');
    console.log('可行:', result.feasible);
    console.log('配方执行:');
    for (const [id, count] of result.recipeExecutions.entries()) {
      const recipe = gameData.recipeMap.get(id);
      console.log(`  ${recipe?.name}: ${count.toFixed(2)}/min`);
    }

    // 应该优先使用r2
    expect(result.recipeExecutions.get('r2')).toBeGreaterThan(0);
  });

  test('用法5: 排除特定配方', () => {
    // 禁用r1，只能用r2生产B
    const config: DemandConfig = {
      demands: [
        createExcludeDemand('B', 60, ['r1'], { note: '禁用r1' })
      ]
    };

    const result = solveDemand(config, gameData);

    console.log('\n=== 用法5: 排除r1 ===');
    console.log('可行:', result.feasible);
    console.log('配方执行:');
    for (const [id, count] of result.recipeExecutions.entries()) {
      const recipe = gameData.recipeMap.get(id);
      console.log(`  ${recipe?.name}: ${count.toFixed(2)}/min`);
    }

    // 不应该使用r1
    expect(result.recipeExecutions.has('r1')).toBe(false);
  });

  test('用法6: 批量创建需求', () => {
    const demands = createDemandBatch([
      { itemId: 'E', rate: 60 },           // 自动选择
      { itemId: 'B', rate: 100, recipeId: 'r1' },  // 指定r1
    ], {
      allowExternal: true,
    });

    console.log('\n=== 用法6: 批量创建 ===');
    demands.forEach((d, i) => {
      console.log(`需求${i+1}: ${d.itemId} ${d.rate}/min`);
      console.log(`  策略: ${JSON.stringify(d.recipeSelection)}`);
    });

    expect(demands).toHaveLength(2);
    expect(demands[1].recipeSelection).toEqual({ type: 'single', recipeId: 'r1' });
  });

  test('用法7: 复杂场景 - E的完全配平方案', () => {
    // 强制使用特定比例实现完全配平
    // r1=20, r2=80, r3=60 是完全配平
    const config: DemandConfig = {
      demands: [
        // 先指定B和C的生产比例
        createRatioDemand('B', 180, { r1: 20, r2: 80 }, { note: 'B的生产比例' }),
        createSingleRecipeDemand('E', 60, 'r3', { note: 'E只能用r3' }),
      ],
      objective: 'min-waste',
    };

    const result = solveDemand(config, gameData);

    console.log('\n=== 用法7: 手动配平方案 ===');
    console.log('可行:', result.feasible);
    console.log('配方执行:');
    for (const [id, count] of result.recipeExecutions.entries()) {
      const recipe = gameData.recipeMap.get(id);
      console.log(`  ${recipe?.name}: ${count.toFixed(2)}/min`);
    }

    console.log('\n原料需求:');
    for (const [id, rate] of result.details.rawMaterials.entries()) {
      const item = gameData.itemMap.get(id);
      console.log(`  ${item?.name}: ${rate.toFixed(2)}/min`);
    }

    console.log('\n副产物:');
    if (result.details.byproducts.size === 0) {
      console.log('  无副产物（完美配平）');
    } else {
      for (const [id, rate] of result.details.byproducts.entries()) {
        const item = gameData.itemMap.get(id);
        console.log(`  ${item?.name}: ${rate.toFixed(2)}/min`);
      }
    }
  });

  test('实际数学验证', () => {
    // 验证 r1=20, r2=80, r3=60 确实配平
    const r1 = 20, r2 = 80, r3 = 60;
    
    // B: 1*r1 + 2*r2 = 20 + 160 = 180
    //    需要 3*r3 = 180，刚好
    const bProduction = 1 * r1 + 2 * r2;
    const bConsumption = 3 * r3;
    
    // C: 2*r1 + 1*r2 = 40 + 80 = 120
    //    需要 2*r3 = 120，刚好
    const cProduction = 2 * r1 + 1 * r2;
    const cConsumption = 2 * r3;

    console.log('\n=== 数学验证 ===');
    console.log(`B 产出: ${bProduction}, 消耗: ${bConsumption}, 净: ${bProduction - bConsumption}`);
    console.log(`C 产出: ${cProduction}, 消耗: ${cConsumption}, 净: ${cProduction - cConsumption}`);

    expect(bProduction).toBe(bConsumption);
    expect(cProduction).toBe(cConsumption);
  });
});
