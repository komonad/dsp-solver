/**
 * 鏁版嵁鍔犺浇鍣?- 浠巇sp-calc鏍煎紡鍔犺浇娓告垙鏁版嵁
 */

import type { 
  RawGameData, RawItem, RawRecipe, 
  GameData, Item, Recipe, Building, RecipeItem 
} from '../types';

// 鍘熺増寤虹瓚瀹氫箟锛圛D鏉ヨ嚜娓告垙锛?
const VANILLA_BUILDINGS: Record<number, any> = {
  // 鐔旂倝
  2302: { name: '鐢靛姬鐔旂倝', nameCN: '鐢靛姬鐔旂倝', category: 'smelter', speed: 1, workPower: 0.36, idlePower: 0.012, hasProliferatorSlot: true },
  2315: { name: '浣嶉潰鐔旂倝', nameCN: '浣嶉潰鐔旂倝', category: 'smelter', speed: 2, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
  2319: { name: '璐熺喌鐔旂倝', nameCN: '璐熺喌鐔旂倝', category: 'smelter', speed: 3, workPower: 1.08, idlePower: 0.036, hasProliferatorSlot: true },
  
  // 鍒堕€犲彴
  2303: { name: '鍒堕€犲彴 Mk.I', nameCN: '鍒堕€犲彴 Mk.I', category: 'assembler', speed: 0.75, workPower: 0.27, idlePower: 0.009, hasProliferatorSlot: true },
  2304: { name: '鍒堕€犲彴 Mk.II', nameCN: '鍒堕€犲彴 Mk.II', category: 'assembler', speed: 1, workPower: 0.54, idlePower: 0.018, hasProliferatorSlot: true },
  2305: { name: '鍒堕€犲彴 Mk.III', nameCN: '鍒堕€犲彴 Mk.III', category: 'assembler', speed: 1.5, workPower: 1.08, idlePower: 0.036, hasProliferatorSlot: true },
  2318: { name: '閲嶇粍寮忓埗閫犲彴', nameCN: '閲嶇粍寮忓埗閫犲彴', category: 'assembler', speed: 2, workPower: 2.16, idlePower: 0.072, hasProliferatorSlot: true },
  
  // 绮剧偧鍘?
  2308: { name: 'Refinery', nameCN: 'Refinery', category: 'refinery', speed: 1, workPower: 0.96, idlePower: 0.032, hasProliferatorSlot: true },
  
  // 鍖栧伐鍘?
  2309: { name: 'Chemical Plant', nameCN: 'Chemical Plant', category: 'chemical', speed: 1, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
  2313: { name: 'Cryogenic Chemical Plant', nameCN: 'Cryogenic Chemical Plant', category: 'chemical', speed: 1, workPower: 0.9, idlePower: 0.03, hasProliferatorSlot: true, intrinsicProductivity: 0.25 },
  2314: { name: 'Quantum Chemical Plant', nameCN: 'Quantum Chemical Plant', category: 'chemical', speed: 1, workPower: 1.44, idlePower: 0.048, hasProliferatorSlot: true, intrinsicProductivity: 1.0 },
  
  // 瀵规挒鏈?
  2310: { name: 'Miniature Particle Collider', nameCN: 'Miniature Particle Collider', category: 'particle', speed: 1, workPower: 12, idlePower: 0.4, hasProliferatorSlot: true },
  
  // 鐮旂┒绔?
  2901: { name: 'Matrix Lab', nameCN: 'Matrix Lab', category: 'lab', speed: 1, workPower: 0.48, idlePower: 0.016, hasProliferatorSlot: true },
  2902: { name: '鑷紨鍖栫爺绌剁珯', nameCN: '鑷紨鍖栫爺绌剁珯', category: 'lab', speed: 3, workPower: 1.44, idlePower: 0.048, hasProliferatorSlot: true },
  
  // 鍏朵粬
  2307: { name: 'Oil Extractor', nameCN: 'Oil Extractor', category: 'extractor', speed: 1, workPower: 0.42, idlePower: 0.014, hasProliferatorSlot: false },
  2306: { name: '姘存车', nameCN: '姘存车', category: 'pump', speed: 1, workPower: 0.03, idlePower: 0.001, hasProliferatorSlot: false },
  2311: { name: 'Fractionator', nameCN: 'Fractionator', category: 'fractionator', speed: 1, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
  2312: { name: 'Orbital Collector', nameCN: 'Orbital Collector', category: 'orbital', speed: 1, workPower: 0, idlePower: 0, hasProliferatorSlot: false },
  2301: { name: 'Mining Machine', nameCN: 'Mining Machine', category: 'mining', speed: 0.5, workPower: 0.42, idlePower: 0.014, hasProliferatorSlot: false },
  2316: { name: 'Large Mining Machine', nameCN: 'Large Mining Machine', category: 'mining', speed: 2, workPower: 2.94, idlePower: 0.098, hasProliferatorSlot: false },
};

// 鍘熺熆绫诲瀷ID鍒楄〃锛圱ype 1锛?
const RAW_ITEM_TYPES = new Set([1]);

/**
 * 鍔犺浇娓告垙鏁版嵁
 * @param rawData 鍘熷JSON鏁版嵁
 * @returns 瑙ｆ瀽鍚庣殑娓告垙鏁版嵁
 */
export function loadGameData(rawData: RawGameData): GameData {
  // 杞崲鐗╁搧 - 鏀寔澶у皬鍐欎袱绉嶆牸寮?
  const items: Item[] = rawData.items.map(raw => ({
    id: (raw.ID ?? raw.id ?? 0).toString(),
    name: raw.Name ?? raw.name ?? '鏈煡鐗╁搧',
    originalId: raw.ID ?? raw.id ?? 0,
    type: raw.Type ?? raw.type ?? 0,
    iconName: raw.IconName ?? raw.iconName ?? '',
    isRaw: RAW_ITEM_TYPES.has(raw.Type ?? raw.type ?? 0),
  }));

  // 杞崲閰嶆柟 - 鏀寔澶у皬鍐欎袱绉嶆牸寮?
  const recipes: Recipe[] = rawData.recipes.map(raw => {
    // 濡傛灉宸茬粡鏈?inputs/outputs 鏁扮粍锛堣嚜瀹氫箟鏍煎紡锛夛紝鐩存帴浣跨敤
    let inputs: RecipeItem[];
    let outputs: RecipeItem[];
    
    if (raw.inputs && raw.outputs) {
      if (raw.inputs.length > 0 && typeof raw.inputs[0] === 'object') {
        inputs = raw.inputs as RecipeItem[];
      } else {
        const inputIds = raw.inputs as any[];
        const inputCounts = (raw as any).inputCounts ?? [];
        inputs = inputIds.map((id: any, index: number) => ({
          itemId: id.toString(),
          count: inputCounts[index] || 0,
        }));
      }

      if (raw.outputs.length > 0 && typeof raw.outputs[0] === 'object') {
        outputs = raw.outputs as RecipeItem[];
      } else {
        const outputIds = raw.outputs as any[];
        const outputCounts = (raw as any).outputCounts ?? [];
        outputs = outputIds.map((id: any, index: number) => ({
          itemId: id.toString(),
          count: outputCounts[index] || 0,
        }));
      }
    } else {
      // dsp-calc 鏍煎紡锛圴anilla.json锛?
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
    const category = (raw as any).category;

    return {
      id: (raw.ID ?? raw.id ?? 0).toString(),
      name: raw.Name ?? raw.name ?? '鏈煡閰嶆柟',
      originalId: raw.ID ?? raw.id ?? 0,
      inputs,
      outputs,
      time: raw.TimeSpend !== undefined
        ? raw.TimeSpend / 60
        : (raw.time ?? 60),
      factoryIds: factories,
      category,
      isMultiProduct: raw.isMultiProduct ?? (outputs.length > 1),
      proliferatorLevel: raw.Proliferator ?? raw.proliferatorLevel ?? 0,
      iconName: raw.IconName ?? raw.iconName ?? '',
      type: raw.Type ?? raw.type ?? 0,
    };
  });

  // 杞崲寤虹瓚 - 鏀寔鑷畾涔夋牸寮忕殑 buildings 鏁扮粍
  const buildings: Building[] = [];
  
  // 濡傛灉鏈夎嚜瀹氫箟 buildings 鏁扮粍锛圧efinery.json锛夛紝鐩存帴浣跨敤
  if ((rawData as any).buildings) {
    for (const raw of (rawData as any).buildings) {
      const buildingId = raw.id ?? raw.originalId ?? 0;
      buildings.push({
        id: buildingId.toString(),
        originalId: raw.originalId ?? parseInt(raw.id) ?? 0,
        name: raw.name ?? '鏈煡寤虹瓚',
        category: raw.category || 'other',
        speed: raw.speed ?? 1,
        workPower: raw.workPower ?? 0,
        idlePower: raw.idlePower ?? 0,
        hasProliferatorSlot: raw.hasProliferatorSlot ?? false,
        supportsDoubling: raw.supportsDoubling ?? false,
        intrinsicProductivity: raw.intrinsicProductivity,
      } as Building);
    }
  } else {
    // 浣跨敤鍘熺増寤虹瓚瀹氫箟锛圴anilla.json锛?
    for (const [id, config] of Object.entries(VANILLA_BUILDINGS)) {
      const buildingId = parseInt(id);
      // 妫€鏌ユ寤虹瓚鏄惁琚换浣曢厤鏂逛娇鐢?
      const isUsed = recipes.some(r => r.factoryIds.includes(buildingId));
      if (isUsed) {
        buildings.push({
          id: buildingId.toString(),
          originalId: buildingId,
          name: config.name || `寤虹瓚${buildingId}`,
          category: config.category || 'other',
          speed: config.speed || 1,
          workPower: config.workPower || 0,
          idlePower: config.idlePower || 0,
          hasProliferatorSlot: config.hasProliferatorSlot || false,
          supportsDoubling: false, // 鍘熺増榛樿涓嶆敮鎸?
        } as Building);
      }
    }
  }

  // 鏋勫缓鏄犲皠
  const itemMap = new Map(items.map(i => [i.id, i]));
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  
  // 鏋勫缓鐗╁搧鍒伴厤鏂圭殑鏄犲皠
  const itemToRecipes = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    for (const output of recipe.outputs) {
      if (!itemToRecipes.has(output.itemId)) {
        itemToRecipes.set(output.itemId, []);
      }
      itemToRecipes.get(output.itemId)!.push(recipe);
    }
  }

  const producibleItemIds = new Set<string>();
  for (const recipe of recipes) {
    for (const output of recipe.outputs) {
      producibleItemIds.add(output.itemId);
    }
  }

  // 鑾峰彇鍘熺熆ID鍒楄〃 - 浼樺厛浣跨敤鑷畾涔夋牸寮忎腑鐨?rawItemIds
  const configuredRawItemIds = (rawData as any).rawItemIds ?? items.filter(i => i.isRaw).map(i => i.id);
  const defaultRawItemIds = Array.from(new Set<string>([
    ...(((rawData as any).defaultRawItemIds ?? []) as string[]),
    ...items.filter(i => !producibleItemIds.has(i.id)).map(i => i.id),
  ]));

  const rawItemIds = Array.from(new Set<string>([
    ...configuredRawItemIds,
    ...defaultRawItemIds,
  ]));

  return {
    version: (rawData as any).version ?? '0.10.x',
    items,
    recipes,
    buildings,
    proliferators: [
      { level: 0, name: 'None', speedBonus: 0, productivityBonus: 0, sprayCount: 0 },
      { level: 1, name: 'Proliferator Mk.I', speedBonus: 0.125, productivityBonus: 0.125, sprayCount: 12 },
      { level: 2, name: 'Proliferator Mk.II', speedBonus: 0.20, productivityBonus: 0.20, sprayCount: 12 },
      { level: 3, name: 'Proliferator Mk.III', speedBonus: 1.0, productivityBonus: 1.0, sprayCount: 12 },
    ],
    rawItemIds,
    defaultRawItemIds,
    itemMap,
    recipeMap,
    itemToRecipes,
  };
}

/**
 * 浠庢枃浠跺姞杞芥父鎴忔暟鎹?
 * @param filePath JSON鏂囦欢璺緞
 * @returns 瑙ｆ瀽鍚庣殑娓告垙鏁版嵁
 */
export async function loadGameDataFromFile(filePath: string): Promise<GameData> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  // 绉婚櫎 BOM 澶?
  const cleanContent = content.replace(/^\uFEFF/, '');
  const rawData: RawGameData = JSON.parse(cleanContent);
  return loadGameData(rawData);
}

/**
 * 浠嶶RL鍔犺浇娓告垙鏁版嵁锛堟祻瑙堝櫒鐜锛?
 * @param url JSON鏂囦欢URL
 * @returns 瑙ｆ瀽鍚庣殑娓告垙鏁版嵁
 */
export async function loadGameDataFromURL(url: string): Promise<GameData> {
  const response = await fetch(url);
  const content = await response.text();
  // 绉婚櫎 BOM 澶?
  const cleanContent = content.replace(/^\uFEFF/, '');
  const rawData: RawGameData = JSON.parse(cleanContent);
  return loadGameData(rawData);
}


