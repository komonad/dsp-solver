import type { ProliferatorMode } from '../catalog';

/**
 * Per-building parameter override applied at solve time.
 */
export interface BuildingParameterOverride {
  /** Stack layers (divides effective placement space). Must be a positive integer. */
  stackLayers?: number;
  /** Override fractionator belt speed in items/min. Must be positive. */
  beltSpeedItemsPerMin?: number;
}

/**
 * Primary optimization target for one solve request.
 *
 * - `min_buildings`: minimize footprint-weighted continuous building usage,
 *   with small secondary tie-breaks
 * - `min_complexity`: minimize the total number of involved item types,
 *   recipe types, and building types, then break ties by power
 * - `min_power`: minimize working power
 * - `min_external_input`: minimize external/raw input usage
 * - `min_weighted`: minimize weighted external inputs plus continuous placement area
 */
export type SolveObjective =
  | 'min_buildings'
  | 'min_complexity'
  | 'min_power'
  | 'min_weighted'
  | 'min_external_input';

/**
 * Material-balance policy for non-target items.
 *
 * - `allow_surplus`: intermediate/byproduct items may end with net output >= 0.
 *   The solver first preserves the selected primary objective, then uses
 *   follow-up LP/MILP refinement to reduce surplus and cleanup complexity
 * - `force_balance`: non-external items must close exactly with net 0 unless
 *   they are explicit targets
 */
export type BalancePolicy = 'allow_surplus' | 'force_balance';

/**
 * One requested item-output target for a solve call.
 */
export interface SolveTarget {
  /** Normalized target item ID. */
  itemId: string;
  /** Requested net output rate in items per minute. */
  ratePerMin: number;
}

/** Independent cost coefficients evaluated at the reference throughput. */
export interface ObjectiveWeights {
  /** Multiplies item-specific input costs at the reference throughput. */
  resources: number;
  /** Multiplies continuous placement area at the reference throughput, including stacks. */
  footprint: number;
  /** Multiplies working MW at the reference throughput. */
  power: number;
  /** Cost per distinct recipe, independent of target throughput and other coefficients. */
  recipes: number;
}

/**
 * Complete solver input for one planning request.
 *
 * All IDs use normalized string IDs from the resolved catalog.
 * Unless otherwise noted, `forced*` fields are hard constraints.
 * `allowedRecipesByItem` is a hard per-item recipe whitelist. Other
 * `preferred*` fields are soft preferences used for tie-breaking.
 */
export interface SolveRequest {
  /**
   * Explicit coefficients override the objective preset. All are finite and
   * non-negative; at least one continuous cost is positive to bound recipe flows.
   * With s = sum(target rates) / 60, the objective is
   * (resources * weighted inputs + footprint * area + power * MW) / s
   * + recipes * distinct recipe count. Zero total throughput uses s = 1.
   * Uniformly scaling all positive targets preserves the cost/count tradeoff;
   * multiple outputs retain their requested proportions. Physical result rates,
   * areas and MW reflect the full requested throughput.
   */
  objectiveWeights?: ObjectiveWeights;
  /** Null permits background search until convergence or cancellation. */
  milpTimeLimitMs?: number | null;
  /** Relative gap target, default 0.01. Zero requests proof of exact optimality. */
  milpRelativeGap?: number;
  /** Absolute cost per distinct recipe in min_weighted, default zero. */
  recipeWeight?: number;
  /** Cost per MW of working power in min_weighted, default zero. */
  powerWeight?: number;
  /**
   * Optional recipe-type penalty for min_weighted. The objective is
   * cost / baselineCost + weight * distinctRecipeCount. Building and
   * proliferator variants of one recipe share one indicator. A zero weight
   * disables refinement. timeLimitMs covers model bounding and MILP search,
   * must be between 100 and 10000, and defaults to 3000.
   */
  recipeCountPenalty?: { weight: number; timeLimitMs?: number };
  /** One or more requested output targets. */
  targets: SolveTarget[];
  /** Objective preset used when objectiveWeights is absent. */
  objective: SolveObjective;
  /**
   * Cost per externally supplied item/min, keyed by item ID. Missing entries
   * cost 1; zero marks an input as free. Costs must be finite and non-negative.
   * Applies to min_external_input and min_weighted, including spray consumables.
   */
  inputWeights?: Record<string, number>;
  /** Multiplier for weighted input costs in min_weighted (default 1). */
  resourceWeight?: number;
  /**
   * Cost per unit of continuous placement area for min_weighted (default 1).
   * Continuous cost also includes weighted external inputs and working power.
   * Zero minimizes weighted inputs alone. Area includes configured stack layers;
   * it excludes belts, sorters, clearance and rounding to whole buildings.
   */
  footprintWeight?: number;
  /** Material-balance policy applied to non-target items. */
  balancePolicy: BalancePolicy;
  /**
   * When enabled, items that are required by the active dependency graph but
   * have no feasible producing option after the current recipe/building/
   * proliferator filters are automatically treated as external/raw inputs for
   * this solve only.
   */
  autoPromoteUnavailableItemsToRawInputs?: boolean;
  /** Additional items that this request should treat as external/raw inputs. */
  rawInputItemIds?: string[];
  /**
   * Dataset-default raw items that this request should treat as internal
   * instead. This lets the UI remove a default raw flag without mutating the
   * dataset itself.
   */
  disabledRawInputItemIds?: string[];
  /** Recipe IDs that are forbidden in this request. */
  disabledRecipeIds?: string[];
  /** Building IDs that are forbidden in this request. */
  disabledBuildingIds?: string[];
  /**
   * Hard per-item allowed recipe whitelist, keyed by produced item ID.
   *
   * When present for one item, any recipe that produces that item but is not
   * listed here is forbidden, including recipes that only produce it as a
   * byproduct.
   */
  allowedRecipesByItem?: Record<string, string[]>;
  /** Hard per-recipe building selection. */
  forcedBuildingByRecipe?: Record<string, string>;
  /** Soft per-recipe building preference. */
  preferredBuildingByRecipe?: Record<string, string>;
  /**
   * Hard global proliferator level request. Use `0` for none.
   *
   * This is a request-level default. Per-recipe `forcedProliferatorLevelByRecipe`
   * takes precedence when both are present.
   */
  globalForcedProliferatorLevel?: number;
  /**
   * Hard global proliferator mode request.
   *
   * This is a request-level default. Per-recipe `forcedProliferatorModeByRecipe`
   * takes precedence when both are present.
   */
  globalForcedProliferatorMode?: ProliferatorMode;
  /** Hard per-recipe proliferator level selection. Use `0` for none. */
  forcedProliferatorLevelByRecipe?: Record<string, number>;
  /** Soft per-recipe proliferator level preference. */
  preferredProliferatorLevelByRecipe?: Record<string, number>;
  /** Hard per-recipe proliferator mode selection. */
  forcedProliferatorModeByRecipe?: Record<string, ProliferatorMode>;
  /** Soft per-recipe proliferator mode preference. */
  preferredProliferatorModeByRecipe?: Record<string, ProliferatorMode>;
  /**
   * Soft global proliferator level preference (used when mode is auto).
   *
   * Unlike `globalForcedProliferatorLevel`, this does not constrain mode or
   * level selection; it only adds a small preference penalty for options
   * that use a different level. Per-recipe `preferredProliferatorLevelByRecipe`
   * takes precedence when both are present.
   */
  globalPreferredProliferatorLevel?: number;
  /** Per-building parameter overrides, keyed by building ID. */
  buildingOverrides?: Record<string, BuildingParameterOverride>;
}
