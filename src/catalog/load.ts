import { readFile } from 'fs/promises';
import { resolveCatalogModel } from './resolve';
import {
  type CatalogRuleSetSpec,
  type ResolvedCatalogModel,
  type VanillaDatasetSpec,
  validateCatalogRuleSetSpec,
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

export async function loadCatalogRuleSetFromFile(filePath: string): Promise<CatalogRuleSetSpec> {
  const rules = await loadJsonFile<unknown>(filePath);
  const validation = validateCatalogRuleSetSpec(rules);

  if (!validation.valid) {
    throw new Error(formatIssues(`Invalid catalog rule set file: ${filePath}`, validation.errors));
  }

  return rules as CatalogRuleSetSpec;
}

export async function loadResolvedCatalogFromFiles(
  datasetFilePath: string,
  ruleSetFilePath: string
): Promise<ResolvedCatalogModel> {
  const [dataset, rules] = await Promise.all([
    loadVanillaDatasetFromFile(datasetFilePath),
    loadCatalogRuleSetFromFile(ruleSetFilePath),
  ]);

  return resolveCatalogModel(dataset, rules);
}
