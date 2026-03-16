import { solveFromRequest, SolveRequest } from '../src/core/solveRequest';
import { testGameData, strategyLayered } from './test-config';

describe('SolveRequest shared format', () => {
  test('fullerene-silver test uses the same serialized request shape as web', () => {
    const request: SolveRequest = {
      demands: [{ itemId: 'fullerene-silver', rate: 60 }],
      options: {
        noByproducts: true,
        recipeBuildings: Array.from(strategyLayered.entries()),
        selectedRecipes: [],
        recipeProliferators: [],
        treatAsRaw: [],
        existingSupplies: [],
      },
    };

    const result = solveFromRequest(request, testGameData);

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('fullerene-silver') || 0).toBeGreaterThanOrEqual(59.9);
  });
});
