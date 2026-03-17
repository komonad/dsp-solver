/**
 * 测试配置 - 化工厂增产场景
 * 
 * 场景说明：
 * 化工厂类建筑包含三种：
 * - 化工厂：基础 1.0x 制造速度
 * - 低温化工厂：1.0x 速度 + 25% 额外产出 (intrinsicProductivity=0.25)
 * - 量子化工厂：1.0x 速度 + 100% 额外产出 (intrinsicProductivity=1.0)
 * 
 * 配方系统（分层循环依赖）：
 * r1: 气云 + 石墨烯 + 氢气 → 甲烷 + 富勒烯
 * r2: 甲烷 → 石墨烯 + 氢气
 * r3: 富勒烯 + 生物醇 + 精炼银 → 富勒银
 * r4: 富勒烯 + 富勒醇 + 富勒银 → 精炼银
 * 
 * 策略：r1,r2 使用化工厂（无加成）保持内部平衡
 *       r3,r4 使用量子/低温化工厂（有加成）打破循环
 */

import type { GameData, Item, Recipe, Building } from '../src/legacy/types';

// ============ 建筑定义 ============

/** 化工厂 - 基础，无额外产出 */
export const chemicalPlant: Building = {
  id: 'chemical-plant',
  name: '化工厂',
  originalId: 2309,
  category: 'chemical',
  speed: 1.0,
  workPower: 2.0,
  idlePower: 0.2,
  hasProliferatorSlot: true,
};

/** 低温化工厂 - +25% 额外产出 */
export const cryogenicChemicalPlant: Building = {
  id: 'cryogenic-chemical-plant',
  name: '低温化工厂',
  originalId: 2313,
  category: 'chemical',
  speed: 1.0,
  workPower: 0.9,
  idlePower: 0.03,
  hasProliferatorSlot: true,
  intrinsicProductivity: 0.25,
};

/** 量子化工厂 - +100% 额外产出 */
export const quantumChemicalPlant: Building = {
  id: 'quantum-chemical-plant',
  name: '量子化工厂',
  originalId: 2314,
  category: 'chemical',
  speed: 1.0,
  workPower: 1.44,
  idlePower: 0.048,
  hasProliferatorSlot: true,
  intrinsicProductivity: 1.0,
};

/** 化工厂类建筑列表 */
export const chemicalBuildings = [chemicalPlant, cryogenicChemicalPlant, quantumChemicalPlant];

// ============ 物品定义 ============

/** 原矿 */
export const rawItems: Item[] = [
  { id: 'gas-cloud', name: '气云', originalId: 10001, type: 1, iconName: 'gas-cloud', isRaw: true },
  { id: 'bio-alcohol', name: '生物醇', originalId: 10002, type: 1, iconName: 'bio-alcohol', isRaw: true },
  { id: 'fullerol', name: '富勒醇', originalId: 10003, type: 1, iconName: 'fullerol', isRaw: true },
];

/** 中间产物 */
export const intermediateItems: Item[] = [
  { id: 'graphene', name: '石墨烯', originalId: 11001, type: 2, iconName: 'graphene' },
  { id: 'hydrogen', name: '氢气', originalId: 11002, type: 2, iconName: 'hydrogen' },
  { id: 'methane', name: '甲烷', originalId: 11003, type: 2, iconName: 'methane' },
  { id: 'fullerene', name: '富勒烯', originalId: 11004, type: 2, iconName: 'fullerene' },
  { id: 'fullerene-silver', name: '富勒银', originalId: 11005, type: 2, iconName: 'fullerene-silver' },
];

/** 目标产物 */
export const productItems: Item[] = [
  { id: 'refined-silver', name: '精炼银', originalId: 12001, type: 3, iconName: 'refined-silver' },
];

/** 所有物品 */
export const testItems: Item[] = [...rawItems, ...intermediateItems, ...productItems];

// ============ 配方定义 ============

/** 
 * r1: 气云 + 石墨烯 + 氢气 → 甲烷 + 富勒烯
 * 上层系统配方，用于产生富勒烯供下层使用
 */
export const recipeR1: Recipe = {
  id: 'r1-gas-to-methane-fullerene',
  name: '气云制甲烷和富勒烯',
  originalId: 90001,
  inputs: [
    { itemId: 'gas-cloud', count: 1 },
    { itemId: 'graphene', count: 1 },
    { itemId: 'hydrogen', count: 1 },
  ],
  outputs: [
    { itemId: 'methane', count: 1 },
    { itemId: 'fullerene', count: 1 },
  ],
  time: 60,
  factoryIds: [2309, 2313, 2314], // 化工厂类
  isMultiProduct: true,
  proliferatorLevel: 3,
  iconName: 'r1',
  type: 1,
};

/**
 * r2: 甲烷 → 石墨烯 + 氢气
 * 上层系统配方，回收甲烷重新生产石墨烯和氢气
 */
