import { GameData, Recipe } from '../types';
import { calculateItemBalance } from './productionModel';
import { solve, greaterEq } from 'yalps';

export interface MultiDemandOptions {
  objective?: 'min-buildings' | 'min-power' | 'min-waste';
  globalProliferator?: { level: 0 | 1 | 2 | 3; mode: 'none' | 'speed' | 'productivity'; sprayCount?: number };
  /** 
   * 额外指定为原矿的物品ID列表
   * 这些物品会被视为外部输入，不会继续向上游收集配方
   */
  treatAsRaw?: string[];
  /**
   * 现有供给（每分钟）
   * 这些物品会以固定速率供给，从需求中扣除
   * 例如：现有产线每分钟产出100个B，可以填入 { itemId: 'B', rate: 100 }
   */
  existingSupplies?: Array<{ itemId: string; rate: number }>;
  /**
   * 强制指定使用的配方
   * itemId -> recipeId，表示该物品强制使用指定的配方生产
   */
  selectedRecipes?: Map<string, string>;
  /**
   * 无副产物模式
   * 如果为 true，所有中间产物必须完全平衡（产出 = 消耗），不允许有结余
   */
  noByproducts?: boolean;
  /**
   * 配方特定的增产剂配置
   * recipeId -> { level, mode }
   */
  recipeProliferators?: Map<string, { level: 0 | 1 | 2 | 3; mode: 'none' | 'speed' | 'productivity' }>;
  /**
   * 配方特定的建筑选择
   * recipeId -> buildingId，表示该配方使用指定的建筑生产
   * 如果不指定，使用配方 factoryIds 中的第一个建筑
   */
  recipeBuildings?: Map<string, string>;
}

export interface MultiDemandResult {
  feasible: boolean;
  message?: string;
  recipes: Map<string, number>;      // recipeId -> solver variable units
  recipeRatesPerMinute?: Map<string, number>; // recipeId -> actual executions per minute
  satisfiedDemands: Map<string, number>; // itemId -> actual rate
  intermediateBalance: Map<string, number>; // itemId -> surplus/deficit
  rawMaterials: Map<string, number>; // itemId -> consumption rate
  /**
   * 现有供给的贡献（每分钟）
   * 正数表示该物品由现有供给提供，负数表示现有供给消耗了该物品
   */
  existingSupplyContribution?: Map<string, number>;
}

/**
 * 求解多需求生产配平问题
 * 使用 yalps 线性求解器
 */
