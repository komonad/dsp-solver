import { loadGameDataFromFile } from '../src/legacy/data/loader';
import { solveMultiDemand } from '../src/legacy/core/multiDemandSolver';
import { buildLayeredRecipeBuildings } from '../src/legacy/core/autoBuilding';
import { buildResultModel } from '../src/legacy/web/resultModel';

test('构建结果模型 - Vanilla 蓝马达', async () =&gt; {
  const gameData = await loadGameDataFromFile('./data/Vanilla.json');
  const blueMotorItem = gameData.items.find(item =&gt; item.name === '蓝马达');
  if (!blueMotorItem) throw new Error('找不到蓝马达物品');
  const demands = [{ itemId: blueMotorItem.id, rate: 60 }];
  const recipeBuildings = buildLayeredRecipeBuildings(gameData, demands.map(d =&gt; d.itemId));

  const result = solveMultiDemand(demands, gameData, {
    recipeBuildings,
  });

  const model = buildResultModel(result, gameData, recipeBuildings);
  
  // 验证：应该有多个配方，且蓝马达产出为 60/min
  expect(model.recipes.length).toBeGreaterThan(1);
  
  const blueMotorRecipe = model.recipes.find(r =&gt; r.recipeName === '蓝马达');
  expect(blueMotorRecipe).toBeDefined();
  expect(blueMotorRecipe?.outputs[0].rate).toBeCloseTo(60, 1);
});
