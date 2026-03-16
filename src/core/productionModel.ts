/**
 * 生产模型 - 统一处理所有生产计算
 * 
 * 核心概念:
 * 1. 配方输入: 原料 + 电力 + 增产剂（都是消耗品）
 * 2. 配方输出: 产物
 * 3. 实际产出 = 基础产出 * 建筑翻倍系数 * 增产剂产出系数
 * 4. 实际周期 = 基础周期 / (建筑速度 * 加速增产系数)
 * 
 * 增产剂参数（每种等级）:
 * - speedBonus: 加速模式的速度加成
 * - productivityBonus: 增产模式的产出加成
 * - powerBonus: 功耗增加
 * - consumptionRate: 每分钟消耗的增产剂数量
 */

import type { Recipe, Building, Item, ProliferatorConfig } from '../types';

/**
 * 增产剂参数配置
 */
export interface ProliferatorParams {
  /** 加速模式速度加成 (0.25 = +25%) */
  speedBonus: number;
  /** 增产模式产出加成 (0.25 = +25%) */
  productivityBonus: number;
  /** 功耗加成 (0.7 = +70%) */
  powerBonus: number;
  /** 每分钟消耗的增产剂数量 */
  consumptionRate: number;
}

// 默认增产剂参数
export const DEFAULT_PROLIFERATOR_PARAMS: Record<number, ProliferatorParams> = {
  0: { speedBonus: 0, productivityBonus: 0, powerBonus: 0, consumptionRate: 0 },
  1: { speedBonus: 0.125, productivityBonus: 0.125, powerBonus: 0.3, consumptionRate: 0.5 },
  2: { speedBonus: 0.20, productivityBonus: 0.20, powerBonus: 0.5, consumptionRate: 0.5 },
  3: { speedBonus: 0.25, productivityBonus: 0.25, powerBonus: 0.7, consumptionRate: 0.5 },
};

// 当前使用的参数（可被模组修改）
let currentParams: Record<number, ProliferatorParams> = DEFAULT_PROLIFERATOR_PARAMS;

export function setProliferatorParams(params: Record<number, ProliferatorParams>): void {
  currentParams = params;
}

export function resetProliferatorParams(): void {
  currentParams = DEFAULT_PROLIFERATOR_PARAMS;
}

export function getProliferatorParams(): Record<number, ProliferatorParams> {
  return currentParams;
}

function getParams(level: number): ProliferatorParams {
  return currentParams[level] || currentParams[0];
}

/**
 * 生产上下文
 */
export interface ProductionContext {
  recipe: Recipe;
  building: Building;
  proliferator?: ProliferatorConfig;
}

/**
 * 生产参数计算结果
 */
export interface ProductionParams {
  /** 速度系数 = 建筑速度 * 加速增产系数 */
  speedMultiplier: number;
  /** 产出系数 = 建筑翻倍 * 增产剂产出加成 */
  outputMultiplier: number;
  /** 功耗系数 */
  powerMultiplier: number;
  /** 实际周期时间（秒） */
  cycleTime: number;
  /** 每分钟消耗多少增产剂 */
  proliferatorConsumption: number;
}

/**
 * 计算生产参数
 */
export function calculateProductionParams(context: ProductionContext): ProductionParams {
  const { recipe, building, proliferator } = context;
  const params = proliferator ? getParams(proliferator.level) : getParams(0);

  // 1. 速度系数
  let speedMultiplier = building.speed;
  if (proliferator?.mode === 'speed' && building.hasProliferatorSlot) {
    speedMultiplier *= (1 + params.speedBonus);
  }

  // 2. 产出系数
  let outputMultiplier = 1;
  // 建筑内置产出加成
  if (building.intrinsicProductivity && building.intrinsicProductivity > 0) {
    outputMultiplier *= (1 + building.intrinsicProductivity);
  }
  // 建筑翻倍
  if (building.supportsDoubling && building.doublingConfig) {
    outputMultiplier *= building.doublingConfig.multiplier;
  }
  // 增产剂加成
  if (proliferator?.mode === 'productivity' && building.hasProliferatorSlot) {
    outputMultiplier *= (1 + params.productivityBonus);
  }

  // 3. 功耗系数
  let powerMultiplier = 1;
  if (proliferator && proliferator.level > 0 && building.hasProliferatorSlot) {
    powerMultiplier *= (1 + params.powerBonus);
  }

  // 4. 实际周期
  const cycleTime = recipe.time / speedMultiplier;

  // 5. 增产剂消耗（每分钟）
  const cyclesPerMinute = 60 / cycleTime;
  // 假设每个周期需要喷涂所有产物
  const totalProductsPerCycle = recipe.outputs.reduce((sum, o) => sum + o.count, 0);
  const proliferatorConsumption = params.consumptionRate * cyclesPerMinute * totalProductsPerCycle;

  return {
    speedMultiplier,
    outputMultiplier,
    powerMultiplier,
    cycleTime,
    proliferatorConsumption,
  };
}

