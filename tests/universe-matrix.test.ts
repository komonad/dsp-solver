/**
 * 宇宙矩阵配方收集测试
 */

import { solveMultiDemand } from '../src/core/multiDemandSolver';
import { loadGameDataFromFile } from '../src/data/loader';
import type { GameData } from '../src/types';

// 使用真实数据测试
describe('宇宙矩阵测试', () => {
  let gameData: GameData;
  
  beforeAll(async () => {
    gameData = await loadGameDataFromFile('./data/Vanilla.json');
  });

  test('检查宇宙矩阵配方链', () => {
    // 找到宇宙矩阵
    const universeMatrix = gameData.items.find(i => i.name === '宇宙矩阵' || i.originalId === 6006);
    console.log('宇宙矩阵:', universeMatrix);
    
    // 找到电磁矩阵
    const emMatrix = gameData.items.find(i => i.name === '电磁矩阵' || i.originalId === 6001);
    console.log('电磁矩阵:', emMatrix);
    
    // 检查宇宙矩阵的配方
    const universeRecipes = gameData.itemToRecipes.get('6006') || [];
    console.log('\n宇宙矩阵配方:');
    for (const r of universeRecipes) {
      console.log(`  ${r.name} (ID:${r.id}): inputs=${JSON.stringify(r.inputs)}, outputs=${JSON.stringify(r.outputs)}`);
    }
    
    // 检查电磁矩阵的配方
    const emRecipes = gameData.itemToRecipes.get('6001') || [];
    console.log('\n电磁矩阵配方:');
    for (const r of emRecipes) {
      console.log(`  ${r.name} (ID:${r.id}): inputs=${JSON.stringify(r.inputs)}, outputs=${JSON.stringify(r.outputs)}`);
    }
    
    // 检查磁线圈的配方（电磁矩阵的原材料）
    const coilRecipes = gameData.itemToRecipes.get('1202') || [];
    console.log('\n磁线圈(1202)配方:');
    for (const r of coilRecipes) {
      console.log(`  ${r.name} (ID:${r.id}): inputs=${JSON.stringify(r.inputs)}`);
    }
    
    expect(universeMatrix).toBeDefined();
    expect(emMatrix).toBeDefined();
  });

  test('求解宇宙矩阵生产', () => {
    // 假设宇宙矩阵ID是6006
    const result = solveMultiDemand(
      [{ itemId: '6006', rate: 1 }], // 1个宇宙矩阵/分钟
      gameData
    );

    console.log('\n=== 宇宙矩阵生产求解 ===');
    console.log('可行:', result.feasible);
    console.log('消息:', result.message);
    
    console.log('\n配方执行:');
    for (const [recipeId, count] of result.recipes) {
      const recipe = gameData.recipeMap.get(recipeId);
      console.log(`  ${recipe?.name || recipeId}: ${count.toFixed(4)}/min`);
    }
    
    console.log('\n原材料消耗:');
    for (const [itemId, rate] of result.rawMaterials) {
      const item = gameData.itemMap.get(itemId);
      if (rate > 0.001) {
        console.log(`  ${item?.name || itemId}: ${rate.toFixed(2)}/min`);
      }
    }
    
    // 验证应该包含电磁矩阵的配方
    const hasEMRecipe = Array.from(result.recipes.keys()).some(rid => {
      const r = gameData.recipeMap.get(rid);
      return r?.outputs.some(o => o.itemId === '6001');
    });
    
    console.log('\n是否包含电磁矩阵配方:', hasEMRecipe);
    
    // 电磁矩阵应该被细化（有生产它的配方）
    expect(hasEMRecipe).toBe(true);
    expect(result.feasible).toBe(true);
  });
});
