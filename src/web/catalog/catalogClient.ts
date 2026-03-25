import { resolveCatalogModel } from '../../catalog/resolve';
import type { CatalogDefaultConfigSpec, ResolvedCatalogModel, VanillaDatasetSpec } from '../../catalog/spec';
import type { DatasetPresetId } from '../../i18n';
import { BUNDLED_DATASET_PATHS } from '../shared/webAssetPaths';

export interface DatasetPresetDefinition {
  id: DatasetPresetId;
  datasetPath: string;
  defaultConfigPath?: string;
}

export const DATASET_PRESETS: DatasetPresetDefinition[] = [
  {
    id: 'vanilla',
    datasetPath: BUNDLED_DATASET_PATHS.vanilla.datasetPath,
    defaultConfigPath: BUNDLED_DATASET_PATHS.vanilla.defaultConfigPath,
  },
  {
    id: 'demo-smelting',
    datasetPath: BUNDLED_DATASET_PATHS.demoSmelting.datasetPath,
    defaultConfigPath: BUNDLED_DATASET_PATHS.demoSmelting.defaultConfigPath,
  },
  {
    id: 'refinery-balance',
    datasetPath: BUNDLED_DATASET_PATHS.refineryBalance.datasetPath,
    defaultConfigPath: BUNDLED_DATASET_PATHS.refineryBalance.defaultConfigPath,
  },
  {
    id: 'fullerene-loop',
    datasetPath: BUNDLED_DATASET_PATHS.fullereneLoop.datasetPath,
    defaultConfigPath: BUNDLED_DATASET_PATHS.fullereneLoop.defaultConfigPath,
  },
  {
    id: 'orbitalring',
    datasetPath: BUNDLED_DATASET_PATHS.orbitalRing.datasetPath,
    defaultConfigPath: BUNDLED_DATASET_PATHS.orbitalRing.defaultConfigPath,
  },
  {
    id: 'custom',
    datasetPath: '',
    defaultConfigPath: '',
  },
];

export interface LoadedCatalogSource {
  datasetText: string;
  defaultConfigText: string;
  dataset: VanillaDatasetSpec;
  defaultConfig: CatalogDefaultConfigSpec;
  catalog: ResolvedCatalogModel;
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

async function fetchJsonText(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }

  return stripBom(await response.text());
}

export function resolveCatalogSourceTexts(
  datasetText: string,
  defaultConfigText = '{}'
): LoadedCatalogSource {
  const dataset = JSON.parse(stripBom(datasetText)) as VanillaDatasetSpec;
  const defaultConfig = JSON.parse(stripBom(defaultConfigText || '{}')) as CatalogDefaultConfigSpec;

  return {
    datasetText: stripBom(datasetText),
    defaultConfigText: stripBom(defaultConfigText || '{}'),
    dataset,
    defaultConfig,
    catalog: resolveCatalogModel(dataset, defaultConfig),
  };
}

export async function loadCatalogSourceFromUrl(
  datasetPath: string,
  defaultConfigPath?: string
): Promise<LoadedCatalogSource> {
  const datasetText = await fetchJsonText(datasetPath);
  const defaultConfigText = defaultConfigPath ? await fetchJsonText(defaultConfigPath) : '{}';

  return resolveCatalogSourceTexts(datasetText, defaultConfigText);
}

export async function loadResolvedCatalogFromUrl(
  datasetPath: string,
  defaultConfigPath?: string
): Promise<ResolvedCatalogModel> {
  return (await loadCatalogSourceFromUrl(datasetPath, defaultConfigPath)).catalog;
}
