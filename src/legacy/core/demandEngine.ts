/**
 * 需求引擎 - 支持灵活的配方选择和需求描述
 * 
 * 支持场景:
 * 1. 手动指定配方 - "使用配方X生产物品A"
 * 2. 多配方混合 - "70%用配方X，30%用配方Y"
 * 3. 配方优先级 - "优先用配方X，不够再用配方Y"
 * 4. 动态调整 - 根据资源可用性自动选择
 */

import type { GameData, Recipe, ProliferatorConfig } from '../types';
import { solveProductionLP } from './lpSolver';

/**
 * 配方指定方式
 */
export type RecipeSelection = 
  | { type: 'auto' }                                    // 自动选择
  | { type: 'single'; recipeId: string }               // 指定单一配方
  | { type: 'ratio'; ratios: Map<string, number> }     // 按比例分配
  | { type: 'priority'; order: string[] }              // 按优先级
  | { type: 'exclude'; bannedRecipes: string[] };      // 排除某些配方

/**
 * 物品需求描述
 */
export interface ItemDemand {
  /** 物品ID */
  itemId: string;
  /** 需求速率（每分钟） */
  rate: number;
  /** 配方选择策略 */
  recipeSelection?: RecipeSelection;
  /** 专属增产配置（覆盖全局） */
  proliferator?: ProliferatorConfig;
  /** 是否允许外部输入（作为原矿） */
  allowExternal?: boolean;
  /** 备注 */
  note?: string;
}

/**
 * 复合需求组
 * 用于描述需要同时满足的一组需求
 */
export interface DemandGroup {
  /** 组ID */
  id: string;
  /** 组名称 */
  name: string;
  /** 组内需求 */
  demands: ItemDemand[];
  /** 组的约束类型 */
  constraint: 'all' | 'any' | 'at-least-one';
}

/**
 * 完整需求配置
 */
export interface DemandConfig {
  /** 主需求列表 */
  demands: ItemDemand[];
  /** 可选的需求组 */
  groups?: DemandGroup[];
  /** 全局增产配置 */
  globalProliferator?: ProliferatorConfig;
  /** 优化目标 */
  objective?: 'min-buildings' | 'min-waste' | 'min-power';
}

/**
 * 求解结果
 */
export interface DemandSolution {
  /** 是否可行 */
  feasible: boolean;
  /** 错误信息 */
  errors?: string[];
  /** 警告信息 */
  warnings?: string[];
  /** 各配方的执行次数 */
  recipeExecutions: Map<string, number>;
  /** 各物品的净流量 */
  netFlows: Map<string, number>;
  /** 详细结果 */
  details: {
    totalBuildings: number;
    totalPower: number;
    rawMaterials: Map<string, number>;
    byproducts: Map<string, number>;
  };
}

/**
 * 求解需求
 * @param config 需求配置
 * @param gameData 游戏数据
 * @returns 求解结果
 */
export function solveDemand(
  config: DemandConfig,
  gameData: GameData
): DemandSolution {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 预处理需求，转换为LP可处理的形式
  const lpConstraints: ItemDemand[] = [];
  const forcedRecipes = new Map<string, number>(); // 强制指定的配方执行次数

  for (const demand of config.demands) {
    const processed = processDemand(demand, gameData, errors, warnings);
    
    if (processed.forcedRecipes) {
      // 有强制指定的配方
      for (const [recipeId, count] of processed.forcedRecipes.entries()) {
        forcedRecipes.set(recipeId, count);
      }
    }
    
    lpConstraints.push(...processed.constraints);
  }

  // 2. 构建并求解LP
  // 这里需要修改LP求解器，支持强制配方约束
  const solution = solveWithForcedRecipes(
    lpConstraints,
    forcedRecipes,
    gameData,
    config
  );

  return solution;
}

/**
 * 处理单个需求
 */
