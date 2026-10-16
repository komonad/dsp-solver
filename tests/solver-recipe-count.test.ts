import { resolveCatalogModel, type VanillaDatasetSpec } from '../src/catalog';
import { loadHighsSolverImplementation, solveCatalogRequest, solveCatalogRequestAsync, type SolveRequest, type RecipeCountOptimization } from '../src/solver';
import { isFeasibleAssignment } from '../src/solver/solutionValidation';
import { buildRecipeOptimizationViewModel } from '../src/web/app/workbenchHelpers';
import { parseAdvancedSolveOverrides, mergeAdvancedSolveOverrides } from '../src/web/workbench/requestBuilder';
import { updateObjectiveWeightsText } from '../src/web/workbench/objectiveWeights';

function catalog() {
  const data: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore' },
      { ID: 1201, Type: 2, Name: 'Intermediate', IconName: 'intermediate' },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate' },
      ...[5001, 5002].map(ID => ({ ID, Type: 6, Name: 'Assembler', IconName: 'assembler', Speed: 1, Space: 1, WorkEnergyPerTick: 0 })),
    ],
    recipes: [
      { ID: 1, Items: [1001], Results: [1201], ItemCounts: [1] },
      { ID: 2, Items: [1201], Results: [1101], ItemCounts: [1] },
      { ID: 3, Items: [1001], Results: [1101], ItemCounts: [1.1] },
    ].map(recipe => ({ ...recipe, Type: 1, Name: `Recipe ${recipe.ID}`, IconName: 'plate', Factories: [5001, 5002], ResultCounts: [1], TimeSpend: 60, Proliferator: 0 })),
  };
  return resolveCatalogModel(data, { recommendedRawItemTypeIds: [1] });
}

const request: SolveRequest = {
  objective: 'min_weighted', balancePolicy: 'force_balance', targets: [{ itemId: '1101', ratePerMin: 60 }],
  recipeCountPenalty: { weight: 0.1, timeLimitMs: 500 },
};

test('recipe indicators trade a small cost increase for fewer recipe types', async () => {
  const result = await solveCatalogRequestAsync(catalog(), request);
  expect(result.recipePlans.map(plan => plan.recipeId)).toEqual(['3']);
  expect(result.objectiveCost?.total).toBeCloseTo(67);
  expect(result.recipeCountOptimization).toMatchObject({ status: 'converged', baselineRecipeCount: 2, finalRecipeCount: 1, binaryCount: 3 });
  expect(result.recipeCountOptimization?.baselineCost).toBeCloseTo(62);
  expect(result.itemBalance.every(item => Math.abs(item.netRatePerMin) < 1e-6)).toBe(true);
  const lowPenalty = await solveCatalogRequestAsync(catalog(), { ...request, recipeCountPenalty: { weight: 0.01 } });
  expect(lowPenalty.recipeCountOptimization?.finalRecipeCount).toBe(2);
});

test('recipe complexity has an absolute independent coefficient', async () => {
  for (const [recipeWeight, expectedCount] of [[4, 2], [6, 1]]) {
    const result = await solveCatalogRequestAsync(catalog(), { ...request, recipeCountPenalty: undefined,
      recipeWeight, milpTimeLimitMs: 500 });
    expect(result.recipeCountOptimization?.finalRecipeCount).toBe(expectedCount);
    expect(result.recipeCountOptimization?.penaltyPerRecipe).toBe(recipeWeight);
  }
  const scaled = await solveCatalogRequestAsync(catalog(), { ...request, recipeCountPenalty: undefined,
    recipeWeight: 6, resourceWeight: 2, footprintWeight: 2, milpTimeLimitMs: 500 });
  expect(scaled.recipeCountOptimization?.finalRecipeCount).toBe(2);
});

test.each([[4, 2], [6, 1]])('explicit complexity weight %s preserves its tradeoff across output rates', async (recipes, expectedCount) => {
  const c = catalog();
  const results = [];
  for (const ratePerMin of [10, 60, 1000]) {
    const snapshots: RecipeCountOptimization[] = [];
    const result = await solveCatalogRequestAsync(c, {
      ...request, recipeCountPenalty: undefined,
      objectiveWeights: { resources: 1, footprint: 1, power: 0, recipes },
      targets: [{ itemId: '1101', ratePerMin }], milpRelativeGap: 0,
    }, { onIntermediateResult: result => snapshots.push(result.recipeCountOptimization!) });
    expect(result.recipeCountOptimization).toMatchObject({ status: 'converged', finalRecipeCount: expectedCount, penaltyPerRecipe: recipes });
    expect(result.targets[0].actualRatePerMin).toBeCloseTo(ratePerMin);
    expect(snapshots[0].baselineCost).toBeCloseTo(62);
    results.push(result);
  }
  for (const result of results.slice(1)) {
    expect(result.recipePlans.map(plan => plan.recipeId)).toEqual(results[0].recipePlans.map(plan => plan.recipeId));
    expect(result.recipeCountOptimization?.finalCost).toBeCloseTo(results[0].recipeCountOptimization!.finalCost);
    expect(result.objectiveCost?.total).toBeCloseTo(results[0].objectiveCost!.total);
  }
  expect(results[2].externalInputs[0].ratePerMin / results[0].externalInputs[0].ratePerMin).toBeCloseTo(100);
  expect(results[2].objectiveCost!.placementArea / results[0].objectiveCost!.placementArea).toBeCloseTo(100);
});

