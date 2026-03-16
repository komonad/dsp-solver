import { loadGameDataFromFile } from '../src/data/loader';
import { solveMultiDemand } from '../src/core/multiDemandSolver';
import { buildLayeredRecipeBuildings } from '../src/core/autoBuilding';
import { buildResultModel } from '../src/web/resultModel';

test('result model stays internally consistent for fullerene-silver', async () => {
  const gameData = await loadGameDataFromFile('./data/TestConfig.json');
  const recipeBuildings = buildLayeredRecipeBuildings(gameData, ['11005']);
  const result = solveMultiDemand(
    [{ itemId: '11005', rate: 60 }],
    gameData,
    { recipeBuildings }
  );

  expect(result.feasible).toBe(true);

  const model = buildResultModel(result, gameData, recipeBuildings);
  for (const row of model.recipes) {
    expect(row.buildingCount * row.perBuildingExecutionsPerMinute).toBeCloseTo(row.executionsPerMinute, 6);
  }

  const fullereneSilver = model.recipes.find(row => row.recipeId === '90003');
  expect(fullereneSilver?.executionsPerMinute).toBeCloseTo(40, 6);
  expect(fullereneSilver?.buildingCount).toBeCloseTo(2 / 3, 6);
  expect(fullereneSilver?.outputs[0].rate).toBeCloseTo(80, 6);
});
