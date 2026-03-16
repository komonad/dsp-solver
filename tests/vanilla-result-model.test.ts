import { loadGameDataFromFile } from '../src/data/loader';
import { solveMultiDemand } from '../src/core/multiDemandSolver';
import { buildLayeredRecipeBuildings } from '../src/core/autoBuilding';
import { buildResultModel } from '../src/web/resultModel';

test('vanilla result model keeps building count and execution rate aligned', async () => {
  const gameData = await loadGameDataFromFile('./data/Vanilla.json');
  const recipeBuildings = buildLayeredRecipeBuildings(gameData, ['6006']);
  const result = solveMultiDemand(
    [{ itemId: '6006', rate: 60 }],
    gameData,
    { recipeBuildings }
  );

  expect(result.feasible).toBe(true);
  const model = buildResultModel(result, gameData, recipeBuildings);

  for (const row of model.recipes) {
    expect(row.buildingCount * row.perBuildingExecutionsPerMinute).toBeCloseTo(row.executionsPerMinute, 6);
  }

  const universeRecipe = model.recipes.find(row => row.outputs.some(output => output.itemId === '6006'));
  expect(universeRecipe).toBeDefined();
  expect(universeRecipe?.outputs[0].rate).toBeCloseTo(universeRecipe?.executionsPerMinute || 0, 6);
  expect(universeRecipe?.buildingCount).toBeCloseTo(15, 6);
  expect(universeRecipe?.buildingName).toBe('自演化研究站');
});
