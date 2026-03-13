/**
 * 增产剂效果计算模块
 * 
 * 支持参数化的增产效果计算
 */

import type { ProliferatorConfig, ProliferatorLevel, ProliferatorMode, ProliferatorEffect, GameData } from '../types';

/**
 * 增产参数配置
 * 允许自定义增产效果参数，用于模组支持
 */
export interface ProliferatorParams {
  /** 加速模式速度加成 */
  speedBonus: number;
  /** 增产模式产出加成 */
  productivityBonus: number;
  /** 功耗加成 */
  powerBonus: number;
  /** 喷涂次数 */
  sprayCount: number;
}

/**
 * 默认增产参数（原版游戏）
 */
export const DEFAULT_PROLIFERATOR_PARAMS: Record<ProliferatorLevel, ProliferatorParams> = {
  0: { speedBonus: 0, productivityBonus: 0, powerBonus: 0, sprayCount: 0 },
  1: { speedBonus: 0.25, productivityBonus: 0.125, powerBonus: 0.3, sprayCount: 12 },
  2: { speedBonus: 0.50, productivityBonus: 0.20, powerBonus: 0.5, sprayCount: 12 },
  3: { speedBonus: 1.00, productivityBonus: 0.25, powerBonus: 0.7, sprayCount: 12 },
};

/**
 * 自定义增产参数表
 * 可以通过修改此表来支持模组的增产效果
 */
let customProliferatorParams: Record<ProliferatorLevel, ProliferatorParams> | null = null;

/**
 * 设置自定义增产参数
 * @param params 自定义参数表
 */
export function setCustomProliferatorParams(params: Record<ProliferatorLevel, ProliferatorParams>): void {
  customProliferatorParams = params;
}

/**
 * 重置为默认增产参数
 */
export function resetProliferatorParams(): void {
  customProliferatorParams = null;
}

/**
 * 获取当前使用的增产参数
 * @returns 当前增产参数表
 */
export function getProliferatorParams(): Record<ProliferatorLevel, ProliferatorParams> {
  return customProliferatorParams || DEFAULT_PROLIFERATOR_PARAMS;
}

/**
 * 计算增产效果
 * @param config 增产配置
 * @param baseOutput 基础产出数量
 * @param buildingHasSlot 建筑是否有增产槽位
 * @returns 增产效果计算结果
 */
export function calculateProliferatorEffect(
  config: ProliferatorConfig,
  baseOutput: number = 1,
  buildingHasSlot: boolean = true
): ProliferatorEffect {
  // 如果没有增产槽位或配置为无，返回默认值
  if (!buildingHasSlot || config.level === 0 || config.mode === 'none') {
    return {
      speedMultiplier: 1,
      productivityMultiplier: 1,
      powerMultiplier: 1,
      extraProducts: 0,
    };
  }

  const params = getProliferatorParams()[config.level];

  let speedMultiplier = 1;
  let productivityMultiplier = 1;
  let powerMultiplier = 1 + params.powerBonus;

  if (config.mode === 'speed') {
    // 加速模式：速度提升，功耗增加
    speedMultiplier = 1 + params.speedBonus;
    productivityMultiplier = 1;
  } else if (config.mode === 'productivity') {
    // 增产模式：产出增加，速度略微降低，功耗增加
    speedMultiplier = 1; // 实际游戏中增产模式也会略微降速，但这里简化处理
    productivityMultiplier = 1 + params.productivityBonus;
  }

  // 计算额外产出数量（对于整数产出）
  const totalOutput = baseOutput * productivityMultiplier;
  const extraProducts = totalOutput - baseOutput;

  return {
    speedMultiplier,
    productivityMultiplier,
    powerMultiplier,
    extraProducts,
  };
}

/**
 * 计算实际产出速率
 * @param baseRate 基础产出速率（每分钟）
 * @param effect 增产效果
 * @param buildingSpeed 建筑速度倍率
 * @returns 实际产出速率
 */
export function calculateActualRate(
  baseRate: number,
  effect: ProliferatorEffect,
  buildingSpeed: number = 1
): number {
  return baseRate * effect.speedMultiplier * effect.productivityMultiplier * buildingSpeed;
}

/**
 * 计算所需建筑数量
 * @param targetRate 目标产出速率（每分钟）
 * @param baseRatePerBuilding 单个建筑基础产出速率
 * @param effect 增产效果
 * @param buildingSpeed 建筑速度倍率
 * @param doublingMultiplier 翻倍效果倍率（模组特性）
 * @returns 所需建筑数量（可能为小数）
 */
export function calculateBuildingCount(
  targetRate: number,
  baseRatePerBuilding: number,
  effect: ProliferatorEffect,
  buildingSpeed: number = 1,
  doublingMultiplier: number = 1
): number {
  const actualRatePerBuilding = calculateActualRate(
    baseRatePerBuilding,
    effect,
    buildingSpeed
  ) * doublingMultiplier;
  
  return targetRate / actualRatePerBuilding;
}

/**
 * 获取喷涂机数量需求
 * @param totalItems 总喷涂物品数量
 * @param config 增产配置
 * @returns 所需喷涂机数量（考虑喷涂次数）
 */
export function calculateSprayerCount(
  totalItems: number,
  config: ProliferatorConfig
): number {
  if (config.level === 0 || config.sprayCount === 0) {
    return 0;
  }
  
  const params = getProliferatorParams()[config.level];
  // 每个喷涂机每分钟可喷涂 30 次
  const spraysPerMinute = 30;
  // 每次喷涂可喷涂的物品数量
  const itemsPerSpray = params.sprayCount;
  
  const totalSpraysNeeded = totalItems / itemsPerSpray;
  return totalSpraysNeeded / spraysPerMinute;
}

/**
 * 验证增产配置是否有效
 * @param config 增产配置
 * @param recipeProliferatorLevel 配方支持的增产剂等级
 * @param buildingHasSlot 建筑是否有增产槽位
 * @returns 是否有效
 */
export function isValidProliferatorConfig(
  config: ProliferatorConfig,
  recipeProliferatorLevel: number,
  buildingHasSlot: boolean
): boolean {
  if (!buildingHasSlot) {
    return config.level === 0 || config.mode === 'none';
  }
  
  // 配方支持的增产剂等级：0-不支持，1-Mk.I，2-Mk.II，3-Mk.III
  return config.level <= recipeProliferatorLevel;
}

/**
 * 获取推荐的增产配置
 * @param recipeType 配方类型
 * @param buildingSpeed 建筑速度
 * @param preferSpeed 是否优先加速
 * @returns 推荐的增产配置
 */
export function getRecommendedProliferatorConfig(
  recipeType: number,
  buildingSpeed: number = 1,
  preferSpeed: boolean = true
): ProliferatorConfig {
  // 默认使用最高级增产剂
  const level: ProliferatorLevel = 3;
  
  // 根据偏好选择模式
  const mode: ProliferatorMode = preferSpeed ? 'speed' : 'productivity';
  
  const params = getProliferatorParams()[level];
  
  return {
    level,
    mode,
    sprayCount: params.sprayCount,
  };
}
