import { resolveCatalogModel, type VanillaDatasetSpec } from '../src/catalog';
import { solveCatalogRequestAsync, type ObjectiveWeights, type SolveResult } from '../src/solver';
import { OBJECTIVE_PRESETS, matchObjectivePreset, resolveObjectiveWeights, updateObjectiveWeightsText } from '../src/web/workbench/objectiveWeights';
import { parseAdvancedSolveOverrides, mergeAdvancedSolveOverrides } from '../src/web/workbench/requestBuilder';
import { applyWorkbenchSolveProgress, buildIdleWorkbenchSolveState, buildCancelledWorkbenchSolveState, persistWorkbenchSolveState, restoreWorkbenchSolveState } from '../src/web/workbench/autoSolve';
import { getObjectiveProductionScale, normalizeObjectiveRequest } from '../src/solver/objectiveCosts';

function catalog() {
  const data: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore A', IconName: 'a' },
      { ID: 1002, Type: 1, Name: 'Ore B', IconName: 'b' },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate' },
      { ID: 5001, Type: 6, Name: 'Large', IconName: 'large', Speed: 1, Space: 10, WorkEnergyPerTick: 1e6 / 60 },
      { ID: 5002, Type: 6, Name: 'Small', IconName: 'small', Speed: 1, Space: 1, WorkEnergyPerTick: 1e7 / 60 },
    ],
    recipes: [1001, 1002].map((item, index) => ({ ID: index + 1, Type: 1, Name: `Plate ${index}`, IconName: 'plate', Factories: [5001 + index], Items: [item], ItemCounts: [1], Results: [1101], ResultCounts: [1], TimeSpend: 60, Proliferator: 0 })),
  };
  return resolveCatalogModel(data, { recommendedRawItemTypeIds: [1] });
}

test.each([
  [{ resources: 1, footprint: 0, power: 0, recipes: 0 }, '1'],
  [{ resources: 0, footprint: 1, power: 0, recipes: 0 }, '2'],
  [{ resources: 0, footprint: 0, power: 1, recipes: 0 }, '1'],
  [{ resources: 0, footprint: 1, power: 100, recipes: 0 }, '1'],
] as Array<[ObjectiveWeights, string]>)('explicit objective coefficients override the selected preset: %j', async (objectiveWeights, recipeId) => {
  const result = await solveCatalogRequestAsync(catalog(), { objective: 'min_power', objectiveWeights,
    targets: [{ itemId: '1101', ratePerMin: 60 }], balancePolicy: 'force_balance', inputWeights: { '1002': 5 } });
  expect(result.status).toBe('optimal');
  expect(result.recipePlans.map(plan => plan.recipeId)).toEqual([recipeId]);
  const c = result.objectiveCost!;
  expect(c.total).toBeCloseTo(c.resourceCost + c.footprintCost + c.powerCost!);
  expect(c.powerCost).toBeCloseTo(result.powerSummary.activePowerMW * objectiveWeights.power);
});

test('background optimization publishes a usable baseline before MIP results and has no time cap', async () => {
  const snapshots: SolveResult[] = [];
  const result = await solveCatalogRequestAsync(catalog(), { objective: 'min_buildings',
    objectiveWeights: { resources: 1, footprint: 1, power: 1, recipes: 100 },
    targets: [{ itemId: '1101', ratePerMin: 60 }], balancePolicy: 'force_balance',
  }, { onIntermediateResult: snapshot => snapshots.push(snapshot) });
  expect(snapshots.length).toBeGreaterThan(0);
  expect(snapshots[0].recipeCountOptimization).toMatchObject({ status: 'optimizing', timeLimitMs: null, penaltyPerRecipe: 100 });
  for (const snapshot of snapshots) {
    expect(snapshot.status).toBe('feasible');
    expect(snapshot.targets[0].actualRatePerMin).toBeCloseTo(60);
  }
  expect(result.recipeCountOptimization?.status).toBe('converged');
});

