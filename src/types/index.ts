/**
 * 戴森球计划模组量化计算器 - 类型定义
 * 
 * 数据格式兼容 github.com/DSPCalculator/dsp-calc
 */

/** 增产剂效果类型 */
export type ProliferatorMode = 'none' | 'speed' | 'productivity';

/** 增产剂等级 */
export type ProliferatorLevel = 0 | 1 | 2 | 3;

/** 增产剂配置 */
export interface ProliferatorConfig {
  /** 等级 0-3 */
  level: ProliferatorLevel;
  /** 模式：无/加速/增产 */
  mode: ProliferatorMode;
  /** 喷涂次数 */
  sprayCount: number;
}

/** 原始物品数据（来自dsp-calc格式或自定义格式） */
export interface RawItem {
  ID?: number;
  Type?: number;
  Name?: string;
  GridIndex?: number;
  IconName?: string;
  id?: number;
  type?: number;
  name?: string;
  iconName?: string;
  isRaw?: boolean;
}

/** 原始配方数据（来自dsp-calc格式或自定义格式） */
export interface RawRecipe {
  // dsp-calc 格式（大写）
  ID?: number;
  Type?: number;
  Factories?: number[];
  Name?: string;
  Items?: number[];
  ItemCounts?: number[];
  Results?: number[];
  ResultCounts?: number[];
  TimeSpend?: number;
  Proliferator?: number;
  // 自定义格式（小写）
  id?: number;
  type?: number;
  factoryIds?: number[];
  name?: string;
  items?: number[];
  itemCounts?: number[];
  results?: number[];
  resultCounts?: number[];
  time?: number;
  proliferatorLevel?: number;
  iconName?: string;
  IconName?: string;
  inputs?: { itemId: string; count: number }[];
  outputs?: { itemId: string; count: number }[];
  isMultiProduct?: boolean;
}

/** 原始游戏数据（来自dsp-calc格式） */
export interface RawGameData {
  items: RawItem[];
  recipes: RawRecipe[];
  // 可选的自定义建筑数组
  buildings?: any[];
  // 可选的原矿ID列表
  rawItemIds?: string[];
  // 可选的默认原矿ID列表（始终视为原矿输入）
  defaultRawItemIds?: string[];
}

/** 物品 */
export interface Item {
  /** 唯一标识符 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 显示名称（中文） */
  nameCN?: string;
  /** 原始ID */
  originalId: number;
  /** 物品类型 */
  type: number;
  /** 图标名称 */
  iconName: string;
  /** 是否为原矿（可直接采集） */
  isRaw?: boolean;
}

/** 配方输入/输出项 */
export interface RecipeItem {
  /** 物品ID */
  itemId: string;
  /** 数量 */
  count: number;
}

/** 配方 */
export interface Recipe {
  /** 唯一标识符 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 原始ID */
  originalId: number;
  /** 输入物品 */
  inputs: RecipeItem[];
  /** 输出物品（多产物配方会有多个） */
  outputs: RecipeItem[];
  /** 制作时间（秒，已除以60转换为每分钟的基准） */
  time: number;
  /** 可用建筑类型ID列表 */
  factoryIds: number[];
  /** 是否为多产物配方 */
  isMultiProduct: boolean;
  /** 增产剂等级 0-3 */
  proliferatorLevel: number;
  /** 图标名称 */
  iconName: string;
  /** 配方类型 */
  type: number;
}

/** 建筑 */
export interface Building {
  /** 唯一标识符 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 原始ID */
  originalId: number;
  /** 建筑类型 */
  category: BuildingCategory;
  /** 基础制作速度（倍数） */
  speed: number;
  /** 工作功耗（MW） */
  workPower: number;
  /** 待机功耗（MW） */
  idlePower: number;
  /** 是否有增产槽位 */
  hasProliferatorSlot: boolean;
  /** 是否支持翻倍效果（模组特性） */
  supportsDoubling?: boolean;
  /** 翻倍效果参数 */
  doublingConfig?: {
    /** 翻倍倍率 */
    multiplier: number;
    /** 适用产物类型 */
    applicableItems?: string[];
  };
  /** 建筑内置产出加成（例如某些模组建筑自带增产效果） */
  intrinsicProductivity?: number;
}

/** 建筑类型 */
export type BuildingCategory = 
  | 'smelter'      // 熔炉
  | 'assembler'    // 制造台
  | 'refinery'     // 精炼厂
  | 'chemical'     // 化工厂
  | 'particle'     // 对撞机
  | 'lab'          // 研究站
  | 'collector'    // 射线接收站
  | 'pump'         // 水泵
  | 'extractor'    // 原油萃取站
  | 'fractionator' // 分馏塔
  | 'mining'       // 采矿机
  | 'orbital'      // 轨道采集器
  | 'ejector'      // 电磁弹射器
  | 'other';       // 其他

/** 产物优先级配置（用于多产物配方配平） */
export interface ProductPriority {
  /** 物品ID */
  itemId: string;
  /** 优先级（越高越优先消耗/产出） */
  priority: number;
  /** 是否允许作为副产物（多余） */
  allowByproduct: boolean;
  /** 是否允许作为缺口（需要外部输入） */
  allowDeficit: boolean;
}

