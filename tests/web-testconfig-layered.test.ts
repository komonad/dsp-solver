import { solveFromRequest } from '../src/core/solveRequest';
import { buildLayeredRecipeBuildings } from '../src/core/autoBuilding';
import { loadWebTestConfig } from './test-config-loader';

test('layered auto-building makes fullerene-silver feasible with intrinsic productivity', async () => {
  const gameData = await loadWebTestConfig();
  const recipeBuildings = Array.from(buildLayeredRecipeBuildings(gameData, ['11005']).entries());

  expect(recipeBuildings).toContainEqual(['90003', '2314']);
  expect(recipeBuildings).toContainEqual(['90004', '2314']);

  const result = solveFromRequest({
    demands: [{ itemId: '11005', rate: 60 }],
    options: { recipeBuildings, noByproducts: false, selectedRecipes: [], recipeProliferators: [], treatAsRaw: [], existingSupplies: [] }
  }, gameData);

  expect(result.feasible).toBe(true);
  expect(result.satisfiedDemands.get('11005') || 0).toBeGreaterThanOrEqual(59.9);
});
