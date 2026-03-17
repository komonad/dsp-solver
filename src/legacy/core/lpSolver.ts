/**
 * 线性规划求解器模块
 * 
 * 变量: 每个配方的执行次数（每分钟）
 * 约束: 每个物品的净产出 >= 需求
 * 目标: 最小化建筑总数或浪费
 */

import { solve } from 'yalps';
import type { Model } from 'yalps';
import type { GameData, Recipe, ProliferatorConfig } from '../types';
import { calculateItemBalance } from './productionModel';

/**
 * LP求解结果
 */
export interface LPSolution {
  feasible: boolean;
  result: number;
  variables: Map<string, number>;
  recipeCounts: Map<string, number>;
}

/**
 * 求解选项
 */
export interface SolveOptions {
  /** 优化目标 */
  objective?: 'min-buildings' | 'min-waste' | 'min-power';
  /** 允许使用的配方 */
  allowedRecipes?: string[];
  /** 禁止使用的配方 */
  bannedRecipes?: string[];
  /** 全局增产配置（应用到所有配方） */
  globalProliferator?: ProliferatorConfig;
  /** 是否允许原矿输入 */
  allowExternalInput?: boolean;
}

/**
 * 构建并求解LP模型
 * 
 * @param targetItemId 目标产物ID
 * @param targetRate 目标产出速率（每分钟）
 * @param gameData 游戏数据
 * @param options 求解选项
 * @returns 求解结果
 */
export function solveProductionLP(
  targetItemId: string,
  targetRate: number,
  gameData: GameData,
  options: SolveOptions = {}
): LPSolution {
  // 1. 收集相关配方
  let recipes = gameData.recipes;
  
  if (options.allowedRecipes) {
    recipes = recipes.filter(r => options.allowedRecipes!.includes(r.id));
  }
  if (options.bannedRecipes) {
    recipes = recipes.filter(r => !options.bannedRecipes!.includes(r.id));
  }

  // 2. 收集所有涉及的物品（从配方中）
  const allItems = new Set<string>();
  allItems.add(targetItemId);
  
  for (const recipe of recipes) {
    for (const input of recipe.inputs) {
      allItems.add(input.itemId);
    }
    for (const output of recipe.outputs) {
      allItems.add(output.itemId);
    }
  }

  // 3. 构建变量（配方）
  const variables: Record<string, Record<string, number>> = {};
  
  for (const recipe of recipes) {
    const varName = `r${recipe.id}`;
    const coeffs: Record<string, number> = {};
    
    for (const itemId of allItems) {
      const balance = calculateItemBalance(recipe, itemId, options.globalProliferator);
      if (Math.abs(balance) > 1e-12) {
        coeffs[itemId] = balance;
      }
    }
    
    // 目标函数系数（最小化建筑数量）
    coeffs._obj = 1;
    
    variables[varName] = coeffs;
  }

  // 4. 构建约束
  const constraints: Record<string, { min?: number; max?: number }> = {};
  
  for (const itemId of allItems) {
    const isTarget = itemId === targetItemId;
    const isRaw = gameData.rawItemIds.includes(itemId);
    
    if (isTarget) {
      // 目标物品：必须满足需求
      constraints[itemId] = { min: targetRate };
    } else if (!isRaw || options.allowExternalInput === false) {
      // 非原矿：不能从外部输入，必须有非负产出
      constraints[itemId] = { min: 0 };
    }
    // 原矿不做约束（允许从外部输入）
  }

  // 5. 构建模型并求解
  const model: Model = {
    direction: 'minimize',
    objective: '_obj',
    constraints,
    variables,
  };

  const solution = solve(model);

  // 6. 解析结果
  const resultVariables = new Map<string, number>();
  const recipeCounts = new Map<string, number>();
  let result = 0;

  if (solution.status === 'optimal') {
    for (const [varName, value] of solution.variables) {
      if (varName.startsWith('r') && value > 0.0001) {
        resultVariables.set(varName, value);
        const recipeId = varName.slice(1);
        recipeCounts.set(recipeId, value);
      }
    }
    
    result = solution.result || 0;
  }

  return {
    feasible: recipeCounts.size > 0,
    result,
    variables: resultVariables,
    recipeCounts,
  };
}

