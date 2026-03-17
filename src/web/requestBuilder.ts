import type { BalancePolicy, SolveObjective, SolveRequest } from '../solver';

export type AdvancedSolveOverrides = Omit<
  SolveRequest,
  'targets' | 'objective' | 'balancePolicy' | 'rawInputItemIds'
>;

export interface EditableTarget {
  itemId: string;
  ratePerMin: number;
}

export interface BuildWorkbenchRequestParams {
  targets: EditableTarget[];
  objective: SolveObjective;
  balancePolicy: BalancePolicy;
  rawInputItemIds: string[];
  advancedOverrides?: AdvancedSolveOverrides;
}

export interface ParseAdvancedOverridesResult {
  value: AdvancedSolveOverrides;
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(entry => typeof entry === 'string');
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(entry => typeof entry === 'number' && Number.isFinite(entry));
}

function isModeRecord(value: unknown): value is Record<string, 'none' | 'speed' | 'productivity'> {
  const allowed = new Set(['none', 'speed', 'productivity']);
  return isRecord(value) && Object.values(value).every(entry => typeof entry === 'string' && allowed.has(entry));
}

function readOptionalStringArray(
  source: Record<string, unknown>,
  key: keyof AdvancedSolveOverrides,
  errors: string[]
): string[] | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isStringArray(value)) {
    errors.push(`${String(key)} must be a string array when present.`);
    return undefined;
  }
  return value;
}

function readOptionalStringRecord(
  source: Record<string, unknown>,
  key: keyof AdvancedSolveOverrides,
  errors: string[]
): Record<string, string> | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isStringRecord(value)) {
    errors.push(`${String(key)} must be an object whose values are strings.`);
    return undefined;
  }
  return value;
}

function readOptionalNumberRecord(
  source: Record<string, unknown>,
  key: keyof AdvancedSolveOverrides,
  errors: string[]
): Record<string, number> | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isNumberRecord(value)) {
    errors.push(`${String(key)} must be an object whose values are finite numbers.`);
    return undefined;
  }
  return value;
}

function readOptionalModeRecord(
  source: Record<string, unknown>,
  key: keyof AdvancedSolveOverrides,
  errors: string[]
): Record<string, 'none' | 'speed' | 'productivity'> | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isModeRecord(value)) {
    errors.push(`${String(key)} must be an object whose values are one of none, speed, or productivity.`);
    return undefined;
  }
  return value;
}

export function parseAdvancedSolveOverrides(text: string): ParseAdvancedOverridesResult {
  if (!text.trim()) {
    return { value: {}, error: '' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      value: {},
      error: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.',
    };
  }

  if (!isRecord(parsed)) {
    return { value: {}, error: 'Advanced overrides must be a JSON object.' };
  }

  const source = parsed as Record<string, unknown>;
  const errors: string[] = [];
  const value: AdvancedSolveOverrides = {
    disabledRecipeIds: readOptionalStringArray(source, 'disabledRecipeIds', errors),
    disabledBuildingIds: readOptionalStringArray(source, 'disabledBuildingIds', errors),
    forcedRecipeByItem: readOptionalStringRecord(source, 'forcedRecipeByItem', errors),
    preferredRecipeByItem: readOptionalStringRecord(source, 'preferredRecipeByItem', errors),
    forcedBuildingByRecipe: readOptionalStringRecord(source, 'forcedBuildingByRecipe', errors),
    preferredBuildingByRecipe: readOptionalStringRecord(source, 'preferredBuildingByRecipe', errors),
    forcedProliferatorLevelByRecipe: readOptionalNumberRecord(source, 'forcedProliferatorLevelByRecipe', errors),
    preferredProliferatorLevelByRecipe: readOptionalNumberRecord(source, 'preferredProliferatorLevelByRecipe', errors),
    forcedProliferatorModeByRecipe: readOptionalModeRecord(source, 'forcedProliferatorModeByRecipe', errors),
    preferredProliferatorModeByRecipe: readOptionalModeRecord(source, 'preferredProliferatorModeByRecipe', errors),
  };

  if (errors.length > 0) {
    return { value: {}, error: errors.join(' ') };
  }

  return { value, error: '' };
}

export function buildWorkbenchRequest(params: BuildWorkbenchRequestParams): SolveRequest {
  return {
    targets: params.targets
      .filter(target => target.itemId && Number.isFinite(target.ratePerMin) && target.ratePerMin >= 0)
      .map(target => ({ itemId: target.itemId, ratePerMin: target.ratePerMin })),
    objective: params.objective,
    balancePolicy: params.balancePolicy,
    rawInputItemIds: params.rawInputItemIds,
    ...params.advancedOverrides,
  };
}
