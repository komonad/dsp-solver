/**
 * 多需求求解器测试 - 使用自定义线性求解器
 * 
 * 场景：同时需要 E 和 B
 */

import { solveMultiDemand, MultiDemandResult } from '../src/core/multiDemandSolver';
import type { GameData, Recipe, Item, Building } from '../src/types';

function createTestData(): GameData {
  const items: Item[] = [
    { id: 'A', name: 'A', originalId: 1, type: 1, iconName: 'a', isRaw: true },
    { id: 'B', name: 'B', originalId: 2, type: 2, iconName: 'b' },
    { id: 'C', name: 'C', originalId: 3, type: 2, iconName: 'c' },
    { id: 'D', name: 'D', originalId: 4, type: 1, iconName: 'd', isRaw: true },
    { id: 'E', name: 'E', originalId: 5, type: 3, iconName: 'e' },
  ];

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

function formatResult(result: MultiDemandResult, gameData: GameData): string {
  const lines: string[] = [];
  lines.push(`可行: ${result.feasible}`);
  if (result.message) lines.push(`消息: ${result.message}`);
  
  lines.push('\n配方执行（每分钟）:');
  for (const [recipeId, count] of result.recipes) {
    const recipe = gameData.recipeMap.get(recipeId);
    lines.push(`  ${recipe?.name || recipeId}: ${count.toFixed(4)}`);
  }
  
  lines.push('\n需求满足:');
  for (const [itemId, rate] of result.satisfiedDemands) {
    const item = gameData.itemMap.get(itemId);
    lines.push(`  ${item?.name || itemId}: ${rate.toFixed(2)}/min`);
  }
  
  lines.push('\n原材料消耗:');
  for (const [itemId, rate] of result.rawMaterials) {
    const item = gameData.itemMap.get(itemId);
    lines.push(`  ${item?.name || itemId}: ${rate.toFixed(2)}/min`);
  }
  
  lines.push('\n中间产物结余:');
  for (const [itemId, balance] of result.intermediateBalance) {
    const item = gameData.itemMap.get(itemId);
    lines.push(`  ${item?.name || itemId}: ${balance >= 0 ? '+' : ''}${balance.toFixed(2)}/min`);
  }
  
  return lines.join('\n');
}

describe('Multi-Demand Solver (自定义求解器)', () => {
  const gameData = createTestData();

  test('单需求：只生产 E', () => {
    const result = solveMultiDemand(
      [{ itemId: 'E', rate: 60 }],
      gameData
    );

    console.log('\n=== 单需求：E=60/min ===');
    console.log(formatResult(result, gameData));

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('E') || 0).toBeGreaterThanOrEqual(59.9); // 浮点容差
  });

  test('单需求：只生产 B', () => {
    const result = solveMultiDemand(
      [{ itemId: 'B', rate: 100 }],
      gameData
    );

    console.log('\n=== 单需求：B=100/min ===');
    console.log(formatResult(result, gameData));

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('B') || 0).toBeGreaterThanOrEqual(99.9); // 浮点容差
  });

  test('双需求：同时生产 E 和 B', () => {
    const result = solveMultiDemand(
      [
        { itemId: 'E', rate: 60 },
        { itemId: 'B', rate: 100 },
      ],
      gameData
    );

    console.log('\n=== 双需求：E=60/min + B=100/min ===');
    console.log(formatResult(result, gameData));

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('E') || 0).toBeGreaterThanOrEqual(59.9); // 浮点容差
    expect(result.satisfiedDemands.get('B') || 0).toBeGreaterThanOrEqual(99.9); // 浮点容差

    // 验证配方都被使用
    console.log('\n详细验证:');
    console.log(`E 实际产出: ${result.satisfiedDemands.get('E')?.toFixed(2)}/min`);
    console.log(`B 实际产出: ${result.satisfiedDemands.get('B')?.toFixed(2)}/min`);
    
    const r1Count = result.recipes.get('r1') || 0;
    const r2Count = result.recipes.get('r2') || 0;
    const r3Count = result.recipes.get('r3') || 0;
    
    console.log(`\n配方执行次数:`);
    console.log(`  r1: ${r1Count.toFixed(4)}/min`);
    console.log(`  r2: ${r2Count.toFixed(4)}/min`);
    console.log(`  r3: ${r3Count.toFixed(4)}/min`);
    
    // 验证 r3 被使用（用于生产 E）
    expect(r3Count).toBeGreaterThan(0);
  });

  test('三需求：E + B + C', () => {
    const result = solveMultiDemand(
      [
        { itemId: 'E', rate: 60 },
        { itemId: 'B', rate: 100 },
        { itemId: 'C', rate: 50 },
      ],
      gameData
    );

    console.log('\n=== 三需求：E=60 + B=100 + C=50 ===');
    console.log(formatResult(result, gameData));

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('E') || 0).toBeGreaterThanOrEqual(59.9); // 浮点容差
    expect(result.satisfiedDemands.get('B') || 0).toBeGreaterThanOrEqual(99.9); // 浮点容差
    expect(result.satisfiedDemands.get('C') || 0).toBeGreaterThanOrEqual(49.9); // 浮点容差
  });

  test('验证物料平衡', () => {
    const result = solveMultiDemand(
      [{ itemId: 'E', rate: 60 }, { itemId: 'B', rate: 100 }],
      gameData
    );

    // 手动验证物料平衡
    const r1 = result.recipes.get('r1') || 0;
    const r2 = result.recipes.get('r2') || 0;
    const r3 = result.recipes.get('r3') || 0;

    // B: r1*1 + r2*2 = 产出, r3*3 = 消耗
    const bProduced = r1 * 60 + r2 * 120;  // 每分钟（time=1，所以60次/分钟）
    const bConsumed = r3 * 180;
    const bNet = bProduced - bConsumed;

    // C: r1*2 + r2*1 = 产出, r3*2 = 消耗
    const cProduced = r1 * 120 + r2 * 60;
    const cConsumed = r3 * 120;
    const cNet = cProduced - cConsumed;

    console.log('\n=== 物料平衡验证 ===');
    console.log(`r1=${r1.toFixed(4)}, r2=${r2.toFixed(4)}, r3=${r3.toFixed(4)}`);
    console.log(`B: 产出 ${bProduced.toFixed(2)}, 消耗 ${bConsumed.toFixed(2)}, 净 ${bNet.toFixed(2)}`);
    console.log(`C: 产出 ${cProduced.toFixed(2)}, 消耗 ${cConsumed.toFixed(2)}, 净 ${cNet.toFixed(2)}`);

    // 净产出应该满足需求（浮点容差）
    expect(result.satisfiedDemands.get('B') || 0).toBeGreaterThanOrEqual(99.9);
  });

  test('功能：将B标记为原矿', () => {
    // 场景：需求B=100，不标记B为原矿时需要r1或r2生产B
    const resultWithoutRaw = solveMultiDemand(
      [{ itemId: 'B', rate: 100 }],
      gameData
    );

    console.log('\n=== 需求B=100，不标记B为原矿 ===');
    console.log(formatResult(resultWithoutRaw, gameData));

    // 应该有生产B的配方（r1或r2）
    expect(resultWithoutRaw.recipes.has('r1') || resultWithoutRaw.recipes.has('r2')).toBe(true);
    // B不应该出现在原材料消耗中（因为是自己生产的）
    expect(resultWithoutRaw.rawMaterials.has('B')).toBe(false);

    // 标记B为原矿：直接从外部输入B
    const resultWithRaw = solveMultiDemand(
      [{ itemId: 'B', rate: 100 }],
      gameData,
      { treatAsRaw: ['B'] }  // 将B标记为原矿
    );

    console.log('\n=== 需求B=100，标记B为原矿 ===');
    console.log(formatResult(resultWithRaw, gameData));

    // 不应该有生产B的配方（停止向上游收集）
    expect(resultWithRaw.recipes.has('r1')).toBe(false);
    expect(resultWithRaw.recipes.has('r2')).toBe(false);
    // 没有配方执行（因为B直接从外部输入）
    expect(resultWithRaw.recipes.size).toBe(0);

    // B应该被满足（从外部输入）
    expect(resultWithRaw.satisfiedDemands.get('B') || 0).toBeGreaterThanOrEqual(99.9);
    // B应该被标记为原材料消耗（外部输入）
    expect(resultWithRaw.rawMaterials.has('B')).toBe(true);
    // B消耗量 = 100/min
    expect(resultWithRaw.rawMaterials.get('B') || 0).toBeGreaterThan(99);
  });

  test('功能：将C标记为原矿', () => {
    const result = solveMultiDemand(
      [{ itemId: 'E', rate: 60 }, { itemId: 'B', rate: 100 }],
      gameData,
      { treatAsRaw: ['C'] }  // 将C标记为原矿，不生产C
    );

    console.log('\n=== 标记C为原矿 ===');
    console.log(formatResult(result, gameData));

    // C应该出现在原材料消耗中
    expect(result.rawMaterials.has('C')).toBe(true);
    
    // 由于C是原矿，不需要用r1来配平C
    // 应该用r2生产B（因为r1会产出多余的C）
    expect(result.recipes.has('r2')).toBe(true);
  });

  test('功能：现有产线供给B=50', () => {
    // 需求B=100，现有产线供给B=50，剩余50需要生产
    const result = solveMultiDemand(
      [{ itemId: 'B', rate: 100 }],
      gameData,
      { 
        existingSupplies: [{ itemId: 'B', rate: 50 }]  // 现有产线每分钟提供50个B
      }
    );

    console.log('\n=== 现有产线供给B=50，需求B=100 ===');
    console.log(formatResult(result, gameData));
    if (result.existingSupplyContribution) {
      console.log('\n现有供给贡献:');
      for (const [itemId, rate] of result.existingSupplyContribution) {
        console.log(`  ${itemId}: ${rate.toFixed(2)}/min`);
      }
    }

    // 可行
    expect(result.feasible).toBe(true);
    
    // B的总满足量应该是100
    expect(result.satisfiedDemands.get('B') || 0).toBeGreaterThanOrEqual(99.9);
    
    // 现有供给贡献了50
    expect(result.existingSupplyContribution?.get('B') || 0).toBeCloseTo(50, 1);
    
    // 求解的配方只需要生产约50个B（实际可能用r2生产50/2=25次）
    const r2Count = result.recipes.get('r2') || 0;
    const bProducedByR2 = r2Count * 120;  // r2每分钟产出120个B
    expect(bProducedByR2).toBeCloseTo(50, 0);  // 约50
  });

  test('功能：现有产线完全满足需求', () => {
    // 需求B=100，现有产线供给B=120（超过需求）
    const result = solveMultiDemand(
      [{ itemId: 'B', rate: 100 }],
      gameData,
      { 
        existingSupplies: [{ itemId: 'B', rate: 120 }]  // 超过需求
      }
    );

    console.log('\n=== 现有产线供给B=120，需求B=100 ===');
    console.log(formatResult(result, gameData));

    // 可行
    expect(result.feasible).toBe(true);
    
    // B的总满足量应该是100
    expect(result.satisfiedDemands.get('B') || 0).toBeGreaterThanOrEqual(99.9);
    
    // 不需要额外配方
    expect(result.recipes.size).toBe(0);
    
    // 供给贡献了100（实际使用了100）
    expect(result.existingSupplyContribution?.get('B') || 0).toBeCloseTo(100, 1);
  });

  test('功能：现有产线供给C来生产E', () => {
    // 需求E=60，现有产线供给C=120（正好满足E的C需求）
    // C由现有供给提供，B由配方生产
    const result = solveMultiDemand(
      [{ itemId: 'E', rate: 60 }],
      gameData,
      { 
        existingSupplies: [{ itemId: 'C', rate: 120 }]  // E需要120 C/min
      }
    );

    console.log('\n=== 现有产线供给C=120，需求E=60 ===');
    console.log(formatResult(result, gameData));
    if (result.existingSupplyContribution) {
      console.log('\n现有供给贡献:');
      for (const [itemId, rate] of result.existingSupplyContribution) {
        if (!itemId.startsWith('__')) {
          console.log(`  ${itemId}: ${rate.toFixed(2)}/min`);
        }
      }
    }

    // 可行
    expect(result.feasible).toBe(true);
    
    // E满足
    expect(result.satisfiedDemands.get('E') || 0).toBeGreaterThanOrEqual(59.9);
    
    // 只有r3（生产E）
    expect(result.recipes.has('r3')).toBe(true);
    expect(result.recipes.get('r3') || 0).toBeCloseTo(1, 1);  // r3执行1次
    
    // C由现有供给提供
    expect(result.existingSupplyContribution?.get('C') || 0).toBeCloseTo(120, 1);
    
    // B由配方生产，原材料是A和D
    expect(result.rawMaterials.has('A')).toBe(true);
    expect(result.rawMaterials.has('D')).toBe(true);
  });
});

describe('Unified objective options', () => {
  const gameData = createTestData();

  test('same API can optimize buildings vs raw inputs', () => {
    const minBuildings = solveMultiDemand(
      [{ itemId: 'E', rate: 60 }],
      gameData,
      { objective: 'min-buildings' }
    );

    const minWaste = solveMultiDemand(
      [{ itemId: 'E', rate: 60 }],
      gameData,
      { objective: 'min-waste' }
    );

    expect(minBuildings.feasible).toBe(true);
    expect(minWaste.feasible).toBe(true);

    const minBuildingsR1 = minBuildings.recipes.get('r1') || 0;
    const minBuildingsR2 = minBuildings.recipes.get('r2') || 0;
    const minWasteR1 = minWaste.recipes.get('r1') || 0;
    const minWasteR2 = minWaste.recipes.get('r2') || 0;

    expect(minWasteR1).toBeGreaterThan(minBuildingsR1);
    expect(minWasteR2).toBeLessThan(minBuildingsR2);
  });
});
