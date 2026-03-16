/**
 * 手动验证 LP 求解的数学正确性
 */

import { solve, greaterEq, lessEq } from 'yalps';
import type { Model } from 'yalps';

test('手动求解 X=10 的配平', () => {
  // 变量: r3, r4 (每分钟执行次数)
  // r3: F + G + X -> 1.25Y (使用工厂乙)
  // r4: F + H + Y -> 1.25X (使用工厂乙)
  
  // 约束:
  // X: 1.25*r4 - r3 >= 10  (净产出 >= 需求)
  // Y: 1.25*r3 - r4 >= 0   (Y不能 deficit)
  // r3 >= 0, r4 >= 0
  
  const model: Model = {
    direction: 'minimize',
    objective: 'total',
    constraints: {
      X_balance: { min: 10 },  // 需要 10 X/分钟
      Y_balance: { min: 0 },   // Y 不能缺口
    },
    variables: {
      r3: { total: 1, X_balance: -1, Y_balance: 1.25 },  // 消耗1X, 产出1.25Y
      r4: { total: 1, X_balance: 1.25, Y_balance: -1 },  // 消耗1Y, 产出1.25X
    },
  };

  const solution = solve(model);
  console.log('Solution:', solution);

  expect(solution.status).toBe('optimal');
  
  const vars = new Map(solution.variables);
  const r3 = vars.get('r3') || 0;
  const r4 = vars.get('r4') || 0;
  
  console.log(`r3 = ${r3.toFixed(2)}/分钟`);
  console.log(`r4 = ${r4.toFixed(2)}/分钟`);
  
  // 验证 X 平衡
  const xNet = r4 * 1.25 - r3;
  console.log(`X 净产出: ${xNet.toFixed(2)}/分钟`);
  expect(xNet).toBeGreaterThanOrEqual(9.9); // 约等于 10
  
  // 验证 Y 平衡
  const yNet = r3 * 1.25 - r4;
  console.log(`Y 净产出: ${yNet.toFixed(2)}/分钟`);
  expect(yNet).toBeGreaterThanOrEqual(-0.01); // 约等于 0
  
  // 理论解: r3 = 17.78, r4 = 22.22
  console.log('\n理论预期:');
  console.log('r3 = 17.78, r4 = 22.22');
  console.log('X = 1.25*22.22 - 17.78 = 10');
  console.log('Y = 1.25*17.78 - 22.22 = 0');
});

test('无副产物模式: Y 严格等于 0', () => {
  const model: Model = {
    direction: 'minimize',
    objective: 'total',
    constraints: {
      X_balance: { min: 10 },  // X >= 10
      Y_balance: { min: 0, max: 0 },  // Y = 0 (严格平衡)
    },
    variables: {
      r3: { total: 1, X_balance: -1, Y_balance: 1.25 },
      r4: { total: 1, X_balance: 1.25, Y_balance: -1 },
    },
  };

  const solution = solve(model);
  console.log('No-byproduct solution:', solution);

  expect(solution.status).toBe('optimal');
  
  const vars = new Map(solution.variables);
  const r3 = vars.get('r3') || 0;
  const r4 = vars.get('r4') || 0;
  
  console.log(`\n无副产物解:`);
  console.log(`r3 = ${r3.toFixed(2)}/分钟`);
  console.log(`r4 = ${r4.toFixed(2)}/分钟`);
  
  // 验证
  const xNet = r4 * 1.25 - r3;
  const yNet = r3 * 1.25 - r4;
  
  console.log(`X 净产出: ${xNet.toFixed(2)}/分钟`);
  console.log(`Y 净产出: ${yNet.toFixed(2)}/分钟`);
  
  expect(Math.abs(yNet)).toBeLessThan(0.01); // Y 应该几乎为 0
});
