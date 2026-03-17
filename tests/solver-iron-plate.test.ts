import { loadResolvedCatalogFromFiles } from '../src/catalog';
import { solveCatalogRequest } from '../src/solver';

const vanillaDatasetPath = './data/Vanilla.json';
const vanillaDefaultConfigPath = './data/Vanilla.defaults.json';
const ironPlateItemId = '1101';
const ironPlateRecipeId = '1';

test.each([
  {
    ratePerMin: 60,
    preferredBuildingId: '2302',
    expectedBuildingId: '2302',
    expectedExactBuildingCount: 1,
    expectedRoundedBuildingCount: 1,
    expectedPowerMW: 0.36,
  },
  {
    ratePerMin: 300,
    preferredBuildingId: '2315',
    expectedBuildingId: '2315',
    expectedExactBuildingCount: 2.5,
    expectedRoundedBuildingCount: 3,
    expectedPowerMW: 4.32,
  },
  {
    ratePerMin: 540,
    preferredBuildingId: '2319',
    expectedBuildingId: '2319',
    expectedExactBuildingCount: 3,
    expectedRoundedBuildingCount: 3,
    expectedPowerMW: 8.64,
  },
])(
  'solveCatalogRequest respects building preference for $ratePerMin iron plate per minute',
  async ({
    ratePerMin,
    preferredBuildingId,
    expectedBuildingId,
    expectedExactBuildingCount,
    expectedRoundedBuildingCount,
    expectedPowerMW,
  }) => {
    const catalog = await loadResolvedCatalogFromFiles(vanillaDatasetPath, vanillaDefaultConfigPath);
    const result = solveCatalogRequest(catalog, {
      targets: [{ itemId: ironPlateItemId, ratePerMin }],
      objective: 'min_external_input',
      balancePolicy: 'force_balance',
      disabledRecipeIds: catalog.syntheticRecipeIds,
      forcedProliferatorModeByRecipe: {
        [ironPlateRecipeId]: 'none',
      },
      forcedProliferatorLevelByRecipe: {
        [ironPlateRecipeId]: 0,
      },
      preferredBuildingByRecipe: {
        [ironPlateRecipeId]: preferredBuildingId,
      },
    });

    expect(result.status).toBe('optimal');
    expect(result.diagnostics.unmetPreferences).toEqual([]);
    expect(result.recipePlans).toHaveLength(1);
    expect(result.buildingSummary).toHaveLength(1);

    const recipePlan = result.recipePlans[0];
    const buildingSummary = result.buildingSummary[0];

    expect(recipePlan.recipeId).toBe(ironPlateRecipeId);
    expect(recipePlan.buildingId).toBe(expectedBuildingId);
    expect(recipePlan.runsPerMin).toBe(ratePerMin);
    expect(recipePlan.exactBuildingCount).toBeCloseTo(expectedExactBuildingCount, 6);
    expect(recipePlan.roundedUpBuildingCount).toBe(expectedRoundedBuildingCount);
    expect(recipePlan.activePowerMW).toBeCloseTo(expectedPowerMW, 6);
    expect(recipePlan.roundedPlacementPowerMW).toBeCloseTo(expectedPowerMW, 6);
    expect(recipePlan.inputs).toEqual([{ itemId: '1001', ratePerMin: ratePerMin }]);
    expect(recipePlan.outputs).toEqual([{ itemId: ironPlateItemId, ratePerMin: ratePerMin }]);

    expect(buildingSummary.buildingId).toBe(expectedBuildingId);
    expect(buildingSummary.exactCount).toBeCloseTo(expectedExactBuildingCount, 6);
    expect(buildingSummary.roundedUpCount).toBe(expectedRoundedBuildingCount);
    expect(buildingSummary.activePowerMW).toBeCloseTo(expectedPowerMW, 6);
    expect(buildingSummary.roundedPlacementPowerMW).toBeCloseTo(expectedPowerMW, 6);

    expect(result.powerSummary.activePowerMW).toBeCloseTo(expectedPowerMW, 6);
    expect(result.powerSummary.roundedPlacementPowerMW).toBeCloseTo(expectedPowerMW, 6);
    expect(result.externalInputs).toEqual([{ itemId: '1001', ratePerMin: ratePerMin }]);
    expect(result.surplusOutputs).toEqual([]);

    expect(result.targets).toEqual([
      {
        itemId: ironPlateItemId,
        requestedRatePerMin: ratePerMin,
        actualRatePerMin: ratePerMin,
      },
    ]);

    expect(result.itemBalance).toEqual([
      {
        itemId: '1001',
        producedRatePerMin: ratePerMin,
        consumedRatePerMin: ratePerMin,
        netRatePerMin: 0,
      },
      {
        itemId: ironPlateItemId,
        producedRatePerMin: ratePerMin,
        consumedRatePerMin: ratePerMin,
        netRatePerMin: 0,
      },
    ]);
  }
);

test('solveCatalogRequest uses external input directly when iron plate is marked as raw input', async () => {
  const catalog = await loadResolvedCatalogFromFiles(vanillaDatasetPath, vanillaDefaultConfigPath);
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: ironPlateItemId, ratePerMin: 60 }],
    objective: 'min_external_input',
    balancePolicy: 'force_balance',
    disabledRecipeIds: catalog.syntheticRecipeIds,
    forcedProliferatorModeByRecipe: {
      [ironPlateRecipeId]: 'none',
    },
    forcedProliferatorLevelByRecipe: {
      [ironPlateRecipeId]: 0,
    },
    rawInputItemIds: [ironPlateItemId],
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toEqual([]);
  expect(result.buildingSummary).toEqual([]);
  expect(result.powerSummary).toEqual({
    activePowerMW: 0,
    roundedPlacementPowerMW: 0,
  });
  expect(result.externalInputs).toEqual([{ itemId: ironPlateItemId, ratePerMin: 60 }]);
  expect(result.surplusOutputs).toEqual([]);
  expect(result.targets).toEqual([
    {
      itemId: ironPlateItemId,
      requestedRatePerMin: 60,
      actualRatePerMin: 60,
    },
  ]);
  expect(result.itemBalance).toEqual([
    {
      itemId: ironPlateItemId,
      producedRatePerMin: 60,
      consumedRatePerMin: 60,
      netRatePerMin: 0,
    },
  ]);
});
