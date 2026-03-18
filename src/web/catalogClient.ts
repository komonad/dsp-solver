import { resolveCatalogModel } from '../catalog/resolve';
import type { CatalogDefaultConfigSpec, ResolvedCatalogModel, VanillaDatasetSpec } from '../catalog/spec';

export interface DatasetPresetDefinition {
  id: string;
  label: string;
  description: string;
  datasetPath: string;
  defaultConfigPath?: string;
}

export const DATASET_PRESETS: DatasetPresetDefinition[] = [
  {
    id: 'vanilla',
    label: 'Vanilla',
    description: 'The full vanilla-compatible dataset and its companion defaults.',
    datasetPath: './Vanilla.json',
    defaultConfigPath: './Vanilla.defaults.json',
  },
  {
    id: 'demo-smelting',
    label: 'Demo Smelting',
    description: 'A tiny two-building smelting dataset for fast frontend checks.',
    datasetPath: './DemoSmelting.json',
    defaultConfigPath: './DemoSmelting.defaults.json',
  },
  {
    id: 'legacy-refinery',
    label: 'Legacy Refinery',
    description: 'The light-oil scenario that closes heavy oil through the paired refinery recipes.',
    datasetPath: './LegacyRefinery.json',
    defaultConfigPath: './LegacyRefinery.defaults.json',
  },
  {
    id: 'legacy-cycle',
    label: 'Legacy Cycle',
    description: 'The fullerol/fullersilver loop with low-temperature and quantum chemical plant productivity bonuses.',
    datasetPath: './LegacyCycle.json',
    defaultConfigPath: './LegacyCycle.defaults.json',
  },
  {
    id: 'custom',
    label: 'Custom Paths',
    description: 'Load any dataset/default-config pair that is reachable from the current web root.',
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
