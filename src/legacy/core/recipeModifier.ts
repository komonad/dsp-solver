/**
 * 配方修改器 (简化版 - 待重新实现)
 * 
 * TODO: 使用新的 solveMultiDemand 重新实现
 */

import type { 
  GameData, Recipe, CalculationResultItem, ProliferatorConfig,
  CalculationConfig, Building
} from '../types';

/**
 * 配方修改选项
 */
export interface RecipeModification {
  /** 要修改的配方ID */
  recipeId: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 新的增产配置 */
  proliferator?: ProliferatorConfig;
  /** 新的建筑ID */
  buildingId?: string;
  /** 强制指定的配方执行次数（每分钟） */
  forcedCount?: number;
}

/**
 * 重新计算请求
 */
export interface RecalculationRequest {
  /** 目标产物ID */
  targetItemId: string;
  /** 目标产出速率 */
  targetRate: number;
  /** 配方修改列表 */
  modifications: RecipeModification[];
  /** 全局增产配置（应用到所有未指定配方的） */
  globalProliferator?: ProliferatorConfig;
  /** 禁用所有多产物配方（只使用单产物配方） */
  disableMultiProduct?: boolean;
  /** 优化策略 */
  objective?: 'min-buildings' | 'min-waste' | 'min-power';
}

/**
 * 重新计算结果
 */
export interface RecalculationResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 原始方案 */
  originalScheme: {
    recipeCounts: Map<string, number>;
    totalBuildings: number;
    byproducts: Map<string, number>;
  };
  /** 修改后的方案 */
  modifiedScheme: {
    recipeCounts: Map<string, number>;
    totalBuildings: number;
    byproducts: Map<string, number>;
  };
  /** 各项结果 */
  items: CalculationResultItem[];
  /** 修改详情 */
  changes: {
    recipeId: string;
    type: 'disabled' | 'proliferator' | 'building' | 'count';
    oldValue: any;
    newValue: any;
    impact: string;
  }[];
}

/**
 * 根据修改重新求解配方配平
 * TODO: 使用新的 solveMultiDemand 重新实现
 */
export function recalculateWithModifications(
  request: RecalculationRequest,
  gameData: GameData
): RecalculationResult {
  return {
    success: false,
    error: '功能待重新实现',
    originalScheme: { recipeCounts: new Map(), totalBuildings: 0, byproducts: new Map() },
    modifiedScheme: { recipeCounts: new Map(), totalBuildings: 0, byproducts: new Map() },
    items: [],
    changes: [],
  };
}
