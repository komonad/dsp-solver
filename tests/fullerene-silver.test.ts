import { solveMultiDemand } from '../src/legacy/core/multiDemandSolver';
import {
  testGameData,
  strategyLayered,
  strategyMixed,
  strategyAllBasic,
  strategyAllQuantum,
} from './test-config';

describe('fullerene-silver solving', () => {
  test('layered strategy finds a balanced solution for fullerene-silver', () => {
    const result = solveMultiDemand(
      [{ itemId: 'fullerene-silver', rate: 60 }],
      testGameData,
      { recipeBuildings: strategyLayered, noByproducts: true }
    );

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('fullerene-silver') || 0).toBeGreaterThanOrEqual(59.9);
    expect(Math.abs(result.intermediateBalance.get('methane') || 0)).toBeLessThan(0.01);
    expect(Math.abs(result.intermediateBalance.get('graphene') || 0)).toBeLessThan(0.01);
    expect(Math.abs(result.intermediateBalance.get('hydrogen') || 0)).toBeLessThan(0.01);
    expect(Math.abs(result.intermediateBalance.get('refined-silver') || 0)).toBeLessThan(0.01);
  });

  test('mixed strategy also finds a balanced solution for fullerene-silver', () => {
    const result = solveMultiDemand(
      [{ itemId: 'fullerene-silver', rate: 60 }],
      testGameData,
      { recipeBuildings: strategyMixed, noByproducts: true }
    );

    expect(result.feasible).toBe(true);
    expect(result.satisfiedDemands.get('fullerene-silver') || 0).toBeGreaterThanOrEqual(59.9);
  });

  test('all-basic strategy is infeasible for fullerene-silver', () => {
    const result = solveMultiDemand(
      [{ itemId: 'fullerene-silver', rate: 60 }],
      testGameData,
      { recipeBuildings: strategyAllBasic, noByproducts: true }
    );

    expect(result.feasible).toBe(false);
  });

  test('all-quantum strategy is infeasible for fullerene-silver', () => {
    const result = solveMultiDemand(
      [{ itemId: 'fullerene-silver', rate: 60 }],
      testGameData,
      { recipeBuildings: strategyAllQuantum, noByproducts: true }
    );

    expect(result.feasible).toBe(false);
  });
});