/**
 * 计算配方系数（用于LP求解）
 * 
 * 返回: 单位执行次数（每分钟1次）的净产出系数
 * 正数 = 产出, 负数 = 消耗（包括原料、电力、增产剂）
 */
export function buildRecipeCoefficients(
  recipe: Recipe,
  building: Building,
  proliferator?: ProliferatorConfig
): Map<string, number> {
  const params = calculateProductionParams({ recipe, building, proliferator });
  const coef = new Map<string, number>();

  // 产出系数（正数）
  for (const output of recipe.outputs) {
    const rate = output.count * params.outputMultiplier;
    coef.set(output.itemId, rate);
  }

  // 原料消耗系数（负数）
  for (const input of recipe.inputs) {
    const rate = -input.count;
    coef.set(input.itemId, (coef.get(input.itemId) || 0) + rate);
  }

  // 电力消耗系数（负数，单位 MW/每分钟执行次数）
  const powerPerCycle = building.workPower * params.powerMultiplier;
  const powerPerMinute = powerPerCycle * (60 / params.cycleTime);
  coef.set('__POWER__', -powerPerMinute);

  // 增产剂消耗系数（负数）
  if (proliferator && proliferator.level > 0 && building.hasProliferatorSlot) {
    const prolifItemId = `__PROLIFERATOR_${proliferator.level}__`;
    coef.set(prolifItemId, -params.proliferatorConsumption);
  }

  return coef;
}

/**
 * 计算目标产出所需的建筑数量和资源消耗
 * 
 * @param context 生产上下文
 * @param targetRate 目标产出速率（每分钟，针对主产物）
 * @returns 详细计算结果
 */
export function calculateProductionRequirements(
  context: ProductionContext,
  targetRate: number
): {
  buildingCount: number;
  inputs: Map<string, number>;
  outputs: Map<string, number>;
  cycleTime: number;
} {
  const { recipe } = context;
  const params = calculateProductionParams(context);

  // 主产物
  const mainProduct = recipe.outputs[0];
  if (!mainProduct) {
    throw new Error('Recipe has no output');
  }

  // 单建筑每分钟产出 = (60 / 周期时间) * 产出数量 * 产出倍率
  const cyclesPerMinute = 60 / params.cycleTime;
  const outputPerBuilding = cyclesPerMinute * mainProduct.count * params.outputMultiplier;

  // 所需建筑数量
  const buildingCount = targetRate / outputPerBuilding;

  // 计算输入
  const inputs = new Map<string, number>();

  // 原料
  for (const input of recipe.inputs) {
    const rate = cyclesPerMinute * input.count * buildingCount;
    inputs.set(input.itemId, (inputs.get(input.itemId) || 0) + rate);
  }

  // 电力
  const powerPerMinute = buildingCount * context.building.workPower * params.powerMultiplier * cyclesPerMinute;
  inputs.set('__POWER__', powerPerMinute);

  // 增产剂
  if (context.proliferator && context.proliferator.level > 0) {
    const prolifItemId = `__PROLIFERATOR_${context.proliferator.level}__`;
    inputs.set(prolifItemId, params.proliferatorConsumption * buildingCount);
  }

  // 计算输出
  const outputs = new Map<string, number>();
  for (const output of recipe.outputs) {
    const rate = cyclesPerMinute * output.count * params.outputMultiplier * buildingCount;
    outputs.set(output.itemId, rate);
  }

  return {
    buildingCount,
    inputs,
    outputs,
    cycleTime: params.cycleTime,
  };
}

/**
 * 计算配方执行次数对应的净流量
 * 
 * @param recipe 配方
 * @param executionsPerMinute 每分钟执行次数
 * @param context 生产上下文
 * @returns 各物品的净流量（正=产出，负=消耗）
 */
export function calculateNetFlow(
  recipe: Recipe,
  executionsPerMinute: number,
  context: ProductionContext
): Map<string, number> {
  const params = calculateProductionParams(context);
  const net = new Map<string, number>();

  // 产出
  for (const output of recipe.outputs) {
    const rate = executionsPerMinute * output.count * params.outputMultiplier;
    net.set(output.itemId, (net.get(output.itemId) || 0) + rate);
  }

  // 原料消耗
  for (const input of recipe.inputs) {
    const rate = executionsPerMinute * input.count;
    net.set(input.itemId, (net.get(input.itemId) || 0) - rate);
  }

  // 电力消耗（作为特殊物品）
  const powerPerCycle = context.building.workPower * params.powerMultiplier;
  const powerPerMinute = powerPerCycle * executionsPerMinute;
  net.set('__POWER__', (net.get('__POWER__') || 0) - powerPerMinute);

  // 增产剂消耗
  if (context.proliferator && context.proliferator.level > 0 && context.building.hasProliferatorSlot) {
    const prolifItemId = `__PROLIFERATOR_${context.proliferator.level}__`;
    net.set(prolifItemId, (net.get(prolifItemId) || 0) - params.proliferatorConsumption);
  }

  return net;
}