test('all continuous objective terms use a common throughput basis while physical quantities scale', async () => {
  const c = catalog();
  const results = [];
  for (const ratePerMin of [10, 1000]) {
    const result = await solveCatalogRequestAsync(c, { objective: 'min_weighted',
      objectiveWeights: { resources: 2, footprint: 3, power: 4, recipes: 5 },
      targets: [{ itemId: '1101', ratePerMin }], balancePolicy: 'force_balance', milpRelativeGap: 0 });
    expect(result.recipeCountOptimization?.status).toBe('converged');
    expect(result.objectiveCost?.productionScale).toBeCloseTo(ratePerMin / 60);
    results.push(result);
  }
  expect(results[1].recipePlans.map(plan => plan.recipeId)).toEqual(results[0].recipePlans.map(plan => plan.recipeId));
  for (const term of ['resourceCost', 'footprintCost', 'powerCost', 'total'] as const) {
    expect(results[1].objectiveCost![term]).toBeCloseTo(results[0].objectiveCost![term]!);
  }
  expect(results[1].powerSummary.activePowerMW / results[0].powerSummary.activePowerMW).toBeCloseTo(100);
});

test('multi-output normalization preserves proportions and leaves independent coefficients intact', () => {
  const request = { objective: 'min_weighted' as const, balancePolicy: 'force_balance' as const,
    objectiveWeights: { resources: 2, footprint: 3, power: 4, recipes: 5 },
    targets: [{ itemId: '1101', ratePerMin: 2 }, { itemId: '1201', ratePerMin: 8 }] };
  const normalized = normalizeObjectiveRequest(request);
  expect(normalized).toMatchObject({ resourceWeight: 12, footprintWeight: 18, powerWeight: 24, recipeWeight: 5 });
  expect(normalized.targets).toEqual(request.targets);
  expect(normalizeObjectiveRequest(normalized)).toEqual(normalized);
  const expanded = normalizeObjectiveRequest({ ...request, targets: request.targets.map(t => ({ ...t, ratePerMin: t.ratePerMin * 100 })) });
  expect(expanded.resourceWeight! * 100).toBeCloseTo(normalized.resourceWeight!);
  expect(expanded.recipeWeight).toBe(normalized.recipeWeight);
  expect(getObjectiveProductionScale({ targets: [{ itemId: '1101', ratePerMin: 0 }] })).toBe(1);
});

test('objective presets and independent coefficients survive editing and persistence', () => {
  expect(matchObjectivePreset(OBJECTIVE_PRESETS.min_power)).toBe('min_power');
  const weights = { resources: 2, footprint: 3, power: 4, recipes: 50 };
  expect(matchObjectivePreset(weights)).toBe('custom');
  const text = updateObjectiveWeightsText('{"inputWeights":{"1000":0}}', { objectiveWeights: weights, milpTimeLimitMs: null, milpRelativeGap: 0 });
  const parsed = parseAdvancedSolveOverrides(text);
  expect(parsed.error).toBe('');
  const overrides = mergeAdvancedSolveOverrides(parsed.value, {});
  expect(overrides).toMatchObject({ objectiveWeights: weights, milpTimeLimitMs: null, milpRelativeGap: 0, inputWeights: { '1000': 0 } });
  expect(resolveObjectiveWeights('min_power', overrides)).toEqual(weights);
});

test('streaming results remain current while searching and survive cancellation and reload', async () => {
  const request = { objective: 'min_power' as const, targets: [{ itemId: '1101', ratePerMin: 60 }], balancePolicy: 'force_balance' as const };
  const result = await solveCatalogRequestAsync(catalog(), request);
  const state = applyWorkbenchSolveProgress(buildIdleWorkbenchSolveState(), { stage: 'optimizing_recipe_count', activeRequest: request, result });
  expect(state.activity).toMatchObject({ status: 'running', staleResult: false });
  expect(state.result).toBe(result);
  const stopped = buildCancelledWorkbenchSolveState(state);
  expect(stopped.activity).toMatchObject({ status: 'cancelled', staleResult: false });
  expect(restoreWorkbenchSolveState(persistWorkbenchSolveState(stopped)).result).toEqual(result);
  const optimizing = { ...state, result: { ...result, recipeCountOptimization: {
    status: 'optimizing' as const, timeLimitMs: null, durationMs: 100, weight: 1,
    baselineCost: 60, finalCost: 60, baselineRecipeCount: 1, finalRecipeCount: 1, binaryCount: 2,
  } } };
  expect(restoreWorkbenchSolveState(persistWorkbenchSolveState(optimizing)).result?.recipeCountOptimization?.status).toBe('paused');
});
