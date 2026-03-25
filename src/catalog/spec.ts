/**
 * Solver-visible proliferator strategy for a recipe variant.
 *
 * - `none`: no proliferator effect
 * - `speed`: faster execution, unchanged input consumption per run
 * - `productivity`: higher output per run, unchanged input consumption per run
 */
export type ProliferatorMode = 'none' | 'speed' | 'productivity';

/**
 * High-level meaning assigned to a raw dataset modifier code.
 *
 * - `none`: the code means no extra modifier semantics
 * - `proliferator`: the code is interpreted through proliferator-level rules
 * - `special`: reserved for dataset-specific non-proliferator behaviors
 */
export type RecipeModifierKind = 'none' | 'proliferator' | 'special';

/**
 * Raw item record loaded directly from a Vanilla-compatible dataset file.
 *
 * These fields intentionally stay close to the upstream JSON shape.
 */
export interface VanillaItemRecord {
  /** Stable upstream numeric item ID. */
  ID: number;
  /** Upstream item type/category code from the dataset. */
  Type: number;
  /** User-facing display name from the dataset. */
  Name: string;
  /** Upstream icon resource name. */
  IconName: string;
  /** Optional upstream grid-position hint. */
  GridIndex?: number;
  /** Optional working energy usage in game units per tick. */
  WorkEnergyPerTick?: number;
  /** Optional building speed multiplier from the dataset item entry. */
  Speed?: number;
  /** Optional placement size metadata from the dataset. */
  Space?: number;
  /** Optional upstream multiple-output hint. */
  MultipleOutput?: number;
}

/**
 * Raw recipe record loaded directly from a Vanilla-compatible dataset file.
 *
 * A recipe is defined by parallel input/output ID arrays plus their matching
 * count arrays. The parser keeps this shape intact and resolves it into a more
 * explicit internal model later.
 */
export interface VanillaRecipeRecord {
  /** Stable upstream numeric recipe ID. */
  ID: number;
  /** Upstream recipe type/category code from the dataset. */
  Type: number;
  /**
   * Authoritative list of concrete building IDs that may run this recipe.
   * This is not derived from building category.
   */
  Factories: number[];
  /** User-facing display name from the dataset. */
  Name: string;
  /** Input item IDs, positionally matched with ItemCounts. */
  Items: number[];
  /** Per-run input amounts, positionally matched with Items. */
  ItemCounts: number[];
  /** Output item IDs, positionally matched with ResultCounts. */
  Results: number[];
  /** Per-run output amounts, positionally matched with Results. */
  ResultCounts: number[];
  /**
   * Upstream recipe duration in game ticks.
   *
   * The current parser interprets this with the DSP convention
   * `60 ticks = 1 second`, so:
   * - `TimeSpend = 60` means a 1-second recipe
   * - `TimeSpend = 3600` means a 60-second recipe
   */
  TimeSpend: number;
  /**
   * Raw modifier code from the dataset.
   *
   * This is not a proliferator level by itself. Its meaning is resolved
   * through dataset defaults or other configuration.
   */
  Proliferator: number;
  /** Upstream icon resource name. */
  IconName: string;
}

export interface VanillaDatasetSpec {
  /** Raw item list from the dataset file. */
  items: VanillaItemRecord[];
  /** Raw recipe list from the dataset file. */
  recipes: VanillaRecipeRecord[];
}

/**
 * Dataset-coupled default definition for one proliferator level.
 *
 * This is optional metadata/config, not part of the raw dataset itself.
 */
export interface ProliferatorLevelConfigSpec {
  /** Logical proliferator level, usually 1/2/3 for DSP-style data. */
  Level: number;
  /** Optional concrete catalog item ID for this proliferator consumable. */
  ItemID?: number;
  /** Number of item applications provided by one proliferator item. */
  SprayCount?: number;
  /** Speed-mode execution multiplier at this level. */
  SpeedMultiplier: number;
  /** Productivity-mode output multiplier at this level. */
  ProductivityMultiplier: number;
  /** Extra working-power multiplier at this level. */
  PowerMultiplier: number;
}

/**
 * Optional per-building default overrides and metadata.
 *
 * These values are dataset defaults and may later be overridden by user input
 * or future config layers.
 */
