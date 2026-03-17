/**
 * 核心计算引擎
 * 
 * 整合所有功能进行量化计算
 */

import type { 
  GameData, CalculationConfig, CalculationResult, CalculationResultItem,
  Demand, Recipe, Building, ProliferatorConfig 
} from '../types';
import { calculateProliferatorEffect, calculateBuildingCount } from './proliferator';
import { getDoublingMultiplier } from './doubling';
import { findSingleProductScheme, calculateSchemeOutput, analyzeScheme } from './multiProduct';

/**
 * 执行量化计算
 * @param config 计算配置
 * @param gameData 游戏数据
 * @returns 计算结果
 */
export function calculate(
  config: CalculationConfig,
  gameData: GameData
): CalculationResult {
  const startTime = Date.now();

  // 1. 处理每个需求
  const resultItems: CalculationResultItem[] = [];
  const processedRecipes = new Set<string>();
  const allSchemes: ReturnType<typeof findSingleProductScheme>[] = [];

  for (const demand of config.demands) {
    // 使用LP求解最优方案
    const scheme = findSingleProductScheme(
      demand.itemId,
      demand.rate,
      gameData,
      {
        strategy: config.balancingStrategy || 'min-waste',
        allowedRecipes: config.allowedRecipes,
        bannedRecipes: config.bannedRecipes,
      }
    );

    if (!scheme) {
      console.warn(`无法找到 ${demand.itemId} 的生产方案`);
      continue;
    }

    allSchemes.push(scheme);

    // 递归处理上游需求
    const upstreamItems = processScheme(
      scheme,
      gameData,
      config,
      processedRecipes,
      resultItems,
      10 // 最大递归深度
    );
  }

  // 2. 合并相同配方的结果
  const mergedItems = mergeResultItems(resultItems);

  // 3. 统计结果
  const totalBuildings: Record<string, number> = {};
  let totalPower = 0;
  const rawRequirements: Record<string, number> = {};
  const byproducts: Record<string, number> = {};

  for (const item of mergedItems) {
    // 统计建筑
    totalBuildings[item.buildingId] = (totalBuildings[item.buildingId] || 0) + item.buildingCountCeil;
    
    // 统计功耗
    const building = gameData.buildings.find(b => b.id === item.buildingId);
    if (building) {
      totalPower += building.workPower * item.buildingCountCeil;
    }

    // 收集原矿需求和副产物
    for (const scheme of allSchemes) {
      if (!scheme) continue;
      const analysis = analyzeScheme(scheme, gameData);
      
      for (const [itemId, rate] of analysis.rawInputs) {
        const itemName = gameData.itemMap.get(itemId)?.name || itemId;
        rawRequirements[itemName] = (rawRequirements[itemName] || 0) + rate;
      }

      for (const [itemId, rate] of analysis.byproducts) {
        const itemName = gameData.itemMap.get(itemId)?.name || itemId;
        byproducts[itemName] = (byproducts[itemName] || 0) + rate;
      }
    }
  }

  const calculationTime = Date.now() - startTime;

  return {
    items: mergedItems,
    totalBuildings,
    totalPower,
    balancingSchemes: allSchemes.filter((s): s is NonNullable<typeof s> => s !== null),
    rawRequirements,
    byproducts,
    calculationTime,
  };
}

/**
 * 处理配平方案，递归计算上游需求
 * @param scheme 配平方案
 * @param gameData 游戏数据
 * @param config 计算配置
 * @param processedRecipes 已处理的配方集合
 * @param resultItems 结果项列表
 * @param depth 剩余递归深度
 * @returns 处理的物品ID列表
 */
function processScheme(
  scheme: NonNullable<ReturnType<typeof findSingleProductScheme>>,
  gameData: GameData,
  config: CalculationConfig,
  processedRecipes: Set<string>,
  resultItems: CalculationResultItem[],
  depth: number
): string[] {
  if (depth <= 0) return [];

  const processedItems: string[] = [];

  for (const { recipeId, count } of scheme.recipes) {
    if (processedRecipes.has(recipeId)) continue;
    processedRecipes.add(recipeId);

    const recipe = gameData.recipeMap.get(recipeId);
    if (!recipe) continue;

    // 为每个输出创建结果项
    for (const output of recipe.outputs) {
      const resultItem = createResultItem(
        recipe,
        count,
        output.itemId,
        gameData,
        config
      );

      if (resultItem) {
        resultItems.push(resultItem);
        processedItems.push(output.itemId);
      }
    }

    // 递归处理输入物品
    for (const input of recipe.inputs) {
      // 跳过原矿
      if (gameData.rawItemIds.includes(input.itemId)) continue;

      // 计算输入物品的需求速率
      const inputRate = (input.count / recipe.time) * count;

      // 寻找输入物品的生产方案
      const inputScheme = findSingleProductScheme(
        input.itemId,
        inputRate,
        gameData,
        {
          strategy: config.balancingStrategy || 'min-waste',
        }
      );

      if (inputScheme) {
        const upstreamItems = processScheme(
          inputScheme,
          gameData,
          config,
          processedRecipes,
          resultItems,
          depth - 1
        );
        processedItems.push(...upstreamItems);
      }
    }
  }

  return processedItems;
}

/**
 * 创建计算结果项
 * @param recipe 配方
 * @param count 配方执行次数（每分钟）
 * @param mainProductId 主产物ID
 * @param gameData 游戏数据
 * @param config 计算配置
 * @returns 结果项
 */
