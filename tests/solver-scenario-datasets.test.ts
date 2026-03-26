import { loadResolvedCatalogFromFiles } from '../src/catalog';
import { solveCatalogRequest, type SolveResult } from '../src/solver';

const refineryBalanceDatasetPath = './tests/fixtures/scenarios/RefineryBalance.json';
const refineryBalanceDefaultsPath = './tests/fixtures/scenarios/RefineryBalance.defaults.json';
const fullereneLoopDatasetPath = './tests/fixtures/scenarios/FullereneLoop.json';
const fullereneLoopDefaultsPath = './tests/fixtures/scenarios/FullereneLoop.defaults.json';
const orbitalRingDatasetPath = './data/OrbitalRing.json';
const orbitalRingDefaultsPath = './data/OrbitalRing.defaults.json';

function getPlan(result: SolveResult, recipeId: string) {
  return result.recipePlans.find(plan => plan.recipeId === recipeId);
}

function getExternalRate(result: SolveResult, itemId: string): number {
  return result.externalInputs.find(entry => entry.itemId === itemId)?.ratePerMin ?? 0;
}

function getItemBalance(result: SolveResult, itemId: string) {
  const entry = result.itemBalance.find(balance => balance.itemId === itemId);
  if (!entry) {
    throw new Error(`Missing item balance entry for ${itemId}.`);
  }
  return entry;
}

test('refinery balance scenario uses both refinery recipes to eliminate heavy-oil surplus', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    refineryBalanceDatasetPath,
    refineryBalanceDefaultsPath
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
  'fullerene loop scenario is infeasible with only the regular chemical plant for $targetName exports',
  async ({ targetItemId }) => {
    const catalog = await loadResolvedCatalogFromFiles(
      fullereneLoopDatasetPath,
      fullereneLoopDefaultsPath
    );
    const result = solveCatalogRequest(catalog, {
      targets: [{ itemId: targetItemId, ratePerMin: 60 }],
      objective: 'min_external_input',
      balancePolicy: 'force_balance',
      disabledBuildingIds: ['2313', '2314'],
    });

    expect(result.status).toBe('infeasible');
  }
);

test('fullerene loop force-balance uses the regular plant for the methane loop and quantum plant for export recipes', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    fullereneLoopDatasetPath,
    fullereneLoopDefaultsPath
  );
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '11005', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(4);
  expect(getPlan(result, '90001')).toMatchObject({ buildingId: '2309' });
  expect(getPlan(result, '90002')).toMatchObject({ buildingId: '2309' });
  expect(getPlan(result, '90003')).toMatchObject({ buildingId: '2314' });
  expect(getPlan(result, '90004')).toMatchObject({ buildingId: '2314' });
  expect(getPlan(result, '90001')?.runsPerMin).toBeCloseTo(60, 6);
  expect(getPlan(result, '90002')?.runsPerMin).toBeCloseTo(60, 6);
  expect(getPlan(result, '90003')?.runsPerMin).toBeCloseTo(40, 6);
  expect(getPlan(result, '90004')?.runsPerMin).toBeCloseTo(20, 6);
  expect(getExternalRate(result, '10001')).toBeCloseTo(60, 6);
  expect(getExternalRate(result, '10002')).toBeCloseTo(20, 6);
  expect(getExternalRate(result, '12001')).toBeCloseTo(40, 6);
  expect(result.surplusOutputs).toEqual([]);
  expect(result.powerSummary.activePowerMW).toBeCloseTo(4.88, 6);
});

test('fullerene loop remains feasible with the low-temperature plant on the export cycle while the methane loop stays on the regular plant', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    fullereneLoopDatasetPath,
    fullereneLoopDefaultsPath
  );
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '11005', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    forcedBuildingByRecipe: {
      '90001': '2309',
      '90002': '2309',
      '90003': '2313',
      '90004': '2313',
    },
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(4);
  expect(getPlan(result, '90001')).toMatchObject({ buildingId: '2309' });
  expect(getPlan(result, '90002')).toMatchObject({ buildingId: '2309' });
  expect(getPlan(result, '90003')).toMatchObject({ buildingId: '2313' });
  expect(getPlan(result, '90004')).toMatchObject({ buildingId: '2313' });
  expect(getPlan(result, '90001')?.runsPerMin).toBeCloseTo(240, 6);
  expect(getPlan(result, '90002')?.runsPerMin).toBeCloseTo(240, 6);
  expect(getPlan(result, '90003')?.runsPerMin).toBeCloseTo(133.33333333, 6);
  expect(getPlan(result, '90004')?.runsPerMin).toBeCloseTo(106.66666667, 6);
  expect(getExternalRate(result, '10001')).toBeCloseTo(240, 6);
  expect(getExternalRate(result, '10002')).toBeCloseTo(106.66666667, 6);
  expect(getExternalRate(result, '12001')).toBeCloseTo(133.33333333, 6);
});

test('orbitalring fullersilver-embedded recipe chain is feasible when dataset defaults disable probabilistic super-refining', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    orbitalRingDatasetPath,
    orbitalRingDefaultsPath
  );
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '6522', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    disabledRecipeIds: catalog.recommendedDisabledRecipeIds,
  });

  expect(result.status).toBe('optimal');
  expect(getPlan(result, '510')).toBeUndefined();
  expect(getPlan(result, '716')).toMatchObject({
    buildingId: '2317',
    proliferatorMode: 'productivity',
    proliferatorLevel: 3,
  });
  expect(getPlan(result, '717')).toMatchObject({
    buildingId: '2317',
    proliferatorMode: 'productivity',
    proliferatorLevel: 3,
  });
  expect(getPlan(result, '716')?.runsPerMin).toBeGreaterThan(0);
  expect(getPlan(result, '717')?.runsPerMin).toBeGreaterThan(0);
  expect(getExternalRate(result, '6519')).toBeGreaterThan(0);
  expect(getExternalRate(result, '7015')).toBeGreaterThan(0);
  expect(getExternalRate(result, '7101')).toBeGreaterThan(0);
  expect(result.surplusOutputs).toEqual([]);
});

test('orbitalring auto-promotes an infeasible constrained proliferator intermediate when allowed', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    orbitalRingDatasetPath,
    orbitalRingDefaultsPath
  );
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1143', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    disabledRecipeIds: catalog.recommendedDisabledRecipeIds,
    allowedRecipesByItem: {
      '1143': ['715'],
      '6522': ['510'],
    },
  });

  expect(result.status).toBe('optimal');
  expect(getPlan(result, '510')).toBeUndefined();
  expect(getExternalRate(result, '6522')).toBeGreaterThan(0);
  expect(
    result.diagnostics.infoMessages.some(message => message.includes('6522'))
  ).toBe(true);
});

test('orbitalring can still enforce the fullerol proliferator recipe when pure silver is solved internally', async () => {
  const catalog = await loadResolvedCatalogFromFiles(
    orbitalRingDatasetPath,
    orbitalRingDefaultsPath
  );
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '1143', ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    disabledRecipeIds: catalog.recommendedDisabledRecipeIds,
    disabledRawInputItemIds: ['7101'],
    allowedRecipesByItem: {
      '1143': ['715'],
    },
  });

  expect(result.status).toBe('optimal');
  expect(getPlan(result, '715')).toBeDefined();
  expect(getPlan(result, '108')).toBeUndefined();
  expect(getExternalRate(result, '1116')).toBeGreaterThan(0);
});