export interface CatalogBuildingRuleSpec {
  /** Upstream numeric building item ID that this rule applies to. */
  ID: number;
  /** Optional building category for grouping, filtering, or batch preferences. */
  Category?: string;
  /** Optional idle power metadata in MW. Not currently used by solver output. */
  IdlePowerMW?: number;
  /** Optional built-in output bonus applied to recipe outputs on this building. */
  IntrinsicProductivityBonus?: number;
  /** Optional override when raw dataset speed cannot be used directly. */
  SpeedMultiplierOverride?: number;
  /** Optional override when raw dataset work power cannot be used directly. */
  WorkPowerMWOverride?: number;
  /**
   * Optional conveyor throughput in items per minute used by fractionation-like
   * recipes on this building.
   */
  FractionatorBeltSpeedItemsPerMin?: number;
  /**
   * Optional maximum cargo stack size used by fractionation-like recipes on
   * this building.
   */
  FractionatorMaxItemStack?: number;
  /** Optional free-form tags for presentation or grouping. */
  Tags?: string[];
}

/**
 * Mapping from a raw dataset modifier code to internal semantics.
 */
export interface RecipeModifierRuleSpec {
  /** Raw dataset modifier code, such as the recipe's Proliferator field. */
  Code: number;
  /** High-level interpretation of that raw code. */
  Kind: RecipeModifierKind;
  /** Supported proliferator modes when Kind is `proliferator`. */
  SupportedModes?: ProliferatorMode[];
  /** Highest allowed proliferator level when Kind is `proliferator`. */
  MaxLevel?: number;
  /** Optional free-form tags attached to recipes using this code. */
  Tags?: string[];
}

/**
 * Optional per-recipe default overrides.
 *
 * These are dataset-coupled defaults that patch gaps in the raw exported
 * recipe records without mutating the canonical raw dataset file.
 */
export interface CatalogRecipeRuleSpec {
  /** Upstream numeric recipe ID that this rule applies to. */
  ID: number;
  /** Optional authoritative building list override for this recipe. */
  AllowedBuildingIds?: number[];
  /** Optional effective modifier code override for this recipe. */
  ModifierCodeOverride?: number;
  /**
   * Optional per-pass success probability for fractionation-like recipes.
   *
   * When present, the solver interprets the recipe as a 1:1 conveyor-fed
   * conversion whose throughput is derived from:
   * `FractionatorBeltSpeedItemsPerMin * FractionatorMaxItemStack * FractionationProbability`.
   */
  FractionationProbability?: number;
}

/**
 * Optional dataset-coupled policies for deriving effective modifier semantics.
 *
 * These policies are applied in the interpretation layer, after loading the raw
 * dataset and before the solver consumes the resolved model.
 */
export interface CatalogRecipeModifierPolicySpec {
  /**
   * Optional explicit recipe IDs that should be interpreted as speed-only
   * proliferator recipes.
   */
  speedOnlyRecipeIds?: number[];
  /**
   * When enabled, a recipe becomes speed-only if the same item with the same
   * amount appears in both its inputs and outputs.
   */
  speedOnlyWhenInputOutputCountsMatch?: boolean;
}

/**
 * Symmetric building-expansion group for recipe compatibility.
 *
 * If a recipe is explicitly allowed on any building in the group, the
 * interpretation layer expands its allowed-building set to include every
 * building in the same group.
 */
export interface CatalogRecipeBuildingExpansionGroupSpec {
  /** Concrete building IDs that should be treated as interchangeable here. */
  BuildingIds: number[];
}

/**
 * Optional dataset-level recommended solve settings.
 *
 * These are not hard constraints. They describe the request defaults that a
 * UI or calling layer should prefer when opening this dataset.
 */
export interface CatalogRecommendedSolveSpec {
  /** Optional recommended primary optimization objective. */
  objective?: 'min_buildings' | 'min_power' | 'min_external_input';
  /** Optional recommended material-balance policy. */
  balancePolicy?: 'allow_surplus' | 'force_balance';
}

/**
 * Optional dataset companion defaults.
 *
 * Nothing here is required globally. These values exist to supply semantics or
 * recommendations that the raw dataset file cannot express cleanly on its own.
 */
