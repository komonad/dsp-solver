import type { ProliferatorMode } from '../catalog';

/**
 * High-level result status for one solve attempt.
 */
export type SolveStatus = 'optimal' | 'infeasible' | 'invalid_input';

/**
 * Human-readable diagnostics collected during validation, compilation, or solve.
 */
export interface SolveDiagnostics {
  /** Validation/compiler/solver messages that explain warnings or failures. */
  messages: string[];
  /** Informational messages that do not indicate problems (e.g. auto-promoted raw inputs). */
  infoMessages: string[];
  /** Soft preferences that were not satisfied by the optimal solution. */
  unmetPreferences: string[];
}

/**
 * One internal model/solve attempt performed while handling a single
 * user-triggered solve request.
 */
export interface SolveAuditAttempt {
  /** Stable phase identifier for this attempt. */
  phase: 'initial_lp' | 'reweighted_lp' | 'complexity_seed_lp' | 'complexity_milp';
  /** Zero-based round index within the phase family when applicable. */
  round?: number;
  /** Model family used for this attempt. */
  modelKind: 'lp' | 'milp';
  /** Count of item-balance dimensions passed into the model. */
  itemCount: number;
  /** Count of unique recipes represented by the active options in this attempt. */
  recipeCount: number;
  /** Count of active recipe/building/proliferator options passed into the model. */
  optionCount: number;
  /** Count of linear constraints passed to the solver. */
  constraintCount: number;
  /** Count of decision variables passed to the solver. */
  variableCount: number;
  /** Time spent constructing the model in milliseconds. */
  buildDurationMs: number;
  /** Time spent inside the solver in milliseconds. */
  solveDurationMs: number;
  /** Total time for this attempt in milliseconds. */
  totalDurationMs: number;
  /** Solver status returned for this attempt. */
  status: string;
  /** Final active surplus item count observed on this attempt, when relevant. */
  surplusItemCount?: number;
  /** Final total surplus rate in items per minute observed on this attempt, when relevant. */
  surplusRatePerMin?: number;
}

/**
 * Structured internal audit trail for one solve request.
 *
 * These metrics are derived by the solver itself and are intended for
 * diagnostics, profiling, and browser-side audit UIs rather than for
 * downstream numerical solving.
 */
export interface SolveAudit {
  /** Item count remaining after upstream graph pruning and option compilation. */
  prunedItemCount: number;
  /** Recipe count remaining after upstream graph pruning. */
  prunedRecipeCount: number;
  /** Option count remaining after request-level graph compilation. */
  prunedOptionCount: number;
  /** External/raw input item count used by the compiled solve graph. */
  resolvedRawInputCount: number;
  /** Time spent compiling and pruning the solve graph in milliseconds. */
  graphDurationMs: number;
  /** Aggregate time spent building models across all attempts in milliseconds. */
  modelDurationMs: number;
  /** Aggregate time spent inside the solver across all attempts in milliseconds. */
  solveDurationMs: number;
  /** Time spent translating the winning solution into the public result in milliseconds. */
  resultDurationMs: number;
  /** Total end-to-end time for this solve in milliseconds. */
  totalDurationMs: number;
  /** Chronological list of model/solve attempts made for this request. */
  attempts: SolveAuditAttempt[];
}

/**
 * Echo of one requested target together with the actual solved net output.
 */
export interface SolvedTarget {
  /** Normalized target item ID. */
  itemId: string;
  /** Requested output rate in items per minute. */
  requestedRatePerMin: number;
  /** Actual solved net output rate in items per minute. */
  actualRatePerMin: number;
}

/**
 * Generic item-rate pair in items per minute.
 */
export interface ItemRate {
  /** Normalized item ID. */
  itemId: string;
  /** Rate in items per minute. */
  ratePerMin: number;
}

/**
 * One concrete selected recipe/building/proliferator variant in the final plan.
 */
export interface RecipePlan {
  /** Recipe ID used by this plan entry. */
  recipeId: string;
  /** Building ID used by this plan entry. */
  buildingId: string;
  /** Selected proliferator level. `0` means none. */
  proliferatorLevel: number;
  /** Selected proliferator mode. */
  proliferatorMode: ProliferatorMode;
  /** Executions per minute for this exact variant. */
  runsPerMin: number;
  /** Continuous building count derived from runsPerMin. */
  exactBuildingCount: number;
  /** User-facing rounded-up building count for placement/power summaries. */
  roundedUpBuildingCount: number;
  /** Working power in MW reported with current solver semantics. */
  activePowerMW: number;
  /** Rounded placement power in MW for user-facing summaries. */
  roundedPlacementPowerMW: number;
  /** Actual consumed item rates for this plan entry. */
  inputs: ItemRate[];
  /** Actual produced item rates for this plan entry. */
  outputs: ItemRate[];
}

