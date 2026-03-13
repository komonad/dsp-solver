/**
 * 数据加载器 - 从dsp-calc格式加载游戏数据
 */

import type { 
  RawGameData, RawItem, RawRecipe, 
  GameData, Item, Recipe, Building, RecipeItem 
} from '../types';

// 原版建筑定义（ID来自游戏）
const VANILLA_BUILDINGS: Record<number, any> = {
  // 熔炉
  2302: { name: '电弧熔炉', nameCN: '电弧熔炉', category: 'smelter', speed: 1, workPower: 0.36, idlePower: 0.012, hasProliferatorSlot: true },
  2315: { name: '位面熔炉', nameCN: '位面熔炉', category: 'smelter', speed: 2, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
  2319: { name: '负熵熔炉', nameCN: '负熵熔炉', category: 'smelter', speed: 3, workPower: 1.08, idlePower: 0.036, hasProliferatorSlot: true },
  
  // 制造台
  2303: { name: '制造台 Mk.I', nameCN: '制造台 Mk.I', category: 'assembler', speed: 0.75, workPower: 0.27, idlePower: 0.009, hasProliferatorSlot: true },
  2304: { name: '制造台 Mk.II', nameCN: '制造台 Mk.II', category: 'assembler', speed: 1, workPower: 0.54, idlePower: 0.018, hasProliferatorSlot: true },
  2305: { name: '制造台 Mk.III', nameCN: '制造台 Mk.III', category: 'assembler', speed: 1.5, workPower: 1.08, idlePower: 0.036, hasProliferatorSlot: true },
  2318: { name: '重组式制造台', nameCN: '重组式制造台', category: 'assembler', speed: 2, workPower: 2.16, idlePower: 0.072, hasProliferatorSlot: true },
  
  // 精炼厂
  2308: { name: '原油精炼厂', nameCN: '原油精炼厂', category: 'refinery', speed: 1, workPower: 0.96, idlePower: 0.032, hasProliferatorSlot: true },
  
  // 化工厂
  2317: { name: '化工厂', nameCN: '化工厂', category: 'chemical', speed: 1, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
  
  // 对撞机
  2310: { name: '微型粒子对撞机', nameCN: '微型粒子对撞机', category: 'particle', speed: 1, workPower: 12, idlePower: 0.4, hasProliferatorSlot: true },
  
  // 研究站
  2901: { name: '矩阵研究站', nameCN: '矩阵研究站', category: 'lab', speed: 1, workPower: 0.48, idlePower: 0.016, hasProliferatorSlot: true },
  2902: { name: '自演化研究站', nameCN: '自演化研究站', category: 'lab', speed: 3, workPower: 1.44, idlePower: 0.048, hasProliferatorSlot: true },
  
  // 其他
  2307: { name: '原油萃取站', nameCN: '原油萃取站', category: 'extractor', speed: 1, workPower: 0.42, idlePower: 0.014, hasProliferatorSlot: false },
  2306: { name: '水泵', nameCN: '水泵', category: 'pump', speed: 1, workPower: 0.03, idlePower: 0.001, hasProliferatorSlot: false },
  2311: { name: '分馏塔', nameCN: '分馏塔', category: 'fractionator', speed: 1, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
  2312: { name: '轨道采集器', nameCN: '轨道采集器', category: 'orbital', speed: 1, workPower: 0, idlePower: 0, hasProliferatorSlot: false },
  2301: { name: '采矿机', nameCN: '采矿机', category: 'mining', speed: 0.5, workPower: 0.42, idlePower: 0.014, hasProliferatorSlot: false },
  2316: { name: '大型采矿机', nameCN: '大型采矿机', category: 'mining', speed: 2, workPower: 2.94, idlePower: 0.098, hasProliferatorSlot: false },
};

// 原矿类型ID列表（Type 1）
const RAW_ITEM_TYPES = new Set([1]);

/**
 * 加载游戏数据
 * @param rawData 原始JSON数据
 * @returns 解析后的游戏数据
 */
export function loadGameData(rawData: RawGameData): GameData {
  // 转换物品 - 支持大小写两种格式
  const items: Item[] = rawData.items.map(raw => ({
    id: (raw.ID ?? raw.id ?? 0).toString(),
    name: raw.Name ?? raw.name ?? '未知物品',
    originalId: raw.ID ?? raw.id ?? 0,
    type: raw.Type ?? raw.type ?? 0,
    iconName: raw.IconName ?? raw.iconName ?? '',
    isRaw: RAW_ITEM_TYPES.has(raw.Type ?? raw.type ?? 0),
  }));

  // 转换配方 - 支持大小写两种格式
  const recipes: Recipe[] = rawData.recipes.map(raw => {
    // 如果已经有 inputs/outputs 数组（自定义格式），直接使用
    let inputs: RecipeItem[];
    let outputs: RecipeItem[];
    
    if (raw.inputs && raw.outputs) {
      // 自定义格式（Refinery.json）
      inputs = raw.inputs;
      outputs = raw.outputs;
    } else {
      // dsp-calc 格式（Vanilla.json）
      const items = raw.Items ?? raw.items ?? [];
      const itemCounts = raw.ItemCounts ?? raw.itemCounts ?? [];
      const results = raw.Results ?? raw.results ?? [];
      const resultCounts = raw.ResultCounts ?? raw.resultCounts ?? [];
      
      inputs = items.map((id: any, index: number) => ({
        itemId: id.toString(),
        count: itemCounts[index] || 0,
      }));

      outputs = results.map((id: any, index: number) => ({
        itemId: id.toString(),
        count: resultCounts[index] || 0,
      }));
    }
    
    const factories = raw.Factories ?? raw.factoryIds ?? [];

    return {
      id: (raw.ID ?? raw.id ?? 0).toString(),
      name: raw.Name ?? raw.name ?? '未知配方',
      originalId: raw.ID ?? raw.id ?? 0,
      inputs,
      outputs,
      time: (raw.TimeSpend ?? raw.time ?? 60) / 60, // 转换为每分钟的基准时间
      factoryIds: factories,
      isMultiProduct: raw.isMultiProduct ?? (outputs.length > 1),
      proliferatorLevel: raw.Proliferator ?? raw.proliferatorLevel ?? 0,
      iconName: raw.IconName ?? raw.iconName ?? '',
      type: raw.Type ?? raw.type ?? 0,
    };
  });

  // 转换建筑 - 支持自定义格式的 buildings 数组
  const buildings: Building[] = [];
  
  // 如果有自定义 buildings 数组（Refinery.json），直接使用
  if ((rawData as any).buildings) {
    for (const raw of (rawData as any).buildings) {
      const buildingId = raw.id ?? raw.originalId ?? 0;
      buildings.push({
        id: buildingId.toString(),
        originalId: raw.originalId ?? parseInt(raw.id) ?? 0,
        name: raw.name ?? '未知建筑',
        category: raw.category || 'other',
        speed: raw.speed ?? 1,
        workPower: raw.workPower ?? 0,
        idlePower: raw.idlePower ?? 0,
        hasProliferatorSlot: raw.hasProliferatorSlot ?? false,
        supportsDoubling: raw.supportsDoubling ?? false,
      } as Building);
    }
  } else {
    // 使用原版建筑定义（Vanilla.json）
    for (const [id, config] of Object.entries(VANILLA_BUILDINGS)) {
      const buildingId = parseInt(id);
      // 检查此建筑是否被任何配方使用
      const isUsed = recipes.some(r => r.factoryIds.includes(buildingId));
      if (isUsed) {
        buildings.push({
          id: buildingId.toString(),
          originalId: buildingId,
          name: config.name || `建筑${buildingId}`,
          category: config.category || 'other',
          speed: config.speed || 1,
          workPower: config.workPower || 0,
          idlePower: config.idlePower || 0,
          hasProliferatorSlot: config.hasProliferatorSlot || false,
          supportsDoubling: false, // 原版默认不支持
        } as Building);
      }
    }
  }

  // 构建映射
  const itemMap = new Map(items.map(i => [i.id, i]));
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  
  // 构建物品到配方的映射
  const itemToRecipes = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    for (const output of recipe.outputs) {
      if (!itemToRecipes.has(output.itemId)) {
        itemToRecipes.set(output.itemId, []);
      }
      itemToRecipes.get(output.itemId)!.push(recipe);
    }
  }

  // 获取原矿ID列表 - 优先使用自定义格式中的 rawItemIds
  const rawItemIds = (rawData as any).rawItemIds ?? items.filter(i => i.isRaw).map(i => i.id);

  return {
    version: (rawData as any).version ?? '0.10.x',
    items,
    recipes,
    buildings,
    proliferators: [
      { level: 0, name: '无', speedBonus: 0, productivityBonus: 0, sprayCount: 0 },
      { level: 1, name: '增产剂 Mk.I', speedBonus: 0.125, productivityBonus: 0.125, sprayCount: 12 },
      { level: 2, name: '增产剂 Mk.II', speedBonus: 0.20, productivityBonus: 0.20, sprayCount: 12 },
      { level: 3, name: '增产剂 Mk.III', speedBonus: 0.25, productivityBonus: 0.25, sprayCount: 12 },
    ],
    rawItemIds,
    itemMap,
    recipeMap,
    itemToRecipes,
  };
}

/**
 * 从文件加载游戏数据
 * @param filePath JSON文件路径
 * @returns 解析后的游戏数据
 */
export async function loadGameDataFromFile(filePath: string): Promise<GameData> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  // 移除 BOM 头
  const cleanContent = content.replace(/^\uFEFF/, '');
  const rawData: RawGameData = JSON.parse(cleanContent);
  return loadGameData(rawData);
}

/**
 * 从URL加载游戏数据（浏览器环境）
 * @param url JSON文件URL
 * @returns 解析后的游戏数据
 */
export async function loadGameDataFromURL(url: string): Promise<GameData> {
  const response = await fetch(url);
  const content = await response.text();
  // 移除 BOM 头
  const cleanContent = content.replace(/^\uFEFF/, '');
  const rawData: RawGameData = JSON.parse(cleanContent);
  return loadGameData(rawData);
}
