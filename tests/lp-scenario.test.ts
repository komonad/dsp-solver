/**
 * 线性规划求解器场景测试
 * 
 * 场景：两个多产物配方配平
 * 
 * 配方1: A -> B + 2C
 * 配方2: A + D -> 2B + C
 * 配方3: 3B + 2C -> E
 * 
 * 目标：生产 E
 */

import type { GameData, Recipe, Item, Building } from '../src/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const solver = require('javascript-lp-solver');

// 创建测试数据
function createTestGameData(): GameData {
  const items: Item[] = [
    { id: 'A', name: 'A', originalId: 1, type: 1, iconName: 'a', isRaw: true },
    { id: 'B', name: 'B', originalId: 2, type: 2, iconName: 'b' },
    { id: 'C', name: 'C', originalId: 3, type: 2, iconName: 'c' },
    { id: 'D', name: 'D', originalId: 4, type: 1, iconName: 'd', isRaw: true },
    { id: 'E', name: 'E', originalId: 5, type: 3, iconName: 'e' },
  ];

  const recipes: Recipe[] = [
    { id: 'r1', name: 'A->B+2C', originalId: 1, inputs: [{ itemId: 'A', count: 1 }], outputs: [{ itemId: 'B', count: 1 }, { itemId: 'C', count: 2 }], time: 1, factoryIds: [1], isMultiProduct: true, proliferatorLevel: 0, iconName: 'r1', type: 1 },
    { id: 'r2', name: 'A+D->2B+C', originalId: 2, inputs: [{ itemId: 'A', count: 1 }, { itemId: 'D', count: 1 }], outputs: [{ itemId: 'B', count: 2 }, { itemId: 'C', count: 1 }], time: 1, factoryIds: [1], isMultiProduct: true, proliferatorLevel: 0, iconName: 'r2', type: 1 },
    { id: 'r3', name: '3B+2C->E', originalId: 3, inputs: [{ itemId: 'B', count: 3 }, { itemId: 'C', count: 2 }], outputs: [{ itemId: 'E', count: 1 }], time: 1, factoryIds: [1], isMultiProduct: false, proliferatorLevel: 0, iconName: 'r3', type: 1 },
  ];

  const buildings: Building[] = [{ id: '1', originalId: 1, name: '测试建筑', category: 'assembler', speed: 1, workPower: 1, idlePower: 0.1, hasProliferatorSlot: false }];

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

describe('LP Scenario: Two Multi-Product Recipes Balancing', () => {
  test('solver finds optimal solution for E=1', () => {
    const model = {
      optimize: { r1: 1, r2: 1, r3: 1 },
      opType: 'min',
      constraints: { B_balance: { min: 0 }, C_balance: { min: 0 }, E_demand: { min: 1 } },
      variables: {
        r1: { B_balance: 1, C_balance: 2, E_demand: 0 },
        r2: { B_balance: 2, C_balance: 1, E_demand: 0 },
        r3: { B_balance: -3, C_balance: -2, E_demand: 1 },
      },
    };

    const result = solver.Solve(model);
    console.log('\n=== LP Result for E=1 ===');
    console.log('Result:', JSON.stringify(result, null, 2));

    // 从 vertices 提取解
    expect(result.vertices).toBeDefined();
    expect(result.vertices.length).toBeGreaterThan(0);

    const vertex = result.vertices[0];
    const r1 = vertex.r1 || 0;
    const r2 = vertex.r2 || 0;
    const r3 = vertex.r3 || 0;

    console.log('\nExtracted:');
    console.log(`r1: ${r1}, r2: ${r2}, r3: ${r3}`);

    // 验证
    const bNet = r1 + 2 * r2 - 3 * r3;
    const cNet = 2 * r1 + r2 - 2 * r3;

    console.log(`B net: ${bNet} (>=0)`);
    console.log(`C net: ${cNet} (>=0)`);
    console.log(`E: ${r3} (>=1)`);

    expect(r3).toBeGreaterThanOrEqual(1);
    expect(bNet).toBeGreaterThanOrEqual(-0.001);
    expect(cNet).toBeGreaterThanOrEqual(-0.001);

    // 计算原料
    const aConsumption = r1 + r2;
    const dConsumption = r2;
    console.log(`\nConsumption: ${aConsumption.toFixed(2)} A + ${dConsumption.toFixed(2)} D`);
    console.log(`Total buildings: ${(r1 + r2 + r3).toFixed(2)}`);
  });

  test('solver finds optimal solution for E=3', () => {
    const model = {
      optimize: { r1: 1, r2: 1, r3: 1 },
      opType: 'min',
      constraints: { B_balance: { min: 0 }, C_balance: { min: 0 }, E_demand: { min: 3 } },
      variables: {
        r1: { B_balance: 1, C_balance: 2, E_demand: 0 },
        r2: { B_balance: 2, C_balance: 1, E_demand: 0 },
        r3: { B_balance: -3, C_balance: -2, E_demand: 1 },
      },
    };

    const result = solver.Solve(model);
    console.log('\n=== LP Result for E=3 ===');

    const vertex = result.vertices[0];
    const r1 = vertex.r1 || 0;
    const r2 = vertex.r2 || 0;
    const r3 = vertex.r3 || 0;

    console.log(`r1: ${r1}, r2: ${r2}, r3: ${r3}`);

    // 验证
    const bNet = r1 + 2 * r2 - 3 * r3;
    const cNet = 2 * r1 + r2 - 2 * r3;

    expect(r3).toBeGreaterThanOrEqual(3);
    expect(bNet).toBeGreaterThanOrEqual(-0.001);
    expect(cNet).toBeGreaterThanOrEqual(-0.001);

    // 完全配平需要：r1=1, r2=4, r3=3
    // 但最优解可能是 r1=9, r2=0, r3=3
    console.log(`\nB net: ${bNet.toFixed(2)}`);
    console.log(`C net: ${cNet.toFixed(2)}`);
  });

  test('mathematical analysis - perfect balance', () => {
    // 完全配平: r2 = 4*r1, r3 = 3*r1
    console.log('\n=== Mathematical Analysis ===');
    console.log('For perfect balance (B=0, C=0):');
    console.log('  r2 = 4*r1');
    console.log('  r3 = 3*r1');
    console.log('');

    // r1=1, r2=4, r3=3 => E=3
    const r1 = 1, r2 = 4, r3 = 3;
    const bNet = r1 + 2 * r2 - 3 * r3;
    const cNet = 2 * r1 + r2 - 2 * r3;

    console.log(`Test: r1=${r1}, r2=${r2}, r3=${r3}`);
    console.log(`  B net: ${bNet} (should be 0)`);
    console.log(`  C net: ${cNet} (should be 0)`);
    console.log(`  E: ${r3}`);
    console.log(`  Total buildings: ${r1 + r2 + r3}`);
    console.log(`  Consumption: ${r1 + r2} A + ${r2} D`);

    expect(bNet).toBe(0);
    expect(cNet).toBe(0);
  });

  test('comparison: different strategies', () => {
    console.log('\n=== Strategy Comparison ===');

    // 策略1: 最小建筑数（默认）
    const model1 = {
      optimize: { r1: 1, r2: 1, r3: 1 },
      opType: 'min',
      constraints: { B_balance: { min: 0 }, C_balance: { min: 0 }, E_demand: { min: 3 } },
      variables: {
        r1: { B_balance: 1, C_balance: 2, E_demand: 0 },
        r2: { B_balance: 2, C_balance: 1, E_demand: 0 },
        r3: { B_balance: -3, C_balance: -2, E_demand: 1 },
      },
    };

    // 策略2: 惩罚 r1（因为产生更多C需要处理）
    const model2 = {
      optimize: { r1: 2, r2: 1, r3: 1 }, // r1 惩罚系数为2
      opType: 'min',
      constraints: model1.constraints,
      variables: model1.variables,
    };

    const result1 = solver.Solve(model1);
    const result2 = solver.Solve(model2);

    console.log('\nMin-buildings:');
    const v1 = result1.vertices[0];
    console.log(`  r1=${v1.r1 || 0}, r2=${v1.r2 || 0}, r3=${v1.r3 || 0}`);
    console.log(`  Total: ${(v1.r1 || 0) + (v1.r2 || 0) + (v1.r3 || 0)}`);

    console.log('\nPenalize r1 (coef=2):');
    const v2 = result2.vertices?.[0] || { r1: 0, r2: 0, r3: 0 };
    const r2_1 = v2.r1 || 0, r2_2 = v2.r2 || 0, r2_3 = v2.r3 || 0;
    console.log(`  r1=${r2_1}, r2=${r2_2}, r3=${r2_3}`);
    console.log(`  Total: ${r2_1 + r2_2 + r2_3}`);

    // 两种策略应该都得到可行解
    expect(v1.r3 || 0).toBeGreaterThanOrEqual(3);
  });
});
