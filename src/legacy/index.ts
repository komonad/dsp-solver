/**
 * DSP Mod Calculator - 戴森球计划模组量化计算器
 * 
 * 主要特性：
 * - 多产物配方配平：找到能够作为单一产物生成的生成方案
 * - 参数化增产效果：支持自定义增产参数
 * - 建筑翻倍效果：支持模组中的建筑翻倍特性
 */

// 类型导出
export * from './types';

// 核心功能导出
export { loadGameData, loadGameDataFromFile } from './data/loader';
export { calculate, quickCalculate, calculateUpstream } from './core/calculator';
export { 
  calculateProliferatorEffect, 
  calculateBuildingCount,
  setCustomProliferatorParams,
  resetProliferatorParams,
  getProliferatorParams,
  getRecommendedProliferatorConfig
} from './core/proliferator';
export {
  setBuildingDoublingConfig,
  getBuildingDoublingConfig,
  enableDoublingForBuilding,
  enableDoublingForRecipes,
  batchSetDoublingConfigs,
  clearAllDoublingConfigs,
  getDoublingMultiplier
} from './core/doubling';
export {
  findMultiProductRecipes,
  findSingleProductScheme,
  optimizeBalancing,
  calculateSchemeOutput,
  getMultiProductWarnings,
  analyzeScheme
} from './core/multiProduct';
export {
  solveProductionLP,
  validateSolution,
  calculateSchemeDetails,
} from './core/lpSolver';
export {
  calculateProductionParams,
  buildRecipeCoefficients,
  calculateProductionRequirements,
  calculateNetFlow,
  formatProductionReport,
  setProliferatorParams,
  DEFAULT_PROLIFERATOR_PARAMS,
} from './core/productionModel';
export type {
  ProliferatorParams,
  ProductionContext,
  ProductionParams,
} from './core/productionModel';
export {
  solveDemand,
  createAutoDemand,
  createSingleRecipeDemand,
  createRatioDemand,
  createPriorityDemand,
  createExcludeDemand,
  createDemandBatch,
} from './core/demandEngine';
export type {
  RecipeSelection,
  ItemDemand,
  DemandGroup,
  DemandConfig,
  DemandSolution,
} from './core/demandEngine';
export {
  solveMultiDemand,
} from './core/multiDemandSolver';
export type {
  MultiDemandOptions,
  MultiDemandResult,
} from './core/multiDemandSolver';

// 版本号
export const VERSION = '1.0.0';

export { solveFromRequest, solveRequestToOptions } from './core/solveRequest';
export type { SolveRequest, SerializedProliferatorSetting } from './core/solveRequest';
