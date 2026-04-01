import { resolveCatalogModel, type CatalogDefaultConfigSpec, type VanillaDatasetSpec } from '../src/catalog';
import { getLocaleBundle } from '../src/i18n';
import { buildWorkbenchConfigDisplayModel } from '../src/web/app/workbenchHelpers';
import type { WorkbenchPersistedConfig } from '../src/web/workbench/persistence';

const bundle = getLocaleBundle('zh-CN');

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildDemoDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Smelter',
        IconName: 'smelter',
        GridIndex: 3,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Ore to Plate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'plate',
      },
    ],
  };
}

function buildDemoDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };
}

test('buildWorkbenchConfigDisplayModel prefers custom names and summarizes solved results', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());

  const config: WorkbenchPersistedConfig = {
    id: 'cfg-1',
    name: 'My Plan',
    editorState: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_power',
      balancePolicy: 'allow_surplus',
      autoPromoteUnavailableItemsToRawInputs: true,
      proliferatorPolicy: 'auto',
      rawInputItemIds: [],
      disabledRawInputItemIds: [],
      disabledRecipeIds: [],
      disabledBuildingIds: [],
      allowedRecipesByItem: {},
      recipePreferences: [],
      recipeStrategyOverrides: [],
      preferredBuildings: [],
      advancedOverridesText: '',
    },
  };

  const display = buildWorkbenchConfigDisplayModel(
    config,
    {
      result: {
        status: 'optimal',
        diagnostics: { messages: [], unmetPreferences: [], infoMessages: [] },
        resolvedRawInputItemIds: ['1001'],
        targets: [{ itemId: '1101', requestedRatePerMin: 60, actualRatePerMin: 60 }],
        externalInputs: [{ itemId: '1001', ratePerMin: 60 }],
        recipePlans: [
          {
            recipeId: '1',
            buildingId: '5001',
            proliferatorMode: 'none',
            proliferatorLevel: 0,
            runsPerMin: 60,
            exactBuildingCount: 1,
            roundedUpBuildingCount: 1,
            activePowerMW: 1,
            roundedPlacementPowerMW: 1,
            inputs: [{ itemId: '1001', ratePerMin: 60 }],
            outputs: [{ itemId: '1101', ratePerMin: 60 }],
          },
        ],
        buildingSummary: [
          {
            buildingId: '5001',
            exactCount: 1,
            roundedUpCount: 1,
            activePowerMW: 1,
            roundedPlacementPowerMW: 1,
          },
        ],
        powerSummary: {
          activePowerMW: 1,
          roundedPlacementPowerMW: 1,
        },
        itemBalance: [],
        surplusOutputs: [],
      },
      error: '',
      activityStatus: 'settled',
    },
    { sourceKey: 'test' },
    { catalog, locale: 'zh-CN', bundle }
  );

  expect(display).toMatchObject({
    id: 'cfg-1',
    title: 'My Plan',
    customName: 'My Plan',
    hasCustomName: true,
    targetSummary: `Plate 60/\u5206`,
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
    status: 'optimal',
    recipePlanCount: 1,
    roundedBuildingCount: 1,
  });
  expect(display.powerLabel).toBe('1.00 MW');
});

test('buildWorkbenchConfigDisplayModel falls back to target summary and running status', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());

  const config: WorkbenchPersistedConfig = {
    id: 'cfg-2',
    editorState: {
      targets: [{ itemId: '1101', ratePerMin: 90 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      autoPromoteUnavailableItemsToRawInputs: true,
      proliferatorPolicy: 'auto',
      rawInputItemIds: [],
      disabledRawInputItemIds: [],
      disabledRecipeIds: [],
      disabledBuildingIds: [],
      allowedRecipesByItem: {},
      recipePreferences: [],
      recipeStrategyOverrides: [],
      preferredBuildings: [],
      advancedOverridesText: '',
    },
  };

  const display = buildWorkbenchConfigDisplayModel(
    config,
    {
      result: null,
      error: '',
      activity: {
        status: 'running',
        staleResult: false,
        stage: 'solving_primary',
      },
    },
    { sourceKey: 'test' },
    { catalog, locale: 'zh-CN', bundle }
  );

  expect(display.title).toBe(`Plate 90/\u5206`);
  expect(display.targetSummary).toBe(`Plate 90/\u5206`);
  expect(display.status).toBe('running');
  expect(display.recipePlanCount).toBeNull();
  expect(display.roundedBuildingCount).toBeNull();
  expect(display.powerLabel).toBeNull();
});
