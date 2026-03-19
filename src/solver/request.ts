import type { ProliferatorMode } from '../catalog';

/**
 * Primary optimization target for one solve request.
 *
 * - `min_buildings`: minimize exact continuous building usage, with small
 *   secondary tie-breaks
 * - `min_power`: minimize working power
 * - `min_external_input`: minimize external/raw input usage
 */
export type SolveObjective = 'min_buildings' | 'min_power' | 'min_external_input';

/**
 * Material-balance policy for non-target items.
 *
 * - `allow_surplus`: intermediate/byproduct items may end with net output >= 0
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

/**
 * Complete solver input for one planning request.
 *
 * All IDs use normalized string IDs from the resolved catalog.
 * Unless otherwise noted, `forced*` fields are hard constraints.
 *
 * `preferredRecipeByItem` is treated as a best-effort strong preference:
 * the solver first tries to enforce it as a hard constraint and only falls
 * back to soft preference solving if that strict solve is infeasible.
 *
 * Other `preferred*` fields remain soft preferences used for tie-breaking.
 */
export interface SolveRequest {
  /** One or more requested output targets. */
  targets: SolveTarget[];
  /** Primary optimization objective. */
  objective: SolveObjective;
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
  /** Hard per-item recipe selection, keyed by produced item ID. */
  forcedRecipeByItem?: Record<string, string>;
  /**
   * Best-effort per-item recipe preference, keyed by produced item ID.
   *
   * The solver first tries to satisfy these as hard recipe choices. If that
   * makes the request infeasible, it falls back to the normal soft-preference
   * solve and reports the missed preference in diagnostics.
   */
  preferredRecipeByItem?: Record<string, string>;
  /** Hard per-recipe building selection. */
  forcedBuildingByRecipe?: Record<string, string>;
  /** Soft per-recipe building preference. */
  preferredBuildingByRecipe?: Record<string, string>;
  /** Hard per-recipe proliferator level selection. Use `0` for none. */
  forcedProliferatorLevelByRecipe?: Record<string, number>;
  /** Soft per-recipe proliferator level preference. */
  preferredProliferatorLevelByRecipe?: Record<string, number>;
  /** Hard per-recipe proliferator mode selection. */
  forcedProliferatorModeByRecipe?: Record<string, ProliferatorMode>;
  /** Soft per-recipe proliferator mode preference. */
  preferredProliferatorModeByRecipe?: Record<string, ProliferatorMode>;
}