function createResultItem(
  recipe: Recipe,
  count: number,
  mainProductId: string,
  gameData: GameData,
  config: CalculationConfig
): CalculationResultItem | null {
  // 选择建筑
  const buildingId = selectBuilding(recipe, config.buildingPreferences);
  const building = gameData.buildings.find(b => b.id === buildingId);
  if (!building) return null;

  // 获取增产配置
  const proliferator: ProliferatorConfig = config.defaultProliferator || { level: 0, mode: 'none', sprayCount: 0 };
  
  // 检查增产配置是否有效
  const isValid = proliferator.level <= recipe.proliferatorLevel && building.hasProliferatorSlot;
  const effectiveProliferator: ProliferatorConfig = isValid ? proliferator : { level: 0, mode: 'none', sprayCount: 0 };

  // 计算增产效果
  const mainProduct = recipe.outputs.find(o => o.itemId === mainProductId);
  const baseOutput = mainProduct?.count || 1;
  const proliferatorEffect = calculateProliferatorEffect(
    effectiveProliferator,
    baseOutput,
    building.hasProliferatorSlot
  );

  // 计算翻倍效果
  const itemForDoubling = gameData.itemMap.get(mainProductId);
  const doublingMultiplier = itemForDoubling 
    ? getDoublingMultiplier(buildingId, itemForDoubling, recipe)
    : 1;

  // 计算建筑数量
  const baseRatePerBuilding = (baseOutput / recipe.time);
  const actualRatePerBuilding = baseRatePerBuilding * 
    proliferatorEffect.speedMultiplier * 
    proliferatorEffect.productivityMultiplier * 
    building.speed * 
    doublingMultiplier;
  
  const targetRate = baseRatePerBuilding * count;
  const buildingCount = targetRate / actualRatePerBuilding;

  const itemForName = gameData.itemMap.get(mainProductId);

  return {
    itemId: mainProductId,
    itemName: itemForName?.name || mainProductId,
    netRate: targetRate,
    buildingCount,
    buildingCountCeil: Math.ceil(buildingCount * 100) / 100, // 保留2位小数
    recipeId: recipe.id,
    buildingId,
    proliferator: effectiveProliferator,
    useDoubling: doublingMultiplier > 1,
    extraProducts: proliferatorEffect.extraProducts * count,
  };
}

/**
 * 选择最优建筑
 * @param recipe 配方
 * @param preferences 建筑偏好
 * @returns 建筑ID
 */
function selectBuilding(
  recipe: Recipe,
  preferences?: CalculationConfig['buildingPreferences']
): string {
  // 默认选择最后一个可用建筑（通常是最高级）
  if (!preferences) {
    return recipe.factoryIds[recipe.factoryIds.length - 1]?.toString() || '2302';
  }

  // 根据偏好选择
  for (const factoryId of recipe.factoryIds) {
    const id = factoryId.toString();
    if (preferences.preferredSmelter?.toString() === id) return id;
    if (preferences.preferredAssembler?.toString() === id) return id;
    if (preferences.preferredChemicalPlant?.toString() === id) return id;
  }

  return recipe.factoryIds[recipe.factoryIds.length - 1]?.toString() || '2302';
}

/**
 * 合并相同配方的结果项
 * @param items 结果项列表
 * @returns 合并后的列表
 */
function mergeResultItems(items: CalculationResultItem[]): CalculationResultItem[] {
  const merged = new Map<string, CalculationResultItem>();

  for (const item of items) {
    const key = `${item.recipeId}_${item.itemId}_${item.buildingId}`;
    
    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.buildingCount += item.buildingCount;
      existing.buildingCountCeil += item.buildingCountCeil;
      existing.netRate += item.netRate;
      existing.extraProducts = (existing.extraProducts || 0) + (item.extraProducts || 0);
    } else {
      merged.set(key, { ...item });
    }
  }

  return Array.from(merged.values());
}

/**
 * 快速计算（不使用配平，直接计算）
 * @param itemId 物品ID
 * @param rate 每分钟需求
 * @param gameData 游戏数据
 * @param config 计算配置
 * @returns 简化结果
 */
export function quickCalculate(
  itemId: string,
  rate: number,
  gameData: GameData,
  config?: Partial<CalculationConfig>
): CalculationResultItem | null {
  const recipes = gameData.itemToRecipes.get(itemId);
  if (!recipes || recipes.length === 0) return null;

  const recipe = recipes[0]; // 使用第一个配方
  const fullConfig: CalculationConfig = {
    demands: [{ itemId, rate }],
    buildingPreferences: config?.buildingPreferences,
    defaultProliferator: config?.defaultProliferator,
    ...config,
  };

  const result = createResultItem(recipe, 1, itemId, gameData, fullConfig);
  return result;
}

/**
 * 递归计算上游需求
 * @param itemId 物品ID
 * @param rate 需求速率
 * @param gameData 游戏数据
 * @param config 计算配置
 * @param depth 递归深度
 * @returns 所有上游需求
 */
export function calculateUpstream(
  itemId: string,
  rate: number,
  gameData: GameData,
  config?: Partial<CalculationConfig>,
  depth: number = 10
): Map<string, number> {
  const requirements = new Map<string, number>();
  requirements.set(itemId, rate);

  if (depth <= 0) return requirements;

  // 使用LP求解
  const scheme = findSingleProductScheme(itemId, rate, gameData, {
    strategy: config?.balancingStrategy || 'min-waste',
  });

  if (!scheme) return requirements;

  // 计算方案产出
  const netOutputs = calculateSchemeOutput(scheme, gameData);

  // 递归处理净消耗的物品
  for (const [id, netRate] of netOutputs.entries()) {
    if (netRate < -0.001 && !gameData.rawItemIds.includes(id)) {
      const upstream = calculateUpstream(
        id,
        Math.abs(netRate),
        gameData,
        config,
        depth - 1
      );
      
      // 合并上游需求
      for (const [uid, urate] of upstream.entries()) {
        requirements.set(uid, (requirements.get(uid) || 0) + urate);
      }
    }
  }

  return requirements;
}
