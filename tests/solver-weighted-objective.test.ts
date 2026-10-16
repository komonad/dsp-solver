import { resolveCatalogModel, type VanillaDatasetSpec } from '../src/catalog';
import { solveCatalogRequestAsync, type SolveRequest } from '../src/solver';
import { parseAdvancedSolveOverrides, mergeAdvancedSolveOverrides } from '../src/web/workbench/requestBuilder';
import { updateObjectiveWeightsText } from '../src/web/workbench/objectiveWeights';
import { deriveResourceScarcityWeights } from '../src/solver/resourceScarcity';
import { readFileSync } from 'fs';

function catalog() {
  const data: VanillaDatasetSpec = {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore A', IconName: 'a' },
      { ID: 1002, Type: 1, Name: 'Ore B', IconName: 'b' },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'p' },
      { ID: 5001, Type: 6, Name: 'Large', IconName: 'l', Speed: 1, Space: 10, WorkEnergyPerTick: 0 },
      { ID: 5002, Type: 6, Name: 'Small', IconName: 's', Speed: 1, Space: 1, WorkEnergyPerTick: 0 },
    ],
    recipes: [1001, 1002].map((id, index) => ({
      ID: index + 1, Type: 1, Name: `Recipe ${index}`, IconName: 'p',
      Factories: [5001 + index], Items: [id], ItemCounts: [1],
      Results: [1101], ResultCounts: [1], TimeSpend: 60, Proliferator: 0,
    })),
  };
  return resolveCatalogModel(data, { recommendedRawItemTypeIds: [1] });
}

const request: SolveRequest = {
  targets: [{ itemId: '1101', ratePerMin: 60 }],
  objective: 'min_weighted', balancePolicy: 'force_balance',
  inputWeights: { '1001': 1, '1002': 5 }, footprintWeight: 0,
};

test('HiGHS trades input scarcity against placement area in consistent units', async () => {
  const c = catalog();
  const cheap = await solveCatalogRequestAsync(c, request);
  expect(cheap.status).toBe('optimal');
  expect(cheap.recipePlans.map(p => p.recipeId)).toEqual(['1']);
  expect(cheap.objectiveCost).toMatchObject({ weightedInputCost: 60, placementArea: 10, footprintCost: 0, total: 60 });
  const compact = await solveCatalogRequestAsync(c, { ...request, footprintWeight: 100 });
  expect(compact.status).toBe('optimal');
  expect(compact.recipePlans.map(p => p.recipeId)).toEqual(['2']);
  expect(compact.objectiveCost).toMatchObject({ weightedInputCost: 300, placementArea: 1, footprintCost: 100, total: 400 });
  const resourcesFirst = await solveCatalogRequestAsync(c, { ...request, resourceWeight: 100, footprintWeight: 1 });
  expect(resourcesFirst.recipePlans.map(p => p.recipeId)).toEqual(['1']);
  const areaOnly = await solveCatalogRequestAsync(c, { ...request, resourceWeight: 0, footprintWeight: 1 });
  expect(areaOnly.recipePlans.map(p => p.recipeId)).toEqual(['2']);
  const scarce = await solveCatalogRequestAsync(c, { ...request, inputWeights: { '1001': 10 } });
  expect(scarce.recipePlans.map(p => p.recipeId)).toEqual(['2']);
  expect(scarce.itemBalance.every(item => Math.abs(item.netRatePerMin) < 1e-6)).toBe(true);
});

test.each(['force_balance', 'allow_surplus'] as const)('weighted input-only objective supports free inputs with %s', async balancePolicy => {
  const result = await solveCatalogRequestAsync(catalog(), {
    ...request, objective: 'min_external_input', balancePolicy, inputWeights: { '1002': 0 },
  });
  expect(result.status).toBe('optimal');
  expect(result.externalInputs.find(i => i.itemId === '1002')?.ratePerMin).toBeCloseTo(60);
});

test('surplus refinement preserves weighted primary cost within numerical tolerance', async () => {
  const result = await solveCatalogRequestAsync(catalog(), { ...request, balancePolicy: 'allow_surplus' });
  expect(result.status).toBe('optimal');
  expect(result.objectiveCost?.total).toBeCloseTo(60, 4);
});

test.each([NaN, Infinity, -1])('invalid cost %s is rejected', async cost => {
  expect((await solveCatalogRequestAsync(catalog(), { ...request, footprintWeight: cost })).status).toBe('invalid_input');
  expect((await solveCatalogRequestAsync(catalog(), { ...request, inputWeights: { '1001': cost } })).status).toBe('invalid_input');
});

test('unknown weighted item is rejected', async () => {
  expect((await solveCatalogRequestAsync(catalog(), { ...request, inputWeights: { missing: 1 } })).status).toBe('invalid_input');
});

test('zero objective weights are rejected', async () => {
  expect((await solveCatalogRequestAsync(catalog(), { ...request, resourceWeight: 0, footprintWeight: 0 })).status).toBe('invalid_input');
});

test('sampling pools solid amounts and normalizes scarcity to iron without inventing missing resources', () => {
  const sample = { schemaVersion: 1, starCount: 64, resourceMultiplier: 1, samples: [
    { seed: 1, starCount: 64, solidPlanetCount: 1, amounts: { '1001': 100, '1016': 2 } },
    { seed: 2, starCount: 64, solidPlanetCount: 1, amounts: { '1001': 100, '1016': 0 } },
  ] };
  expect(deriveResourceScarcityWeights(sample)).toEqual({ '1001': 1, '1016': 100 });
  expect(deriveResourceScarcityWeights({ ...sample, renewableItemIds: [1016] })).toEqual({ '1001': 1, '1016': 0 });
  expect(() => deriveResourceScarcityWeights({ ...sample, samples: [sample.samples[0], sample.samples[0]] })).toThrow();
  expect(() => deriveResourceScarcityWeights({ ...sample, samples: [] })).toThrow();
});

test('weight editing preserves other advanced settings and survives request merging', () => {
  const text = updateObjectiveWeightsText('{"disabledRecipeIds":["3"]}', { inputWeights: { '1001': 0 }, footprintWeight: 5, resourceWeight: 7 });
  const parsed = parseAdvancedSolveOverrides(text);
  expect(parsed.error).toBe('');
  expect(mergeAdvancedSolveOverrides(parsed.value, {})).toMatchObject({
    disabledRecipeIds: ['3'], inputWeights: { '1001': 0 }, footprintWeight: 5, resourceWeight: 7,
  });
  expect(() => updateObjectiveWeightsText('{', {})).toThrow();
});

test.each(['Vanilla', 'OrbitalRing'])('%s bundled resource samples have finite costs and preserve renewable sources', name => {
  const samples = JSON.parse(readFileSync(`data/${name}.resource-samples.json`, 'utf8'));
  const weights = deriveResourceScarcityWeights(samples);
  const data = JSON.parse(readFileSync(`data/${name}.json`, 'utf8').replace(/^\uFEFF/, ''));
  expect(samples.samples).toHaveLength(3);
  expect(weights['1001']).toBe(1);
  expect(weights['1016']).toBeGreaterThan(1);
  expect(weights['1000']).toBe(0);
  for (const id of samples.renewableItemIds) expect(weights[String(id)]).toBe(0);
  for (const id of Object.keys(weights)) expect(data.items.some((item: { ID: number }) => String(item.ID) === id)).toBe(true);
});
