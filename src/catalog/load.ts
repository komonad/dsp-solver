import { readFile } from 'fs/promises';
import { resolveCatalogModel } from './resolve';
import {
  type CatalogDefaultConfigSpec,
  type ResolvedCatalogModel,
  type VanillaDatasetSpec,
  validateCatalogDefaultConfigSpec,
  validateVanillaDatasetSpec,
} from './spec';

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function formatIssues(prefix: string, issues: Array<{ path: string; message: string }>): string {
  return `${prefix}\n${issues.map(issue => `${issue.path}: ${issue.message}`).join('\n')}`;
}

export function parseJsonText<T>(text: string): T {
  return JSON.parse(stripBom(text)) as T;
}

export async function loadJsonFile<T>(filePath: string): Promise<T> {
  const text = await readFile(filePath, 'utf8');
  return parseJsonText<T>(text);
}

export async function loadVanillaDatasetFromFile(filePath: string): Promise<VanillaDatasetSpec> {
  const dataset = await loadJsonFile<unknown>(filePath);
  const validation = validateVanillaDatasetSpec(dataset);

  if (!validation.valid) {
    throw new Error(formatIssues(`Invalid Vanilla dataset file: ${filePath}`, validation.errors));
  }

  return dataset as VanillaDatasetSpec;
}

export async function loadCatalogDefaultConfigFromFile(
  filePath: string
): Promise<CatalogDefaultConfigSpec> {
  const defaultConfig = await loadJsonFile<unknown>(filePath);
  const validation = validateCatalogDefaultConfigSpec(defaultConfig);

  if (!validation.valid) {
    throw new Error(
      formatIssues(`Invalid catalog default config file: ${filePath}`, validation.errors)
    );
  }

  return defaultConfig as CatalogDefaultConfigSpec;
}

export async function loadResolvedCatalogFromFiles(
  datasetFilePath: string,
  defaultConfigFilePath?: string
): Promise<ResolvedCatalogModel> {
  const datasetPromise = loadVanillaDatasetFromFile(datasetFilePath);
  const defaultConfigPromise = defaultConfigFilePath
    ? loadCatalogDefaultConfigFromFile(defaultConfigFilePath)
    : Promise.resolve<CatalogDefaultConfigSpec>({});

  const [dataset, defaultConfig] = await Promise.all([datasetPromise, defaultConfigPromise]);

  return resolveCatalogModel(dataset, defaultConfig);
}
