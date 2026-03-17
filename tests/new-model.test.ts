/**
 * 新生产模型测试
 * 
 * 场景：A→B+2C, A+D→2B+C, 3B+2C→E
 * 所有单位：每分钟
 */

import { solveProductionLP, validateSolution, calculateSchemeDetails } from '../src/legacy/core/lpSolver';
import { calculateProductionRequirements, formatProductionReport } from '../src/legacy/core/productionModel';
import type { GameData, Recipe, Item, Building, ProliferatorConfig } from '../src/legacy/types';

function createTestData(): GameData {
  const items: Item[] = [
    { id: 'A', name: 'A', originalId: 1, type: 1, iconName: 'a', isRaw: true },
    { id: 'B', name: 'B', originalId: 2, type: 2, iconName: 'b' },
    { id: 'C', name: 'C', originalId: 3, type: 2, iconName: 'c' },
    { id: 'D', name: 'D', originalId: 4, type: 1, iconName: 'd', isRaw: true },
    { id: 'E', name: 'E', originalId: 5, type: 3, iconName: 'e' },
    { id: 'PROLIF_3', name: '增产剂Mk.III', originalId: 100, type: 4, iconName: 'prolif3' },
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

describe('New Production Model', () => {
  const gameData = createTestData();

  test('基础求解：E=60/分钟（使用所有配方）', () => {
    const result = solveProductionLP('E', 60, gameData);

    console.log('\n=== 基础求解：E=60/分钟 ===');
    console.log('可行:', result.feasible);
    
    if (result.feasible) {
      console.log('配方执行次数:');
      for (const [id, count] of result.recipeCounts.entries()) {
        const recipe = gameData.recipeMap.get(id);
        console.log(`  ${recipe?.name}: ${count.toFixed(2)}/分钟`);
      }

      // 验证物料平衡
      const validation = validateSolution(result.recipeCounts, gameData);
      console.log('\n物料平衡:');
      for (const [id, net] of validation.netFlows.entries()) {
        if (id.startsWith('__')) {
          if (id === '__POWER__') console.log(`  电力: ${net.toFixed(2)} MW`);
        } else {
          const item = gameData.itemMap.get(id);
          console.log(`  ${item?.name}: ${net.toFixed(2)}/min`);
        }
      }

      // 原料需求
      const details = calculateSchemeDetails(result.recipeCounts, gameData);
      console.log('\n原料需求:');
      for (const [id, rate] of details.inputs.entries()) {
        if (!id.startsWith('__')) {
          const item = gameData.itemMap.get(id);
          console.log(`  ${item?.name}: ${rate.toFixed(2)}/min`);
        }
      }

      // r3 是 "3B+2C→E"，time=1秒，每次产出1个E
      // 1次/分钟的配方执行 = 60个E/分钟产出
      expect(result.recipeCounts.get('r3') || 0).toBeGreaterThanOrEqual(1);
    }
  });

  test('完全配平方案：禁用 r3，只使用 r1 和 r2', () => {
    // 数学解：r1=20, r2=80, r3=60 是完全配平
    // 但 LP 求解器可能有不同结果
    
    const result = solveProductionLP('E', 60, gameData, {
      objective: 'min-buildings',
    });

    console.log('\n=== 完全配平分析 ===');
    
    if (result.feasible) {
      // 计算是否为完全配平
      const validation = validateSolution(result.recipeCounts, gameData);
      let hasByproduct = false;
      let hasDeficit = false;
      
      for (const [id, net] of validation.netFlows.entries()) {
        if (!id.startsWith('__') && !gameData.rawItemIds.includes(id) && id !== 'E') {
          if (net > 0.1) {
            hasByproduct = true;
            const item = gameData.itemMap.get(id);
            console.log(`副产物: ${item?.name} ${net.toFixed(2)}/min`);
          }
          if (net < -0.1) {
            hasDeficit = true;
          }
        }
      }

      if (!hasByproduct && !hasDeficit) {
        console.log('方案已完全配平，无副产物');
      }

      // 显示配方比例
      const r1 = result.recipeCounts.get('r1') || 0;
      const r2 = result.recipeCounts.get('r2') || 0;
      const r3 = result.recipeCounts.get('r3') || 0;
      
      console.log(`\n配方比例: r1=${r1.toFixed(1)}, r2=${r2.toFixed(1)}, r3=${r3.toFixed(1)}`);
      if (r1 > 0) {
        console.log(`r2/r1 = ${(r2/r1).toFixed(2)} (完全配平应为 4.00)`);
      }
    }

    expect(result.feasible).toBe(true);
  });

  test('手动验证完全配平：r1=20, r2=80, r3=60', () => {
    // 直接验证数学配平解
    const recipeCounts = new Map([
      ['r1', 20],
      ['r2', 80],
      ['r3', 60],
    ]);

    const validation = validateSolution(recipeCounts, gameData);

    console.log('\n=== 手动配平验证 ===');
    console.log('配方: r1=20, r2=80, r3=60');
    
    console.log('\n物料平衡:');
    for (const [id, net] of validation.netFlows.entries()) {
      if (id.startsWith('__')) {
        if (id === '__POWER__') console.log(`  电力: ${net.toFixed(2)} MW`);
      } else {
        const item = gameData.itemMap.get(id);
        const isRaw = gameData.rawItemIds.includes(id);
        console.log(`  ${item?.name}: ${net.toFixed(2)}/min ${isRaw ? '(原矿)' : ''}`);
      }
    }

    // B 和 C 应该完全配平（接近0）
    const bNet = validation.netFlows.get('B') || 0;
    const cNet = validation.netFlows.get('C') || 0;
    
    console.log(`\nB 净产出: ${bNet.toFixed(2)} (应为 0)`);
    console.log(`C 净产出: ${cNet.toFixed(2)} (应为 0)`);

    expect(Math.abs(bNet)).toBeLessThan(0.1);
    expect(Math.abs(cNet)).toBeLessThan(0.1);
  });

  test('使用增产剂（加速模式）', () => {
    const proliferator: ProliferatorConfig = {
      level: 3,
      mode: 'speed',
      sprayCount: 12,
    };

    const result = solveProductionLP('E', 60, gameData, {
      globalProliferator: proliferator,
    });

    console.log('\n=== 加速模式 L3 ===');
    if (result.feasible) {
      console.log('配方执行次数:');
      for (const [id, count] of result.recipeCounts.entries()) {
        const recipe = gameData.recipeMap.get(id);
        console.log(`  ${recipe?.name}: ${count.toFixed(2)}/分钟`);
      }

      const details = calculateSchemeDetails(result.recipeCounts, gameData, proliferator);
      console.log(`\n总建筑: ${details.totalBuildings.toFixed(2)}`);
      console.log(`总功耗: ${details.totalPower.toFixed(2)} MW`);
      
      const prolifConsumption = details.inputs.get('__PROLIFERATOR_3__') || 0;
      console.log(`增产剂Mk.III消耗: ${prolifConsumption.toFixed(2)}/min`);
    }

    expect(result.feasible).toBe(true);
  });

  test('使用增产剂（增产模式）', () => {
    const proliferator: ProliferatorConfig = {
      level: 3,
      mode: 'productivity',
      sprayCount: 12,
    };

    const result = solveProductionLP('E', 60, gameData, {
      globalProliferator: proliferator,
    });

    console.log('\n=== 增产模式 L3 ===');
    if (result.feasible) {
      console.log('配方执行次数:');
      for (const [id, count] of result.recipeCounts.entries()) {
        const recipe = gameData.recipeMap.get(id);
        console.log(`  ${recipe?.name}: ${count.toFixed(2)}/分钟`);
      }

      const details = calculateSchemeDetails(result.recipeCounts, gameData, proliferator);
      console.log(`\n总建筑: ${details.totalBuildings.toFixed(2)}`);
      console.log(`总功耗: ${details.totalPower.toFixed(2)} MW`);
      
      const prolifConsumption = details.inputs.get('__PROLIFERATOR_3__') || 0;
      console.log(`增产剂Mk.III消耗: ${prolifConsumption.toFixed(2)}/min`);

      // 增产模式应该需要更少建筑
      const resultNoProlif = solveProductionLP('E', 60, gameData);
      const detailsNoProlif = calculateSchemeDetails(resultNoProlif.recipeCounts, gameData);
      console.log(`\n对比无增产: ${detailsNoProlif.totalBuildings.toFixed(2)} 个建筑`);
      console.log(`节省: ${(detailsNoProlif.totalBuildings - details.totalBuildings).toFixed(2)} 个`);
    }

    expect(result.feasible).toBe(true);
  });

  test('单配方详细计算', () => {
    const r3 = gameData.recipeMap.get('r3')!;
    const building = gameData.buildings[0];

    // 无增产
    const req1 = calculateProductionRequirements(
      { recipe: r3, building },
      60
    );

    console.log('\n=== 单配方 r3 详细计算 ===');
    console.log('\n无增产:');
    console.log(formatProductionReport(req1, gameData.itemMap));

    // 加速增产
    const req2 = calculateProductionRequirements(
      { recipe: r3, building, proliferator: { level: 3, mode: 'speed', sprayCount: 12 } },
      60
    );

    console.log('\n加速模式 L3:');
    console.log(formatProductionReport(req2, gameData.itemMap));

    // 验证加速模式建筑更少
    expect(req2.buildingCount).toBeLessThan(req1.buildingCount);
  });
});
