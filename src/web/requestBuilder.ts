import type { ProliferatorMode, ResolvedCatalogModel } from '../catalog';
import { DEFAULT_APP_LOCALE, getLocaleBundle, type AppLocale } from '../i18n';
import type { BalancePolicy, SolveObjective, SolveRequest } from '../solver';

export type AdvancedSolveOverrides = Omit<
  SolveRequest,
  'targets' | 'objective' | 'balancePolicy' | 'rawInputItemIds'
>;

export interface EditableTarget {
  itemId: string;
  ratePerMin: number;
}

export interface EditableRecipePreference {
  recipeId: string;
  preferredBuildingId: string;
  preferredProliferatorMode: '' | ProliferatorMode;
  preferredProliferatorLevel: '' | number;
}

export type WorkbenchProliferatorPolicy = 'auto' | 'disable_all';

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
  errors: string[],
  locale: AppLocale
): string[] | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isStringArray(value)) {
    errors.push(getLocaleBundle(locale).advancedOverrides.stringArray(String(key)));
    return undefined;
  }
  return value;
}

function readOptionalStringRecord(
  source: Record<string, unknown>,
  key: keyof AdvancedSolveOverrides,
  errors: string[],
  locale: AppLocale
): Record<string, string> | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isStringRecord(value)) {
    errors.push(getLocaleBundle(locale).advancedOverrides.stringRecord(String(key)));
    return undefined;
  }
  return value;
}

function readOptionalNumberRecord(
  source: Record<string, unknown>,
  key: keyof AdvancedSolveOverrides,
  errors: string[],
  locale: AppLocale
): Record<string, number> | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isNumberRecord(value)) {
    errors.push(getLocaleBundle(locale).advancedOverrides.numberRecord(String(key)));
    return undefined;
  }
  return value;
}

function readOptionalModeRecord(
  source: Record<string, unknown>,
  key: keyof AdvancedSolveOverrides,
  errors: string[],
  locale: AppLocale
): Record<string, 'none' | 'speed' | 'productivity'> | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isModeRecord(value)) {
    errors.push(getLocaleBundle(locale).advancedOverrides.modeRecord(String(key)));
    return undefined;
  }
  return value;
}

function mergeUniqueStringArrays(left?: string[], right?: string[]): string[] | undefined {
  const merged = Array.from(new Set([...(left ?? []), ...(right ?? [])]));
  return merged.length > 0 ? merged : undefined;
}

