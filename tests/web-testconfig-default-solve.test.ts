import { solveMultiDemand } from '../src/legacy/core/multiDemandSolver';
import { buildLayeredRecipeBuildings } from '../src/legacy/core/autoBuilding';
import { loadWebTestConfig } from './test-config-loader';

test('default web solve path for test config uses layered buildings and solves fullerene-silver', async () => {
  const gameData = await loadWebTestConfig();
  const result = solveMultiDemand(
    [{ itemId: '11005', rate: 60 }],
    gameData,
    {
      treatAsRaw: [],
      existingSupplies: [],
      selectedRecipes: new Map(),
      noByproducts: false,
      recipeProliferators: new Map(),
      recipeBuildings: buildLayeredRecipeBuildings(gameData, ['11005']),
    }
  );

  expect(result.feasible).toBe(true);
  expect(result.satisfiedDemands.get('11005') || 0).toBeGreaterThanOrEqual(59.9);
});
