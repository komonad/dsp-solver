import { solveMultiDemand } from '../src/core/multiDemandSolver';
import { testGameData, strategyLayered } from './test-config';

describe('web parity scenarios', () => {
  test('web-like solve uses layered building strategy and remains feasible', () => {
    const result = solveMultiDemand(
      [{ itemId: 'refined-silver', rate: 60 }],
      testGameData,
      {
        recipeBuildings: strategyLayered,
        noByproducts: true,
        treatAsRaw: [],
        existingSupplies: [],
        selectedRecipes: new Map(),
        recipeProliferators: new Map(),
      }
    );

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('refined-silver') || 0).toBeGreaterThanOrEqual(59.9);
    expect(Math.abs(result.intermediateBalance.get('methane') || 0)).toBeLessThan(0.01);
    expect(Math.abs(result.intermediateBalance.get('graphene') || 0)).toBeLessThan(0.01);
    expect(Math.abs(result.intermediateBalance.get('hydrogen') || 0)).toBeLessThan(0.01);
  });

  test('productivity on both sides of a closed loop should break feasibility', () => {
    const allProductivity = new Map([
      ['r1-gas-to-methane-fullerene', { level: 3 as const, mode: 'productivity' as const }],
      ['r2-methane-recycle', { level: 3 as const, mode: 'productivity' as const }],
      ['r3-fullerene-silver', { level: 3 as const, mode: 'productivity' as const }],
      ['r4-refined-silver', { level: 3 as const, mode: 'productivity' as const }],
    ]);

    const result = solveMultiDemand(
      [{ itemId: 'refined-silver', rate: 60 }],
      testGameData,
      {
        recipeBuildings: strategyLayered,
        recipeProliferators: allProductivity,
        noByproducts: true,
      }
    );

    expect(result.feasible).toBe(false);
  });
});