export const recipeR2: Recipe = {
  id: 'r2-methane-recycle',
  name: '甲烷回收',
  originalId: 90002,
  inputs: [{ itemId: 'methane', count: 1 }],
  outputs: [
    { itemId: 'graphene', count: 1 },
    { itemId: 'hydrogen', count: 1 },
  ],
  time: 60,
  factoryIds: [2309, 2313, 2314],
  isMultiProduct: true,
  proliferatorLevel: 3,
  iconName: 'r2',
  type: 1,
};

/**
 * r3: 富勒烯 + 生物醇 + 精炼银 → 富勒银
 * 下层系统配方，参与 X-Y 循环
 */
export const recipeR3: Recipe = {
  id: 'r3-fullerene-silver',
  name: '富勒银合成',
  originalId: 90003,
  inputs: [
    { itemId: 'fullerene', count: 1 },
    { itemId: 'bio-alcohol', count: 1 },
    { itemId: 'refined-silver', count: 1 },
  ],
  outputs: [{ itemId: 'fullerene-silver', count: 1 }],
  time: 60,
  factoryIds: [2309, 2313, 2314],
  isMultiProduct: false,
  proliferatorLevel: 3,
  iconName: 'r3',
  type: 1,
};

/**
 * r4: 富勒烯 + 富勒醇 + 富勒银 → 精炼银
 * 下层系统配方，参与 X-Y 循环，产出目标产物
 */
export const recipeR4: Recipe = {
  id: 'r4-refined-silver',
  name: '精炼银提取',
  originalId: 90004,
  inputs: [
    { itemId: 'fullerene', count: 1 },
    { itemId: 'fullerol', count: 1 },
    { itemId: 'fullerene-silver', count: 1 },
  ],
  outputs: [{ itemId: 'refined-silver', count: 1 }],
  time: 60,
  factoryIds: [2309, 2313, 2314],
  isMultiProduct: false,
  proliferatorLevel: 3,
  iconName: 'r4',
  type: 1,
};

/** 所有测试配方 */
export const testRecipes: Recipe[] = [recipeR1, recipeR2, recipeR3, recipeR4];

// ============ GameData 构造 ============

export function createTestGameData(): GameData {
  const itemMap = new Map(testItems.map(i => [i.id, i]));
  const recipeMap = new Map(testRecipes.map(r => [r.id, r]));
  
  // 构建 itemToRecipes 映射
  const itemToRecipes = new Map<string, Recipe[]>();
  for (const recipe of testRecipes) {
    for (const output of recipe.outputs) {
      if (!itemToRecipes.has(output.itemId)) {
        itemToRecipes.set(output.itemId, []);
      }
      itemToRecipes.get(output.itemId)!.push(recipe);
    }
  }

  return {
    version: 'test-chemical-scenario',
    items: testItems,
    recipes: testRecipes,
    buildings: chemicalBuildings,
    proliferators: [],
    rawItemIds: ['gas-cloud', 'bio-alcohol', 'fullerol'],
    itemMap,
    recipeMap,
    itemToRecipes,
  };
}

// ============ 预设策略 ============

/**
 * 策略1：分层策略（推荐）
 * - r1, r2 使用化工厂（无加成）：保持甲烷↔石墨烯+氢气的内部平衡
 * - r3, r4 使用量子化工厂（+100%产出）：打破精炼银↔富勒银循环
 */
export const strategyLayered = new Map([
  ['r1-gas-to-methane-fullerene', 'chemical-plant'],
  ['r2-methane-recycle', 'chemical-plant'],
  ['r3-fullerene-silver', 'quantum-chemical-plant'],
  ['r4-refined-silver', 'quantum-chemical-plant'],
]);

/**
 * 策略2：全部使用量子化工厂
 * 预期结果：无解（r1,r2 使用加成后无法内部平衡）
 */
export const strategyAllQuantum = new Map([
  ['r1-gas-to-methane-fullerene', 'quantum-chemical-plant'],
  ['r2-methane-recycle', 'quantum-chemical-plant'],
  ['r3-fullerene-silver', 'quantum-chemical-plant'],
  ['r4-refined-silver', 'quantum-chemical-plant'],
]);

/**
 * 策略3：全部使用化工厂（无加成）
 * 预期结果：无解（精炼银↔富勒银循环无法打破）
 */
export const strategyAllBasic = new Map([
  ['r1-gas-to-methane-fullerene', 'chemical-plant'],
  ['r2-methane-recycle', 'chemical-plant'],
  ['r3-fullerene-silver', 'chemical-plant'],
  ['r4-refined-silver', 'chemical-plant'],
]);

/**
 * 策略4：混合增产策略
 * - r1, r2 使用化工厂（保持平衡）
 * - r3 使用低温化工厂（+25%）
 * - r4 使用量子化工厂（+100%）
 */
export const strategyMixed = new Map([
  ['r1-gas-to-methane-fullerene', 'chemical-plant'],
  ['r2-methane-recycle', 'chemical-plant'],
  ['r3-fullerene-silver', 'cryogenic-chemical-plant'],
  ['r4-refined-silver', 'quantum-chemical-plant'],
]);

// 导出默认测试数据
export const testGameData = createTestGameData();
