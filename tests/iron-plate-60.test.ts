import { loadGameDataFromFile } from '../src/legacy/data/loader';
import { solveMultiDemand } from '../src/legacy/core/multiDemandSolver';
import { buildLayeredRecipeBuildings } from '../src/legacy/core/autoBuilding';
import { buildResultModel } from '../src/legacy/web/resultModel';

test('vanilla config 60 iron plate per minute demand gives correct output', async () => {
  const gameData = await loadGameDataFromFile('./data/Vanilla.json');
  
  // 查找铁块的ID
  const ironPlateItem = gameData.items.find(item => item.name === '铁块');
  expect(ironPlateItem).toBeDefined();
  if (!ironPlateItem) return;
  
  const demands = [{ itemId: ironPlateItem.id, rate: 60 }];
  const recipeBuildings = buildLayeredRecipeBuildings(gameData, demands.map(d => d.itemId));
  
  const result = solveMultiDemand(demands, gameData, {
    treatAsRaw: [],
    existingSupplies: [],
    selectedRecipes: new Map(),
    noByproducts: false,
    recipeProliferators: new Map(),
    recipeBuildings,
  });
  
  expect(result.feasible).toBe(true);
  
  // 验证满足的需求正确
  const satisfiedDemand = result.satisfiedDemands.get(ironPlateItem.id);
  expect(satisfiedDemand).toBeCloseTo(60, 6);
  
  // 打印调试信息
  console.log('DEBUG: 配方计数 (recipes)', Object.fromEntries(result.recipes));
  console.log('DEBUG: 配方速率 per minute (recipeRatesPerMinute)', Object.fromEntries(result.recipeRatesPerMinute || new Map()));
  console.log('DEBUG: 满足的需求', satisfiedDemand);
  console.log('DEBUG: 原料', Object.fromEntries(result.rawMaterials));
  
  const model = buildResultModel(result, gameData, recipeBuildings);
  
  // 找到铁块配方
  const ironRecipe = model.recipes.find(r => r.recipeName === '铁块');
  expect(ironRecipe).toBeDefined();
  if (!ironRecipe) return;
  
  console.log('DEBUG: 铁块配方信息', gameData.recipeMap.get('1'));
  console.log('DEBUG: 铁块配方结果', ironRecipe);
  
  // 验证产出量是60/分钟
  const ironOutput = ironRecipe.outputs.find(o => o.itemId === ironPlateItem.id);
  expect(ironOutput).toBeDefined();
  if (!ironOutput) return;
  
  expect(ironOutput.rate).toBeCloseTo(60, 6);
  
  // 验证铁矿消耗量是60/分钟
  const ironOreInput = ironRecipe.inputs.find(i => i.itemName === '铁矿');
  expect(ironOreInput).toBeDefined();
  if (!ironOreInput) return;
  
  expect(ironOreInput.rate).toBeCloseTo(60, 6);
  
  // 验证建筑数量是 1/3 ≈ 0.33 个
  console.log('DEBUG: 建筑数量:', ironRecipe.buildingCount);
  expect(ironRecipe.buildingCount).toBeCloseTo(1/3, 6);
});
