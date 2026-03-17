/**
 * 测试建筑内置产出加成（intrinsicProductivity）
 * 
 * 使用测试配置：化工厂增产场景
 * 
 * 场景说明：
 * 上层系统（内部平衡）：
 *   r1: 气云 + 石墨烯 + 氢气 → 甲烷 + 富勒烯
 *   r2: 甲烷 → 石墨烯 + 氢气
 * 
 * 下层系统（循环依赖）：
 *   r3: 富勒烯 + 生物醇 + 精炼银 → 富勒银
 *   r4: 富勒烯 + 富勒醇 + 富勒银 → 精炼银
 * 
 * 建筑：
 *   - 化工厂：1.0x速度，无加成
 *   - 低温化工厂：1.0x速度，+25%产出
 *   - 量子化工厂：1.0x速度，+100%产出
 */

import { solveMultiDemand } from '../src/legacy/core/multiDemandSolver';
import {
  testGameData,
  strategyLayered,
  strategyAllQuantum,
  strategyAllBasic,
  strategyMixed,
  chemicalPlant,
  cryogenicChemicalPlant,
  quantumChemicalPlant,
} from './test-config';

describe('化工厂增产场景测试', () => {
  test('场景说明：分层的循环依赖系统', () => {
    console.log('\n=== 化工厂增产场景 ===');
    console.log('\n上层系统（内部平衡）：');
    console.log('  r1: 气云 + 石墨烯 + 氢气 → 甲烷 + 富勒烯');
    console.log('  r2: 甲烷 → 石墨烯 + 氢气');
    console.log('  特点：甲烷、石墨烯、氢气是中间产物，r1和r2可以完美平衡');
    console.log('\n下层系统（循环依赖）：');
    console.log('  r3: 富勒烯 + 生物醇 + 精炼银 → 富勒银');
    console.log('  r4: 富勒烯 + 富勒醇 + 富勒银 → 精炼银');
    console.log('  特点：精炼银和富勒银互相依赖，无加成时无法自举');
    console.log('\n建筑类型：');
    console.log(`  - 化工厂: 速度${chemicalPlant.speed}x，无额外产出`);
    console.log(`  - 低温化工厂: 速度${cryogenicChemicalPlant.speed}x，+${(cryogenicChemicalPlant.intrinsicProductivity! * 100)}%产出`);
    console.log(`  - 量子化工厂: 速度${quantumChemicalPlant.speed}x，+${(quantumChemicalPlant.intrinsicProductivity! * 100)}%产出`);
  });

  test('数学分析：分层系统的物料平衡', () => {
    console.log('\n=== 数学分析 ===');
    
    console.log('\n上层系统（r1, r2 使用化工厂，无加成）：');
    console.log('  甲烷平衡: r1 - r2 = 0  =>  r1 = r2');
    console.log('  石墨烯平衡: r2 - r1 = 0  =>  r1 = r2 ✓');
    console.log('  结论：只要 r1 = r2，上层系统完美平衡');
    
    console.log('\n下层系统（r3, r4 使用量子化工厂，+100%产出）：');
    console.log('  富勒银产出: 2*r3（100%加成 = 2x产出）');
    console.log('  富勒银消耗: r4');
    console.log('  精炼银产出: 2*r4');
    console.log('  精炼银消耗: r3');
    console.log('');
    console.log('  富勒银平衡: 2*r3 - r4 = 0  =>  r4 = 2*r3');
    console.log('  精炼银需求: 2*r4 - r3 >= D（D为精炼银需求）');
    console.log('  代入: 2*(2*r3) - r3 >= D');
    console.log('       4*r3 - r3 >= D');
    console.log('       3*r3 >= D');
    console.log('       r3 >= D/3');
    console.log('');
    console.log('  当 D=60/分钟 时: r3 = 20, r4 = 40');
    console.log('  精炼银净产出: 2*40 - 20 = 60/分钟 ✓');
    
    console.log('\n富勒烯的平衡（连接上下层）：');
    console.log('  富勒烯产出: r1（来自上层）');
    console.log('  富勒烯消耗: r3 + r4（下层消耗）');
    console.log('  约束: r1 = r3 + r4');
    console.log('  当 r3=20, r4=40 时: r1 = r2 = 60');
    
    expect(true).toBe(true);
  });

  test('分层策略：上层用化工厂，下层用量子化工厂', () => {
    console.log('\n=== 分层策略求解 ===');
    console.log('策略：r1,r2→化工厂（无加成），r3,r4→量子化工厂（+100%）');

    const result = solveMultiDemand(
      [{ itemId: 'refined-silver', rate: 60 }],
      testGameData,
      { recipeBuildings: strategyLayered, noByproducts: true }
    );

    console.log('可行:', result.feasible);

    if (result.feasible) {
      const recipes = new Map(result.recipes);
      const r1 = recipes.get('r1-gas-to-methane-fullerene') || 0;
      const r2 = recipes.get('r2-methane-recycle') || 0;
      const r3 = recipes.get('r3-fullerene-silver') || 0;
      const r4 = recipes.get('r4-refined-silver') || 0;

      console.log('\n配方执行:');
      console.log(`  r1 (气云→甲烷+富勒烯) [化工厂]: ${r1.toFixed(2)}/分钟`);
      console.log(`  r2 (甲烷回收) [化工厂]: ${r2.toFixed(2)}/分钟`);
      console.log(`  r3 (富勒银合成) [量子化工厂]: ${r3.toFixed(2)}/分钟`);
      console.log(`  r4 (精炼银提取) [量子化工厂]: ${r4.toFixed(2)}/分钟`);

      console.log('\n物料平衡验证:');
      // 上层系统（无加成）
      const methaneBalance = r1 - r2;
      const grapheneBalance = r2 - r1;
      const hydrogenBalance = r2 - r1;
      console.log(`  甲烷 (r1-r2): ${methaneBalance.toFixed(4)} (应为 0)`);
      console.log(`  石墨烯 (r2-r1): ${grapheneBalance.toFixed(4)} (应为 0)`);
      console.log(`  氢气 (r2-r1): ${hydrogenBalance.toFixed(4)} (应为 0)`);

      // 下层系统（量子化工厂有+100%加成 = 2x产出）
      const fullereneSilverBalance = r3 * 2 - r4;
      const refinedSilverProduction = r4 * 2 - r3;
      console.log(`  富勒银 (2*r3-r4): ${fullereneSilverBalance.toFixed(4)} (应为 0)`);
      console.log(`  精炼银 (2*r4-r3): ${refinedSilverProduction.toFixed(2)} (应为 60)`);

      // 富勒烯的连接
      const fullereneBalance = r1 - r3 - r4;
      console.log(`  富勒烯 (r1-r3-r4): ${fullereneBalance.toFixed(4)} (应为 0)`);

      // 验证
      expect(Math.abs(methaneBalance)).toBeLessThan(0.1);
      expect(Math.abs(grapheneBalance)).toBeLessThan(0.1);
      expect(Math.abs(hydrogenBalance)).toBeLessThan(0.1);
      expect(Math.abs(fullereneSilverBalance)).toBeLessThan(0.1);
      expect(Math.abs(fullereneBalance)).toBeLessThan(0.1);
      expect(refinedSilverProduction).toBeCloseTo(60, 1);
    }

    expect(result.feasible).toBe(true);
  });

  test('混合增产策略：r3用低温，r4用量子', () => {
    console.log('\n=== 混合增产策略 ===');
    console.log('策略：r1,r2→化工厂，r3→低温化工厂（+25%），r4→量子化工厂（+100%）');

    const result = solveMultiDemand(
      [{ itemId: 'refined-silver', rate: 60 }],
      testGameData,
      { recipeBuildings: strategyMixed, noByproducts: true }
    );

    console.log('可行:', result.feasible);

    if (result.feasible) {
      const recipes = new Map(result.recipes);
      const r1 = recipes.get('r1-gas-to-methane-fullerene') || 0;
      const r2 = recipes.get('r2-methane-recycle') || 0;
      const r3 = recipes.get('r3-fullerene-silver') || 0;
      const r4 = recipes.get('r4-refined-silver') || 0;

      console.log('\n配方执行:');
      console.log(`  r1 [化工厂]: ${r1.toFixed(2)}/分钟`);
      console.log(`  r2 [化工厂]: ${r2.toFixed(2)}/分钟`);
      console.log(`  r3 [低温化工厂 +25%]: ${r3.toFixed(2)}/分钟`);
      console.log(`  r4 [量子化工厂 +100%]: ${r4.toFixed(2)}/分钟`);

      // r3有+25% = 1.25x，r4有+100% = 2x
      const fullereneSilverBalance = r3 * 1.25 - r4;
      const refinedSilverProduction = r4 * 2 - r3;
      
      console.log('\n物料平衡:');
      console.log(`  富勒银 (1.25*r3-r4): ${fullereneSilverBalance.toFixed(4)} (应为 0)`);
      console.log(`  精炼银 (2*r4-r3): ${refinedSilverProduction.toFixed(2)} (应为 60)`);

      expect(Math.abs(fullereneSilverBalance)).toBeLessThan(0.1);
      expect(refinedSilverProduction).toBeCloseTo(60, 1);
    }

    expect(result.feasible).toBe(true);
  });

  test('错误策略：全部使用量子化工厂应该无解', () => {
    console.log('\n=== 错误策略：全部使用量子化工厂 ===');
    console.log('如果r1,r2也使用加成，甲烷和石墨烯/氢气无法平衡：');
    console.log('  甲烷: 2*r1 - r2 = 0  =>  r2 = 2*r1');
    console.log('  石墨烯: 2*r2 - r1 = 0  =>  r1 = 2*r2');
    console.log('  代入: r1 = 4*r1  =>  只有r1=0时成立');

    const result = solveMultiDemand(
      [{ itemId: 'refined-silver', rate: 60 }],
      testGameData,
      { recipeBuildings: strategyAllQuantum, noByproducts: true }
    );

    console.log('\n可行:', result.feasible);
    if (!result.feasible) {
      console.log('原因:', result.message || '无解（约束矛盾）');
    }

    expect(result.feasible).toBe(false);
  });

  test('对比：全部使用化工厂（无加成）无法打破循环', () => {
    console.log('\n=== 全部使用化工厂（无加成） ===');
    console.log('精炼银↔富勒银循环无加成时无法自举：');
    console.log('  精炼银产出: r4, 消耗: r3');
    console.log('  富勒银产出: r3, 消耗: r4');
    console.log('  完全对称，无法产生净精炼银');

    const result = solveMultiDemand(
      [{ itemId: 'refined-silver', rate: 60 }],
      testGameData,
      { recipeBuildings: strategyAllBasic, noByproducts: true }
    );

    console.log('\n可行:', result.feasible);

    expect(result.feasible).toBe(false);
  });
});
