import {
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import { solveCatalogRequest, type SolveResult } from '../src/solver';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildLegacyRefineryDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1007, Type: 1, Name: 'Crude Oil', IconName: 'oil', GridIndex: 1 },
      { ID: 1120, Type: 2, Name: 'Hydrogen', IconName: 'hydrogen', GridIndex: 2 },
      { ID: 1117, Type: 2, Name: 'Light Oil', IconName: 'light-oil', GridIndex: 3 },
      { ID: 1116, Type: 2, Name: 'Heavy Oil', IconName: 'heavy-oil', GridIndex: 4 },
      {
        ID: 2304,
        Type: 6,
        Name: 'Refinery',
        IconName: 'refinery',
        GridIndex: 5,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [2304],
        Name: 'Crude Oil Cracking',
        Items: [1007, 1120],
        ItemCounts: [1, 1],
        Results: [1117, 1116],
        ResultCounts: [2, 1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'refining-1',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [2304],
        Name: 'Heavy Oil Refining',
        Items: [1116, 1120],
        ItemCounts: [1, 2],
        Results: [1117],
        ResultCounts: [1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'refining-2',
      },
    ],
  };
}

function buildLegacyRefineryDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [{ ID: 2304, Category: 'refinery' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemIds: [1007, 1120],
  };
}

function buildLegacyCycleDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 10001, Type: 1, Name: 'Gas Cloud', IconName: 'gas-cloud', GridIndex: 1 },
      { ID: 10002, Type: 1, Name: 'Bio Ethanol', IconName: 'bio-ethanol', GridIndex: 2 },
      { ID: 10003, Type: 2, Name: 'Fullerol', IconName: 'fullerol', GridIndex: 3 },
      { ID: 11001, Type: 2, Name: 'Graphene', IconName: 'graphene', GridIndex: 4 },
      { ID: 11002, Type: 2, Name: 'Hydrogen', IconName: 'hydrogen', GridIndex: 5 },
      { ID: 11003, Type: 2, Name: 'Methane', IconName: 'methane', GridIndex: 6 },
      { ID: 11004, Type: 2, Name: 'Fullerene', IconName: 'fullerene', GridIndex: 7 },
      { ID: 11005, Type: 2, Name: 'Fullersilver', IconName: 'fullersilver', GridIndex: 8 },
      { ID: 12001, Type: 1, Name: 'Refined Silver', IconName: 'refined-silver', GridIndex: 9 },
      {
        ID: 2309,
        Type: 6,
        Name: 'Chemical Plant',
        IconName: 'chemical-plant',
        GridIndex: 10,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
      {
        ID: 2313,
        Type: 6,
        Name: 'Low Temperature Chemical Plant',
        IconName: 'low-temp-chemical-plant',
        GridIndex: 11,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(0.9),
      },
      {
        ID: 2314,
        Type: 6,
        Name: 'Quantum Chemical Plant',
        IconName: 'quantum-chemical-plant',
        GridIndex: 12,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1.44),
      },
    ],
    recipes: [
      {
        ID: 90001,
        Type: 1,
        Factories: [2309, 2313, 2314],
        Name: 'Gas Cloud Separation',
        Items: [10001],
        ItemCounts: [1],
        Results: [11003, 11004],
        ResultCounts: [1, 1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'gas-separation',
      },
      {
        ID: 90002,
        Type: 1,
        Factories: [2309, 2313, 2314],
        Name: 'Methane Cracking',
        Items: [11003],
        ItemCounts: [1],
        Results: [11001, 11002],
        ResultCounts: [1, 1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'methane-cracking',
      },
      {
        ID: 90003,
        Type: 1,
        Factories: [2309, 2313, 2314],
        Name: 'Fullersilver Synthesis',
        Items: [10003, 12001, 11004],
        ItemCounts: [1, 1, 1],
        Results: [11005],
        ResultCounts: [1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'fullersilver',
      },
      {
        ID: 90004,
        Type: 1,
        Factories: [2309, 2313, 2314],
        Name: 'Fullerol Synthesis',
        Items: [11005, 10002, 11004],
        ItemCounts: [1, 1, 1],
        Results: [10003],
        ResultCounts: [1],
        TimeSpend: 3600,
        Proliferator: 0,
        IconName: 'fullerol',
      },
    ],
  };
}

function buildLegacyCycleDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [
      { ID: 2309, Category: 'chemical' },
      { ID: 2313, Category: 'chemical', IntrinsicProductivityBonus: 0.25 },
      { ID: 2314, Category: 'chemical', IntrinsicProductivityBonus: 1 },
    ],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemIds: [10001, 10002, 12001],
  };
}

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

test('legacy refinery scenario uses both refinery recipes to eliminate heavy-oil surplus', () => {
  const catalog = resolveCatalogModel(buildLegacyRefineryDataset(), buildLegacyRefineryDefaults());
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
  expect(result.powerSummary.activePowerMW).toBeCloseTo(40, 6);
});

test.each([
  { targetItemId: '11005', targetName: 'fullersilver' },
  { targetItemId: '10003', targetName: 'fullerol' },
])(
  'legacy cycle scenario is infeasible with only the regular chemical plant for $targetName exports',
  ({ targetItemId }) => {
    const catalog = resolveCatalogModel(buildLegacyCycleDataset(), buildLegacyCycleDefaults());
    const result = solveCatalogRequest(catalog, {
      targets: [{ itemId: targetItemId, ratePerMin: 60 }],
      objective: 'min_external_input',
      balancePolicy: 'allow_surplus',
      disabledBuildingIds: ['2313', '2314'],
    });

    expect(result.status).toBe('infeasible');
  }
);

test('legacy cycle scenario becomes feasible with the low-temperature chemical plant 25% intrinsic productivity', () => {
  const catalog = resolveCatalogModel(buildLegacyCycleDataset(), buildLegacyCycleDefaults());
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
  expect(result.powerSummary.activePowerMW).toBeCloseTo(389.7, 6);
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
  ({ targetItemId, expectedExternal, expectedRuns }) => {
    const catalog = resolveCatalogModel(buildLegacyCycleDataset(), buildLegacyCycleDefaults());
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
    expect(result.powerSummary.activePowerMW).toBeCloseTo(129.6, 6);
  }
);
