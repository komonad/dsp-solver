/**
 * 线性规划求解器模块
 * 
 * 变量: 每个配方的执行次数（每分钟）
 * 约束: 每个物品的净产出 >= 需求
 * 目标: 最小化建筑总数或浪费
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const solver = require('javascript-lp-solver');
import type { GameData, Recipe, ProliferatorConfig, Building } from '../types';
import { calculateProductionParams } from './productionModel';

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

  // 2. 为每个配方计算系数（假设使用第一个可用建筑）
  const recipeCoefficients = new Map<string, Map<string, number>>();
  const recipeBuildings = new Map<string, Building>();

  for (const recipe of recipes) {
    const building = gameData.buildings.find(b => 
      recipe.factoryIds.includes(parseInt(b.id))
    ) || gameData.buildings[0];
    
    recipeBuildings.set(recipe.id, building);
    
    // 计算生产参数
    const params = calculateProductionParams({
      recipe,
      building,
      proliferator: options.globalProliferator,
    });

    // 构建系数
    const coef = new Map<string, number>();

    // 产出系数（正数）
    for (const output of recipe.outputs) {
      const rate = output.count * params.outputMultiplier;
      coef.set(output.itemId, rate);
    }

    // 消耗系数（负数）- 原料
    for (const input of recipe.inputs) {
      coef.set(input.itemId, (coef.get(input.itemId) || 0) - input.count);
    }

    // 电力消耗（负数）
    const powerPerCycle = building.workPower * params.powerMultiplier;
    const powerPerMinute = powerPerCycle * (60 / params.cycleTime);
    coef.set('__POWER__', -powerPerMinute);

    // 增产剂消耗（负数）
    if (options.globalProliferator && options.globalProliferator.level > 0 && building.hasProliferatorSlot) {
      const prolifId = `__PROLIFERATOR_${options.globalProliferator.level}__`;
      coef.set(prolifId, -params.proliferatorConsumption);
    }

    recipeCoefficients.set(recipe.id, coef);
  }

  // 3. 收集所有涉及的物品
  const allItems = new Set<string>();
  allItems.add(targetItemId);
  allItems.add('__POWER__'); // 电力总是包含
  
  for (const coef of recipeCoefficients.values()) {
    for (const itemId of coef.keys()) {
      if (!itemId.startsWith('__PROLIFERATOR')) {
        allItems.add(itemId);
      }
    }
  }
  if (options.globalProliferator && options.globalProliferator.level > 0) {
    allItems.add(`__PROLIFERATOR_${options.globalProliferator.level}__`);
  }

  // 4. 构建LP模型
  const lpModel: any = {
    optimize: {},
    opType: 'min',
    constraints: {},
    variables: {},
  };

  // 目标函数：最小化建筑数量
  for (const recipe of recipes) {
    const varName = `r${recipe.id}`;
    const building = recipeBuildings.get(recipe.id)!;
    const params = calculateProductionParams({
      recipe,
      building,
      proliferator: options.globalProliferator,
    });

    // 系数 = 配方时间 / 产出系数（相当于建筑数量权重）
    let coef = params.cycleTime;
    
    if (options.objective === 'min-waste' && recipe.isMultiProduct) {
      coef *= 1.5; // 多产物配方有惩罚
    }
    
    lpModel.optimize[varName] = coef;
    lpModel.variables[varName] = {};
  }

  // 约束条件
  for (const itemId of allItems) {
    const constraintName = `balance_${itemId}`;
    const isTarget = itemId === targetItemId;
    const isRaw = gameData.rawItemIds.includes(itemId);
    
    // 目标物品：净产出 >= targetRate
    // 非原矿：净产出 >= 0
    // 原矿：无约束（允许外部输入）
    if (!isTarget && isRaw && options.allowExternalInput !== false) {
      continue; // 跳过原矿约束
    }

    const rhs = isTarget ? targetRate : 0;
    lpModel.constraints[constraintName] = { min: rhs };

    // 为每个变量添加系数
    for (const recipe of recipes) {
      const varName = `r${recipe.id}`;
      const coef = recipeCoefficients.get(recipe.id)!.get(itemId) || 0;
      if (coef !== 0) {
        lpModel.variables[varName][constraintName] = coef;
      }
    }
  }

  // 5. 求解
  const result = solver.Solve(lpModel);

  // 6. 解析结果
  const variables = new Map<string, number>();
  const recipeCounts = new Map<string, number>();

  if (result.vertices && result.vertices.length > 0) {
    const vertex = result.vertices[0];
    
    for (const recipe of recipes) {
      const varName = `r${recipe.id}`;
      const value = vertex[varName] || 0;
      if (value > 0.0001) {
        variables.set(varName, value);
        recipeCounts.set(recipe.id, value);
      }
    }
  }

  return {
    feasible: recipeCounts.size > 0,
    result: result.result || 0,
    variables,
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

    const building = gameData.buildings.find(b => 
      recipe.factoryIds.includes(parseInt(b.id))
    ) || gameData.buildings[0];

    const params = calculateProductionParams({ recipe, building, proliferator });

    // 产出
    for (const output of recipe.outputs) {
      const rate = count * output.count * params.outputMultiplier;
      netFlows.set(output.itemId, (netFlows.get(output.itemId) || 0) + rate);
    }

    // 原料消耗
    for (const input of recipe.inputs) {
      const rate = count * input.count;
      netFlows.set(input.itemId, (netFlows.get(input.itemId) || 0) - rate);
    }

    // 电力消耗
    const powerPerCycle = building.workPower * params.powerMultiplier;
    const powerPerMinute = powerPerCycle * count * (60 / params.cycleTime);
    netFlows.set('__POWER__', (netFlows.get('__POWER__') || 0) - powerPerMinute);

    // 增产剂消耗
    if (proliferator && proliferator.level > 0 && building.hasProliferatorSlot) {
      const prolifId = `__PROLIFERATOR_${proliferator.level}__`;
      netFlows.set(prolifId, (netFlows.get(prolifId) || 0) - params.proliferatorConsumption * count);
    }
  }

  // 检查缺口
  for (const [itemId, net] of netFlows.entries()) {
    if (net < -0.001 && !itemId.startsWith('__') && !gameData.rawItemIds.includes(itemId)) {
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

    const params = calculateProductionParams({ recipe, building, proliferator });
    const cyclesPerMinute = 60 / params.cycleTime;

    // 建筑数量
    totalBuildings += count;

    // 电力
    const power = building.workPower * params.powerMultiplier * cyclesPerMinute * count;
    totalPower += power;
    inputs.set('__POWER__', (inputs.get('__POWER__') || 0) + power);

    // 原料
    for (const input of recipe.inputs) {
      const rate = input.count * cyclesPerMinute * count;
      inputs.set(input.itemId, (inputs.get(input.itemId) || 0) + rate);
    }

    // 产出
    for (const output of recipe.outputs) {
      const rate = output.count * params.outputMultiplier * cyclesPerMinute * count;
      outputs.set(output.itemId, (outputs.get(output.itemId) || 0) + rate);
    }

    // 增产剂
    if (proliferator && proliferator.level > 0 && building.hasProliferatorSlot) {
      const prolifId = `__PROLIFERATOR_${proliferator.level}__`;
      const consumption = params.proliferatorConsumption * count;
      inputs.set(prolifId, (inputs.get(prolifId) || 0) + consumption);
    }
  }

  return { totalBuildings, totalPower, inputs, outputs };
}
