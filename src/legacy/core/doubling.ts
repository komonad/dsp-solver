/**
 * 建筑翻倍效果支持模块
 * 
 * 支持模组中部分建筑对产物产生翻倍效果的特性
 */

import type { Building, Item, Recipe } from '../types';

/**
 * 翻倍效果配置
 */
export interface DoublingConfig {
  /** 是否启用翻倍效果 */
  enabled: boolean;
  /** 翻倍倍率（默认2倍） */
  multiplier: number;
  /** 适用产物ID列表（空表示全部适用） */
  applicableItemIds: string[];
  /** 适用产物类型列表 */
  applicableItemTypes: number[];
  /** 适用配方类型列表 */
  applicableRecipeTypes: number[];
  /** 是否只对特定配方生效 */
  specificRecipesOnly: boolean;
  /** 特定配方ID列表 */
  specificRecipeIds: string[];
}

/**
 * 默认翻倍配置（原版无翻倍效果）
 */
export const DEFAULT_DOUBLING_CONFIG: DoublingConfig = {
  enabled: false,
  multiplier: 2,
  applicableItemIds: [],
  applicableItemTypes: [],
  applicableRecipeTypes: [],
  specificRecipesOnly: false,
  specificRecipeIds: [],
};

/**
 * 建筑翻倍配置表
 * 可以为特定建筑配置翻倍效果
 */
const buildingDoublingConfigs = new Map<string, DoublingConfig>();

/**
 * 设置建筑的翻倍配置
 * @param buildingId 建筑ID
 * @param config 翻倍配置
 */
export function setBuildingDoublingConfig(buildingId: string, config: DoublingConfig): void {
  buildingDoublingConfigs.set(buildingId, config);
}

/**
 * 获取建筑的翻倍配置
 * @param buildingId 建筑ID
 * @returns 翻倍配置，未设置则返回默认配置
 */
export function getBuildingDoublingConfig(buildingId: string): DoublingConfig {
  return buildingDoublingConfigs.get(buildingId) || DEFAULT_DOUBLING_CONFIG;
}

/**
 * 清除所有翻倍配置
 */
export function clearAllDoublingConfigs(): void {
  buildingDoublingConfigs.clear();
}

/**
 * 检查翻倍效果是否适用于指定产物
 * @param config 翻倍配置
 * @param item 物品
 * @param recipe 配方
 * @returns 是否适用
 */
export function isDoublingApplicable(
  config: DoublingConfig,
  item: Item,
  recipe: Recipe
): boolean {
  if (!config.enabled) {
    return false;
  }

  // 检查是否在特定配方列表中
  if (config.specificRecipesOnly && !config.specificRecipeIds.includes(recipe.id)) {
    return false;
  }

  // 检查产物类型
  if (config.applicableItemTypes.length > 0 && !config.applicableItemTypes.includes(item.type)) {
    return false;
  }

  // 检查产物ID
  if (config.applicableItemIds.length > 0 && !config.applicableItemIds.includes(item.id)) {
    return false;
  }

  // 检查配方类型
  if (config.applicableRecipeTypes.length > 0 && !config.applicableRecipeTypes.includes(recipe.type)) {
    return false;
  }

  return true;
}

/**
 * 获取配方的翻倍倍率
 * @param buildingId 建筑ID
 * @param item 产物
 * @param recipe 配方
 * @returns 翻倍倍率（1表示无翻倍效果）
 */
export function getDoublingMultiplier(
  buildingId: string,
  item: Item,
  recipe: Recipe
): number {
  const config = getBuildingDoublingConfig(buildingId);
  
  if (!isDoublingApplicable(config, item, recipe)) {
    return 1;
  }

  return config.multiplier;
}

/**
 * 批量设置翻倍配置（用于模组数据加载）
 * @param configs 建筑ID到配置的映射
 */
export function batchSetDoublingConfigs(configs: Record<string, DoublingConfig>): void {
  for (const [buildingId, config] of Object.entries(configs)) {
    setBuildingDoublingConfig(buildingId, config);
  }
}

/**
 * 为特定建筑启用翻倍效果（简化配置）
 * @param buildingId 建筑ID
 * @param multiplier 翻倍倍率（默认2）
 * @param applicableItems 适用产物ID列表（可选）
 */
export function enableDoublingForBuilding(
  buildingId: string,
  multiplier: number = 2,
  applicableItems?: string[]
): void {
  setBuildingDoublingConfig(buildingId, {
    enabled: true,
    multiplier,
    applicableItemIds: applicableItems || [],
    applicableItemTypes: [],
    applicableRecipeTypes: [],
    specificRecipesOnly: false,
    specificRecipeIds: [],
  });
}

/**
 * 为特定配方启用翻倍效果
 * @param buildingId 建筑ID
 * @param recipeIds 配方ID列表
 * @param multiplier 翻倍倍率
 */
export function enableDoublingForRecipes(
  buildingId: string,
  recipeIds: string[],
  multiplier: number = 2
): void {
  setBuildingDoublingConfig(buildingId, {
    enabled: true,
    multiplier,
    applicableItemIds: [],
    applicableItemTypes: [],
    applicableRecipeTypes: [],
    specificRecipesOnly: true,
    specificRecipeIds: recipeIds,
  });
}

/**
 * 检查建筑是否支持翻倍效果
 * @param building 建筑
 * @returns 是否支持
 */
export function isBuildingSupportDoubling(building: Building): boolean {
  const config = getBuildingDoublingConfig(building.id);
  return config.enabled;
}

/**
 * 获取所有启用翻倍效果的建筑ID
 * @returns 建筑ID列表
 */
export function getDoublingEnabledBuildings(): string[] {
  return Array.from(buildingDoublingConfigs.entries())
    .filter(([_, config]) => config.enabled)
    .map(([id, _]) => id);
}
