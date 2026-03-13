/**
 * 测试场景：建筑内置增产效果
 * 
 * 工厂甲：普通建筑
 * 工厂乙：自带 25% (alpha) 产出加成
 * 
 * 配方：
 * r1: A + C + D -> E + F
 * r2: E -> C + D
 * r3: F + G + X -> Y
 * r4: F + H + Y -> X
 * 
 * 目标：生产 X
 * 
 * 关键点：
 * - r3 和 r4 形成循环依赖（需要 X 生产 Y，需要 Y 生产 X）
 * - 使用工厂乙（有产出加成）可以打破循环，实现配平
 * - 如果不考虑建筑内置增产效果，问题无解
 */

import { solveMultiDemand } from '../src/core/multiDemandSolver';
import type { GameData, Recipe, Item, Building } from '../src/types';

// 创建测试数据
function createTestGameData(): GameData {
  // 物品
  const items: Item[] = [
    { id: 'A', name: 'A（原矿）', originalId: 1, type: 1, iconName: 'a', isRaw: true },
    { id: 'C', name: 'C', originalId: 3, type: 2, iconName: 'c' },
    { id: 'D', name: 'D', originalId: 4, type: 2, iconName: 'd' },
    { id: 'E', name: 'E', originalId: 5, type: 2, iconName: 'e' },
    { id: 'F', name: 'F', originalId: 6, type: 2, iconName: 'f' },
    { id: 'G', name: 'G（原矿）', originalId: 7, type: 1, iconName: 'g', isRaw: true },
    { id: 'H', name: 'H（原矿）', originalId: 8, type: 1, iconName: 'h', isRaw: true },
    { id: 'X', name: 'X', originalId: 9, type: 2, iconName: 'x' },
    { id: 'Y', name: 'Y', originalId: 10, type: 2, iconName: 'y' },
  ];

  // 配方
  const recipes: Recipe[] = [
    {
      id: 'r1',
      name: 'A+C+D->E+F',
      originalId: 1,
      inputs: [
        { itemId: 'A', count: 1 },
        { itemId: 'C', count: 1 },
        { itemId: 'D', count: 1 },
      ],
      outputs: [
        { itemId: 'E', count: 1 },
        { itemId: 'F', count: 1 },
      ],
      time: 1,
      factoryIds: [100, 101], // 工厂甲和乙都可以生产
      isMultiProduct: true,
      proliferatorLevel: 0,
      iconName: 'r1',
      type: 1,
    },
    {
      id: 'r2',
      name: 'E->C+D',
      originalId: 2,
      inputs: [{ itemId: 'E', count: 1 }],
      outputs: [
        { itemId: 'C', count: 1 },
        { itemId: 'D', count: 1 },
      ],
      time: 1,
      factoryIds: [100, 101],
      isMultiProduct: true,
      proliferatorLevel: 0,
      iconName: 'r2',
      type: 1,
    },
    {
      id: 'r3',
      name: 'F+G+X->Y',
      originalId: 3,
      inputs: [
        { itemId: 'F', count: 1 },
        { itemId: 'G', count: 1 },
        { itemId: 'X', count: 1 },
      ],
      outputs: [{ itemId: 'Y', count: 1 }],
      time: 1,
      factoryIds: [100, 101],
      isMultiProduct: false,
      proliferatorLevel: 0,
      iconName: 'r3',
      type: 1,
    },
    {
      id: 'r4',
      name: 'F+H+Y->X',
      originalId: 4,
      inputs: [
        { itemId: 'F', count: 1 },
        { itemId: 'H', count: 1 },
        { itemId: 'Y', count: 1 },
      ],
      outputs: [{ itemId: 'X', count: 1 }],
      time: 1,
      factoryIds: [100, 101],
      isMultiProduct: false,
      proliferatorLevel: 0,
      iconName: 'r4',
      type: 1,
    },
  ];

  // 建筑：工厂甲（普通）和工厂乙（自带25%产出加成）
  const buildings: Building[] = [
    {
      id: '100',
      originalId: 100,
      name: '工厂甲',
      category: 'assembler',
      speed: 1,
      workPower: 1,
      idlePower: 0.1,
      hasProliferatorSlot: false,
    },
    {
      id: '101',
      originalId: 101,
      name: '工厂乙（+25%产出）',
      category: 'assembler',
      speed: 1,
      workPower: 1.2, // 功耗稍高
      idlePower: 0.1,
      hasProliferatorSlot: false,
      intrinsicProductivity: 0.25, // 25% 产出加成
    },
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

  return {
    version: 'test',
    items,
    recipes,
    buildings,
    proliferators: [],
    rawItemIds: ['A', 'G', 'H'],
    itemMap,
    recipeMap,
    itemToRecipes,
  };
}

describe('建筑内置增产效果测试', () => {
  const gameData = createTestGameData();

  test('场景说明：X和Y的循环依赖', () => {
    console.log('\n=== 场景说明 ===');
    console.log('配方 r3: F + G + X -> Y');
    console.log('配方 r4: F + H + Y -> X');
    console.log('');
    console.log('循环依赖：');
    console.log('- 生产 Y 需要 X（通过 r3）');
    console.log('- 生产 X 需要 Y（通过 r4）');
    console.log('');
    console.log('如果没有产出加成，这个系统无法自举。');
    console.log('工厂乙有 25% 产出加成，可以多产出 X 和 Y，打破循环。');
    console.log('');

    // 验证配方结构
    const r3 = gameData.recipeMap.get('r3')!;
    const r4 = gameData.recipeMap.get('r4')!;

    expect(r3.inputs.some(i => i.itemId === 'X')).toBe(true);
    expect(r4.inputs.some(i => i.itemId === 'Y')).toBe(true);
    expect(r3.outputs.some(o => o.itemId === 'Y')).toBe(true);
    expect(r4.outputs.some(o => o.itemId === 'X')).toBe(true);
  });

  test('数学分析：使用工厂乙时 r3 和 r4 的物料平衡', () => {
    const factoryYi = gameData.buildings.find(b => b.id === '101')!;
    console.log('\n=== 数学分析 ===');
    console.log(`工厂乙的 intrinsicProductivity: ${factoryYi.intrinsicProductivity}`);

    // 使用工厂乙时，r3 和 r4 的产出都有 1.25 倍加成
    // r3: F + G + X -> 1.25 Y
    // r4: F + H + Y -> 1.25 X

    // 设 r3 执行 a 次/分钟，r4 执行 b 次/分钟
    // Y 的平衡: 1.25a - b >= 0 (Y 的产出 - 消耗)
    // X 的平衡: 1.25b - a >= 0 (X 的产出 - 消耗)
    // 完全平衡时: 1.25a = b, 1.25b = a
    // 代入: 1.25 * 1.25a = a => 1.5625a = a => a = 0 (矛盾！)

    // 等等，这个分析有误。让我重新分析：
    // 如果需要净产出 X，我们设需求为 D
    // X 的净产出: 1.25b - a >= D
    // Y 的净产出: 1.25a - b >= 0

    // 从 Y 的约束: b <= 1.25a
    // 代入 X 的约束: 1.25 * 1.25a - a >= D => 0.5625a >= D => a >= 1.778D

    // 取 a = 1.778D, b = 1.25 * 1.778D = 2.222D
    // X 产出: 1.25 * 2.222D - 1.778D = 2.778D - 1.778D = D ✓
    // Y 产出: 1.25 * 1.778D - 2.222D = 2.222D - 2.222D = 0 ✓

    console.log('设 r3 执行 a 次/分钟，r4 执行 b 次/分钟');
    console.log('使用工厂乙（25%加成）:');
    console.log('  r3 产出: 1.25 Y/次');
    console.log('  r4 产出: 1.25 X/次');
    console.log('');
    console.log('约束条件:');
    console.log('  Y 平衡: 1.25a - b >= 0');
    console.log('  X 平衡: 1.25b - a >= D（D 为 X 需求）');
    console.log('');
    console.log('求解:');
    console.log('  从 Y 约束: b <= 1.25a');
    console.log('  代入 X: 1.25 * 1.25a - a >= D');
    console.log('  即: 0.5625a >= D');
    console.log('  所以: a >= 1.778D');
    console.log('');
    console.log('结论：当使用工厂乙时，系统可以配平！');

    expect(factoryYi.intrinsicProductivity).toBe(0.25);
  });

  test('求解 X=10/分钟 的生产方案（使用工厂乙，应该可行）', () => {
    console.log('\n=== 求解 X=10/分钟（使用工厂乙） ===');

    // 指定所有配方都使用工厂乙（有 25% 内置产出加成）
    const recipeBuildings = new Map([
      ['r1', '101'],
      ['r2', '101'],
      ['r3', '101'],
      ['r4', '101'],
    ]);

    const result = solveMultiDemand(
      [{ itemId: 'X', rate: 10 }],
      gameData,
      { recipeBuildings }
    );

    console.log('可行:', result.feasible);

    if (result.feasible) {
      console.log('\n配方执行:');
      for (const [id, count] of result.recipes) {
        const recipe = gameData.recipeMap.get(id);
        console.log(`  ${recipe?.name}: ${count.toFixed(2)}/分钟`);
      }

      console.log('\n原矿需求:');
      for (const [id, rate] of result.rawMaterials) {
        const item = gameData.itemMap.get(id);
        console.log(`  ${item?.name}: ${rate.toFixed(2)}/分钟`);
      }

      console.log('\n中间产物结余:');
      for (const [id, balance] of result.intermediateBalance) {
        if (Math.abs(balance) > 0.001) {
          const item = gameData.itemMap.get(id);
          console.log(`  ${item?.name}: ${balance > 0 ? '+' : ''}${balance.toFixed(2)}/分钟`);
        }
      }
    }

    expect(result.feasible).toBe(true);
  });

  test('对比：使用工厂甲（无加成）应该无解', () => {
    console.log('\n=== 求解 X=10/分钟（使用工厂甲，应该无解） ===');

    // 指定所有配方都使用工厂甲（无内置产出加成）
    const recipeBuildings = new Map([
      ['r1', '100'],
      ['r2', '100'],
      ['r3', '100'],
      ['r4', '100'],
    ]);

    const result = solveMultiDemand(
      [{ itemId: 'X', rate: 10 }],
      gameData,
      { recipeBuildings }
    );

    console.log('可行:', result.feasible);
    if (!result.feasible) {
      console.log('原因:', result.message);
    }

    // 使用工厂甲应该无解（循环依赖无法打破）
    expect(result.feasible).toBe(false);
  });
});