export interface CatalogDefaultConfigSpec {
  /** Optional ordered icon-atlas pack IDs that the frontend should search for IconName lookups. */
  iconAtlasIds?: string[];
  /** Optional proliferator level table for this dataset. */
  proliferatorLevels?: ProliferatorLevelConfigSpec[];
  /** Optional building metadata/defaults keyed by building ID. */
  buildingRules?: CatalogBuildingRuleSpec[];
  /** Optional per-recipe overrides for gaps in the raw exported dataset. */
  recipeRules?: CatalogRecipeRuleSpec[];
  /** Optional policies used to reinterpret raw recipe modifier codes. */
  recipeModifierPolicy?: CatalogRecipeModifierPolicySpec;
  /** Optional symmetric expansion groups for recipe allowed-building inference. */
  recipeBuildingExpansionGroups?: CatalogRecipeBuildingExpansionGroupSpec[];
  /** Optional building IDs appended to every recipe as globally available factories. */
  recipeBuildingUniversalIds?: number[];
  /** Optional mapping from raw modifier codes to internal meaning. */
  recipeModifierRules?: RecipeModifierRuleSpec[];
  /** Optional recommended solve defaults for UI/request initialization. */
  recommendedSolve?: CatalogRecommendedSolveSpec;
  /** Optional recipe IDs that UI/request layers should disable by default. */
  recommendedDisabledRecipeIds?: number[];
  /** Optional building IDs that UI/request layers should disable by default. */
  recommendedDisabledBuildingIds?: number[];
  /** Optional recommended raw-input item IDs. */
  recommendedRawItemIds?: number[];
  /** Optional recommended raw-input item type codes. */
  recommendedRawItemTypeIds?: number[];
  /** Optional recipe type codes that should default to synthetic. */
  syntheticRecipeTypeIds?: number[];
  /** Optional recipe-name prefixes that should default to synthetic. */
  syntheticRecipeNamePrefixes?: string[];
  /** Optional factory IDs that should default to synthetic-only behavior. */
  syntheticFactoryIds?: number[];
}

/**
 * Normalized item role after parsing dataset + defaults.
 */
export type ItemKind = 'raw' | 'intermediate' | 'product' | 'utility';

/**
 * Resolved item model consumed by solver and presentation code.
 *
 * IDs are normalized to strings so all downstream layers can use one stable ID
 * type regardless of the source dataset.
 */
export interface ResolvedItemSpec {
  /** Normalized string item ID. */
  itemId: string;
  /** Raw upstream item type code. */
  typeId: number;
  /** Display name. */
  name: string;
  /** Resolved role/classification of the item. */
  kind: ItemKind;
  /** Optional icon resource name. */
  icon?: string;
  /** Optional normalized tags. */
  tags?: string[];
  /** Original raw item record for traceability. */
  source: VanillaItemRecord;
}

/**
 * Resolved per-run recipe IO entry.
 */
export interface RecipeIOItem {
  /** Normalized string item ID. */
  itemId: string;
  /** Per-run amount for this item. */
  amount: number;
}

/**
 * Resolved recipe model consumed by the solver.
 */
export interface ResolvedRecipeSpec {
  /** Normalized string recipe ID. */
  recipeId: string;
  /** Raw upstream recipe type code. */
  typeId: number;
  /** Display name. */
  name: string;
  /** Optional icon resource key from the upstream dataset. */
  icon?: string;
  /** Recipe duration in seconds, derived from TimeSpend using 60 ticks = 1 second. */
  cycleTimeSec: number;
  /** Original upstream duration in ticks. */
  timeSpend: number;
  /**
   * Optional per-pass success probability for fractionation-like solver math.
   *
   * When present, the solver ignores raw per-run count magnitudes and treats
   * the recipe as a 1:1 conversion driven by building conveyor throughput.
   */
  fractionationProbability?: number;
  /** Per-run inputs. */
  inputs: RecipeIOItem[];
  /** Per-run outputs. */
  outputs: RecipeIOItem[];
  /** Authoritative list of allowed building IDs for this recipe. */
  allowedBuildingIds: string[];
  /** Effective modifier code after applying dataset defaults/overrides. */
  modifierCode: number;
  /** Resolved interpretation of modifierCode. */
  modifierKind: RecipeModifierKind;
  /** Allowed proliferator modes for this recipe after resolution. */
  supportsProliferatorModes: ProliferatorMode[];
  /** Highest allowed proliferator level for this recipe after resolution. */
  maxProliferatorLevel: number;
  /** Whether this recipe is treated as synthetic/default-disabled for upstream expansion. */
  isSynthetic: boolean;
  /** Optional normalized tags. */
  tags?: string[];
  /** Original raw recipe record for traceability. */
  source: {
    /** Raw recipe record loaded from the dataset. */
    recipe: VanillaRecipeRecord;
    /** Optional dataset default rule used during resolution. */
    rule?: CatalogRecipeRuleSpec;
  };
}

/**
 * Resolved building model consumed by the solver.
 */
