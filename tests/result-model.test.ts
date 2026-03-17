import { loadGameDataFromFile } from '../src/legacy/data/loader';
import { solveMultiDemand } from '../src/legacy/core/multiDemandSolver';
import { buildLayeredRecipeBuildings } from '../src/legacy/core/autoBuilding';
import { buildResultModel } from '../src/legacy/web/resultModel';

test('构建结果模型 - TestConfig 富勒烯银', async () =&gt; {
  const gameData = await loadGameDataFromFile('./data/TestConfig.json');
  const demands = [{ itemId: '11005', rate: 60 }];
  const recipeBuildings = buildLayeredRecipeBuildings(gameData, ['11005']);

  const result = solveMultiDemand(demands, gameData, {
    recipeBuildings,
  });

  const model = buildResultModel(result, gameData, recipeBuildings);
  
  // 验证：应该正确处理 intrinsicProductivity 4倍产率
  expect(model.recipes).toHaveLength(2);

  // 富勒烯银的产出应该是 60/min（与需求一致）
  const fullerenesSilverRecipe = model.recipes.find(r =&gt; r.recipeId === '1010005');
  expect(fullerenesSilverRecipe).toBeDefined();
  expect(fullerenesSilverRecipe?.outputs[0].rate).toBeCloseTo(60, 1);
  
  // 富勒烯的产出是 1.5/min
  const fullerenesRecipe = model.recipes.find(r =&gt; r.recipeId === '1010004');
  expect(fullerenesRecipe).toBeDefined();
  expect(fullerenesRecipe?.outputs[0].rate).toBeCloseTo(1.5, 1);
  
  // 富勒烯银配方输入：20/min 铁，1.5/min 富勒烯
  expect(fullerenesSilverRecipe?.inputs[0].itemId).toBe('1104');
  expect(fullerenesSilverRecipe?.inputs[0].rate).toBeCloseTo(20, 1);
  expect(fullerenesSilverRecipe?.inputs[1].itemId).toBe('11004');
  expect(fullerenesSilverRecipe?.inputs[1].rate).toBeCloseTo(1.5, 1);
});