test('an interrupted feasible incumbent remains usable without being called optimal', async () => {
  const implementation = await loadHighsSolverImplementation();
  const result = solveCatalogRequest(catalog(), request, { implementation: {
    implementationId: 'timeout-incumbent',
    solve(model, options) {
      if (model.binaries?.size) return { status: 'timedout', result: 1.2, variables: new Map(options?.initialSolution) as never, mipGap: 0.4 };
      return implementation.solve(model, options);
    },
  } });
  expect(result.status).toBe('feasible');
  expect(result.recipeCountOptimization).toMatchObject({ status: 'time_limit', relativeGap: 0.4, finalRecipeCount: 2 });
  expect(result.targets[0].actualRatePerMin).toBeCloseTo(60);
});

test('an invalid interrupted candidate and a solver exception both preserve the LP baseline', async () => {
  const implementation = await loadHighsSolverImplementation();
  for (const failure of ['invalid', 'exception']) {
    const result = solveCatalogRequest(catalog(), request, { implementation: {
      implementationId: `failure-${failure}`,
      solve(model, options) {
        if (!model.binaries?.size) return implementation.solve(model, options);
        if (failure === 'exception') throw new Error('Solver failed');
        return { status: 'timedout', result: 0, variables: new Map() };
      },
    } });
    expect(result.status).toBe('feasible');
    expect(result.objectiveCost?.total).toBeCloseTo(62);
    expect(result.recipeCountOptimization?.reason).toBe(failure === 'exception' ? 'solver_error' : 'invalid_candidate');
    expect(result.targets[0].actualRatePerMin).toBeCloseTo(60);
  }
});

test.each([0, 99, 10001, Infinity, NaN])('MILP budget %s is rejected', async timeLimitMs => {
  const result = await solveCatalogRequestAsync(catalog(), { ...request, recipeCountPenalty: { weight: 0.1, timeLimitMs } });
  expect(result.status).toBe('invalid_input');
});

test('the ten-second budget is accepted and zero penalty bypasses MILP', async () => {
  const result = await solveCatalogRequestAsync(catalog(), { ...request, recipeCountPenalty: { weight: 0, timeLimitMs: 10000 } });
  expect(result.status).toBe('optimal');
  expect(result.recipeCountOptimization).toBeUndefined();
});

test('assignment validation rejects fractional indicators, missing demand, and negative rates', () => {
  const model = { direction: 'minimize' as const, objective: 'cost', constraints: { target: { equal: 1 } }, variables: { x: { target: 1 }, y: {} }, binaries: new Set(['y']) };
  expect(isFeasibleAssignment(model, new Map([['x', 1], ['y', 1]]))).toBe(true);
  expect(isFeasibleAssignment(model, new Map([['x', 1], ['y', 0.5]]))).toBe(false);
  expect(isFeasibleAssignment(model, new Map())).toBe(false);
  expect(isFeasibleAssignment(model, new Map([['x', -1], ['y', 1]]))).toBe(false);
});

test('MILP settings survive JSON editing, merging, and budget validation', () => {
  const text = updateObjectiveWeightsText('{"inputWeights":{"1001":2}}', { recipeCountPenalty: { weight: 0.05, timeLimitMs: 10000 } });
  const parsed = parseAdvancedSolveOverrides(text);
  expect(parsed.error).toBe('');
  expect(mergeAdvancedSolveOverrides(parsed.value, {})).toMatchObject({ inputWeights: { '1001': 2 }, recipeCountPenalty: { weight: 0.05, timeLimitMs: 10000 } });
  expect(parseAdvancedSolveOverrides('{"recipeCountPenalty":{"weight":0.1,"timeLimitMs":11000}}').error).not.toBe('');
});

test('optimization display separates feasible termination, cost change, and the complete objective gap', () => {
  const summary: RecipeCountOptimization = { status: 'time_limit', timeLimitMs: 3000, durationMs: 3001, weight: 0.05, baselineCost: 100, finalCost: 110, baselineRecipeCount: 20, finalRecipeCount: 15, binaryCount: 30, relativeGap: 0.4 };
  expect(buildRecipeOptimizationViewModel(summary)).toMatchObject({ recipeLabel: '20 → 15', costChangeLabel: '+10.0%', gapLabel: '40.0%', reduction: 5, finalCostLabel: '110.00', penaltyCostLabel: '75.00', totalCostLabel: '185.00' });
  expect(buildRecipeOptimizationViewModel({ ...summary, relativeGap: undefined, reason: 'solver_error' }).reason).toContain('最佳可行方案');
});

test('a solver failure after a streamed improvement keeps that improvement', async () => {
  const implementation = await loadHighsSolverImplementation();
  const result = solveCatalogRequest(catalog(), request, { implementation: {
    implementationId: 'fail-after-improvement',
    solve(model, options) {
      if (!model.binaries?.size) return implementation.solve(model, options);
      const improved = implementation.solve(model, options);
      options?.onIncumbent?.(improved);
      throw new Error('Interrupted after publishing');
    },
  } });
  expect(result.status).toBe('feasible');
  expect(result.recipeCountOptimization?.reason).toBe('solver_error');
  expect(result.recipePlans.map(plan => plan.recipeId)).toEqual(['3']);
});