export interface ResolvedBuildingSpec {
  /** Normalized string building ID. */
  buildingId: string;
  /** Raw upstream item type code for the building item. */
  typeId: number;
  /** Display name. */
  name: string;
  /** Optional icon resource key from the upstream dataset item entry. */
  icon?: string;
  /** Resolved building category. */
  category: string;
  /** Effective building speed multiplier used by solver math. */
  speedMultiplier: number;
  /** Working power in MW at base load, before proliferator power multipliers. */
  workPowerMW: number;
  /** Optional conveyor throughput in items per minute for fractionation-like recipes. */
  fractionatorBeltSpeedItemsPerMin?: number;
  /** Optional maximum cargo stack size for fractionation-like recipes. */
  fractionatorMaxItemStack?: number;
  /** Optional idle power metadata in MW. */
  idlePowerMW?: number;
  /** Built-in output bonus applied multiplicatively to recipe outputs. */
  intrinsicProductivityBonus: number;
  /** Optional normalized tags. */
  tags?: string[];
  /** Raw provenance for this resolved building entry. */
  source: {
    /** Raw item entry that represents this building. */
    item: VanillaItemRecord;
    /** Optional dataset default rule used during resolution. */
    rule?: CatalogBuildingRuleSpec;
  };
}

/**
 * Resolved proliferator level model consumed by solver option compilation.
 */
export interface ResolvedProliferatorLevelSpec {
  /** Logical proliferator level. */
  level: number;
  /** Optional normalized item ID of the proliferator consumable. */
  itemId?: string;
  /** Number of applications provided by one proliferator item. */
  sprayCount?: number;
  /** Speed-mode execution multiplier. */
  speedMultiplier: number;
  /** Productivity-mode output multiplier. */
  productivityMultiplier: number;
  /** Working-power multiplier. */
  powerMultiplier: number;
  /** Original config record for traceability. */
  source: ProliferatorLevelConfigSpec;
}

/**
 * Fully resolved catalog model.
 *
 * This is the boundary object consumed by the solver. The web layer should not
 * reinterpret raw dataset semantics once a catalog has been resolved.
 */
export interface ResolvedCatalogModel {
  /** Schema/version label for the resolved model. */
  version: string;
  /** Original raw dataset. */
  dataset: VanillaDatasetSpec;
  /** Optional companion defaults used during resolution. */
  defaultConfig: CatalogDefaultConfigSpec;
  /** Ordered icon-atlas pack IDs resolved from dataset defaults for frontend rendering. */
  iconAtlasIds: string[];
  /** Resolved item list. */
  items: ResolvedItemSpec[];
  /** Resolved recipe list. */
  recipes: ResolvedRecipeSpec[];
  /** Resolved building list. */
  buildings: ResolvedBuildingSpec[];
  /** Resolved proliferator level list. */
  proliferatorLevels: ResolvedProliferatorLevelSpec[];
  /** Fast lookup map for items. */
  itemMap: Map<string, ResolvedItemSpec>;
  /** Fast lookup map for recipes. */
  recipeMap: Map<string, ResolvedRecipeSpec>;
  /** Fast lookup map for buildings. */
  buildingMap: Map<string, ResolvedBuildingSpec>;
  /** Fast lookup map for proliferator levels. */
  proliferatorLevelMap: Map<number, ResolvedProliferatorLevelSpec>;
  /** Recommended request defaults carried through from the dataset defaults. */
  recommendedSolve: CatalogRecommendedSolveSpec;
  /** Default disabled recipe IDs inferred from dataset defaults. */
  recommendedDisabledRecipeIds: string[];
  /** Default disabled building IDs inferred from dataset defaults. */
  recommendedDisabledBuildingIds: string[];
  /** Default raw-input item IDs inferred from dataset + defaults. */
  rawItemIds: string[];
  /** Recipe IDs treated as synthetic by default. */
  syntheticRecipeIds: string[];
}

/**
 * Structured validation problem used by dataset/config validators.
 */
export interface ValidationIssue {
  /** JSON-like path of the offending field. */
  path: string;
  /** Human-readable validation message. */
  message: string;
}

/**
 * Validation result for a raw dataset payload.
 */
export interface VanillaDatasetValidationResult {
  /** Whether validation succeeded without errors. */
  valid: boolean;
  /** Collected validation issues. */
  errors: ValidationIssue[];
}

/**
 * Validation result for a dataset default-config payload.
 */
export interface CatalogDefaultConfigValidationResult {
  /** Whether validation succeeded without errors. */
  valid: boolean;
  /** Collected validation issues. */
  errors: ValidationIssue[];
}

