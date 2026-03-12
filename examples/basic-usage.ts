/**
 * 基础使用示例
 */

import { 
  loadGameDataFromFile, 
  calculate, 
  findMultiProductRecipes,
  setCustomProliferatorParams,
  enableDoublingForBuilding
} from '../src';
import type { CalculationConfig } from '../src';

async function main() {
  // 1. 加载游戏数据
  console.log('Loading game data...');
  const gameData = await loadGameDataFromFile('./data/Vanilla.json');
  console.log(`Loaded ${gameData.items.length} items, ${gameData.recipes.length} recipes`);

  // 2. 查找多产物配方
  console.log('\nMulti-product recipes:');
  const multiProductRecipes = findMultiProductRecipes(gameData);
  for (const info of multiProductRecipes.slice(0, 5)) {
    console.log(`  - ${info.recipe.name}: ${info.byproducts.length} byproducts`);
  }

  // 3. 基础计算示例：计算处理器需求
  console.log('\n--- Basic Calculation: Processor ---');
  const processorConfig: CalculationConfig = {
    demands: [
      { itemId: '1303', rate: 60, allowExternal: false }, // 处理器
    ],
    buildingPreferences: {
      preferredAssembler: 2305, // 制造台 Mk.III
    },
    defaultProliferator: {
      level: 3,
      mode: 'speed',
      sprayCount: 12,
    },
    balancingStrategy: 'min-waste',
  };

  const processorResult = calculate(processorConfig, gameData);
  console.log(`Calculation time: ${processorResult.calculationTime}ms`);
  console.log('Buildings needed:');
  for (const [buildingId, count] of Object.entries(processorResult.totalBuildings)) {
    const building = gameData.buildings.find(b => b.id === buildingId);
    console.log(`  ${building?.name || buildingId}: ${count}`);
  }
  console.log('Raw materials:');
  for (const [item, rate] of Object.entries(processorResult.rawRequirements)) {
    console.log(`  ${item}: ${rate.toFixed(2)}/min`);
  }

  // 4. 多产物配方示例：原油精炼
  console.log('\n--- Multi-product Recipe: Plasma Refining ---');
  const oilConfig: CalculationConfig = {
    demands: [
      { itemId: '1120', rate: 30, allowExternal: false }, // 精炼油
    ],
    defaultProliferator: {
      level: 0,
      mode: 'none',
      sprayCount: 0,
    },
  };

  const oilResult = calculate(oilConfig, gameData);
  console.log('Balancing schemes used:');
  for (const scheme of oilResult.balancingSchemes) {
    console.log(`  ${scheme.name}:`);
    console.log(`    Main product: ${scheme.mainProduct}`);
    console.log(`    Byproducts: ${scheme.byproducts.map(b => b.itemId).join(', ')}`);
    console.log(`    Is balanced: ${scheme.isBalanced}`);
  }

  // 5. 增产剂参数化示例
  console.log('\n--- Custom Proliferator Parameters ---');
  setCustomProliferatorParams({
    0: { speedBonus: 0, productivityBonus: 0, powerBonus: 0, sprayCount: 0 },
    1: { speedBonus: 0.2, productivityBonus: 0.2, powerBonus: 0.3, sprayCount: 15 },
    2: { speedBonus: 0.3, productivityBonus: 0.3, powerBonus: 0.5, sprayCount: 15 },
    3: { speedBonus: 0.5, productivityBonus: 0.5, powerBonus: 0.7, sprayCount: 15 },
  });
  console.log('Custom proliferator parameters set!');

  // 6. 建筑翻倍效果示例
  console.log('\n--- Building Doubling Effect ---');
  enableDoublingForBuilding('2315', 2, ['1101', '1102']); // 位面熔炉对铁块和磁铁翻倍
  console.log('Enabled doubling for 位面熔炉 on 铁块 and 磁铁');

  const doublingConfig: CalculationConfig = {
    demands: [
      { itemId: '1101', rate: 120 }, // 铁块
    ],
    buildingPreferences: {
      preferredSmelter: 2315, // 位面熔炉
    },
    doublingSettings: {
      enabled: true,
      buildings: ['2315'],
    },
  };

  const doublingResult = calculate(doublingConfig, gameData);
  console.log('With doubling effect:');
  console.log(`  Buildings needed: ${doublingResult.totalBuildings['2315'] || 0}`);
}

main().catch(console.error);
