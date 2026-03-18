import { resolveCatalogModel } from '../catalog/resolve';
import type { CatalogDefaultConfigSpec, ResolvedCatalogModel, VanillaDatasetSpec } from '../catalog/spec';
import type { DatasetPresetId } from '../i18n';

export interface DatasetPresetDefinition {
  id: DatasetPresetId;
  datasetPath: string;
  defaultConfigPath?: string;
}

export const DATASET_PRESETS: DatasetPresetDefinition[] = [
  {
    id: 'vanilla',
    datasetPath: './Vanilla.json',
    defaultConfigPath: './Vanilla.defaults.json',
  },
  {
    id: 'demo-smelting',
    datasetPath: './DemoSmelting.json',
    defaultConfigPath: './DemoSmelting.defaults.json',
  },
  {
    id: 'refinery-balance',
    datasetPath: './RefineryBalance.json',
    defaultConfigPath: './RefineryBalance.defaults.json',
  },
  {
    id: 'fullerene-loop',
    datasetPath: './FullereneLoop.json',
    defaultConfigPath: './FullereneLoop.defaults.json',
  },
  {
    id: 'custom',
    datasetPath: '',
    defaultConfigPath: '',
  },
];

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

export async function loadResolvedCatalogFromUrl(
  datasetPath: string,
  defaultConfigPath?: string
): Promise<ResolvedCatalogModel> {
  const datasetText = await fetchJsonText(datasetPath);
  const defaultConfigText = defaultConfigPath ? await fetchJsonText(defaultConfigPath) : '{}';
  const dataset = JSON.parse(datasetText) as VanillaDatasetSpec;
  const defaultConfig = JSON.parse(defaultConfigText) as CatalogDefaultConfigSpec;

  return resolveCatalogModel(dataset, defaultConfig);
}