/**
 * Lightweight summary used for introspection/debugging of a raw dataset file.
 */
export interface VanillaDatasetSummary {
  /** Top-level keys found in the dataset object. */
  topLevelKeys: string[];
  /** Number of item records. */
  itemCount: number;
  /** Number of recipe records. */
  recipeCount: number;
  /** Distinct item type codes present in the dataset. */
  itemTypes: number[];
  /** Distinct recipe type codes present in the dataset. */
  recipeTypes: number[];
  /** Distinct raw modifier codes present in recipes. */
  proliferatorCodes: number[];
  /** Distinct building IDs referenced by recipe Factories arrays. */
  factoryIds: number[];
  /** Union of keys observed across item records. */
  itemKeys: string[];
  /** Union of keys observed across recipe records. */
  recipeKeys: string[];
  /** Per-key frequency summary across item records. */
  itemKeyCounts: Record<string, number>;
  /** Per-key frequency summary across recipe records. */
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

  if (value.iconAtlasIds !== undefined && !isStringArray(value.iconAtlasIds)) {
    pushIssue(errors, '$.iconAtlasIds', 'iconAtlasIds must be a string array when present.');
  }

  if (value.buildingRules !== undefined && !Array.isArray(value.buildingRules)) {
    pushIssue(errors, '$.buildingRules', 'buildingRules must be an array when present.');
  }

  if (value.recipeRules !== undefined && !Array.isArray(value.recipeRules)) {
    pushIssue(errors, '$.recipeRules', 'recipeRules must be an array when present.');
  }

  if (value.recipeModifierPolicy !== undefined && !isRecord(value.recipeModifierPolicy)) {
    pushIssue(errors, '$.recipeModifierPolicy', 'recipeModifierPolicy must be an object when present.');
  }

  if (
    value.recipeBuildingExpansionGroups !== undefined &&
    !Array.isArray(value.recipeBuildingExpansionGroups)
  ) {
    pushIssue(
      errors,
      '$.recipeBuildingExpansionGroups',
      'recipeBuildingExpansionGroups must be an array when present.'
    );
  }

  if (
    value.recipeBuildingUniversalIds !== undefined &&
    !isNumberArray(value.recipeBuildingUniversalIds)
  ) {
    pushIssue(
      errors,
      '$.recipeBuildingUniversalIds',
      'recipeBuildingUniversalIds must be a number array when present.'
    );
  }

  if (value.recipeModifierRules !== undefined && !Array.isArray(value.recipeModifierRules)) {
    pushIssue(errors, '$.recipeModifierRules', 'recipeModifierRules must be an array when present.');
  }

  if (value.recommendedSolve !== undefined && !isRecord(value.recommendedSolve)) {
    pushIssue(errors, '$.recommendedSolve', 'recommendedSolve must be an object when present.');
  }

  if (value.recommendedRawItemIds !== undefined && !isNumberArray(value.recommendedRawItemIds)) {
    pushIssue(errors, '$.recommendedRawItemIds', 'recommendedRawItemIds must be a number array when present.');
  }

  if (
    value.recommendedDisabledRecipeIds !== undefined &&
    !isNumberArray(value.recommendedDisabledRecipeIds)
  ) {
    pushIssue(
      errors,
      '$.recommendedDisabledRecipeIds',
      'recommendedDisabledRecipeIds must be a number array when present.'
    );
  }