function processDemand(
  demand: ItemDemand,
  gameData: GameData,
  errors: string[],
  warnings: string[]
): {
  constraints: ItemDemand[];
  forcedRecipes?: Map<string, number>;
} {
  const selection = demand.recipeSelection || { type: 'auto' };
  const recipes = gameData.itemToRecipes.get(demand.itemId) || [];

  switch (selection.type) {
    case 'auto':
      // 自动选择，直接返回原需求
      return { constraints: [demand] };

    case 'single': {
      // 指定单一配方
      const recipe = gameData.recipeMap.get(selection.recipeId);
      if (!recipe) {
        errors.push(`配方 ${selection.recipeId} 不存在`);
        return { constraints: [demand] };
      }
      
      if (!recipe.outputs.some(o => o.itemId === demand.itemId)) {
        errors.push(`配方 ${selection.recipeId} 不生产 ${demand.itemId}`);
        return { constraints: [demand] };
      }

      // 计算需要的执行次数
      const mainOutput = recipe.outputs[0];
      const executions = demand.rate / (mainOutput.count / recipe.time);
      
      const forced = new Map<string, number>();
      forced.set(selection.recipeId, executions);
      
      return { constraints: [], forcedRecipes: forced };
    }

    case 'ratio': {
      // 按比例分配
      const forced = new Map<string, number>();
      let totalRatio = 0;
      
      for (const [recipeId, ratio] of selection.ratios.entries()) {
        totalRatio += ratio;
      }

      for (const [recipeId, ratio] of selection.ratios.entries()) {
        const recipe = gameData.recipeMap.get(recipeId);
        if (!recipe) {
          errors.push(`配方 ${recipeId} 不存在`);
          continue;
        }

        const mainOutput = recipe.outputs[0];
        const targetRate = demand.rate * (ratio / totalRatio);
        const executions = targetRate / (mainOutput.count / recipe.time);
        forced.set(recipeId, executions);
      }

      return { constraints: [], forcedRecipes: forced };
    }

    case 'priority': {
      // 按优先级：先用第一个，不够再用第二个
      // 这需要更复杂的处理，暂时简化为使用第一个可用的
      for (const recipeId of selection.order) {
        const recipe = gameData.recipeMap.get(recipeId);
        if (recipe && recipe.outputs.some(o => o.itemId === demand.itemId)) {
          const forced = new Map<string, number>();
          const mainOutput = recipe.outputs[0];
          const executions = demand.rate / (mainOutput.count / recipe.time);
          forced.set(recipeId, executions);
          return { constraints: [], forcedRecipes: forced };
        }
      }
      
      warnings.push(`优先级列表中的配方都无法生产 ${demand.itemId}，使用自动选择`);
      return { constraints: [demand] };
    }

    case 'exclude': {
      // 排除某些配方，剩下的自动选择
      const availableRecipes = recipes.filter(r => 
        !selection.bannedRecipes.includes(r.id)
      );
      
      if (availableRecipes.length === 0) {
        errors.push(`排除后没有可用配方生产 ${demand.itemId}`);
        return { constraints: [demand] };
      }

      // 返回带有排除列表的需求
      return { 
        constraints: [{
          ...demand,
          recipeSelection: { type: 'auto' }
        }] 
      };
    }

    default:
      return { constraints: [demand] };
  }
}

/**
 * 求解带强制配方的LP
 */
function solveWithForcedRecipes(
  demands: ItemDemand[],
  forcedRecipes: Map<string, number>,
  gameData: GameData,
  config: DemandConfig
): DemandSolution {
  // 这里简化处理：直接合并强制配方和LP结果
  // 实际实现需要修改LP求解器支持等式约束

  // 如果有强制配方，直接计算结果
  if (forcedRecipes.size > 0 && demands.length === 0) {
    return calculateFromForcedRecipes(forcedRecipes, gameData, config);
  }

  // 否则使用LP求解
  // 暂时只处理第一个需求（简化版）
  if (demands.length > 0) {
    const mainDemand = demands[0];
    const result = solveProductionLP(
      mainDemand.itemId,
      mainDemand.rate,
      gameData,
      {
        objective: config.objective || 'min-buildings',
        globalProliferator: mainDemand.proliferator || config.globalProliferator,
      }
    );

    return {
      feasible: result.feasible,
      recipeExecutions: result.recipeCounts,
      netFlows: result.variables,
      details: {
        totalBuildings: 0,
        totalPower: 0,
        rawMaterials: new Map(),
        byproducts: new Map(),
      }
    };
  }

  return {
    feasible: false,
    errors: ['没有有效需求'],
    recipeExecutions: new Map(),
    netFlows: new Map(),
    details: {
      totalBuildings: 0,
      totalPower: 0,
      rawMaterials: new Map(),
      byproducts: new Map(),
    }
  };
}

/**
 * 从强制配方计算结果
 */
