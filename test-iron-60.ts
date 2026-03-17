import { loadGameDataFromFile } from './src/legacy/data/loader';
import { solveMultiDemand } from './src/legacy/core/multiDemandSolver';
import { buildLayeredRecipeBuildings } from './src/legacy/core/autoBuilding';
import { buildResultModel } from './src/legacy/web/resultModel';

async function test60IronPlate() {
  console.log('=== 测试案例：vanilla配置下需求60铁块 ===');
  
  // 1. 加载原版数据
  const gameData = await loadGameDataFromFile('./data/Vanilla.json');
  console.log('✅ 加载Vanilla配置成功');
  
  // 2. 查找铁块的ID和配方
  const ironPlateItem = gameData.items.find(item => item.name === '铁块');
  const ironPlateRecipe = gameData.recipes.find(recipe => recipe.name === '铁块');
  
  if (!ironPlateItem || !ironPlateRecipe) {
    console.error('❌ 未找到铁块物品或配方');
    return;
  }
  
  console.log(`铁块物品ID: ${ironPlateItem.id}`);
  console.log(`铁块配方ID: ${ironPlateRecipe.id}`);
  console.log(`铁块配方: 每次消耗${ironPlateRecipe.inputs[0].amount}个${gameData.itemMap.get(ironPlateRecipe.inputs[0].itemId)?.name}，产出${ironPlateRecipe.outputs[0].amount}个铁块，耗时${ironPlateRecipe.time}秒`);
  
  // 3. 求解需求60铁块/分钟
  const demands = [{ itemId: ironPlateItem.id, rate: 60 }];
  const recipeBuildings = buildLayeredRecipeBuildings(gameData, demands.map(d => d.itemId));
  
  console.log('\n开始求解，需求: 60铁块/分钟');
  
  const result = solveMultiDemand(demands, gameData, {
    treatAsRaw: [],
    existingSupplies: [],
    selectedRecipes: new Map(),
    noByproducts: false,
    recipeProliferators: new Map(),
    recipeBuildings,
  });
  
  console.log(`求解结果: ${result.feasible ? '成功' : '失败'}`);
  
  if (result.feasible) {
    console.log('\n=== 求解器返回的原始数据 ===');
    console.log('配方速率:', Object.fromEntries(result.recipeRatesPerMinute || result.recipes));
    console.log('原料消耗:', Object.fromEntries(result.rawMaterials));
    console.log('满足的需求:', Object.fromEntries(result.satisfiedDemands));
    
    // 4. 构建结果模型
    const model = buildResultModel(result, gameData, recipeBuildings);
    
    console.log('\n=== 结果模型计算的展示数据 ===');
    model.recipes.forEach(recipe => {
      if (recipe.recipeId === ironPlateRecipe.id) {
        console.log(`配方: ${recipe.recipeName}`);
        console.log(`执行次数: ${recipe.executionsPerMinute.toFixed(2)}/分钟`);
        console.log(`建筑数量: ${recipe.buildingCount.toFixed(2)}个 ${recipe.buildingName}`);
        console.log(`单建筑执行次数: ${recipe.perBuildingExecutionsPerMinute.toFixed(2)}/分钟`);
        console.log('输入:', recipe.inputs.map(i => `${i.itemName}: ${i.rate.toFixed(2)}/分钟`));
        console.log('输出:', recipe.outputs.map(o => `${o.itemName}: ${o.rate.toFixed(2)}/分钟`));
      }
    });
    
    console.log('\n原料列表:');
    model.rawMaterials.forEach(raw => {
      console.log(`${raw.itemName}: ${raw.rate.toFixed(2)}/分钟`);
    });
  } else {
    console.error('求解失败:', result.message);
  }
}

test60IronPlate();
