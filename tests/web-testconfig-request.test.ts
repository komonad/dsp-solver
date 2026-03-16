import { solveFromRequest, SolveRequest } from '../src/core/solveRequest';
import { loadWebTestConfig } from './test-config-loader';

describe('web TestConfig request parity', () => {
  test('fullerene-silver browser request is feasible when closure recipes use productive buildings', async () => {
    const gameData = await loadWebTestConfig();
    const request: SolveRequest = {
      demands: [{ itemId: '11005', rate: 60 }],
      options: {
        treatAsRaw: [],
        existingSupplies: [],
        selectedRecipes: [],
        noByproducts: false,
        recipeProliferators: [],
        recipeBuildings: [
          ['1', '2304'],
          ['2', '2304'],
          ['90001', '2309'],
          ['90002', '2309'],
          ['90003', '2314'],
          ['90004', '2314']
        ]
      }
    };

    const result = solveFromRequest(request, gameData);
    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('11005') || 0).toBeGreaterThanOrEqual(59.9);
  });
});
