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

import { solve } from 'yalps';
import type { Model } from 'yalps';

describe('LP Scenario: Two Multi-Product Recipes Balancing', () => {
  test('solver finds optimal solution for E=1', () => {
    const model: Model = {
      direction: 'minimize',
      objective: 'total',
      constraints: {
        B_balance: { min: 0 },
        C_balance: { min: 0 },
        E_demand: { min: 1 },
      },
      variables: {
        r1: { total: 1, B_balance: 1, C_balance: 2, E_demand: 0 },
        r2: { total: 1, B_balance: 2, C_balance: 1, E_demand: 0 },
        r3: { total: 1, B_balance: -3, C_balance: -2, E_demand: 1 },
      },
    };

    const result = solve(model);
    console.log('\n=== LP Result for E=1 ===');
    console.log('Result:', JSON.stringify(result, null, 2));

    expect(result.status).toBe('optimal');

    // 提取解
    const vars = new Map(result.variables);
    const r1 = vars.get('r1') || 0;
    const r2 = vars.get('r2') || 0;
    const r3 = vars.get('r3') || 0;

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
    const model: Model = {
      direction: 'minimize',
      objective: 'total',
      constraints: {
        B_balance: { min: 0 },
        C_balance: { min: 0 },
        E_demand: { min: 3 },
      },
      variables: {
        r1: { total: 1, B_balance: 1, C_balance: 2, E_demand: 0 },
        r2: { total: 1, B_balance: 2, C_balance: 1, E_demand: 0 },
        r3: { total: 1, B_balance: -3, C_balance: -2, E_demand: 1 },
      },
    };

    const result = solve(model);
    console.log('\n=== LP Result for E=3 ===');

    const vars = new Map(result.variables);
    const r1 = vars.get('r1') || 0;
    const r2 = vars.get('r2') || 0;
    const r3 = vars.get('r3') || 0;

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
    const model1: Model = {
      direction: 'minimize',
      objective: 'total',
      constraints: {
        B_balance: { min: 0 },
        C_balance: { min: 0 },
        E_demand: { min: 3 },
      },
      variables: {
        r1: { total: 1, B_balance: 1, C_balance: 2, E_demand: 0 },
        r2: { total: 1, B_balance: 2, C_balance: 1, E_demand: 0 },
        r3: { total: 1, B_balance: -3, C_balance: -2, E_demand: 1 },
      },
    };

    // 策略2: 惩罚 r1（因为产生更多C需要处理）
    const model2: Model = {
      direction: 'minimize',
      objective: 'total',
      constraints: model1.constraints,
      variables: {
        r1: { total: 2, B_balance: 1, C_balance: 2, E_demand: 0 }, // r1 惩罚系数为2
        r2: { total: 1, B_balance: 2, C_balance: 1, E_demand: 0 },
        r3: { total: 1, B_balance: -3, C_balance: -2, E_demand: 1 },
      },
    };

    const result1 = solve(model1);
    const result2 = solve(model2);

    const v1 = new Map(result1.variables);
    const v2 = new Map(result2.variables);

    console.log('\nMin-buildings:');
    const r1_1 = v1.get('r1') || 0, r1_2 = v1.get('r2') || 0, r1_3 = v1.get('r3') || 0;
    console.log(`  r1=${r1_1}, r2=${r1_2}, r3=${r1_3}`);
    console.log(`  Total: ${r1_1 + r1_2 + r1_3}`);

    console.log('\nPenalize r1 (coef=2):');
    const r2_1 = v2.get('r1') || 0, r2_2 = v2.get('r2') || 0, r2_3 = v2.get('r3') || 0;
    console.log(`  r1=${r2_1}, r2=${r2_2}, r3=${r2_3}`);
    console.log(`  Total: ${r2_1 + r2_2 + r2_3}`);

    // 两种策略应该都得到可行解
    expect(r1_3).toBeGreaterThanOrEqual(3);
  });
});