export function solveMultiDemand(
  demands: Array<{ itemId: string; rate: number }>,
  gameData: GameData,
  options: MultiDemandOptions = {}
): MultiDemandResult {
  // 合并用户指定的原矿与游戏数据中的原矿
  const rawItemSet = new Set<string>([
    ...gameData.rawItemIds,
    ...(gameData.defaultRawItemIds || []),
    ...(options.treatAsRaw || [])
  ]);

  // 处理现有供给：计算净供给并调整需求
  const supplyMap = new Map<string, number>(); // itemId -> net supply rate
  const existingSupplies = options.existingSupplies || [];
  
  for (const supply of existingSupplies) {
    const current = supplyMap.get(supply.itemId) || 0;
    supplyMap.set(supply.itemId, current + supply.rate);
  }

  // 调整需求：扣除现有供给
  const adjustedDemands: Array<{ itemId: string; rate: number }> = [];
  const supplyContributions = new Map<string, number>(); // 记录供给的贡献
  
  for (const demand of demands) {
    // 如果需求物品被标记为原矿，不进入求解，直接由供给或外部输入满足
    if (rawItemSet.has(demand.itemId)) {
      const supply = supplyMap.get(demand.itemId) || 0;
      supplyContributions.set(demand.itemId, Math.min(supply, demand.rate));
      // 剩余部分由外部原矿提供
      continue;
    }
    
    const supply = supplyMap.get(demand.itemId) || 0;
    const remaining = Math.max(0, demand.rate - supply);
    
    if (remaining > 0.001) {
      adjustedDemands.push({ itemId: demand.itemId, rate: remaining });
    }
    
    // 记录供给的贡献
    supplyContributions.set(demand.itemId, Math.min(supply, demand.rate));
    
    // 如果供给有剩余，标记为结余
    if (supply > demand.rate) {
      supplyContributions.set(`__surplus_${demand.itemId}`, supply - demand.rate);
    }
    
    // 从supplyMap中扣除已使用的部分
    if (supply > 0) {
      supplyMap.set(demand.itemId, Math.max(0, supply - demand.rate));
    }
  }
  
  // 记录非需求物品的供给贡献（如供给C来生产E）
  for (const [itemId, remainingSupply] of supplyMap) {
    if (remainingSupply > 0.001 && !supplyContributions.has(itemId)) {
      supplyContributions.set(itemId, remainingSupply);
    }
  }

  // 1. 收集所有相关配方（从剩余需求向上游收集）
  const demandItemIds = adjustedDemands.map(d => d.itemId);
  const selectedRecipes = options.selectedRecipes || new Map<string, string>();
  
  const recipes = collectUpstreamRecipes(
    demandItemIds,
    gameData,
    rawItemSet,
    selectedRecipes
  );
  


  // 如果没有剩余需求（所有需求都被供给或标记为原矿）
  if (adjustedDemands.length === 0) {
    const finalSatisfiedDemands = new Map<string, number>();
    const rawMaterials = new Map<string, number>();
    
    for (const demand of demands) {
      const supply = supplyContributions.get(demand.itemId) || 0;
      
      // 如果被标记为原矿，全部从外部输入，标记为满足
      if (rawItemSet.has(demand.itemId)) {
        finalSatisfiedDemands.set(demand.itemId, demand.rate);
        rawMaterials.set(demand.itemId, demand.rate);
      } else {
        // 否则由供给满足
        finalSatisfiedDemands.set(demand.itemId, Math.min(supply, demand.rate));
      }
    }
    
    return {
      feasible: true,
      recipes: new Map(),
      satisfiedDemands: finalSatisfiedDemands,
      intermediateBalance: new Map(),
      rawMaterials,
      existingSupplyContribution: supplyContributions
    };
  }
  
  // 检查是否所有剩余需求都被标记为原矿
  const allDemandsAreRaw = demandItemIds.every(id => rawItemSet.has(id));
  
  if (recipes.length === 0 && !allDemandsAreRaw) {
    return {
      feasible: false,
      message: '未找到相关配方',
      recipes: new Map(),
      satisfiedDemands: new Map(),
      intermediateBalance: new Map(),
      rawMaterials: new Map(),
      existingSupplyContribution: supplyContributions
    };
  }

  // 2. 收集所有涉及物品
  const allItems = new Set<string>();
  for (const recipe of recipes) {
    for (const input of recipe.inputs) allItems.add(input.itemId);
    for (const output of recipe.outputs) allItems.add(output.itemId);
  }

  // 3. 构建 yalps 模型
  const items = Array.from(allItems);
  const adjustedDemandMap = new Map(adjustedDemands.map(d => [d.itemId, d.rate]));
  

  
  // 构建变量（配方）
  const variables: Record<string, Record<string, number>> = {};
  const objective = options.objective || 'min-buildings';
  for (const recipe of recipes) {
    const varName = `r${recipe.id}`;
    const coeffs: Record<string, number> = {};
    
    // 获取该配方使用的建筑
    const buildingId = options.recipeBuildings?.get(recipe.id);
    const buildingIdStr = buildingId ? String(buildingId) : undefined;
    
    const building = buildingIdStr
      ? gameData.buildings.find(b => b.id === buildingIdStr)
      : gameData.buildings.find(b => recipe.factoryIds.includes(b.originalId));
    
    for (const itemId of items) {
      // 使用配方特定的增产剂配置，如果没有则使用全局配置
      const specificProlif = options.recipeProliferators?.get(recipe.id);
      const prolif = specificProlif ?? options.globalProliferator;
      // 传入建筑以考虑内置产出加成
      const balance = calculateItemBalance(recipe, itemId, prolif, building);
      if (Math.abs(balance) > 1e-12) {
        coeffs[itemId] = balance;
      }
    }
    
    let objectiveCost = 1;

    if (objective === 'min-power') {
      objectiveCost = building?.workPower || 1;
    } else if (objective === 'min-waste') {
      let rawInputCost = 0;
      for (const input of recipe.inputs) {
        if (rawItemSet.has(input.itemId)) {
          rawInputCost += input.count * (60 / recipe.time);
        }
      }
      objectiveCost = rawInputCost > 0 ? rawInputCost : 0.001;
    }

    coeffs._obj = objectiveCost;
    
    variables[varName] = coeffs;

  }

  // 构建约束（使用调整后的需求）
  const constraints: Record<string, { min?: number; max?: number }> = {};
  const noByproducts = options.noByproducts || false;
  
  for (const itemId of items) {
    const demand = adjustedDemandMap.get(itemId);
    if (demand !== undefined) {
      // 需求物品：必须满足剩余需求
      constraints[itemId] = { min: demand };
    } else if (!rawItemSet.has(itemId)) {
      // 非需求且非原矿的物品（中间产物）
      if (noByproducts) {
        // 无副产物模式：必须完全平衡（产出 = 消耗）
        constraints[itemId] = { min: 0, max: 0 };
      } else {
        // 正常模式：不能从外部输入，允许结余
        constraints[itemId] = { min: 0 };
      }
    }
    // 原矿不做约束（允许从外部输入）
  }

  // 4. 求解
  const model = {
    direction: 'minimize' as const,
    objective: '_obj',
    constraints,
    variables,
  };
  
  const solution = solve(model);

  // 5. 解析结果
  const recipeCounts = new Map<string, number>();
  const recipeRatesPerMinute = new Map<string, number>();
  const satisfiedDemands = new Map<string, number>();
  const intermediateBalance = new Map<string, number>();
  const rawMaterials = new Map<string, number>();

  if (solution.status !== 'optimal') {
    return {
      feasible: false,
      message: `求解失败: ${solution.status}`,
      recipes: recipeCounts,
      recipeRatesPerMinute,
      satisfiedDemands,
      intermediateBalance,
      rawMaterials
    };
  }

  // 提取配方执行次数 (solution.variables 是 [string, number][] 数组)
  const varMap = new Map<string, number>(solution.variables);
  for (const [varName, value] of varMap) {
    if (varName.startsWith('r') && value > 0.001) {
      const recipeId = varName.slice(1);
      recipeCounts.set(recipeId, value);
      const recipe = gameData.recipeMap.get(recipeId);
      if (recipe) {
        recipeRatesPerMinute.set(recipeId, value * (60 / recipe.time));
      }
    }
  }

  // 初始化可行性验证变量
  let feasible = true;
  let message = '';

  // 计算各物品平衡
  for (const itemId of items) {
    let balance = 0;
    const varMap = new Map<string, number>(solution.variables);
    for (const recipe of recipes) {
      const varName = `r${recipe.id}`;
      const count = varMap.get(varName) || 0;
      if (count > 0.001) {
        // 使用配方特定的增产剂配置，如果没有则使用全局配置
        const specificProlif = options.recipeProliferators?.get(recipe.id);
        const prolif = specificProlif ?? options.globalProliferator;
        // 获取该配方使用的建筑
        const buildingId = options.recipeBuildings?.get(recipe.id);
        const buildingIdStr = buildingId ? String(buildingId) : undefined;
        const building = buildingIdStr
          ? gameData.buildings.find(b => b.id === buildingIdStr)
          : gameData.buildings.find(b => recipe.factoryIds.includes(b.originalId));
        const coeff = calculateItemBalance(recipe, itemId, prolif, building);
        balance += coeff * count;
      }
    }

    const demand = adjustedDemandMap.get(itemId);
    const isRaw = rawItemSet.has(itemId);
    
    if (demand !== undefined) {
      // 需求物品
      satisfiedDemands.set(itemId, balance);
    } else if (isRaw) {
      // 被标记为原矿的物品：无论结余还是消耗，都放入 rawMaterials
      if (balance < -0.001) {
        // 净消耗
        rawMaterials.set(itemId, -balance);
      } else if (balance > 0.001) {
        // 净产出（结余）- 对于原矿，结余表示有外部输入后的剩余
        // 标记为负消耗（表示有资源可用）
        rawMaterials.set(itemId, 0); // 显示为0或可以单独标记为结余
      }
      // balance ≈ 0 则忽略
    } else if (balance < -0.001) {
      // 中间产物出现净消耗 - 这不应该发生，因为约束要求 >= 0
      // 标记为不可行
      feasible = false;
      message += `${itemId}生产不足: ${balance.toFixed(2)}/min; `;
      // 仍然记录消耗以便调试
      rawMaterials.set(itemId, -balance);
    } else if (balance > 0.001) {
      // 中间产物结余
      intermediateBalance.set(itemId, balance);
    }
  }

  // 6. 合并现有供给的贡献到最终结果
  const finalSatisfiedDemands = new Map<string, number>();
  
  // 对于原始需求，计算总满足量（供给 + 求解结果）
  for (const demand of demands) {
    const supplyContribution = supplyContributions.get(demand.itemId) || 0;
    const solvedContribution = satisfiedDemands.get(demand.itemId) || 0;
    finalSatisfiedDemands.set(demand.itemId, supplyContribution + solvedContribution);
  }
  
  // 合并供给产生的中间产物结余
  for (const [key, value] of supplyContributions) {
    if (key.startsWith('__surplus_')) {
      const itemId = key.slice(10);
      const current = intermediateBalance.get(itemId) || 0;
      intermediateBalance.set(itemId, current + value);
    }
  }

  // 7. 验证可行性（使用原始需求）
  const originalDemandMap = new Map(demands.map(d => [d.itemId, d.rate]));
  
  for (const [itemId, demandRate] of originalDemandMap) {
    const actual = finalSatisfiedDemands.get(itemId) || 0;
    if (actual < demandRate - 0.01) {
      feasible = false;
      message += `${itemId}需求未满足: ${actual.toFixed(2)} < ${demandRate}; `;
    }
  }
  
  // 8. 断言验证：检查物料平衡的守恒性
  if (feasible) {
    // 重新计算所有配方的总产出/消耗，验证平衡
    const totalProduction = new Map<string, number>();
    const totalConsumption = new Map<string, number>();
    
    for (const [recipeId, count] of recipeCounts) {
      const recipe = gameData.recipeMap.get(recipeId);
      if (!recipe) continue;
      
      const specificProlif = options.recipeProliferators?.get(recipeId);
      const prolif = specificProlif ?? options.globalProliferator;
      
      // 获取该配方使用的建筑（考虑内置产出加成）
      const buildingId = options.recipeBuildings?.get(recipeId);
      const buildingIdStr = buildingId ? String(buildingId) : undefined;
      const building = buildingIdStr
        ? gameData.buildings.find(b => b.id === buildingIdStr)
        : gameData.buildings.find(b => recipe.factoryIds.includes(b.originalId));
      const intrinsicBonus = building?.intrinsicProductivity || 0;
      
      for (const output of recipe.outputs) {
        let rate = output.count * count * (60 / recipe.time);
        if (prolif?.mode === 'productivity') {
          const prodBonus = [0, 0.125, 0.2, 0.25][prolif.level || 0];
          rate *= (1 + prodBonus);
        }
        if (intrinsicBonus > 0) {
          rate *= (1 + intrinsicBonus);
        }
        totalProduction.set(output.itemId, (totalProduction.get(output.itemId) || 0) + rate);
      }
      
      for (const input of recipe.inputs) {
        const rate = input.count * count * (60 / recipe.time);
        totalConsumption.set(input.itemId, (totalConsumption.get(input.itemId) || 0) + rate);
      }
    }
    
    // 验证每个需求的净产出 >= 需求
    for (const [itemId, demandRate] of originalDemandMap) {
      const production = totalProduction.get(itemId) || 0;
      const consumption = totalConsumption.get(itemId) || 0;
      const netProduction = production - consumption;
      
      // 检查原矿消耗是否合理
      const rawConsumption = rawMaterials.get(itemId) || 0;
      const totalAvailable = netProduction + rawConsumption;
      
      if (Math.abs(totalAvailable - demandRate) > 0.1 && !rawItemSet.has(itemId)) {
        console.warn(`[Assertion Warning] ${itemId} 产出/消耗不匹配:`, {
          需求: demandRate,
          净产出: netProduction,
          原矿输入: rawConsumption,
          可用总量: totalAvailable,
          差额: totalAvailable - demandRate
        });
      }
    }
    
    // 验证中间产物的平衡（非原矿、非需求的物品）
    for (const [itemId, balance] of intermediateBalance) {
      if (originalDemandMap.has(itemId) || rawItemSet.has(itemId)) continue;
      
      const production = totalProduction.get(itemId) || 0;
      const consumption = totalConsumption.get(itemId) || 0;
      const calculatedBalance = production - consumption;
      
      if (Math.abs(balance - calculatedBalance) > 0.01) {
        console.warn(`[Assertion Warning] ${itemId} 中间产物结余计算不一致:`, {
          记录结余: balance,
          计算结余: calculatedBalance,
          产出: production,
          消耗: consumption
        });
      }
    }
  }

  // 8. 处理被标记为原矿的需求物品（它们没有进入求解，需要在这里标记为满足）
  for (const demand of demands) {
    if (rawItemSet.has(demand.itemId) && !finalSatisfiedDemands.has(demand.itemId)) {
      const supply = supplyContributions.get(demand.itemId) || 0;
      finalSatisfiedDemands.set(demand.itemId, Math.min(supply, demand.rate));
      // 剩余部分算外部原矿输入
      if (supply < demand.rate) {
        const needFromExternal = demand.rate - supply;
        rawMaterials.set(demand.itemId, (rawMaterials.get(demand.itemId) || 0) + needFromExternal);
      }
    }
  }

  return {
    feasible,
    message: message || undefined,
    recipes: recipeCounts,
    recipeRatesPerMinute,
    satisfiedDemands: finalSatisfiedDemands,
    intermediateBalance,
    rawMaterials,
    existingSupplyContribution: supplyContributions
  };
}

