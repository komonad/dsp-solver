export type ProliferatorMode = 'none' | 'speed' | 'productivity';

export type RecipeModifierKind = 'none' | 'proliferator' | 'special';

export interface VanillaItemRecord {
  ID: number;
  Type: number;
  Name: string;
  IconName: string;
  GridIndex?: number;
  WorkEnergyPerTick?: number;
  Speed?: number;
  Space?: number;
  MultipleOutput?: number;
}

export interface VanillaRecipeRecord {
  ID: number;
  Type: number;
  Factories: number[];
  Name: string;
  Items: number[];
  ItemCounts: number[];
  Results: number[];
  ResultCounts: number[];
  TimeSpend: number;
  Proliferator: number;
  IconName: string;
}

export interface VanillaDatasetSpec {
  items: VanillaItemRecord[];
  recipes: VanillaRecipeRecord[];
}

export interface ProliferatorLevelConfigSpec {
  Level: number;
  ItemID?: number;
  SprayCount?: number;
  SpeedMultiplier: number;
  ProductivityMultiplier: number;
  PowerMultiplier: number;
}

export interface CatalogBuildingRuleSpec {
  ID: number;
  Category?: string;
  IdlePowerMW?: number;
  IntrinsicProductivityBonus?: number;
  SpeedMultiplierOverride?: number;
  WorkPowerMWOverride?: number;
  Tags?: string[];
}

export interface RecipeModifierRuleSpec {
  Code: number;
  Kind: RecipeModifierKind;
  SupportedModes?: ProliferatorMode[];
  MaxLevel?: number;
  Tags?: string[];
}

export interface CatalogDefaultConfigSpec {
  proliferatorLevels?: ProliferatorLevelConfigSpec[];
  buildingRules?: CatalogBuildingRuleSpec[];
  recipeModifierRules?: RecipeModifierRuleSpec[];
  recommendedRawItemIds?: number[];
  recommendedRawItemTypeIds?: number[];
  syntheticRecipeTypeIds?: number[];
  syntheticRecipeNamePrefixes?: string[];
  syntheticFactoryIds?: number[];
}

export type ItemKind = 'raw' | 'intermediate' | 'product' | 'utility';

export interface ResolvedItemSpec {
  itemId: string;
  typeId: number;
  name: string;
  kind: ItemKind;
  icon?: string;
  tags?: string[];
  source: VanillaItemRecord;
}

export interface RecipeIOItem {
  itemId: string;
  amount: number;
}

export interface ResolvedRecipeSpec {
  recipeId: string;
  typeId: number;
  name: string;
  cycleTimeSec: number;
  timeSpend: number;
  inputs: RecipeIOItem[];
  outputs: RecipeIOItem[];
  allowedBuildingIds: string[];
  modifierCode: number;
  modifierKind: RecipeModifierKind;
  supportsProliferatorModes: ProliferatorMode[];
  maxProliferatorLevel: number;
  isSynthetic: boolean;
  tags?: string[];
  source: VanillaRecipeRecord;
}

export interface ResolvedBuildingSpec {
  buildingId: string;
  typeId: number;
  name: string;
  category: string;
  speedMultiplier: number;
  workPowerMW: number;
  idlePowerMW?: number;
  intrinsicProductivityBonus: number;
  tags?: string[];
  source: {
    item: VanillaItemRecord;
    rule?: CatalogBuildingRuleSpec;
  };
}

export interface ResolvedProliferatorLevelSpec {
  level: number;
  itemId?: string;
  sprayCount?: number;
  speedMultiplier: number;
  productivityMultiplier: number;
  powerMultiplier: number;
  source: ProliferatorLevelConfigSpec;
}

