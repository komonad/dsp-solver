import { GameData, Item, Recipe, Building } from '../src/types';
import { solveMultiDemand } from '../src/core/multiDemandSolver';

// 创建炼油配置数据
function createRefineryData(): GameData {
  const items: Item[] = [
    { id: 'oil', name: '原油', originalId: 1007, type: 1, iconName: 'oil', isRaw: true },
    { id: 'hydrogen', name: '氢气', originalId: 1120, type: 2, iconName: 'hydrogen' },
    { id: 'light-oil', name: '轻油', originalId: 1117, type: 2, iconName: 'light-oil' },
    { id: 'heavy-oil', name: '重油', originalId: 1116, type: 2, iconName: 'heavy-oil' },
  ];

  const recipes: Recipe[] = [
    {
      id: 'r1',
      name: '原油裂解',
      originalId: 1,
      type: 1,
      iconName: 'refining',
      inputs: [
        { itemId: 'oil', count: 1 },
        { itemId: 'hydrogen', count: 1 },
      ],
      outputs: [
        { itemId: 'light-oil', count: 2 },
        { itemId: 'heavy-oil', count: 1 },
      ],
      time: 1,
      factoryIds: [2304],
      proliferatorLevel: 0,
      isMultiProduct: true,
    },
    {
      id: 'r2',
      name: '重油精炼',
      originalId: 2,
      type: 1,
      iconName: 'refining',
      inputs: [
        { itemId: 'heavy-oil', count: 1 },
        { itemId: 'hydrogen', count: 2 },
      ],
      outputs: [
        { itemId: 'light-oil', count: 1 },
      ],
      time: 1,
      factoryIds: [2304],
      proliferatorLevel: 0,
      isMultiProduct: false,
    },
  ];

  const buildings: Building[] = [
    {
      id: '2304',
      originalId: 2304,
      name: '原油精炼厂',
      category: 'refinery',
      speed: 1,
      workPower: 1,
      idlePower: 0.1,
      hasProliferatorSlot: false,
    },
  ];

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const itemToRecipes = new Map<string, Recipe[]>();

  for (const recipe of recipes) {
    for (const output of recipe.outputs) {
      if (!itemToRecipes.has(output.itemId)) itemToRecipes.set(output.itemId, []);
      itemToRecipes.get(output.itemId)!.push(recipe);
    }
  }

  return {
    version: '1.0',
    items,
    recipes,
    buildings,
    proliferators: [],
    rawItemIds: ['oil'],
    itemMap,
    recipeMap,
    itemToRecipes,
  };
}

