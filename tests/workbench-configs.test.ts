import {
  createWorkbenchConfig,
  deleteWorkbenchConfig,
  forkWorkbenchConfig,
  syncActiveWorkbenchConfigCollection,
} from '../src/web/workbench/configs';
import type { WorkbenchEditorState } from '../src/web/workbench/persistence';

function buildEditorState(ratePerMin: number): WorkbenchEditorState {
  return {
    targets: [{ itemId: '1101', ratePerMin }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    autoPromoteUnavailableItemsToRawInputs: true,
    proliferatorPolicy: 'auto',
    globalProliferatorLevel: '',
    rawInputItemIds: [],
    disabledRawInputItemIds: [],
    disabledRecipeIds: [],
    disabledBuildingIds: [],
    allowedRecipesByItem: {},
    recipePreferences: [],
    recipeStrategyOverrides: [],
    preferredBuildings: [],
    advancedOverridesText: '',
  };
}

test('createWorkbenchConfig appends a fresh default-state config and activates it', () => {
  const collection = createWorkbenchConfig(
    {
      activeConfigId: 'cfg-a',
      configs: [
        {
          id: 'cfg-a',
          editorState: buildEditorState(60),
        },
      ],
    },
    {
      editorState: buildEditorState(90),
    }
  );

  expect(collection.configs).toHaveLength(2);
  expect(collection.activeConfigId).toBe(collection.configs[1]?.id);
  expect(collection.configs[1]?.editorState.targets).toEqual([
    { itemId: '1101', ratePerMin: 90 },
  ]);
});

test('deleteWorkbenchConfig switches to a remaining neighbor when deleting the active config', () => {
  const collection = deleteWorkbenchConfig(
    {
      activeConfigId: 'cfg-b',
      configs: [
        {
          id: 'cfg-a',
          editorState: buildEditorState(60),
        },
        {
          id: 'cfg-b',
          editorState: buildEditorState(90),
        },
        {
          id: 'cfg-c',
          editorState: buildEditorState(120),
        },
      ],
    },
    'cfg-b',
    buildEditorState(30)
  );

  expect(collection.configs.map(config => config.id)).toEqual(['cfg-a', 'cfg-c']);
  expect(collection.activeConfigId).toBe('cfg-c');
});

test('deleteWorkbenchConfig recreates a default config when removing the last one', () => {
  const collection = deleteWorkbenchConfig(
    {
      activeConfigId: 'cfg-a',
      configs: [
        {
          id: 'cfg-a',
          editorState: buildEditorState(60),
        },
      ],
    },
    'cfg-a',
    buildEditorState(45)
  );

  expect(collection.configs).toHaveLength(1);
  expect(collection.activeConfigId).toBe(collection.configs[0]?.id);
  expect(collection.configs[0]?.editorState.targets).toEqual([
    { itemId: '1101', ratePerMin: 45 },
  ]);
});

test('forkWorkbenchConfig keeps the source solve snapshot on the new active config', () => {
  const solveState = {
    result: null,
    error: '',
    activityStatus: 'settled' as const,
    inputKey: 'solve-key',
  };
  const collection = forkWorkbenchConfig(
    {
      activeConfigId: 'cfg-a',
      configs: [
        {
          id: 'cfg-a',
          editorState: buildEditorState(60),
          solveState,
        },
      ],
    },
    'cfg-a',
    {
      editorState: buildEditorState(60),
      solveState,
    }
  );

  expect(collection.configs).toHaveLength(2);
  expect(collection.activeConfigId).toBe(collection.configs[1]?.id);
  expect(collection.configs[1]?.solveState?.inputKey).toBe('solve-key');
});

test('syncActiveWorkbenchConfigCollection skips hydrating activations so the target config is not polluted', () => {
  const collection = syncActiveWorkbenchConfigCollection(
    {
      activeConfigId: 'cfg-a',
      configs: [
        {
          id: 'cfg-a',
          editorState: buildEditorState(60),
          solveState: {
            result: null,
            error: '',
            activityStatus: 'settled',
            inputKey: 'cfg-a-key',
          },
        },
        {
          id: 'cfg-b',
          editorState: buildEditorState(90),
          solveState: {
            result: null,
            error: '',
            activityStatus: 'settled',
            inputKey: 'cfg-b-key',
          },
        },
      ],
    },
    'cfg-b',
    buildEditorState(120),
    {
      result: null,
      error: '',
      activityStatus: 'settled',
      inputKey: 'cfg-a-key',
    },
    {
      skipConfigId: 'cfg-b',
    }
  );

  expect(collection.configs[1]?.editorState.targets).toEqual([
    { itemId: '1101', ratePerMin: 90 },
  ]);
  expect(collection.configs[1]?.solveState?.inputKey).toBe('cfg-b-key');
});