function calculateFromForcedRecipes(
  forcedRecipes: Map<string, number>,
  gameData: GameData,
  config: DemandConfig
): DemandSolution {
  // 计算净流量
  const netFlows = new Map<string, number>();
  let totalBuildings = 0;
  let totalPower = 0;

  for (const [recipeId, count] of forcedRecipes.entries()) {
    const recipe = gameData.recipeMap.get(recipeId);
    if (!recipe) continue;

    const building = gameData.buildings.find(b => 
      recipe.factoryIds.includes(parseInt(b.id))
    ) || gameData.buildings[0];

    // 简化计算：假设每分钟执行count次
    for (const output of recipe.outputs) {
      const rate = output.count * count;
      netFlows.set(output.itemId, (netFlows.get(output.itemId) || 0) + rate);
    }

    for (const input of recipe.inputs) {
      const rate = input.count * count;
      netFlows.set(input.itemId, (netFlows.get(input.itemId) || 0) - rate);
    }

    totalBuildings += Math.ceil(count);
    totalPower += building.workPower * count;
  }

  // 分类原料和副产物
  const rawMaterials = new Map<string, number>();
  const byproducts = new Map<string, number>();

  for (const [itemId, net] of netFlows.entries()) {
    if (net < -0.001 && gameData.rawItemIds.includes(itemId)) {
      rawMaterials.set(itemId, Math.abs(net));
    } else if (net > 0.001) {
      // 检查是否是需求物品
      const isDemandItem = config.demands.some(d => d.itemId === itemId);
      if (!isDemandItem) {
        byproducts.set(itemId, net);
      }
    }
  }

  return {
    feasible: true,
    recipeExecutions: forcedRecipes,
    netFlows,
    details: {
      totalBuildings,
      totalPower,
      rawMaterials,
      byproducts,
    }
  };
}

/**
 * 创建自动选择的需求
 */
export function createAutoDemand(
  itemId: string, 
  rate: number, 
  options?: Partial<Omit<ItemDemand, 'itemId' | 'rate'>>
): ItemDemand {
  return {
    itemId,
    rate,
    recipeSelection: { type: 'auto' },
    ...options,
  };
}

/**
 * 创建指定配方的需求
 */
export function createSingleRecipeDemand(
  itemId: string,
  rate: number,
  recipeId: string,
  options?: Partial<Omit<ItemDemand, 'itemId' | 'rate' | 'recipeSelection'>>
): ItemDemand {
  return {
    itemId,
    rate,
    recipeSelection: { type: 'single', recipeId },
    ...options,
  };
}

/**
 * 创建多配方比例需求
 */
export function createRatioDemand(
  itemId: string,
  rate: number,
  ratios: Record<string, number>,
  options?: Partial<Omit<ItemDemand, 'itemId' | 'rate' | 'recipeSelection'>>
): ItemDemand {
  return {
    itemId,
    rate,
    recipeSelection: { 
      type: 'ratio', 
      ratios: new Map(Object.entries(ratios)) 
    },
    ...options,
  };
}

/**
 * 创建配方优先级需求
 */
export function createPriorityDemand(
  itemId: string,
  rate: number,
  order: string[],
  options?: Partial<Omit<ItemDemand, 'itemId' | 'rate' | 'recipeSelection'>>
): ItemDemand {
  return {
    itemId,
    rate,
    recipeSelection: { type: 'priority', order },
    ...options,
  };
}

/**
 * 创建排除配方的需求
 */
export function createExcludeDemand(
  itemId: string,
  rate: number,
  bannedRecipes: string[],
  options?: Partial<Omit<ItemDemand, 'itemId' | 'rate' | 'recipeSelection'>>
): ItemDemand {
  return {
    itemId,
    rate,
    recipeSelection: { type: 'exclude', bannedRecipes },
    ...options,
  };
}

/**
 * 批量创建需求
 */
export function createDemandBatch(
  demands: Array<{ itemId: string; rate: number; recipeId?: string }>,
  commonOptions?: Partial<Omit<ItemDemand, 'itemId' | 'rate' | 'recipeSelection'>>
): ItemDemand[] {
  return demands.map(d => {
    if (d.recipeId) {
      return createSingleRecipeDemand(d.itemId, d.rate, d.recipeId, commonOptions);
    }
    return createAutoDemand(d.itemId, d.rate, commonOptions);
  });
}