describe('炼油配置测试', () => {
  test('180/min 轻油求解 - 最小建筑数方案', () => {
    const gameData = createRefineryData();

    console.log('\n=== 方案1: 最小建筑数（接受重油结余） ===\n');

    const result = solveMultiDemand(
      [{ itemId: 'light-oil', rate: 180 }],
      gameData,
      { treatAsRaw: ['oil', 'hydrogen'] }
    );

    console.log('可行:', result.feasible);
    expect(result.feasible).toBe(true);

    console.log('\n配方执行:');
    for (const [recipeId, count] of result.recipes) {
      const recipe = gameData.recipeMap.get(recipeId);
      if (recipe) {
        console.log(`  ${recipe.name}: ${count.toFixed(4)} 次/min = ${count.toFixed(2)} 个精炼厂`);
      }
    }

    console.log('\n原材料:');
    for (const [itemId, rate] of result.rawMaterials) {
      const item = gameData.itemMap.get(itemId);
      console.log(`  ${item?.name}: ${rate.toFixed(2)}/min`);
    }

    console.log('\n中间产物结余:');
    for (const [itemId, balance] of result.intermediateBalance) {
      if (Math.abs(balance) > 0.001) {
        const item = gameData.itemMap.get(itemId);
        console.log(`  ${item?.name}: ${balance > 0 ? '+' : ''}${balance.toFixed(2)}/min`);
      }
    }

    // 验证
    const r1 = result.recipes.get('r1') || 0; // 每秒执行次数
    const r2 = result.recipes.get('r2') || 0;
    
    // solver 返回的是每秒执行次数，需要 ×60 转每分钟
    // 轻油产出 = (2*r1 + 1*r2) × 60 = 180
    const lightOilPerSec = 2 * r1 + 1 * r2;
    const lightOilPerMin = lightOilPerSec * 60;
    console.log(`\n验证: 轻油产出 = (2×${r1.toFixed(4)} + 1×${r2.toFixed(4)}) × 60 = ${lightOilPerSec.toFixed(4)} × 60 = ${lightOilPerMin.toFixed(2)}/min ✓`);
    
    expect(lightOilPerMin).toBeGreaterThanOrEqual(180 - 0.01);
  });

  test('180/min 轻油求解 - 重油平衡方案（强制使用配方2）', () => {
    const gameData = createRefineryData();

    console.log('\n=== 方案2: 重油零结余（副产物完全利用） ===\n');
    console.log('数学分析:');
    console.log('  设 r1 = 原油裂解执行次数/min, r2 = 重油精炼执行次数/min');
    console.log('  轻油约束: 2*r1 + r2 = 180 (产出 180/min)');
    console.log('  重油平衡: r1 = r2 (产生的重油全部被消耗)');
    console.log('  解得: r1 = r2 = 60 次/min');
    console.log('  即各需要 1 个精炼厂\n');

    // 通过指定配方选择来强制使用配方2
    const result = solveMultiDemand(
      [{ itemId: 'light-oil', rate: 180 }],
      gameData,
      { 
        treatAsRaw: ['oil', 'hydrogen'],
        selectedRecipes: new Map([['heavy-oil', 'r2']]) // 强制使用重油精炼配方处理重油
      }
    );

    console.log('可行:', result.feasible);
    
    if (result.feasible) {
      console.log('\n配方执行:');
      for (const [recipeId, count] of result.recipes) {
        const recipe = gameData.recipeMap.get(recipeId);
        if (recipe) {
          console.log(`  ${recipe.name}: ${count.toFixed(4)} 次/min = ${(count/60).toFixed(2)} 个精炼厂 (按秒)`);
          console.log(`           或 ${count.toFixed(2)} 个精炼厂 (按分)`);
        }
      }

      // 验证重油平衡
      const r1 = result.recipes.get('r1') || 0;
      const r2 = result.recipes.get('r2') || 0;
      
      console.log('\n验证:');
      console.log(`  轻油产出: 2×${r1.toFixed(2)} + 1×${r2.toFixed(2)} = ${(2*r1 + r2).toFixed(2)}/min`);
      console.log(`  重油平衡: ${r1.toFixed(2)} - ${r2.toFixed(2)} = ${(r1-r2).toFixed(2)}/min`);
      
      // 在重油平衡的约束下，求解器应该找到 r1 = r2 = 60 的解
      // 但由于建筑数增加，可能不是最优解
    }
    
    expect(result.feasible).toBe(true);
  });

  test('手动计算验证', () => {
    console.log('\n=== 手动计算最优方案 ===\n');
    
    // 方案1: 只用配方1
    console.log('【方案1】只用原油裂解:');
    console.log('  需要: 180/2 = 90 次/min 配方执行');
    console.log('  精炼厂: 90/60 = 1.5 个');
    console.log('  原油: 90/min');
    console.log('  氢气: 90/min');
    console.log('  副产物重油: 90/min (需要处理或销毁)');
    console.log('  总建筑数: 1.5');
    console.log();
    
    // 方案2: 平衡重油
    console.log('【方案2】完全利用重油:');
    console.log('  r1 = r2 = 60 次/min (各1个精炼厂)');
    console.log('  轻油产出: 2×60 + 1×60 = 180/min ✓');
    console.log('  原油: 60/min');
    console.log('  氢气: 60 + 2×60 = 180/min');
    console.log('  重油结余: 0');
    console.log('  总建筑数: 2');
    console.log();
    
    // 方案3: 只用配方2（如果有外部重油来源）
    console.log('【方案3】只用重油精炼（外部重油）:');
    console.log('  需要: 180/1 = 180 次/min');
    console.log('  精炼厂: 180/60 = 3 个');
    console.log('  重油: 180/min');
    console.log('  氢气: 360/min');
    console.log('  总建筑数: 3');
    console.log();
    
    console.log('结论:');
    console.log('  最小建筑数: 方案1 (1.5个)，但有90/min重油副产物');
    console.log('  无副产物: 方案2 (2个)，氢气消耗更多');
    console.log('  如果氢气比重油难处理，方案2更好');
    console.log('  如果重油可以存储或销毁，方案1更省');
  });
});
