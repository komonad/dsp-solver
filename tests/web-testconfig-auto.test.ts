import { solveFromRequest, SolveRequest } from '../src/core/solveRequest';
import { loadWebTestConfig } from './test-config-loader';

describe('web TestConfig auto-building parity', () => {
  test('fullerene-silver becomes feasible without stale building overrides', async () => {
    const gameData = await loadWebTestConfig();
    const request: SolveRequest = {
      demands: [{ itemId: '11005', rate: 60 }],
      options: {
        treatAsRaw: [],
        existingSupplies: [],
        selectedRecipes: [],
        noByproducts: false,
        recipeProliferators: [],
        recipeBuildings: []
      }
    };

    const result = solveFromRequest(request, gameData);
    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('11005') || 0).toBeGreaterThanOrEqual(59.9);
  });
});