/**
 * 收集上游配方（BFS遍历）
 * @param stopAtItems 遇到这些物品停止向上游收集（视为原矿）
 * @param selectedRecipes 强制指定的配方选择
 */
export function collectUpstreamRecipes(
  targetItemIds: string[], 
  gameData: GameData,
  stopAtItems?: Set<string>,
  selectedRecipes?: Map<string, string>
): Recipe[] {
  const visited = new Set<string>();
  const queue = [...targetItemIds];
  const recipes: Recipe[] = [];

  while (queue.length > 0) {
    const itemId = queue.shift()!;
    if (visited.has(itemId)) continue;
    
    // 标记为已访问
    visited.add(itemId);
    
    // 如果是原矿，停止向上收集（不找生产它的配方）
    if (stopAtItems?.has(itemId)) {
      continue;
    }

    // 找产出该物品的配方
    let producingRecipes: Recipe[];
    
    // 检查是否有强制指定的配方
    const selectedRecipeId = selectedRecipes?.get(itemId);
    if (selectedRecipeId) {
      // 只使用指定的配方
      const selectedRecipe = gameData.recipeMap.get(selectedRecipeId);
      producingRecipes = selectedRecipe ? [selectedRecipe] : [];
    } else {
      // 使用所有能生产该物品的配方（排除无中生有配方）
      producingRecipes = gameData.recipes.filter(r => {
        if (!r.outputs.some(o => o.itemId === itemId)) return false;
        // 排除无中生有配方（无输入但有输出，且配方名称以"[无中生有]"开头）
        if (r.inputs.length === 0 && r.name.startsWith('[无中生有]')) return false;
        return true;
      });
    }

    for (const recipe of producingRecipes) {
      if (!recipes.find(r => r.id === recipe.id)) {
        recipes.push(recipe);
        // 将该配方的所有输入加入队列
        for (const input of recipe.inputs) {
          if (!visited.has(input.itemId)) {
            queue.push(input.itemId);
          }
        }
      }
    }
  }

  return recipes;
}