  if (
    value.recommendedDisabledBuildingIds !== undefined &&
    !isNumberArray(value.recommendedDisabledBuildingIds)
  ) {
    pushIssue(
      errors,
      '$.recommendedDisabledBuildingIds',
      'recommendedDisabledBuildingIds must be a number array when present.'
    );
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
  const recipeRuleIds = new Set<number>();
  const modifierCodes = new Set<number>();
  const modeSet = new Set<ProliferatorMode>(['none', 'speed', 'productivity']);
  const kindSet = new Set<RecipeModifierKind>(['none', 'proliferator', 'special']);
  const objectiveSet = new Set(['min_buildings', 'min_power', 'min_external_input']);
  const balancePolicySet = new Set(['allow_surplus', 'force_balance']);

  if (config.recommendedSolve !== undefined) {
    if (
      config.recommendedSolve.objective !== undefined &&
      !objectiveSet.has(config.recommendedSolve.objective)
    ) {
      pushIssue(
        errors,
        '$.recommendedSolve.objective',
        'objective must be one of min_buildings, min_power, or min_external_input.'
      );
    }

    if (
      config.recommendedSolve.balancePolicy !== undefined &&
      !balancePolicySet.has(config.recommendedSolve.balancePolicy)
    ) {
      pushIssue(
        errors,
        '$.recommendedSolve.balancePolicy',
        'balancePolicy must be one of allow_surplus or force_balance.'
      );
    }
  }

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
    if (rule.FractionatorBeltSpeedItemsPerMin !== undefined && (!isFiniteNumber(rule.FractionatorBeltSpeedItemsPerMin) || rule.FractionatorBeltSpeedItemsPerMin <= 0)) pushIssue(errors, `${path}.FractionatorBeltSpeedItemsPerMin`, 'FractionatorBeltSpeedItemsPerMin must be a positive finite number when present.');
    if (rule.FractionatorMaxItemStack !== undefined && (!isFiniteNumber(rule.FractionatorMaxItemStack) || rule.FractionatorMaxItemStack <= 0)) pushIssue(errors, `${path}.FractionatorMaxItemStack`, 'FractionatorMaxItemStack must be a positive finite number when present.');
    if (rule.Tags !== undefined && !isStringArray(rule.Tags)) pushIssue(errors, `${path}.Tags`, 'Tags must be a string array when present.');

    if (isFiniteNumber(rule.ID)) {
      if (buildingIds.has(rule.ID)) {
        pushIssue(errors, `${path}.ID`, `Duplicate building rule ID ${rule.ID}.`);
      }
      buildingIds.add(rule.ID);
    }
  });

  (config.recipeRules ?? []).forEach((rule, index) => {
    const path = `$.recipeRules[${index}]`;

    if (!isRecord(rule)) {
      pushIssue(errors, path, 'Recipe rule must be an object.');
      return;
    }

    if (!isFiniteNumber(rule.ID)) pushIssue(errors, `${path}.ID`, 'ID must be a finite number.');
    if (
      rule.AllowedBuildingIds !== undefined &&
      !isNumberArray(rule.AllowedBuildingIds)
    ) {
      pushIssue(
        errors,
        `${path}.AllowedBuildingIds`,
        'AllowedBuildingIds must be a number array when present.'
      );
    }
    if (
      rule.ModifierCodeOverride !== undefined &&
      (!isFiniteNumber(rule.ModifierCodeOverride) || rule.ModifierCodeOverride < 0)
    ) {
      pushIssue(
        errors,
        `${path}.ModifierCodeOverride`,
        'ModifierCodeOverride must be a non-negative finite number when present.'
      );
    }
    if (rule.FractionationProbability !== undefined && (!isFiniteNumber(rule.FractionationProbability) || rule.FractionationProbability <= 0 || rule.FractionationProbability > 1)) pushIssue(errors, `${path}.FractionationProbability`, 'FractionationProbability must be a finite number in the range (0, 1].');

    if (isFiniteNumber(rule.ID)) {
      if (recipeRuleIds.has(rule.ID)) {
        pushIssue(errors, `${path}.ID`, `Duplicate recipe rule ID ${rule.ID}.`);
      }
      recipeRuleIds.add(rule.ID);
    }
  });

  if (config.recipeModifierPolicy !== undefined) {
    const policy = config.recipeModifierPolicy;

    if (
      policy.speedOnlyRecipeIds !== undefined &&
      !isNumberArray(policy.speedOnlyRecipeIds)
    ) {
      pushIssue(
        errors,
        '$.recipeModifierPolicy.speedOnlyRecipeIds',
        'speedOnlyRecipeIds must be a number array when present.'
      );
    }

    if (
      policy.speedOnlyWhenInputOutputCountsMatch !== undefined &&
      typeof policy.speedOnlyWhenInputOutputCountsMatch !== 'boolean'
    ) {
      pushIssue(
        errors,
        '$.recipeModifierPolicy.speedOnlyWhenInputOutputCountsMatch',
        'speedOnlyWhenInputOutputCountsMatch must be a boolean when present.'
      );
    }
  }

  (config.recipeBuildingExpansionGroups ?? []).forEach((group, index) => {
    const path = `$.recipeBuildingExpansionGroups[${index}]`;

    if (!isRecord(group)) {
      pushIssue(errors, path, 'Recipe building expansion group must be an object.');
      return;
    }

    if (!isNumberArray(group.BuildingIds) || group.BuildingIds.length === 0) {
      pushIssue(
        errors,
        `${path}.BuildingIds`,
        'BuildingIds must be a non-empty number array.'
      );
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