function mergeRecord<T extends string | number>(
  left?: Record<string, T>,
  right?: Record<string, T>
): Record<string, T> | undefined {
  const merged = {
    ...(left ?? {}),
    ...(right ?? {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function parseAdvancedSolveOverrides(
  text: string,
  locale: AppLocale = DEFAULT_APP_LOCALE
): ParseAdvancedOverridesResult {
  const bundle = getLocaleBundle(locale);

  if (!text.trim()) {
    return { value: {}, error: '' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      value: {},
      error:
        error instanceof Error
          ? `${bundle.advancedOverrides.invalidJsonPrefix}${error.message}`
          : bundle.advancedOverrides.invalidJsonFallback,
    };
  }

  if (!isRecord(parsed)) {
    return { value: {}, error: bundle.advancedOverrides.mustBeJsonObject };
  }

  const source = parsed as Record<string, unknown>;
  const errors: string[] = [];
  const value: AdvancedSolveOverrides = {
    disabledRecipeIds: readOptionalStringArray(source, 'disabledRecipeIds', errors, locale),
    disabledBuildingIds: readOptionalStringArray(source, 'disabledBuildingIds', errors, locale),
    forcedRecipeByItem: readOptionalStringRecord(source, 'forcedRecipeByItem', errors, locale),
    preferredRecipeByItem: readOptionalStringRecord(source, 'preferredRecipeByItem', errors, locale),
    forcedBuildingByRecipe: readOptionalStringRecord(source, 'forcedBuildingByRecipe', errors, locale),
    preferredBuildingByRecipe: readOptionalStringRecord(source, 'preferredBuildingByRecipe', errors, locale),
    forcedProliferatorLevelByRecipe: readOptionalNumberRecord(
      source,
      'forcedProliferatorLevelByRecipe',
      errors,
      locale
    ),
    preferredProliferatorLevelByRecipe: readOptionalNumberRecord(
      source,
      'preferredProliferatorLevelByRecipe',
      errors,
      locale
    ),
    forcedProliferatorModeByRecipe: readOptionalModeRecord(
      source,
      'forcedProliferatorModeByRecipe',
      errors,
      locale
    ),
    preferredProliferatorModeByRecipe: readOptionalModeRecord(
      source,
      'preferredProliferatorModeByRecipe',
      errors,
      locale
    ),
  };

  if (errors.length > 0) {
    return { value: {}, error: errors.join(' ') };
  }

  return { value, error: '' };
}

export function buildPreferredRecipeOverrides(
  preferences: EditableRecipePreference[]
): Pick<
  AdvancedSolveOverrides,
  | 'preferredBuildingByRecipe'
  | 'preferredProliferatorLevelByRecipe'
  | 'preferredProliferatorModeByRecipe'
> {
  const preferredBuildingByRecipe: Record<string, string> = {};
  const preferredProliferatorLevelByRecipe: Record<string, number> = {};
  const preferredProliferatorModeByRecipe: Record<string, ProliferatorMode> = {};

  preferences.forEach(preference => {
    if (!preference.recipeId) {
      return;
    }

    if (preference.preferredBuildingId) {
      preferredBuildingByRecipe[preference.recipeId] = preference.preferredBuildingId;
    }

    if (preference.preferredProliferatorMode) {
      preferredProliferatorModeByRecipe[preference.recipeId] = preference.preferredProliferatorMode;
    }

    if (
      typeof preference.preferredProliferatorLevel === 'number' &&
      Number.isFinite(preference.preferredProliferatorLevel) &&
      preference.preferredProliferatorLevel >= 0
    ) {
      preferredProliferatorLevelByRecipe[preference.recipeId] =
        preference.preferredProliferatorLevel;
    }
  });

  return {
    preferredBuildingByRecipe:
      Object.keys(preferredBuildingByRecipe).length > 0
        ? preferredBuildingByRecipe
        : undefined,
    preferredProliferatorLevelByRecipe:
      Object.keys(preferredProliferatorLevelByRecipe).length > 0
        ? preferredProliferatorLevelByRecipe
        : undefined,
    preferredProliferatorModeByRecipe:
      Object.keys(preferredProliferatorModeByRecipe).length > 0
        ? preferredProliferatorModeByRecipe
        : undefined,
  };
}

export function buildGlobalProliferatorOverrides(
  catalog: ResolvedCatalogModel,
  policy: WorkbenchProliferatorPolicy
): Pick<
  AdvancedSolveOverrides,
  'forcedProliferatorModeByRecipe' | 'forcedProliferatorLevelByRecipe'
> {
  if (policy === 'auto') {
    return {};
  }

  const affectedRecipeIds = catalog.recipes
    .filter(
      recipe =>
        recipe.maxProliferatorLevel > 0 ||
        recipe.supportsProliferatorModes.some(mode => mode !== 'none')
    )
    .map(recipe => recipe.recipeId);

  return {
    forcedProliferatorModeByRecipe: Object.fromEntries(
      affectedRecipeIds.map(recipeId => [recipeId, 'none'])
    ),
    forcedProliferatorLevelByRecipe: Object.fromEntries(
      affectedRecipeIds.map(recipeId => [recipeId, 0])
    ),
  };
}

export function mergeAdvancedSolveOverrides(
  base: AdvancedSolveOverrides = {},
  override: AdvancedSolveOverrides = {}
): AdvancedSolveOverrides {
  const merged: AdvancedSolveOverrides = {};

  const disabledRecipeIds = mergeUniqueStringArrays(
    base.disabledRecipeIds,
    override.disabledRecipeIds
  );
  if (disabledRecipeIds) {
    merged.disabledRecipeIds = disabledRecipeIds;
  }

  const disabledBuildingIds = mergeUniqueStringArrays(
    base.disabledBuildingIds,
    override.disabledBuildingIds
  );
  if (disabledBuildingIds) {
    merged.disabledBuildingIds = disabledBuildingIds;
  }

  const forcedRecipeByItem = mergeRecord(
    base.forcedRecipeByItem,
    override.forcedRecipeByItem
  );
  if (forcedRecipeByItem) {
    merged.forcedRecipeByItem = forcedRecipeByItem;
  }

  const preferredRecipeByItem = mergeRecord(
    base.preferredRecipeByItem,
    override.preferredRecipeByItem
  );
  if (preferredRecipeByItem) {
    merged.preferredRecipeByItem = preferredRecipeByItem;
  }

  const forcedBuildingByRecipe = mergeRecord(
    base.forcedBuildingByRecipe,
    override.forcedBuildingByRecipe
  );
  if (forcedBuildingByRecipe) {
    merged.forcedBuildingByRecipe = forcedBuildingByRecipe;
  }

  const preferredBuildingByRecipe = mergeRecord(
    base.preferredBuildingByRecipe,
    override.preferredBuildingByRecipe
  );
  if (preferredBuildingByRecipe) {
    merged.preferredBuildingByRecipe = preferredBuildingByRecipe;
  }

  const forcedProliferatorLevelByRecipe = mergeRecord(
    base.forcedProliferatorLevelByRecipe,
    override.forcedProliferatorLevelByRecipe
  );
  if (forcedProliferatorLevelByRecipe) {
    merged.forcedProliferatorLevelByRecipe = forcedProliferatorLevelByRecipe;
  }

  const preferredProliferatorLevelByRecipe = mergeRecord(
    base.preferredProliferatorLevelByRecipe,
    override.preferredProliferatorLevelByRecipe
  );
  if (preferredProliferatorLevelByRecipe) {
    merged.preferredProliferatorLevelByRecipe = preferredProliferatorLevelByRecipe;
  }

  const forcedProliferatorModeByRecipe = mergeRecord(
    base.forcedProliferatorModeByRecipe,
    override.forcedProliferatorModeByRecipe
  );
  if (forcedProliferatorModeByRecipe) {
    merged.forcedProliferatorModeByRecipe = forcedProliferatorModeByRecipe;
  }

  const preferredProliferatorModeByRecipe = mergeRecord(
    base.preferredProliferatorModeByRecipe,
    override.preferredProliferatorModeByRecipe
  );
  if (preferredProliferatorModeByRecipe) {
    merged.preferredProliferatorModeByRecipe = preferredProliferatorModeByRecipe;
  }

  return merged;
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