/** 计算需求 */
export interface Demand {
  /** 物品ID */
  itemId: string;
  /** 每分钟需求数量 */
  rate: number;
  /** 是否允许从外部输入（作为原矿） */
  allowExternal?: boolean;
}

/** 计算结果项 */
export interface CalculationResultItem {
  /** 物品ID */
  itemId: string;
  /** 物品名称 */
  itemName: string;
  /** 净产出/消耗（每分钟，正数为产出，负数为消耗） */
  netRate: number;
  /** 所需建筑数量（可能为小数） */
  buildingCount: number;
  /** 向上取整后的建筑数量 */
  buildingCountCeil: number;
  /** 使用的配方ID */
  recipeId: string;
  /** 使用的建筑ID */
  buildingId: string;
  /** 使用的增产配置 */
  proliferator?: ProliferatorConfig;
  /** 是否使用翻倍效果 */
  useDoubling?: boolean;
  /** 额外产物（用于增产模式） */
  extraProducts?: number;
}

/** 多产物配平方案 */
export interface BalancingScheme {
  /** 方案ID */
  id: string;
  /** 方案名称 */
  name: string;
  /** 主要产物（单一产物目标） */
  mainProduct: string;
  /** 副产物处理方案 */
  byproducts: {
    itemId: string;
    /** 处理方式：consume-内部消耗, export-导出, burn-焚烧 */
    handling: 'consume' | 'export' | 'burn';
    /** 数量（每分钟） */
    rate: number;
  }[];
  /** 配平使用的配方及数量 */
  recipes: {
    recipeId: string;
    count: number;
  }[];
  /** 是否完全配平（无多余产物） */
  isBalanced: boolean;
}

/** 计算配置 */
export interface CalculationConfig {
  /** 目标需求列表 */
  demands: Demand[];
  /** 建筑偏好设置 */
  buildingPreferences?: {
    /** 优先使用的熔炉ID */
    preferredSmelter?: number;
    /** 优先使用的制造台ID */
    preferredAssembler?: number;
    /** 优先使用的化工厂ID */
    preferredChemicalPlant?: number;
  };
  /** 增产剂默认配置 */
  defaultProliferator?: ProliferatorConfig;
  /** 多产物配方配平策略 */
  balancingStrategy?: 'min-waste' | 'min-buildings' | 'min-power' | 'custom';
  /** 自定义产物优先级（用于custom策略） */
  productPriorities?: ProductPriority[];
  /** 允许使用的配方ID列表 */
  allowedRecipes?: string[];
  /** 禁止使用的配方ID列表 */
  bannedRecipes?: string[];
  /** 是否允许使用稀有资源配方 */
  allowRareRecipes?: boolean;
  /** 翻倍效果启用设置 */
  doublingSettings?: {
    /** 全局启用 */
    enabled: boolean;
    /** 对特定建筑启用 */
    buildings?: string[];
    /** 对特定产物启用 */
    items?: string[];
  };
}

/** 完整计算结果 */
export interface CalculationResult {
  /** 各项结果 */
  items: CalculationResultItem[];
  /** 总建筑数量统计 */
  totalBuildings: Record<string, number>;
  /** 总功耗（MW） */
  totalPower: number;
  /** 使用的多产物配平方案 */
  balancingSchemes: BalancingScheme[];
  /** 原矿需求（需要从外部输入的物品） */
  rawRequirements: Record<string, number>;
  /** 副产物（多余的物品） */
  byproducts: Record<string, number>;
  /** 计算耗时（毫秒） */
  calculationTime: number;
}

/** 游戏数据集 */
export interface GameData {
  version: string;
  items: Item[];
  recipes: Recipe[];
  buildings: Building[];
  /** 增产剂数据 */
  proliferators: {
    level: ProliferatorLevel;
    name: string;
    speedBonus: number;      // 加速模式速度加成
    productivityBonus: number; // 增产模式产出加成
    sprayCount: number;      // 可喷涂次数
  }[];
  /** 原矿ID列表 */
  rawItemIds: string[];
  /** 默认原矿ID列表 */
  defaultRawItemIds: string[];
  /** 物品ID到物品的映射 */
  itemMap: Map<string, Item>;
  /** 配方ID到配方的映射 */
  recipeMap: Map<string, Recipe>;
  /** 物品ID到生产配方的映射 */
  itemToRecipes: Map<string, Recipe[]>;
}

/** 线性规划变量 */
export interface LPVariable {
  name: string;
  coefficient: number;
  min?: number;
  max?: number;
  integer?: boolean;
}

/** 线性规划约束 */
export interface LPConstraint {
  name: string;
  coefficients: Record<string, number>;
  operator: '<=' | '>=' | '=';
  rhs: number;
}

/** 线性规划模型 */
export interface LPModel {
  /** 目标函数（最小化） */
  objective: LPVariable[];
  /** 约束条件 */
  constraints: LPConstraint[];
  /** 变量定义 */
  variables: Record<string, { min?: number; max?: number; integer?: boolean }>;
}

/** 增产参数计算结果 */
export interface ProliferatorEffect {
  /** 速度倍率 */
  speedMultiplier: number;
  /** 产出倍率 */
  productivityMultiplier: number;
  /** 功耗倍率 */
  powerMultiplier: number;
  /** 额外产出数量 */
  extraProducts: number;
}
