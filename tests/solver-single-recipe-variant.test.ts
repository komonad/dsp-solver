import { resolveCatalogModel, type VanillaDatasetSpec } from '../src/catalog';
import { solveCatalogRequestAsync, type SolveRequest, type SolveResult } from '../src/solver';
import { mergeAdvancedSolveOverrides, parseAdvancedSolveOverrides } from '../src/web/workbench/requestBuilder';
import { updateObjectiveWeightsText } from '../src/web/workbench/objectiveWeights';

function catalog(secondBuilding = false) {
  const data: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore' },
      { ID: 1143, Type: 2, Name: 'Spray', IconName: 'spray' },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate' },
      { ID: 5001, Type: 6, Name: 'Factory', IconName: 'factory', Speed: 1, Space: 1, WorkEnergyPerTick: 0 },
    ],
    recipes: [
      { ID: 1, Type: 4, Factories: [5001], Name: 'Pair', IconName: 'pair', Items: [1001], ItemCounts: [1],
        Results: [1143, 1101], ResultCounts: [1, 1], TimeSpend: 60, Proliferator: 1 },
      { ID: 2, Type: 4, Factories: [5001], Name: 'Plate', IconName: 'plate', Items: [1001], ItemCounts: [10],
        Results: [1101], ResultCounts: [1], TimeSpend: 60, Proliferator: 0 },
    ],
  };
  if (secondBuilding) {
    data.items.push({ ID: 5002, Type: 6, Name: 'Advanced factory', IconName: 'factory', Speed: 1, Space: 1, WorkEnergyPerTick: 0 });
    data.recipes.forEach(recipe => recipe.Factories.push(5002));
    data.recipes[1].ItemCounts = [100];
  }
  return resolveCatalogModel(data, {
    buildingRules: secondBuilding ? [{ ID: 5002, IntrinsicProductivityBonus: 1 }] : [],
    recommendedRawItemTypeIds: [1],
    proliferatorLevels: [
      { Level: 0, SpeedMultiplier: 1, ProductivityMultiplier: 1, PowerMultiplier: 1 },
      { Level: 1, ItemID: 1143, SprayCount: 5, SpeedMultiplier: 1, ProductivityMultiplier: 2, PowerMultiplier: 1 },
    ],
    recipeModifierRules: [
      { Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 },
      { Code: 1, Kind: 'proliferator', SupportedModes: ['none', 'productivity'], MaxLevel: 1 },
    ],
  });
}

const request: SolveRequest = {
  targets: [{ itemId: '1143', ratePerMin: 57 }, { itemId: '1101', ratePerMin: 63 }],
  objective: 'min_weighted', objectiveWeights: { resources: 1, footprint: 0, power: 0, recipes: 0 },
  balancePolicy: 'force_balance', milpTimeLimitMs: 1000, milpRelativeGap: 0,
};

function expectSingleVariants(result: SolveResult) {
  expect(new Set(result.recipePlans.map(plan => plan.recipeId)).size).toBe(result.recipePlans.length);
}

test('relaxed production may mix variants while the hard switch excludes them', async () => {
  const c = catalog();
  const relaxed = await solveCatalogRequestAsync(c, request);
  expect(relaxed.recipePlans.filter(plan => plan.recipeId === '1')).toHaveLength(2);
  const snapshots: SolveResult[] = [];
  const constrained = await solveCatalogRequestAsync(c, { ...request, singleRecipeVariant: true },
    { onIntermediateResult: result => snapshots.push(result) });
  expect(constrained.status).toBe('optimal');
  expectSingleVariants(constrained);
  expect(constrained.recipePlans.map(plan => plan.recipeId).sort()).toEqual(['1', '2']);
  expect(constrained.recipePlans.find(plan => plan.recipeId === '1')?.proliferatorMode).toBe('none');
  expect(snapshots.length).toBeGreaterThan(0);
  snapshots.forEach(expectSingleVariants);
});

test('an exclusively mixed feasible relaxation is infeasible under the hard switch', async () => {
  const result = await solveCatalogRequestAsync(catalog(), { ...request, singleRecipeVariant: true, disabledRecipeIds: ['2'] });
  expect(result.status).toBe('infeasible');
  expect(result.recipePlans).toEqual([]);
});

test('the hard switch also prevents mixing buildings for one recipe', async () => {
  const c = catalog(true);
  const relaxed = await solveCatalogRequestAsync(c, request);
  const pair = relaxed.recipePlans.filter(plan => plan.recipeId === '1');
  expect(new Set(pair.map(plan => plan.buildingId)).size).toBe(2);
  const constrained = await solveCatalogRequestAsync(c, { ...request, singleRecipeVariant: true });
  expect(constrained.status).toBe('optimal');
  expectSingleVariants(constrained);
});

test('single variants remain compatible with recipe penalties and scaled throughput', async () => {
  const result = await solveCatalogRequestAsync(catalog(), { ...request, singleRecipeVariant: true,
    targets: request.targets.map(target => ({ ...target, ratePerMin: target.ratePerMin * 100 })),
    objectiveWeights: { ...request.objectiveWeights!, recipes: 5 } });
  expect(result.status).toBe('optimal');
  expectSingleVariants(result);
  expect(result.recipePlans.some(plan => plan.exactBuildingCount > 1)).toBe(true);
});

test('single variant overrides preserve explicit false and reject non-booleans', () => {
  const parsed = parseAdvancedSolveOverrides(updateObjectiveWeightsText('{}', { singleRecipeVariant: true }));
  expect(parsed.error).toBe('');
  expect(parsed.value.singleRecipeVariant).toBe(true);
  expect(mergeAdvancedSolveOverrides(parsed.value, { singleRecipeVariant: false }).singleRecipeVariant).toBe(false);
  expect(parseAdvancedSolveOverrides('{"singleRecipeVariant":1}').error).not.toBe('');
});