export interface ResolvedCatalogModel {
  version: string;
  dataset: VanillaDatasetSpec;
  defaultConfig: CatalogDefaultConfigSpec;
  items: ResolvedItemSpec[];
  recipes: ResolvedRecipeSpec[];
  buildings: ResolvedBuildingSpec[];
  proliferatorLevels: ResolvedProliferatorLevelSpec[];
  itemMap: Map<string, ResolvedItemSpec>;
  recipeMap: Map<string, ResolvedRecipeSpec>;
  buildingMap: Map<string, ResolvedBuildingSpec>;
  proliferatorLevelMap: Map<number, ResolvedProliferatorLevelSpec>;
  rawItemIds: string[];
  syntheticRecipeIds: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface VanillaDatasetValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

export interface CatalogDefaultConfigValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

export interface VanillaDatasetSummary {
  topLevelKeys: string[];
  itemCount: number;
  recipeCount: number;
  itemTypes: number[];
  recipeTypes: number[];
  proliferatorCodes: number[];
  factoryIds: number[];
  itemKeys: string[];
  recipeKeys: string[];
  itemKeyCounts: Record<string, number>;
  recipeKeyCounts: Record<string, number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function pushIssue(errors: ValidationIssue[], path: string, message: string): void {
  errors.push({ path, message });
}

function summarizeObjectKeys<T extends object>(records: T[]): {
  keys: string[];
  keyCounts: Record<string, number>;
} {
  const keys = Array.from(
    new Set(records.flatMap(record => Object.keys(record as Record<string, unknown>)))
  ).sort();
  const keyCounts = Object.fromEntries(
    keys.map(key => [key, records.filter(record => key in (record as Record<string, unknown>)).length])
  );

  return { keys, keyCounts };
}

export function validateVanillaDatasetSpec(value: unknown): VanillaDatasetValidationResult {
  const errors: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return {
      valid: false,
      errors: [{ path: '$', message: 'Dataset must be an object.' }],
    };
  }

  if (!Array.isArray(value.items)) {
    pushIssue(errors, '$.items', 'items must be an array.');
  }