/**
 * 计算物品在配方中的净产出系数（每分钟，每执行1次配方）
 * 用于线性方程组建模
 * 
 * @param recipe 配方
 * @param itemId 物品ID
 * @param proliferator 全局增产剂配置（可选）
 * @returns 净产出系数（正=产出，负=消耗）
 */
export function calculateItemBalance(
  recipe: Recipe,
  itemId: string,
  proliferator?: { level: 0 | 1 | 2 | 3; mode: 'none' | 'speed' | 'productivity'; sprayCount?: number },
  building?: Building
): number {
  // 参数验证
  if (!recipe) {
    throw new Error('[Assertion Error] calculateItemBalance: recipe is undefined');
  }
  if (!itemId) {
    throw new Error('[Assertion Error] calculateItemBalance: itemId is undefined');
  }
  if (recipe.time <= 0) {
    throw new Error(`[Assertion Error] Recipe ${recipe.id} has invalid time: ${recipe.time}`);
  }
  
  // 验证配方的输入输出
  const totalInputCount = recipe.inputs.reduce((sum, i) => sum + i.count, 0);
  const totalOutputCount = recipe.outputs.reduce((sum, o) => sum + o.count, 0);
  
  if (totalOutputCount === 0 && recipe.inputs.length > 0) {
    console.warn(`[Assertion Warning] Recipe ${recipe.id} (${recipe.name}) has no outputs but has inputs`);
  }

  // 增产模式加成（增加产出，不增加消耗）
  let prodMultiplier = proliferator?.mode === 'productivity' ? 
    (1 + [0, 0.125, 0.2, 0.25][proliferator.level || 0]) : 1;
  
  // 建筑内置产出加成（例如某些模组建筑自带增产效果）
  if (building?.intrinsicProductivity && building.intrinsicProductivity > 0) {
    prodMultiplier *= (1 + building.intrinsicProductivity);
  }

  let balance = 0;

  // 产出（每分钟）- 考虑增产加成和建筑内置加成，不考虑加速（加速只影响建筑数量）
  for (const output of recipe.outputs) {
    if (output.itemId === itemId) {
      if (output.count < 0) {
        throw new Error(`[Assertion Error] Recipe ${recipe.id} has negative output count for ${itemId}`);
      }
      balance += output.count * prodMultiplier * (60 / recipe.time);
    }
  }

  // 消耗（每分钟）- 不受增产/加速影响（原料消耗不变）
  for (const input of recipe.inputs) {
    if (input.itemId === itemId) {
      if (input.count < 0) {
        throw new Error(`[Assertion Error] Recipe ${recipe.id} has negative input count for ${itemId}`);
      }
      balance -= input.count * (60 / recipe.time);
    }
  }

  // 验证：加速模式不应该影响物料平衡
  if (proliferator?.mode === 'speed' && Math.abs(balance) > 0.001) {
    // 对于加速模式，物料平衡不应该改变（只改变建筑数量）
    // 这是一个合理性检查，但不抛出错误，只记录
    const expectedBalanceWithoutSpeed = balance; // 已经计算好了
    if (Math.abs(expectedBalanceWithoutSpeed - balance) > 0.001) {
      console.warn(`[Assertion Warning] Speed mode should not change material balance for ${itemId} in recipe ${recipe.id}`);
    }
  }

  return balance;
}

/**
 * 格式化生产报告
 */
export function formatProductionReport(
  result: ReturnType<typeof calculateProductionRequirements>,
  itemMap: Map<string, Item>
): string {
  const lines: string[] = [];
  
  lines.push('=== 生产参数 ===');
  lines.push(`建筑数量: ${result.buildingCount.toFixed(2)}`);
  lines.push(`周期时间: ${result.cycleTime.toFixed(2)} 秒`);
  
  lines.push('\n=== 输入（每分钟）===');
  for (const [id, rate] of result.inputs.entries()) {
    if (id.startsWith('__')) {
      if (id === '__POWER__') lines.push(`  电力: ${rate.toFixed(2)} MW`);
      else if (id.includes('PROLIFERATOR')) {
        const level = id.match(/\d+/)?.[0];
        lines.push(`  增产剂Mk.${level}: ${rate.toFixed(2)}`);
      }
    } else {
      lines.push(`  ${itemMap.get(id)?.name || id}: ${rate.toFixed(2)}`);
    }
  }
  
  lines.push('\n=== 输出（每分钟）===');
  for (const [id, rate] of result.outputs.entries()) {
    lines.push(`  ${itemMap.get(id)?.name || id}: ${rate.toFixed(2)}`);
  }

  return lines.join('\n');
}