/**
 * Aggregated building usage across all recipe plans for one building type.
 */
export interface BuildingSummary {
  /** Building ID for this summary row. */
  buildingId: string;
  /** Sum of exact continuous counts across all plans using this building. */
  exactCount: number;
  /** Sum of rounded plan counts currently used for user-facing placement totals. */
  roundedUpCount: number;
  /** Aggregated working power in MW for this building type. */
  activePowerMW: number;
  /** Aggregated rounded placement power in MW for this building type. */
  roundedPlacementPowerMW: number;
}

/**
 * Top-level power totals for the solved plan.
 */
export interface PowerSummary {
  /** Total working power in MW under current reporting semantics. */
  activePowerMW: number;
  /** Total rounded placement power in MW. */
  roundedPlacementPowerMW: number;
}

/**
 * Per-item production/consumption accounting entry.
 */
export interface ItemBalanceEntry {
  /** Normalized item ID. */
  itemId: string;
  /** Total produced rate in items per minute, including external inputs. */
  producedRatePerMin: number;
  /** Total consumed rate in items per minute, including target demand. */
  consumedRatePerMin: number;
  /** Net rate in items per minute: produced - consumed. */
  netRatePerMin: number;
}

/**
 * Public solver result returned by solveCatalogRequest.
 *
 * This object is intended to be rich enough for presentation layers to render
 * without re-deriving hidden business formulas.
 */
export interface SolveResult {
  /** Final solve status. */
  status: SolveStatus;
  /** Warnings, validation issues, and unmet soft preferences. */
  diagnostics: SolveDiagnostics;
  /** Structured internal audit trail for this solve attempt. */
  solveAudit?: SolveAudit;
  /** Final set of items treated as raw/external inputs during this solve. */
  resolvedRawInputItemIds: string[];
  /** Echo of requested targets and achieved rates. */
  targets: SolvedTarget[];
  /** Detailed selected recipe/building/proliferator variants. */
  recipePlans: RecipePlan[];
  /** Aggregated building usage by building type. */
  buildingSummary: BuildingSummary[];
  /** Aggregated power totals. */
  powerSummary: PowerSummary;
  /** External/raw inputs required by the plan. */
  externalInputs: ItemRate[];
  /** Explicit final net surplus outputs after target demand and recipe consumption. */
  surplusOutputs: ItemRate[];
  /** Full item-balance table for auditing and testing. */
  itemBalance: ItemBalanceEntry[];
}

/**
 * Internal compiled LP option derived from one recipe/building/mode/level
 * combination.
 *
 * This is solver-internal rather than a public API shape.
 */
export type CompiledItemAmountEntry = readonly [itemId: string, amount: number];

export interface CompiledOption {
  /** Stable internal LP variable/option ID. */
  optionId: string;
  /** Recipe ID represented by this option. */
  recipeId: string;
  /** Building ID represented by this option. */
  buildingId: string;
  /** Proliferator level represented by this option. */
  proliferatorLevel: number;
  /** Proliferator mode represented by this option. */
  proliferatorMode: ProliferatorMode;
  /** Optional normalized proliferator consumable item ID. */
  proliferatorItemId?: string;
  /** Working-power multiplier applied to the base building power. */
  powerMultiplier: number;
  /** Effective runs per minute provided by one building of this option. */
  singleBuildingRunsPerMin: number;
  /** Exact building cost per one run/min of this option. */
  buildingCostPerRunPerMin: number;
  /** Exact working-power cost in MW per one run/min of this option. */
  powerCostMWPerRunPerMin: number;
  /** Per-run consumed items for this option. */
  inputPerRun: Record<string, number>;
  /** Precompiled consumed-item entries for fast iteration. */
  inputEntries: CompiledItemAmountEntry[];
  /** Per-run produced items for this option. */
  outputPerRun: Record<string, number>;
  /** Precompiled produced-item entries for fast iteration. */
  outputEntries: CompiledItemAmountEntry[];
  /** Precompiled net coefficients written into item-balance constraints. */
  netItemEntries: CompiledItemAmountEntry[];
  /** Precompiled unique item IDs touched by this option. */
  touchedItemIds: string[];
}