  if (!Array.isArray(value.recipes)) {
    pushIssue(errors, '$.recipes', 'recipes must be an array.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const dataset = value as unknown as VanillaDatasetSpec;
  const itemIds = new Set<number>();
  const recipeIds = new Set<number>();

  dataset.items.forEach((item, index) => {
    const path = `$.items[${index}]`;

    if (!isRecord(item)) {
      pushIssue(errors, path, 'Item must be an object.');
      return;
    }

    if (!isFiniteNumber(item.ID)) pushIssue(errors, `${path}.ID`, 'ID must be a finite number.');
    if (!isFiniteNumber(item.Type)) pushIssue(errors, `${path}.Type`, 'Type must be a finite number.');
    if (typeof item.Name !== 'string' || item.Name.length === 0) pushIssue(errors, `${path}.Name`, 'Name must be a non-empty string.');
    if (typeof item.IconName !== 'string') pushIssue(errors, `${path}.IconName`, 'IconName must be a string.');
    if (item.GridIndex !== undefined && !isFiniteNumber(item.GridIndex)) pushIssue(errors, `${path}.GridIndex`, 'GridIndex must be a finite number when present.');
    if (item.WorkEnergyPerTick !== undefined && !isFiniteNumber(item.WorkEnergyPerTick)) pushIssue(errors, `${path}.WorkEnergyPerTick`, 'WorkEnergyPerTick must be a finite number when present.');
    if (item.Speed !== undefined && (!isFiniteNumber(item.Speed) || item.Speed <= 0)) pushIssue(errors, `${path}.Speed`, 'Speed must be a positive finite number when present.');
    if (item.Space !== undefined && !isFiniteNumber(item.Space)) pushIssue(errors, `${path}.Space`, 'Space must be a finite number when present.');
    if (item.MultipleOutput !== undefined && !isFiniteNumber(item.MultipleOutput)) pushIssue(errors, `${path}.MultipleOutput`, 'MultipleOutput must be a finite number when present.');

    if (isFiniteNumber(item.ID)) {
      if (itemIds.has(item.ID)) {
        pushIssue(errors, `${path}.ID`, `Duplicate item ID ${item.ID}.`);
      }
      itemIds.add(item.ID);
    }
  });

  dataset.recipes.forEach((recipe, index) => {
    const path = `$.recipes[${index}]`;

    if (!isRecord(recipe)) {
      pushIssue(errors, path, 'Recipe must be an object.');
      return;
    }

    if (!isFiniteNumber(recipe.ID)) pushIssue(errors, `${path}.ID`, 'ID must be a finite number.');
    if (!isFiniteNumber(recipe.Type)) pushIssue(errors, `${path}.Type`, 'Type must be a finite number.');
    if (!isNumberArray(recipe.Factories)) pushIssue(errors, `${path}.Factories`, 'Factories must be a number array.');
    if (typeof recipe.Name !== 'string' || recipe.Name.length === 0) pushIssue(errors, `${path}.Name`, 'Name must be a non-empty string.');
    if (!isNumberArray(recipe.Items)) pushIssue(errors, `${path}.Items`, 'Items must be a number array.');
    if (!isNumberArray(recipe.ItemCounts)) pushIssue(errors, `${path}.ItemCounts`, 'ItemCounts must be a number array.');
    if (!isNumberArray(recipe.Results)) pushIssue(errors, `${path}.Results`, 'Results must be a number array.');
    if (!isNumberArray(recipe.ResultCounts)) pushIssue(errors, `${path}.ResultCounts`, 'ResultCounts must be a number array.');
    if (!isFiniteNumber(recipe.TimeSpend) || recipe.TimeSpend <= 0) pushIssue(errors, `${path}.TimeSpend`, 'TimeSpend must be a positive finite number.');
    if (!isFiniteNumber(recipe.Proliferator) || recipe.Proliferator < 0) pushIssue(errors, `${path}.Proliferator`, 'Proliferator must be a non-negative finite number.');
    if (typeof recipe.IconName !== 'string') pushIssue(errors, `${path}.IconName`, 'IconName must be a string.');

    if (isFiniteNumber(recipe.ID)) {
      if (recipeIds.has(recipe.ID)) {
        pushIssue(errors, `${path}.ID`, `Duplicate recipe ID ${recipe.ID}.`);
      }
      recipeIds.add(recipe.ID);
    }

    if (isNumberArray(recipe.Items) && isNumberArray(recipe.ItemCounts) && recipe.Items.length !== recipe.ItemCounts.length) {
      pushIssue(errors, path, 'Items and ItemCounts must have the same length.');
    }

    if (isNumberArray(recipe.Results) && isNumberArray(recipe.ResultCounts) && recipe.Results.length !== recipe.ResultCounts.length) {
      pushIssue(errors, path, 'Results and ResultCounts must have the same length.');
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCatalogDefaultConfigSpec(value: unknown): CatalogDefaultConfigValidationResult {
  const errors: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return {
      valid: false,
      errors: [{ path: '$', message: 'Catalog default config must be an object.' }],
    };
  }

  if (value.proliferatorLevels !== undefined && !Array.isArray(value.proliferatorLevels)) {
    pushIssue(errors, '$.proliferatorLevels', 'proliferatorLevels must be an array when present.');
  }

  if (value.buildingRules !== undefined && !Array.isArray(value.buildingRules)) {
    pushIssue(errors, '$.buildingRules', 'buildingRules must be an array when present.');
  }

  if (value.recipeModifierRules !== undefined && !Array.isArray(value.recipeModifierRules)) {
    pushIssue(errors, '$.recipeModifierRules', 'recipeModifierRules must be an array when present.');
  }

  if (value.recommendedRawItemIds !== undefined && !isNumberArray(value.recommendedRawItemIds)) {
    pushIssue(errors, '$.recommendedRawItemIds', 'recommendedRawItemIds must be a number array when present.');
  }

  if (value.recommendedRawItemTypeIds !== undefined && !isNumberArray(value.recommendedRawItemTypeIds)) {
    pushIssue(errors, '$.recommendedRawItemTypeIds', 'recommendedRawItemTypeIds must be a number array when present.');
  }

  if (value.syntheticRecipeTypeIds !== undefined && !isNumberArray(value.syntheticRecipeTypeIds)) {
    pushIssue(errors, '$.syntheticRecipeTypeIds', 'syntheticRecipeTypeIds must be a number array when present.');
  }

  if (value.syntheticRecipeNamePrefixes !== undefined && !isStringArray(value.syntheticRecipeNamePrefixes)) {
    pushIssue(errors, '$.syntheticRecipeNamePrefixes', 'syntheticRecipeNamePrefixes must be a string array when present.');
  }

  if (value.syntheticFactoryIds !== undefined && !isNumberArray(value.syntheticFactoryIds)) {
    pushIssue(errors, '$.syntheticFactoryIds', 'syntheticFactoryIds must be a number array when present.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const config = value as unknown as CatalogDefaultConfigSpec;
  const levels = new Set<number>();
  const buildingIds = new Set<number>();
  const modifierCodes = new Set<number>();
  const modeSet = new Set<ProliferatorMode>(['none', 'speed', 'productivity']);
  const kindSet = new Set<RecipeModifierKind>(['none', 'proliferator', 'special']);

  (config.proliferatorLevels ?? []).forEach((level, index) => {
    const path = `$.proliferatorLevels[${index}]`;

    if (!isRecord(level)) {
      pushIssue(errors, path, 'Proliferator level must be an object.');
      return;
    }

    if (!isFiniteNumber(level.Level) || level.Level < 0) pushIssue(errors, `${path}.Level`, 'Level must be a non-negative finite number.');
    if (level.ItemID !== undefined && !isFiniteNumber(level.ItemID)) pushIssue(errors, `${path}.ItemID`, 'ItemID must be a finite number when present.');
    if (level.SprayCount !== undefined && (!isFiniteNumber(level.SprayCount) || level.SprayCount <= 0)) pushIssue(errors, `${path}.SprayCount`, 'SprayCount must be a positive finite number when present.');
    if (!isFiniteNumber(level.SpeedMultiplier) || level.SpeedMultiplier <= 0) pushIssue(errors, `${path}.SpeedMultiplier`, 'SpeedMultiplier must be a positive finite number.');
    if (!isFiniteNumber(level.ProductivityMultiplier) || level.ProductivityMultiplier <= 0) pushIssue(errors, `${path}.ProductivityMultiplier`, 'ProductivityMultiplier must be a positive finite number.');
    if (!isFiniteNumber(level.PowerMultiplier) || level.PowerMultiplier <= 0) pushIssue(errors, `${path}.PowerMultiplier`, 'PowerMultiplier must be a positive finite number.');

    if (isFiniteNumber(level.Level) && level.Level > 0 && level.SprayCount === undefined) {
      pushIssue(errors, `${path}.SprayCount`, 'SprayCount is required for proliferator levels above 0.');
    }

    if (isFiniteNumber(level.Level)) {
      if (levels.has(level.Level)) {
        pushIssue(errors, `${path}.Level`, `Duplicate proliferator level ${level.Level}.`);
      }
      levels.add(level.Level);
    }
  });

  (config.buildingRules ?? []).forEach((rule, index) => {
    const path = `$.buildingRules[${index}]`;

    if (!isRecord(rule)) {
      pushIssue(errors, path, 'Building rule must be an object.');
      return;
    }

    if (!isFiniteNumber(rule.ID)) pushIssue(errors, `${path}.ID`, 'ID must be a finite number.');
    if (rule.Category !== undefined && (typeof rule.Category !== 'string' || rule.Category.length === 0)) {
      pushIssue(errors, `${path}.Category`, 'Category must be a non-empty string when present.');
    }
    if (rule.IdlePowerMW !== undefined && (!isFiniteNumber(rule.IdlePowerMW) || rule.IdlePowerMW < 0)) pushIssue(errors, `${path}.IdlePowerMW`, 'IdlePowerMW must be a non-negative finite number when present.');
    if (rule.IntrinsicProductivityBonus !== undefined && (!isFiniteNumber(rule.IntrinsicProductivityBonus) || rule.IntrinsicProductivityBonus < 0)) pushIssue(errors, `${path}.IntrinsicProductivityBonus`, 'IntrinsicProductivityBonus must be a non-negative finite number when present.');
    if (rule.SpeedMultiplierOverride !== undefined && (!isFiniteNumber(rule.SpeedMultiplierOverride) || rule.SpeedMultiplierOverride <= 0)) pushIssue(errors, `${path}.SpeedMultiplierOverride`, 'SpeedMultiplierOverride must be a positive finite number when present.');
    if (rule.WorkPowerMWOverride !== undefined && (!isFiniteNumber(rule.WorkPowerMWOverride) || rule.WorkPowerMWOverride < 0)) pushIssue(errors, `${path}.WorkPowerMWOverride`, 'WorkPowerMWOverride must be a non-negative finite number when present.');
    if (rule.Tags !== undefined && !isStringArray(rule.Tags)) pushIssue(errors, `${path}.Tags`, 'Tags must be a string array when present.');

    if (isFiniteNumber(rule.ID)) {
      if (buildingIds.has(rule.ID)) {
        pushIssue(errors, `${path}.ID`, `Duplicate building rule ID ${rule.ID}.`);
      }
      buildingIds.add(rule.ID);
    }
  });

  (config.recipeModifierRules ?? []).forEach((rule, index) => {
    const path = `$.recipeModifierRules[${index}]`;

    if (!isRecord(rule)) {
      pushIssue(errors, path, 'Recipe modifier rule must be an object.');
      return;
    }

    if (!isFiniteNumber(rule.Code) || rule.Code < 0) pushIssue(errors, `${path}.Code`, 'Code must be a non-negative finite number.');
    if (typeof rule.Kind !== 'string' || !kindSet.has(rule.Kind as RecipeModifierKind)) pushIssue(errors, `${path}.Kind`, 'Kind must be one of none, proliferator, or special.');
    if (rule.SupportedModes !== undefined) {
      if (!isStringArray(rule.SupportedModes)) {
        pushIssue(errors, `${path}.SupportedModes`, 'SupportedModes must be a string array when present.');
      } else if (!rule.SupportedModes.every(mode => modeSet.has(mode as ProliferatorMode))) {
        pushIssue(errors, `${path}.SupportedModes`, 'SupportedModes may only include none, speed, or productivity.');
      }
    }
    if (rule.MaxLevel !== undefined && (!isFiniteNumber(rule.MaxLevel) || rule.MaxLevel < 0)) pushIssue(errors, `${path}.MaxLevel`, 'MaxLevel must be a non-negative finite number when present.');
    if (rule.Tags !== undefined && !isStringArray(rule.Tags)) pushIssue(errors, `${path}.Tags`, 'Tags must be a string array when present.');

    if (rule.Kind === 'proliferator' && rule.MaxLevel === undefined) {
      pushIssue(errors, `${path}.MaxLevel`, 'MaxLevel is required for proliferator modifier rules.');
    }

    if (isFiniteNumber(rule.Code)) {
      if (modifierCodes.has(rule.Code)) {
        pushIssue(errors, `${path}.Code`, `Duplicate recipe modifier code ${rule.Code}.`);
      }
      modifierCodes.add(rule.Code);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function summarizeVanillaDatasetSpec(dataset: VanillaDatasetSpec): VanillaDatasetSummary {
  const itemTypes = Array.from(new Set(dataset.items.map(item => item.Type))).sort((a, b) => a - b);
  const recipeTypes = Array.from(new Set(dataset.recipes.map(recipe => recipe.Type))).sort((a, b) => a - b);
  const proliferatorCodes = Array.from(new Set(dataset.recipes.map(recipe => recipe.Proliferator))).sort((a, b) => a - b);
  const factoryIds = Array.from(
    new Set(dataset.recipes.flatMap(recipe => recipe.Factories))
  ).sort((a, b) => a - b);
  const itemKeySummary = summarizeObjectKeys(dataset.items);
  const recipeKeySummary = summarizeObjectKeys(dataset.recipes);

  return {
    topLevelKeys: Object.keys(dataset).sort(),
    itemCount: dataset.items.length,
    recipeCount: dataset.recipes.length,
    itemTypes,
    recipeTypes,
    proliferatorCodes,
    factoryIds,
    itemKeys: itemKeySummary.keys,
    recipeKeys: recipeKeySummary.keys,
    itemKeyCounts: itemKeySummary.keyCounts,
    recipeKeyCounts: recipeKeySummary.keyCounts,
  };
}
