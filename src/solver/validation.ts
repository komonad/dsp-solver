import type { ProliferatorMode, ResolvedCatalogModel } from '../catalog';
import type { SolveRequest } from './request';

export interface ValidateResult {
  valid: boolean;
  messages: string[];
}

const VALID_PROLIFERATOR_MODES: ProliferatorMode[] = ['none', 'speed', 'productivity'];

function validateRecipeRecordMap(
  catalog: ResolvedCatalogModel,
  record: Record<string, string> | undefined,
  recordName: string,
  validator: (catalog: ResolvedCatalogModel, key: string, value: string) => boolean
): string[] {
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .filter(([key, value]) => !validator(catalog, key, value))
    .map(([key, value]) => `${recordName} contains an invalid entry: ${key} -> ${value}.`);
}

function validateRecipeArrayRecordMap(
  catalog: ResolvedCatalogModel,
  record: Record<string, string[]> | undefined,
  recordName: string,
  validator: (catalog: ResolvedCatalogModel, key: string, value: string) => boolean
): string[] {
  if (!record) {
    return [];
  }

  return Object.entries(record).flatMap(([key, values]) =>
    values
      .filter(value => !validator(catalog, key, value))
      .map(value => `${recordName} contains an invalid entry: ${key} -> ${value}.`)
  );
}

function validateNumericRecordMap(
  catalog: ResolvedCatalogModel,
  record: Record<string, number> | undefined,
  recordName: string,
  validator: (catalog: ResolvedCatalogModel, key: string, value: number) => boolean
): string[] {
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .filter(([, value]) => !Number.isFinite(value))
    .map(([key]) => `${recordName} contains a non-finite numeric value for ${key}.`)
    .concat(
      Object.entries(record)
        .filter(([key, value]) => Number.isFinite(value) && !validator(catalog, key, value))
        .map(([key, value]) => `${recordName} contains an invalid entry: ${key} -> ${value}.`)
    );
}

function validateModeRecordMap(
  catalog: ResolvedCatalogModel,
  record: Record<string, ProliferatorMode> | undefined,
  recordName: string
): string[] {
  if (!record) {
    return [];
  }

  const allowedModes = new Set<ProliferatorMode>(['none', 'speed', 'productivity']);

  return Object.entries(record)
    .filter(([key, value]) => !catalog.recipeMap.has(key) || !allowedModes.has(value))
    .map(([key, value]) => `${recordName} contains an invalid entry: ${key} -> ${value}.`);
}

export function validateSolveRequest(catalog: ResolvedCatalogModel, request: SolveRequest): ValidateResult {
  const messages: string[] = [];

  if (request.targets.length === 0) {
    messages.push('SolveRequest.targets must not be empty.');
  }

  for (const target of request.targets) {
    if (!Number.isFinite(target.ratePerMin) || target.ratePerMin < 0) {
      messages.push(`Target rate must be a non-negative finite number: ${target.itemId}.`);
    }

    if (!catalog.itemMap.has(target.itemId)) {
      messages.push(`Unknown target item: ${target.itemId}.`);
    }
  }

  for (const itemId of request.rawInputItemIds ?? []) {
    if (!catalog.itemMap.has(itemId)) {
      messages.push(`Unknown raw-input item: ${itemId}.`);
    }
  }

  for (const itemId of request.disabledRawInputItemIds ?? []) {
    if (!catalog.itemMap.has(itemId)) {
      messages.push(`Unknown disabled raw-input item: ${itemId}.`);
    }
  }

  for (const recipeId of request.disabledRecipeIds ?? []) {
    if (!catalog.recipeMap.has(recipeId)) {
      messages.push(`Unknown disabled recipe: ${recipeId}.`);
    }
  }

  for (const buildingId of request.disabledBuildingIds ?? []) {
    if (!catalog.buildingMap.has(buildingId)) {
      messages.push(`Unknown disabled building: ${buildingId}.`);
    }
  }

  messages.push(
    ...validateRecipeArrayRecordMap(
      catalog,
      request.allowedRecipesByItem,
      'allowedRecipesByItem',
      (innerCatalog, itemId, recipeId) =>
        innerCatalog.itemMap.has(itemId) &&
        innerCatalog.recipeMap.has(recipeId) &&
        innerCatalog.recipeMap.get(recipeId)!.outputs.some(output => output.itemId === itemId)
    )
  );

  messages.push(
    ...validateRecipeRecordMap(
      catalog,
      request.forcedBuildingByRecipe,
      'forcedBuildingByRecipe',
      (innerCatalog, recipeId, buildingId) =>
        innerCatalog.recipeMap.has(recipeId) &&
        innerCatalog.buildingMap.has(buildingId)
    )
  );

  messages.push(
    ...validateRecipeRecordMap(
      catalog,
      request.preferredBuildingByRecipe,
      'preferredBuildingByRecipe',
      (innerCatalog, recipeId, buildingId) =>
        innerCatalog.recipeMap.has(recipeId) &&
        innerCatalog.buildingMap.has(buildingId)
    )
  );

  messages.push(
    ...validateNumericRecordMap(
      catalog,
      request.forcedProliferatorLevelByRecipe,
      'forcedProliferatorLevelByRecipe',
      (innerCatalog, recipeId, level) =>
        innerCatalog.recipeMap.has(recipeId) &&
        level >= 0 &&
        Number.isInteger(level) &&
        (level === 0 || innerCatalog.proliferatorLevelMap.has(level))
    )
  );

  if (
    request.globalForcedProliferatorLevel !== undefined &&
    !(
      request.globalForcedProliferatorLevel >= 0 &&
      Number.isInteger(request.globalForcedProliferatorLevel) &&
      (request.globalForcedProliferatorLevel === 0 ||
        catalog.proliferatorLevelMap.has(request.globalForcedProliferatorLevel))
    )
  ) {
    messages.push('globalForcedProliferatorLevel must be 0 or a known proliferator level.');
  }

  messages.push(
    ...validateNumericRecordMap(
      catalog,
      request.preferredProliferatorLevelByRecipe,
      'preferredProliferatorLevelByRecipe',
      (innerCatalog, recipeId, level) =>
        innerCatalog.recipeMap.has(recipeId) &&
        level >= 0 &&
        Number.isInteger(level) &&
        (level === 0 || innerCatalog.proliferatorLevelMap.has(level))
    )
  );

  messages.push(
    ...validateModeRecordMap(
      catalog,
      request.forcedProliferatorModeByRecipe,
      'forcedProliferatorModeByRecipe'
    )
  );

  if (
    request.globalForcedProliferatorMode !== undefined &&
    !VALID_PROLIFERATOR_MODES.includes(request.globalForcedProliferatorMode)
  ) {
    messages.push('globalForcedProliferatorMode must be none, speed, or productivity.');
  }

  messages.push(
    ...validateModeRecordMap(
      catalog,
      request.preferredProliferatorModeByRecipe,
      'preferredProliferatorModeByRecipe'
    )
  );

  return {
    valid: messages.length === 0,
    messages,
  };
}
