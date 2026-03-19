import { resolveCatalogModel, type CatalogDefaultConfigSpec, type VanillaDatasetSpec } from '../src/catalog';
import {
  buildWorkbenchCacheKey,
  clearWorkbenchCache,
  readActiveWorkbenchCacheSource,
  readWorkbenchDatasetDraft,
  readWorkbenchEditorState,
  sanitizeWorkbenchEditorState,
  writeActiveWorkbenchCacheSource,
  writeWorkbenchDatasetDraft,
  writeWorkbenchEditorState,
  type WorkbenchCacheSource,
  type WorkbenchDatasetDraft,
  type WorkbenchEditorState,
} from '../src/web/persistence';

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

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

test('workbench cache stores active dataset source and editor state per dataset key', () => {
  const storage = createMemoryStorage();
  const source: WorkbenchCacheSource = {
    presetId: 'demo-smelting',
    datasetPath: './DemoSmelting.json',
    defaultConfigPath: './DemoSmelting.defaults.json',
  };
  const editorState: WorkbenchEditorState = {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: 'auto',
    rawInputItemIds: ['1001'],
    disabledRawInputItemIds: [],
    disabledRecipeIds: ['1'],
    disabledBuildingIds: ['5001'],
    preferredRecipeByItem: { '1101': '1' },
    recipePreferences: [],
    recipeStrategyOverrides: [],
    advancedOverridesText: '{"preferredRecipeByItem":{"1101":"1"}}',
  };

  writeActiveWorkbenchCacheSource(storage, source);
  writeWorkbenchEditorState(storage, source, editorState);

  expect(readActiveWorkbenchCacheSource(storage)).toEqual(source);
  expect(readWorkbenchEditorState(storage, source)).toEqual(editorState);
  expect(buildWorkbenchCacheKey(source)).toBe(
    './DemoSmelting.json::./DemoSmelting.defaults.json'
  );
});

test('clearWorkbenchCache removes both active source and entries', () => {
  const storage = createMemoryStorage();
  const source: WorkbenchCacheSource = {
    presetId: 'demo-smelting',
    datasetPath: './DemoSmelting.json',
    defaultConfigPath: './DemoSmelting.defaults.json',
  };

  writeActiveWorkbenchCacheSource(storage, source);
  writeWorkbenchEditorState(storage, source, {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: 'auto',
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: [],
    preferredRecipeByItem: {},
    recipePreferences: [],
    recipeStrategyOverrides: [],
    advancedOverridesText: '',
  });

  clearWorkbenchCache(storage);

  expect(readActiveWorkbenchCacheSource(storage)).toBeNull();
  expect(readWorkbenchEditorState(storage, source)).toBeNull();
  expect(readWorkbenchDatasetDraft(storage, source)).toBeNull();
});

test('dataset drafts are stored per source key and cleared with the rest of the cache', () => {
  const storage = createMemoryStorage();
  const source: WorkbenchCacheSource = {
    presetId: 'demo-smelting',
    datasetPath: './DemoSmelting.json',
    defaultConfigPath: './DemoSmelting.defaults.json',
  };
  const draft: WorkbenchDatasetDraft = {
    datasetText: '{"items":[],"recipes":[]}',
    defaultConfigText: '{"recommendedRawItemIds":[1001]}',
  };

  writeWorkbenchDatasetDraft(storage, source, draft);
  expect(readWorkbenchDatasetDraft(storage, source)).toEqual(draft);

  clearWorkbenchCache(storage);
  expect(readWorkbenchDatasetDraft(storage, source)).toBeNull();
});

test('sanitizeWorkbenchEditorState drops references that do not exist in the loaded catalog', () => {
  const catalog = resolveCatalogModel(buildDemoDataset(), buildDemoDefaults());
  const sanitized = sanitizeWorkbenchEditorState(catalog, {
    targets: [
      { itemId: '1101', ratePerMin: 60 },
      { itemId: '9999', ratePerMin: 90 },
    ],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: 'disable_all',
    rawInputItemIds: ['1001', '9999'],
    disabledRawInputItemIds: ['1001', '9999'],
    disabledRecipeIds: ['1', '9999'],
    disabledBuildingIds: ['5001', '9999'],
    preferredRecipeByItem: {
      '1101': '1',
      '9999': '1',
      '1001': '1',
    },
    recipePreferences: [
      {
        recipeId: '1',
        preferredBuildingId: '9999',
        preferredProliferatorMode: 'speed',
        preferredProliferatorLevel: 3,
      },
      {
        recipeId: '9999',
        preferredBuildingId: '5001',
        preferredProliferatorMode: '',
        preferredProliferatorLevel: '',
      },
    ],
    recipeStrategyOverrides: [
      {
        recipeId: '1',
        forcedBuildingId: '9999',
        forcedProliferatorMode: 'speed',
        forcedProliferatorLevel: 3,
      },
      {
        recipeId: '9999',
        forcedBuildingId: '5001',
        forcedProliferatorMode: '',
        forcedProliferatorLevel: '',
      },
    ],
    advancedOverridesText: '{}',
  });

  expect(sanitized).toEqual({
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: 'disable_all',
    rawInputItemIds: ['1001'],
    disabledRawInputItemIds: ['1001'],
    disabledRecipeIds: ['1'],
    disabledBuildingIds: ['5001'],
    preferredRecipeByItem: { '1101': '1' },
    recipePreferences: [
      {
        recipeId: '1',
        preferredBuildingId: '',
        preferredProliferatorMode: '',
        preferredProliferatorLevel: '',
      },
    ],
    recipeStrategyOverrides: [],
    advancedOverridesText: '{}',
  });
});