/**
 * 验证解决方案
 * @param recipeCounts 配方执行次数
 * @param gameData 游戏数据
 * @param proliferator 增产配置
 * @returns 验证结果
 */
export function validateSolution(
  recipeCounts: Map<string, number>,
  gameData: GameData,
  proliferator?: ProliferatorConfig
): {
  valid: boolean;
  netFlows: Map<string, number>;
  warnings: string[];
} {
  const netFlows = new Map<string, number>();
  const warnings: string[] = [];

  for (const [recipeId, count] of recipeCounts.entries()) {
    const recipe = gameData.recipeMap.get(recipeId);
    if (!recipe) continue;

    // 产出
    for (const output of recipe.outputs) {
      const prodMultiplier = proliferator?.mode === 'productivity' ? 
        (1 + [0, 0.125, 0.2, 0.25][proliferator.level || 0]) : 1;
      const rate = count * output.count * prodMultiplier * (60 / recipe.time);
      netFlows.set(output.itemId, (netFlows.get(output.itemId) || 0) + rate);
    }

    // 原料消耗
    for (const input of recipe.inputs) {
      const rate = count * input.count * (60 / recipe.time);
      netFlows.set(input.itemId, (netFlows.get(input.itemId) || 0) - rate);
    }
  }

  // 检查缺口
  for (const [itemId, net] of netFlows.entries()) {
    if (net < -0.001 && !gameData.rawItemIds.includes(itemId)) {
      const item = gameData.itemMap.get(itemId);
      warnings.push(`${item?.name || itemId} 有缺口: ${Math.abs(net).toFixed(2)}/min`);
    }
  }

  return {
    valid: warnings.length === 0,
    netFlows,
    warnings,
  };
}

/**
 * 计算方案详情
 */
export function calculateSchemeDetails(
  recipeCounts: Map<string, number>,
  gameData: GameData,
  proliferator?: ProliferatorConfig
): {
  totalBuildings: number;
  totalPower: number;
  inputs: Map<string, number>;
  outputs: Map<string, number>;
} {
  let totalBuildings = 0;
  let totalPower = 0;
  const inputs = new Map<string, number>();
  const outputs = new Map<string, number>();

  for (const [recipeId, count] of recipeCounts.entries()) {
    const recipe = gameData.recipeMap.get(recipeId);
    if (!recipe) continue;

    const building = gameData.buildings.find(b => 
      recipe.factoryIds.includes(parseInt(b.id))
    ) || gameData.buildings[0];

    const prodMultiplier = proliferator?.mode === 'productivity' ? 
      (1 + [0, 0.125, 0.2, 0.25][proliferator.level || 0]) : 1;
    
    const powerMultiplier = proliferator && proliferator.level > 0 ? 
      (1 + [0, 0.3, 0.5, 0.7][proliferator.level]) : 1;

    const cyclesPerMinute = 60 / recipe.time;

    // 建筑数量（考虑加速模式）
    let speedMultiplier = 1;
    if (proliferator?.mode === 'speed') {
      speedMultiplier = 1 + [0, 0.25, 0.5, 1][proliferator.level];
    }
    totalBuildings += count / speedMultiplier;

    // 电力
    const power = building.workPower * powerMultiplier * cyclesPerMinute * count / speedMultiplier;
    totalPower += power;
    inputs.set('__POWER__', (inputs.get('__POWER__') || 0) + power);

    // 原料
    for (const input of recipe.inputs) {
      const rate = input.count * cyclesPerMinute * count;
      inputs.set(input.itemId, (inputs.get(input.itemId) || 0) + rate);
    }

    // 产出
    for (const output of recipe.outputs) {
      const rate = output.count * prodMultiplier * cyclesPerMinute * count;
      outputs.set(output.itemId, (outputs.get(output.itemId) || 0) + rate);
    }
  }

  return { totalBuildings, totalPower, inputs, outputs };
}
