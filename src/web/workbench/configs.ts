import type { ResolvedCatalogModel } from '../../catalog';
import type { PersistedWorkbenchSolveState } from './autoSolve';
import {
  sanitizeWorkbenchEditorState,
  type WorkbenchEditorState,
  type WorkbenchPersistedConfig,
  type WorkbenchPersistedConfigCollection,
} from './persistence';

let nextGeneratedWorkbenchConfigId = 1;

export function createWorkbenchConfigId(): string {
  const nextId = nextGeneratedWorkbenchConfigId;
  nextGeneratedWorkbenchConfigId += 1;
  return `cfg-${Date.now().toString(36)}-${nextId.toString(36)}`;
}

function isSameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createWorkbenchPersistedConfig(
  editorState: WorkbenchEditorState,
  options: Partial<WorkbenchPersistedConfig> = {}
): WorkbenchPersistedConfig {
  return {
    id: options.id && options.id.length > 0 ? options.id : createWorkbenchConfigId(),
    name: options.name,
    editorState,
    solveState: options.solveState,
    updatedAtEpochMs: options.updatedAtEpochMs ?? Date.now(),
    datasetLabel: options.datasetLabel,
    cachedTargetSummary: options.cachedTargetSummary,
  };
}

export function sanitizeWorkbenchConfigCollectionForCatalog(
  catalog: ResolvedCatalogModel,
  collection: WorkbenchPersistedConfigCollection | null | undefined,
  defaultEditorState: WorkbenchEditorState
): WorkbenchPersistedConfigCollection {
  const sanitizedConfigs = (collection?.configs ?? [])
    .map(config => ({
      ...config,
      editorState: sanitizeWorkbenchEditorState(catalog, config.editorState),
      updatedAtEpochMs: config.updatedAtEpochMs ?? Date.now(),
    }))
    .filter(config => Boolean(config.id));

  const configs =
    sanitizedConfigs.length > 0
      ? sanitizedConfigs
      : [createWorkbenchPersistedConfig(defaultEditorState, { id: createWorkbenchConfigId() })];

  const activeConfigId =
    collection?.activeConfigId && configs.some(config => config.id === collection.activeConfigId)
      ? collection.activeConfigId
      : configs[0].id;

  return {
    activeConfigId,
    configs,
  };
}

export function updateWorkbenchConfigCollection(
  collection: WorkbenchPersistedConfigCollection,
  configId: string,
  updater: (config: WorkbenchPersistedConfig) => WorkbenchPersistedConfig
): WorkbenchPersistedConfigCollection {
  let changed = false;
  const configs = collection.configs.map(config => {
    if (config.id !== configId) {
      return config;
    }

    const nextConfig = updater(config);
    changed = nextConfig !== config;
    return nextConfig;
  });

  return changed ? { ...collection, configs } : collection;
}

export function replaceWorkbenchConfigEditorState(
  collection: WorkbenchPersistedConfigCollection,
  configId: string,
  editorState: WorkbenchEditorState
): WorkbenchPersistedConfigCollection {
  return updateWorkbenchConfigCollection(collection, configId, config => ({
    ...(isSameJsonValue(config.editorState, editorState)
      ? config
      : {
          ...config,
          editorState,
          updatedAtEpochMs: Date.now(),
        }),
  }));
}

export function replaceWorkbenchConfigSolveState(
  collection: WorkbenchPersistedConfigCollection,
  configId: string,
  solveState: PersistedWorkbenchSolveState
): WorkbenchPersistedConfigCollection {
  return updateWorkbenchConfigCollection(collection, configId, config => ({
    ...(isSameJsonValue(config.solveState, solveState)
      ? config
      : {
          ...config,
          solveState,
          updatedAtEpochMs: Date.now(),
        }),
  }));
}

export function syncActiveWorkbenchConfigCollection(
  collection: WorkbenchPersistedConfigCollection,
  activeConfigId: string,
  editorState: WorkbenchEditorState,
  solveState: PersistedWorkbenchSolveState,
  options: {
    skipConfigId?: string;
  } = {}
): WorkbenchPersistedConfigCollection {
  if (!activeConfigId || options.skipConfigId === activeConfigId) {
    return collection;
  }

  if (!collection.configs.some(config => config.id === activeConfigId)) {
    return collection;
  }

  return replaceWorkbenchConfigSolveState(
    replaceWorkbenchConfigEditorState(collection, activeConfigId, editorState),
    activeConfigId,
    solveState
  );
}

export function renameWorkbenchConfig(
  collection: WorkbenchPersistedConfigCollection,
  configId: string,
  name: string
): WorkbenchPersistedConfigCollection {
  return updateWorkbenchConfigCollection(collection, configId, config => ({
    ...(config.name === name
      ? config
      : {
          ...config,
          name,
          updatedAtEpochMs: Date.now(),
        }),
  }));
}

export function forkWorkbenchConfig(
  collection: WorkbenchPersistedConfigCollection,
  sourceConfigId: string,
  options: {
    editorState: WorkbenchEditorState;
    solveState: PersistedWorkbenchSolveState;
    name?: string;
  }
): WorkbenchPersistedConfigCollection {
  const sourceConfig = collection.configs.find(config => config.id === sourceConfigId);
  const nextConfig = createWorkbenchPersistedConfig(options.editorState, {
    name: options.name ?? sourceConfig?.name,
    solveState: options.solveState,
  });

  return {
    activeConfigId: nextConfig.id,
    configs: [...collection.configs, nextConfig],
  };
}

export function createWorkbenchConfig(
  collection: WorkbenchPersistedConfigCollection,
  options: {
    editorState: WorkbenchEditorState;
    solveState?: PersistedWorkbenchSolveState;
    name?: string;
  }
): WorkbenchPersistedConfigCollection {
  const nextConfig = createWorkbenchPersistedConfig(options.editorState, {
    name: options.name,
    solveState: options.solveState,
  });

  return {
    activeConfigId: nextConfig.id,
    configs: [...collection.configs, nextConfig],
  };
}

export function deleteWorkbenchConfig(
  collection: WorkbenchPersistedConfigCollection,
  configId: string,
  fallbackEditorState: WorkbenchEditorState
): WorkbenchPersistedConfigCollection {
  const remainingConfigs = collection.configs.filter(config => config.id !== configId);

  if (remainingConfigs.length === 0) {
    const nextConfig = createWorkbenchPersistedConfig(fallbackEditorState);
    return {
      activeConfigId: nextConfig.id,
      configs: [nextConfig],
    };
  }

  const activeConfigId =
    collection.activeConfigId === configId
      ? remainingConfigs[
          Math.min(
            collection.configs.findIndex(config => config.id === configId),
            remainingConfigs.length - 1
          )
        ]?.id ?? remainingConfigs[0].id
      : collection.activeConfigId;

  return {
    activeConfigId,
    configs: remainingConfigs,
  };
}
