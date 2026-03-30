import {
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import { buildWorkbenchSnapshotSolveRequest } from '../src/web/app/workbenchSnapshotRequest';
import type { WorkbenchEditorState } from '../src/web/workbench/persistence';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildCatalog() {
  const dataset: VanillaDatasetSpec = {
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
  const defaults: CatalogDefaultConfigSpec = {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };

  return resolveCatalogModel(dataset, defaults);
}

test('buildWorkbenchSnapshotSolveRequest derives a snapshot request directly from editor state', () => {
  const catalog = buildCatalog();
  const editorState: WorkbenchEditorState = {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: 'none',
    globalProliferatorLevel: '',
    rawInputItemIds: ['1001'],
    disabledRawInputItemIds: ['1002'],
    disabledRecipeIds: ['9'],
    disabledBuildingIds: ['5002'],
    allowedRecipesByItem: { '1101': ['1'] },
    recipePreferences: [],
    recipeStrategyOverrides: [],
    preferredBuildings: [],
    advancedOverridesText: '',
  };

  expect(
    buildWorkbenchSnapshotSolveRequest({
      catalog,
      editorState,
    })
  ).toEqual({
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
    autoPromoteUnavailableItemsToRawInputs: true,
    rawInputItemIds: ['1001'],
    disabledRawInputItemIds: ['1002'],
    disabledRecipeIds: ['9'],
    disabledBuildingIds: ['5002'],
    allowedRecipesByItem: { '1101': ['1'] },
    globalForcedProliferatorLevel: 0,
    globalForcedProliferatorMode: 'none',
  });
});
