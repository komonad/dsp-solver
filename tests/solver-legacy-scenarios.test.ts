import { loadResolvedCatalogFromFiles } from '../src/catalog';
import { solveCatalogRequest, type SolveResult } from '../src/solver';

const legacyRefineryDatasetPath = './data/LegacyRefinery.json';
const legacyRefineryDefaultsPath = './data/LegacyRefinery.defaults.json';
const legacyCycleDatasetPath = './data/LegacyCycle.json';
const legacyCycleDefaultsPath = './data/LegacyCycle.defaults.json';

function getPlan(result: SolveResult, recipeId: string) {
  return result.recipePlans.find(plan => plan.recipeId === recipeId);
}

function getExternalRate(result: SolveResult, itemId: string): number {
  return result.externalInputs.find(entry => entry.itemId === itemId)?.ratePerMin ?? 0;
}

function getSurplusRate(result: SolveResult, itemId: string): number {
  return result.surplusOutputs.find(entry => entry.itemId === itemId)?.ratePerMin ?? 0;
}

function getItemBalance(result: SolveResult, itemId: string) {
  const entry = result.itemBalance.find(balance => balance.itemId === itemId);
  if (!entry) {
    throw new Error(`Missing item balance entry for ${itemId}.`);
  }
  return entry;
}

test('legacy refinery scenario uses both refinery recipes to eliminate heavy-oil surplus', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    legacyRefineryDatasetPath,
    legacyRefineryDefaultsPath
  );
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1117', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(2);
  expect(getPlan(result, '1')).toMatchObject({
    recipeId: '1',
    buildingId: '2304',
    proliferatorMode: 'none',
  });
  expect(getPlan(result, '2')).toMatchObject({
    recipeId: '2',
    buildingId: '2304',
    proliferatorMode: 'none',
  });
  expect(getPlan(result, '1')?.runsPerMin).toBeCloseTo(20, 6);
  expect(getPlan(result, '2')?.runsPerMin).toBeCloseTo(20, 6);
  expect(result.externalInputs).toEqual([
    { itemId: '1007', ratePerMin: 20 },
    { itemId: '1120', ratePerMin: 60 },
  ]);
  expect(getItemBalance(result, '1116').netRatePerMin).toBeCloseTo(0, 6);
  expect(result.surplusOutputs).toEqual([]);
  expect(result.powerSummary.activePowerMW).toBeCloseTo(2, 6);
});

test.each([
  { targetItemId: '11005', targetName: 'fullersilver' },
  { targetItemId: '10003', targetName: 'fullerol' },
])(
  'legacy cycle scenario is infeasible with only the regular chemical plant for $targetName exports',
  async ({ targetItemId }) => {
    const catalog = await loadResolvedCatalogFromFiles(
      legacyCycleDatasetPath,
      legacyCycleDefaultsPath
    );
    const result = solveCatalogRequest(catalog, {
      targets: [{ itemId: targetItemId, ratePerMin: 60 }],
      objective: 'min_external_input',
      balancePolicy: 'allow_surplus',
      disabledBuildingIds: ['2313', '2314'],
    });

    expect(result.status).toBe('infeasible');
  }
);

test('legacy cycle scenario becomes feasible with the low-temperature chemical plant 25% intrinsic productivity', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    legacyCycleDatasetPath,
    legacyCycleDefaultsPath
  );
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '11005', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'allow_surplus',
    disabledBuildingIds: ['2309', '2314'],
    forcedBuildingByRecipe: {
      '90001': '2313',
      '90003': '2313',
      '90004': '2313',
    },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(3);
  expect(result.recipePlans.every(plan => plan.buildingId === '2313')).toBe(true);
  expect(result.targets).toEqual([
    { itemId: '11005', requestedRatePerMin: 60, actualRatePerMin: expect.any(Number) },
  ]);
  expect(result.targets[0].actualRatePerMin).toBeCloseTo(60, 6);
  expect(getPlan(result, '90001')?.runsPerMin).toBeCloseTo(192, 6);
  expect(getPlan(result, '90003')?.runsPerMin).toBeCloseTo(133.33333333, 6);
  expect(getPlan(result, '90004')?.runsPerMin).toBeCloseTo(106.66666667, 6);
  expect(getExternalRate(result, '10001')).toBeCloseTo(192, 6);
  expect(getExternalRate(result, '10002')).toBeCloseTo(106.66666667, 6);
  expect(getExternalRate(result, '12001')).toBeCloseTo(133.33333333, 6);
  expect(getSurplusRate(result, '11003')).toBeCloseTo(240, 6);
  expect(result.powerSummary.activePowerMW).toBeCloseTo(8.1, 6);
});

test.each([
  {
    targetItemId: '11005',
    targetName: 'fullersilver',
    expectedExternal: { gasCloud: 30, bioEthanol: 20, refinedSilver: 40 },
    expectedRuns: { gasSeparation: 30, fullersilver: 40, fullerol: 20 },
  },
  {
    targetItemId: '10003',
    targetName: 'fullerol',
    expectedExternal: { gasCloud: 30, bioEthanol: 40, refinedSilver: 20 },
    expectedRuns: { gasSeparation: 30, fullersilver: 20, fullerol: 40 },
  },
])(
  'legacy cycle scenario prefers the quantum chemical plant for $targetName exports',
  async ({ targetItemId, expectedExternal, expectedRuns }) => {
    const catalog = await loadResolvedCatalogFromFiles(
      legacyCycleDatasetPath,
      legacyCycleDefaultsPath
    );
    const result = solveCatalogRequest(catalog, {
      targets: [{ itemId: targetItemId, ratePerMin: 60 }],
      objective: 'min_external_input',
      balancePolicy: 'allow_surplus',
    });

    expect(result.status).toBe('optimal');
    expect(result.recipePlans).toHaveLength(3);
    expect(result.recipePlans.every(plan => plan.buildingId === '2314')).toBe(true);
    expect(result.targets[0].actualRatePerMin).toBeCloseTo(60, 6);
    expect(getPlan(result, '90001')?.runsPerMin).toBeCloseTo(expectedRuns.gasSeparation, 6);
    expect(getPlan(result, '90003')?.runsPerMin).toBeCloseTo(expectedRuns.fullersilver, 6);
    expect(getPlan(result, '90004')?.runsPerMin).toBeCloseTo(expectedRuns.fullerol, 6);
    expect(getExternalRate(result, '10001')).toBeCloseTo(expectedExternal.gasCloud, 6);
    expect(getExternalRate(result, '10002')).toBeCloseTo(expectedExternal.bioEthanol, 6);
    expect(getExternalRate(result, '12001')).toBeCloseTo(expectedExternal.refinedSilver, 6);
    expect(getSurplusRate(result, '11003')).toBeCloseTo(60, 6);
    expect(result.powerSummary.activePowerMW).toBeCloseTo(4.32, 6);
  }
);
