import type {
  ResolvedCatalogModel,
} from '../catalog';
import type { SolveRequest } from './request';
import { validateSolveRequest } from './validation';
import type {
  SolveAudit,
  SolveAuditAttempt,
  SolveResult,
} from './result';
import type { Model, Options as SolverOptions, Solution, SolverImplementation } from './implementation';
import { yalpsSolverImplementation } from './yalpsImplementation';
import { recordSolverPerf } from './perf';
import {
  EPSILON,
  type CompiledOptionContext,
  type LinearSolveCandidate,
  type SurplusSolutionMetrics,
  currentTimeMs,
  aggregateTargetRates,
  getCatalogSolveCache,
  getCachedSolvedRequestResult,
  setCachedSolvedRequestResult,
  compileSolveGraph,
  collectModelOptions,
  collectInvolvedItemIds,
  collectExternalItemIds,
  countActiveRecipeIds,
} from './solveGraph';
import {
  OBJECTIVE_EPSILON,
  buildObjectiveCoefficient,
  buildExternalInputObjectiveCoefficient,
  computePrimaryObjectiveUpperBound,
  addPrimaryObjectiveUpperBoundConstraint,
  buildComplexityPowerCoefficient,
  buildSurplusVariableName,
  buildExactItemBalanceConstraints,
  ensureVariableCoefficients,
  addVariableCoefficient,
  buildComplexityUsageVariableName,
  collectComplexityTrackedItemIds,
  estimateComplexityLinkUpperBound,
  buildSolveAuditAttempt,
  buildLinearModel,
  buildComplexityModel,
} from './modelBuilder';
import {
  collectSurplusSolutionMetrics,
  countSolutionActiveRecipeIds,
  countSolutionActiveOptionIds,
  collectSolvedUsageCounts,
  buildInfeasibleSolveResult,
  buildResultFromSolution,
  buildInvalidInputSolveResult,
} from './solveResultBuilder';

const SURPLUS_OUTPUT_EPSILON = 1e-3;
const ALLOW_SURPLUS_SYNC_BUDGET_MS = 200;
const ALLOW_SURPLUS_MAX_LINEAR_SOLVES = 5;
const ALLOW_SURPLUS_REWEIGHT_MAX_FACTOR = 256;
const ALLOW_SURPLUS_REWEIGHT_MAX_EXPONENT = 4;
const COMPLEXITY_LINK_BOUND_FLOOR = 64;
const COMPLEXITY_LINK_BOUND_MULTIPLIERS = [1, 4, 16, 64, 256];
const SURPLUS_MILP_TIMEOUT_MS = 750;
const SURPLUS_MILP_TOLERANCE = 0.10;
const SURPLUS_COMPLEXITY_MILP_MAX_OPTIONS = 256;
const SURPLUS_COMPLEXITY_MILP_MAX_BINARIES = 512;
const SURPLUS_COMPLEXITY_MILP_MAX_OPTIONS_YALPS = 80;
const SURPLUS_COMPLEXITY_MILP_MAX_BINARIES_YALPS = 160;

/** Weight for recipe-usage binary indicators in the surplus-type MILP.
 *  Surplus type indicators have weight 1 (integer), so recipe count is a
 *  secondary tiebreaker: 100 recipes = 1 surplus type.  Typical recipe
 *  counts are < 50, so surplus type count always dominates. */
const SURPLUS_MILP_RECIPE_WEIGHT = 1e-2;

/** Weight for LP-inactive recipe indicators.  Much higher than
 *  `SURPLUS_MILP_RECIPE_WEIGHT` so the MILP only introduces a recipe that
 *  was not used in the LP when it substantially reduces surplus type count.
 *  At weight 0.5, the MILP needs to save at least 1 surplus type to justify
 *  introducing 2 new recipes. */
const SURPLUS_MILP_NEW_RECIPE_WEIGHT = 0.5;

function buildSurplusTypeMilpModel(params: {
  request: SolveRequest;
  compiledOptions: CompiledOptionContext[];
  targetRateMap: Map<string, number>;
  externalItemIds: Set<string>;
  surplusUpperBound: number;
  optionRateUpperBoundByOptionId: ReadonlyMap<string, number>;
  defaultOptionRateUpperBound: number;
  /** Option IDs with non-zero rates in the LP solution — only recipes
   *  that are actually used get binary indicators, dramatically reducing
   *  the number of binaries for the branch-and-bound solver. */
  activeOptionIds: ReadonlySet<string>;
  /** Item IDs that could potentially accumulate surplus if the MILP
   *  changes recipe usage.  Includes LP surplus items plus all output
   *  items of LP-active recipes. */
  surplusCandidateItemIds: ReadonlySet<string>;
  primaryObjectiveUpperBound?: number;
}): {
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  involvedItemCount: number;
  activeRecipeCount: number;
  binaryCount: number;
} {
  const {
    request,
    compiledOptions,
    targetRateMap,
    externalItemIds,
    surplusUpperBound,
    optionRateUpperBoundByOptionId,
    defaultOptionRateUpperBound,
    activeOptionIds,
    surplusCandidateItemIds,
    primaryObjectiveUpperBound,
  } = params;

  const activeOptions = collectSurplusMilpOptions({
    request,
    compiledOptions,
    activeOptionIds,
    targetRateMap,
    surplusCandidateItemIds,
  });
  const involvedItemIds = collectInvolvedItemIds(activeOptions, targetRateMap, externalItemIds);
  const constraints = buildExactItemBalanceConstraints(involvedItemIds, targetRateMap);
  const variables: Record<string, Record<string, number>> = {};
  const binaries = new Set<string>();

  // Build recipe → option mapping for recipe-usage linking constraints.
  const recipeUsageMap = new Map<string, string[]>();

  // For each item, collect the set of recipes that produce it (positive net
  // output) and whether any recipe consumes it.  Used to identify:
  // (a) items that can never have surplus (no producer exists)
  // (b) required recipes (sole producer of a consumed/target item)
  const itemProducerRecipes = new Map<string, Set<string>>();
  const itemIsConsumed = new Set<string>();

  for (const { option, recipe } of activeOptions) {
    const coefficients: Record<string, number> = {
      __objective__: buildObjectiveCoefficient(request, recipe, option),
    };
    for (const [itemId, amount] of option.netItemEntries) {
      coefficients[itemId] = amount;
      if (amount > EPSILON) {
        let producers = itemProducerRecipes.get(itemId);
        if (!producers) {
          producers = new Set();
          itemProducerRecipes.set(itemId, producers);
        }
        producers.add(recipe.recipeId);
      } else if (amount < -EPSILON) {
        itemIsConsumed.add(itemId);
      }
    }
    variables[option.optionId] = coefficients;

    const optionIds = recipeUsageMap.get(recipe.recipeId) ?? [];
    optionIds.push(option.optionId);
    recipeUsageMap.set(recipe.recipeId, optionIds);
  }

  // A recipe is required if it is the sole producer of any item that must
  // be produced (target item or consumed by another recipe).  Its binary
  // indicator can be fixed to 1 (i.e. omitted), reducing the MILP search
  // space without changing the feasible set.
  const requiredRecipeIds = new Set<string>();
  for (const itemId of involvedItemIds) {
    const producers = itemProducerRecipes.get(itemId);
    if (!producers || producers.size !== 1) {
      continue;
    }
    const isTarget = (targetRateMap.get(itemId) ?? 0) > EPSILON;
    if (isTarget || itemIsConsumed.has(itemId)) {
      requiredRecipeIds.add(producers.values().next().value!);
    }
  }

  // Items that have no producing recipe can never accumulate surplus —
  // their surplus variable will always be zero.  Skip their binary
  // indicator to shrink the MILP.
  //
  // Additionally, if ALL recipes that touch an item (produce or consume)
  // are required, the MILP cannot change that item's supply/demand balance,
  // so it can never gain surplus either.
  const itemConsumerRecipes = new Map<string, Set<string>>();
  for (const { option, recipe } of activeOptions) {
    for (const [itemId, amount] of option.netItemEntries) {
      if (amount < -EPSILON) {
        let consumers = itemConsumerRecipes.get(itemId);
        if (!consumers) {
          consumers = new Set();
          itemConsumerRecipes.set(itemId, consumers);
        }
        consumers.add(recipe.recipeId);
      }
    }
  }

  const itemCanHaveSurplus = new Set<string>();
  for (const itemId of involvedItemIds) {
    const producers = itemProducerRecipes.get(itemId);
    if (!producers) {
      continue; // no producer → surplus always 0
    }
    // Check if any producer or consumer is non-required (i.e. the MILP
    // could toggle it, potentially disrupting this item's balance).
    let hasToggleableRecipe = false;
    for (const recipeId of producers) {
      if (!requiredRecipeIds.has(recipeId)) {
        hasToggleableRecipe = true;
        break;
      }
    }
    if (!hasToggleableRecipe) {
      const consumers = itemConsumerRecipes.get(itemId);
      if (consumers) {
        for (const recipeId of consumers) {
          if (!requiredRecipeIds.has(recipeId)) {
            hasToggleableRecipe = true;
            break;
          }
        }
      }
    }
    if (hasToggleableRecipe) {
      itemCanHaveSurplus.add(itemId);
    }
  }

  for (const itemId of externalItemIds) {
    variables[`ext:${itemId}`] = {
      [itemId]: 1,
      __objective__: buildExternalInputObjectiveCoefficient(request),
    };
  }

  for (const itemId of involvedItemIds) {
    const linkConstraint = `__surplus_type_link:${itemId}`;
    constraints[linkConstraint] = { min: 0 };

    // Surplus variable: absorbs excess production, no direct objective cost.
    variables[buildSurplusVariableName(itemId)] = {
      [itemId]: -1,
      [linkConstraint]: -1,
    };

    // Binary indicator: y_i = 1 iff item i has any surplus.
    // Only add for items that (a) have a producing recipe and (b) had
    // non-zero surplus in the LP solution.  Other items can still
    // accumulate surplus via the continuous variable, but won't incur
    // the binary indicator cost in the MILP objective.
    if (itemCanHaveSurplus.has(itemId) && surplusCandidateItemIds.has(itemId)) {
      const indicatorName = `__surplus_type:${itemId}`;
      variables[indicatorName] = {
        [linkConstraint]: surplusUpperBound,
        __objective__: 1,
      };
      binaries.add(indicatorName);
    }
  }

  // Recipe-usage binary indicators: penalise the number of distinct recipes
  // used.  This prevents the solver from adding entire production chains
  // solely to consume a small byproduct surplus.
  // LP-active recipes get a light penalty (SURPLUS_MILP_RECIPE_WEIGHT) since
  // they are already part of the solution.  LP-inactive recipes get a much
  // heavier penalty (SURPLUS_MILP_NEW_RECIPE_WEIGHT) so the MILP only
  // introduces them when doing so substantially reduces surplus type count.
  //
  // Do not skip "required" recipes here. A recipe can be the sole producer
  // of an intermediate that is only consumed by an optional surplus-handling
  // branch; dropping its binary would let that whole branch hide behind one
  // counted root recipe and break complexity optimisation.
  for (const [recipeId, optionIds] of recipeUsageMap.entries()) {
    const hasActiveOption = optionIds.some(id => activeOptionIds.has(id));
    const weight = hasActiveOption
      ? SURPLUS_MILP_RECIPE_WEIGHT
      : SURPLUS_MILP_NEW_RECIPE_WEIGHT;
    const constraintName = `__surplus_recipe_link:${recipeId}`;
    constraints[constraintName] = { max: 0 };
    for (const optionId of optionIds) {
      addVariableCoefficient(variables, optionId, constraintName, 1);
    }
    const usageVariable = `__surplus_recipe:${recipeId}`;
    const coefficients = ensureVariableCoefficients(variables, usageVariable);
    coefficients.__objective__ = weight;
    binaries.add(usageVariable);
    const recipeRateUpperBound = optionIds.reduce(
      (sum, optionId) =>
        sum + (optionRateUpperBoundByOptionId.get(optionId) ?? defaultOptionRateUpperBound),
      0
    );
    addVariableCoefficient(variables, usageVariable, constraintName, -recipeRateUpperBound);
  }

  addPrimaryObjectiveUpperBoundConstraint({
    request,
    activeOptions,
    externalItemIds,
    variables,
    constraints,
    primaryObjectiveUpperBound,
  });

  return {
    model: {
      direction: 'minimize',
      objective: '__objective__',
      constraints,
      variables,
      binaries,
    },
    activeOptions,
    involvedItemCount: involvedItemIds.length,
    activeRecipeCount: countActiveRecipeIds(activeOptions),
    binaryCount: binaries.size,
  };
}

function estimateSurplusUpperBound(
  solutionVariables: Iterable<[string, number]>,
  targetRateMap: Map<string, number>
): number {
  let totalRate = 0;
  let maxRate = 0;

  for (const [variableName, value] of solutionVariables) {
    if (value <= EPSILON || variableName.startsWith('__')) {
      continue;
    }
    totalRate += value;
    maxRate = Math.max(maxRate, value);
  }

  const totalTargetRate = Array.from(targetRateMap.values())
    .filter(rate => rate > EPSILON)
    .reduce((sum, rate) => sum + rate, 0);

  return Math.max(COMPLEXITY_LINK_BOUND_FLOOR, totalRate * 2, maxRate * 8, totalTargetRate * 8);
}

/** Estimate a tight big-M for recipe-usage linking constraints.
 *  Only needs to bound the maximum rate of any single option variable —
 *  much smaller than the surplus upper bound. */
function estimateOptionRateUpperBounds(
  solutionVariables: Iterable<[string, number]>,
  targetRateMap: Map<string, number>
): {
  optionRateUpperBoundByOptionId: ReadonlyMap<string, number>;
  defaultOptionRateUpperBound: number;
} {
  const optionRateUpperBoundByOptionId = new Map<string, number>();
  for (const [variableName, value] of solutionVariables) {
    if (
      value <= EPSILON ||
      variableName.startsWith('__') ||
      variableName.startsWith('ext:')
    ) {
      continue;
    }
    optionRateUpperBoundByOptionId.set(
      variableName,
      Math.max(COMPLEXITY_LINK_BOUND_FLOOR, value * 4)
    );
  }
  // Use 4× the max observed option rate as headroom for the MILP to
  // explore alternative recipe combinations.
  const totalTargetRate = Array.from(targetRateMap.values())
    .filter(rate => rate > EPSILON)
    .reduce((sum, rate) => sum + rate, 0);

  return {
    optionRateUpperBoundByOptionId,
    defaultOptionRateUpperBound: Math.max(COMPLEXITY_LINK_BOUND_FLOOR, totalTargetRate * 16),
  };
}

function buildPrimaryObjectiveValue(
  request: SolveRequest,
  activeOptions: CompiledOptionContext[],
  solutionVariables: Iterable<[string, number]>
): number {
  const optionById = new Map(activeOptions.map(entry => [entry.option.optionId, entry.option]));
  let total = 0;

  for (const [variableName, value] of solutionVariables) {
    if (value <= EPSILON) {
      continue;
    }

    if (variableName.startsWith('ext:')) {
      if (request.objective === 'min_external_input') {
        total += value;
      }
      continue;
    }

    const option = optionById.get(variableName);
    if (!option) {
      continue;
    }

    if (request.objective === 'min_buildings') {
      total += option.buildingCostPerRunPerMin * value;
    } else if (request.objective === 'min_power') {
      total += option.powerCostMWPerRunPerMin * value;
    }
  }

  return total;
}

function compareLinearSolveCandidates(left: LinearSolveCandidate, right: LinearSolveCandidate): number {
  if (left.surplus.activeItemIds.length !== right.surplus.activeItemIds.length) {
    return left.surplus.activeItemIds.length - right.surplus.activeItemIds.length;
  }

  if (left.activeOptionCount !== right.activeOptionCount) {
    return left.activeOptionCount - right.activeOptionCount;
  }

  if (left.activeRecipeCount !== right.activeRecipeCount) {
    return left.activeRecipeCount - right.activeRecipeCount;
  }

  if (
    Math.abs(left.surplus.totalRatePerMin - right.surplus.totalRatePerMin) > SURPLUS_OUTPUT_EPSILON
  ) {
    return left.surplus.totalRatePerMin - right.surplus.totalRatePerMin;
  }

  if (Math.abs(left.primaryObjectiveValue - right.primaryObjectiveValue) > OBJECTIVE_EPSILON) {
    return left.primaryObjectiveValue - right.primaryObjectiveValue;
  }

  return 0;
}

function buildReweightedSurplusWeights(
  metrics: SurplusSolutionMetrics,
  round: number
): ReadonlyMap<string, number> | undefined {
  if (metrics.activeItemIds.length <= 1 || metrics.totalRatePerMin <= SURPLUS_OUTPUT_EPSILON) {
    return undefined;
  }

  const exponent = Math.min(ALLOW_SURPLUS_REWEIGHT_MAX_EXPONENT, 2 + round);
  const weights = new Map<string, number>();
  for (const itemId of metrics.activeItemIds) {
    const rate = metrics.itemRateMap.get(itemId) ?? 0;
    const baseWeight = metrics.totalRatePerMin / Math.max(rate, EPSILON);
    weights.set(
      itemId,
      Math.max(
        1,
        Math.min(ALLOW_SURPLUS_REWEIGHT_MAX_FACTOR, Math.pow(baseWeight, exponent))
      )
    );
  }
  return weights;
}

function buildLinearSolveCandidate(params: {
  request: SolveRequest;
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  solution: Solution<string>;
}): LinearSolveCandidate {
  const { request, model, activeOptions, solution } = params;
  return {
    model,
    activeOptions,
    solution,
    surplus: collectSurplusSolutionMetrics(solution.variables),
    activeOptionCount: countSolutionActiveOptionIds(solution.variables),
    activeRecipeCount: countSolutionActiveRecipeIds(activeOptions, solution.variables),
    primaryObjectiveValue: buildPrimaryObjectiveValue(request, activeOptions, solution.variables),
  };
}

function shouldSkipSurplusComplexityMilp(
  implementation: SolverImplementation,
  activeOptionCount: number,
  binaryCount: number
): boolean {
  if (
    activeOptionCount > SURPLUS_COMPLEXITY_MILP_MAX_OPTIONS ||
    binaryCount > SURPLUS_COMPLEXITY_MILP_MAX_BINARIES
  ) {
    return true;
  }

  if (implementation.implementationId === yalpsSolverImplementation.implementationId) {
    return (
      activeOptionCount > SURPLUS_COMPLEXITY_MILP_MAX_OPTIONS_YALPS ||
      binaryCount > SURPLUS_COMPLEXITY_MILP_MAX_BINARIES_YALPS
    );
  }

  return false;
}

function buildFixedSurplusRecipeMilpModel(params: {
  catalog: ResolvedCatalogModel;
  request: SolveRequest;
  compiledOptions: CompiledOptionContext[];
  targetRateMap: Map<string, number>;
  externalItemIds: Set<string>;
  optionRateUpperBoundByOptionId: ReadonlyMap<string, number>;
  defaultOptionRateUpperBound: number;
  activeOptionIds: ReadonlySet<string>;
  allowedSurplusItemIds: ReadonlySet<string>;
  primaryObjectiveUpperBound?: number;
}): {
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  involvedItemCount: number;
  activeRecipeCount: number;
  binaryCount: number;
} {
  const {
    catalog,
    request,
    compiledOptions,
    targetRateMap,
    externalItemIds,
    optionRateUpperBoundByOptionId,
    defaultOptionRateUpperBound,
    activeOptionIds,
    allowedSurplusItemIds,
    primaryObjectiveUpperBound,
  } = params;

  const activeOptions = collectFixedSurplusMilpOptions({
    request,
    compiledOptions,
    activeOptionIds,
    allowedSurplusItemIds,
  });
  const involvedItemIds = collectInvolvedItemIds(activeOptions, targetRateMap, externalItemIds);
  const constraints = buildExactItemBalanceConstraints(involvedItemIds, targetRateMap);
  const variables: Record<string, Record<string, number>> = {};
  const binaries = new Set<string>();
  const recipeUsageMap = new Map<string, string[]>();
  const buildingUsageMap = new Map<string, string[]>();
  const itemUsageMap = new Map<string, string[]>();
  const trackedItemIds = collectComplexityTrackedItemIds(catalog, activeOptions, externalItemIds);
  const totalUsageUpperBound = activeOptions.reduce(
    (sum, { option }) =>
      sum + (optionRateUpperBoundByOptionId.get(option.optionId) ?? defaultOptionRateUpperBound),
    0
  );
  const optionUsageWeight = 1;
  const totalPowerCoefficient = activeOptions.reduce(
    (sum, { option, recipe }) => sum + buildComplexityPowerCoefficient(request, recipe, option),
    0
  );
  const powerTieBreakScale =
    totalPowerCoefficient > 0
      ? 0.0625 / (Math.max(1, totalUsageUpperBound) * totalPowerCoefficient + 1)
      : 0;

  const ensureUsageVariable = (variableName: string, weight: number) => {
    const coefficients = ensureVariableCoefficients(variables, variableName);
    coefficients.__complexity__ = weight;
    binaries.add(variableName);
  };

  const addUsageConstraint = (
    constraintName: string,
    variableIds: string[],
    usageVariable: string,
    weight: number
  ) => {
    constraints[constraintName] = { max: 0 };
    let linkUpperBound = 0;
    for (const variableId of variableIds) {
      addVariableCoefficient(variables, variableId, constraintName, 1);
      linkUpperBound += optionRateUpperBoundByOptionId.get(variableId) ?? defaultOptionRateUpperBound;
    }
    ensureUsageVariable(usageVariable, weight);
    addVariableCoefficient(variables, usageVariable, constraintName, -Math.max(COMPLEXITY_LINK_BOUND_FLOOR, linkUpperBound));
  };

  for (const { option, recipe } of activeOptions) {
    const coefficients: Record<string, number> = {
      __complexity__: buildComplexityPowerCoefficient(request, recipe, option) * powerTieBreakScale,
    };
    for (const [itemId, amount] of option.netItemEntries) {
      coefficients[itemId] = amount;
    }
    variables[option.optionId] = coefficients;

    addUsageConstraint(
      `__complexity_link:option:${option.optionId}`,
      [option.optionId],
      buildComplexityUsageVariableName('option', option.optionId),
      optionUsageWeight
    );

    const recipeOptionIds = recipeUsageMap.get(recipe.recipeId) ?? [];
    recipeOptionIds.push(option.optionId);
    recipeUsageMap.set(recipe.recipeId, recipeOptionIds);

    const buildingOptionIds = buildingUsageMap.get(option.buildingId) ?? [];
    buildingOptionIds.push(option.optionId);
    buildingUsageMap.set(option.buildingId, buildingOptionIds);

    const touchedItemIds = new Set<string>();
    for (const itemId of option.touchedItemIds) {
      if (catalog.itemMap.has(itemId)) {
        touchedItemIds.add(itemId);
      }
    }
    for (const itemId of touchedItemIds) {
      const itemVariableIds = itemUsageMap.get(itemId) ?? [];
      itemVariableIds.push(option.optionId);
      itemUsageMap.set(itemId, itemVariableIds);
    }
  }

  for (const itemId of externalItemIds) {
    variables[`ext:${itemId}`] = {
      [itemId]: 1,
    };
  }

  for (const itemId of allowedSurplusItemIds) {
    if (!involvedItemIds.includes(itemId)) {
      continue;
    }
    variables[buildSurplusVariableName(itemId)] = {
      [itemId]: -1,
      __complexity__: powerTieBreakScale * OBJECTIVE_EPSILON,
    };
  }

  for (const itemId of trackedItemIds) {
    const itemVariableIds = itemUsageMap.get(itemId) ?? [];
    if (externalItemIds.has(itemId)) {
      itemVariableIds.push(`ext:${itemId}`);
    }
    itemUsageMap.set(itemId, itemVariableIds);
  }

  const recipeUsageWeight = 0.5 / Math.max(1, recipeUsageMap.size);
  const buildingUsageWeight = 0.25 / Math.max(1, buildingUsageMap.size);
  const itemUsageWeight = 0.125 / Math.max(1, trackedItemIds.length);

  for (const [recipeId, optionIds] of recipeUsageMap.entries()) {
    addUsageConstraint(
      `__complexity_link:recipe:${recipeId}`,
      optionIds,
      buildComplexityUsageVariableName('recipe', recipeId),
      recipeUsageWeight
    );
  }

  for (const [buildingId, optionIds] of buildingUsageMap.entries()) {
    addUsageConstraint(
      `__complexity_link:building:${buildingId}`,
      optionIds,
      buildComplexityUsageVariableName('building', buildingId),
      buildingUsageWeight
    );
  }

  for (const [itemId, variableIds] of itemUsageMap.entries()) {
    if (variableIds.length === 0) {
      continue;
    }
    addUsageConstraint(
      `__complexity_link:item:${itemId}`,
      variableIds,
      buildComplexityUsageVariableName('item', itemId),
      itemUsageWeight
    );
  }

  addPrimaryObjectiveUpperBoundConstraint({
    request,
    activeOptions,
    externalItemIds,
    variables,
    constraints,
    primaryObjectiveUpperBound,
  });

  return {
    model: {
      direction: 'minimize',
      objective: '__complexity__',
      constraints,
      variables,
      binaries,
    },
    activeOptions,
    involvedItemCount: involvedItemIds.length,
    activeRecipeCount: countActiveRecipeIds(activeOptions),
    binaryCount: binaries.size,
  };
}

function collectSurplusMilpOptions(params: {
  request: SolveRequest;
  compiledOptions: CompiledOptionContext[];
  activeOptionIds: ReadonlySet<string>;
  targetRateMap: ReadonlyMap<string, number>;
  surplusCandidateItemIds: ReadonlySet<string>;
}): CompiledOptionContext[] {
  const {
    request,
    compiledOptions,
    activeOptionIds,
    targetRateMap,
    surplusCandidateItemIds,
  } = params;

  const availableOptions = collectModelOptions(request, compiledOptions);
  if (activeOptionIds.size === 0) {
    return availableOptions;
  }

  const producerOptionIdsByItem = new Map<string, Set<string>>();
  const consumerOptionIdsByItem = new Map<string, Set<string>>();
  const activeConsumedItemIds = new Set<string>();
  const selectedOptionIds = new Set<string>();

  for (const entry of availableOptions) {
    const { option } = entry;
    if (activeOptionIds.has(option.optionId)) {
      selectedOptionIds.add(option.optionId);
      for (const [itemId, amount] of option.netItemEntries) {
        if (amount < -EPSILON) {
          activeConsumedItemIds.add(itemId);
        }
      }
    }

    for (const [itemId, amount] of option.netItemEntries) {
      if (amount > EPSILON) {
        let optionIds = producerOptionIdsByItem.get(itemId);
        if (!optionIds) {
          optionIds = new Set();
          producerOptionIdsByItem.set(itemId, optionIds);
        }
        optionIds.add(option.optionId);
      } else if (amount < -EPSILON) {
        let optionIds = consumerOptionIdsByItem.get(itemId);
        if (!optionIds) {
          optionIds = new Set();
          consumerOptionIdsByItem.set(itemId, optionIds);
        }
        optionIds.add(option.optionId);
      }
    }
  }

  const producerCandidateItemIds = new Set<string>();
  for (const [itemId, rate] of targetRateMap.entries()) {
    if (rate > EPSILON) {
      producerCandidateItemIds.add(itemId);
    }
  }
  for (const itemId of activeConsumedItemIds) {
    producerCandidateItemIds.add(itemId);
  }
  for (const itemId of surplusCandidateItemIds) {
    producerCandidateItemIds.add(itemId);
  }

  for (const itemId of producerCandidateItemIds) {
    for (const optionId of producerOptionIdsByItem.get(itemId) ?? []) {
      selectedOptionIds.add(optionId);
    }
  }

  for (const itemId of surplusCandidateItemIds) {
    for (const optionId of consumerOptionIdsByItem.get(itemId) ?? []) {
      selectedOptionIds.add(optionId);
    }
  }

  for (const optionId of Array.from(selectedOptionIds)) {
    const entry = availableOptions.find(candidate => candidate.option.optionId === optionId);
    if (!entry) {
      continue;
    }
    for (const [itemId, amount] of entry.option.netItemEntries) {
      if (amount < -EPSILON) {
        for (const producerOptionId of producerOptionIdsByItem.get(itemId) ?? []) {
          selectedOptionIds.add(producerOptionId);
        }
      }
    }
  }

  return availableOptions.filter(entry => selectedOptionIds.has(entry.option.optionId));
}

function collectFixedSurplusMilpOptions(params: {
  request: SolveRequest;
  compiledOptions: CompiledOptionContext[];
  activeOptionIds: ReadonlySet<string>;
  allowedSurplusItemIds: ReadonlySet<string>;
}): CompiledOptionContext[] {
  const { request, compiledOptions, activeOptionIds, allowedSurplusItemIds } = params;
  const availableOptions = collectModelOptions(request, compiledOptions);
  if (activeOptionIds.size === 0) {
    return availableOptions;
  }

  const optionById = new Map(
    availableOptions.map(entry => [entry.option.optionId, entry] as const)
  );
  const producerOptionIdsByItem = new Map<string, Set<string>>();
  const consumerOptionIdsByItem = new Map<string, Set<string>>();
  const selectedOptionIds = new Set<string>();
  const pendingExpansionOptionIds: string[] = [];
  const expandedOptionIds = new Set<string>();

  const enqueueOptionId = (optionId: string, expandInputs: boolean) => {
    if (!optionById.has(optionId)) {
      return;
    }
    const wasAdded = !selectedOptionIds.has(optionId);
    selectedOptionIds.add(optionId);
    if (expandInputs && wasAdded) {
      pendingExpansionOptionIds.push(optionId);
    }
  };

  for (const entry of availableOptions) {
    const { option } = entry;
    if (activeOptionIds.has(option.optionId)) {
      selectedOptionIds.add(option.optionId);
    }

    for (const [itemId, amount] of option.netItemEntries) {
      if (amount > EPSILON) {
        const optionIds = producerOptionIdsByItem.get(itemId) ?? new Set<string>();
        optionIds.add(option.optionId);
        producerOptionIdsByItem.set(itemId, optionIds);
      } else if (amount < -EPSILON) {
        const optionIds = consumerOptionIdsByItem.get(itemId) ?? new Set<string>();
        optionIds.add(option.optionId);
        consumerOptionIdsByItem.set(itemId, optionIds);
      }
    }
  }

  for (const itemId of allowedSurplusItemIds) {
    for (const optionId of consumerOptionIdsByItem.get(itemId) ?? []) {
      enqueueOptionId(optionId, true);
    }
  }

  while (pendingExpansionOptionIds.length > 0) {
    const optionId = pendingExpansionOptionIds.pop()!;
    if (expandedOptionIds.has(optionId)) {
      continue;
    }
    expandedOptionIds.add(optionId);
    const entry = optionById.get(optionId);
    if (!entry) {
      continue;
    }

    for (const [itemId, amount] of entry.option.netItemEntries) {
      if (amount >= -EPSILON) {
        continue;
      }
      for (const producerOptionId of producerOptionIdsByItem.get(itemId) ?? []) {
        enqueueOptionId(producerOptionId, true);
      }
    }
  }

  return availableOptions.filter(entry => selectedOptionIds.has(entry.option.optionId));
}

function solveCatalogRequestValidated(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  implementation: SolverImplementation
): SolveResult {
  const solveStartedAt = currentTimeMs();
  const targetRateMap = aggregateTargetRates(request);
  const disabledRawInputItemIds = new Set(request.disabledRawInputItemIds ?? []);
  const rawInputItemIds = new Set<string>(
    [...catalog.rawItemIds, ...(request.rawInputItemIds ?? [])].filter(
      itemId => !disabledRawInputItemIds.has(itemId)
    )
  );
  const disabledRecipeIds = new Set(request.disabledRecipeIds ?? []);
  const disabledBuildingIds = new Set(request.disabledBuildingIds ?? []);
  const compiledGraph = compileSolveGraph(
    catalog,
    request,
    Array.from(targetRateMap.keys()),
    rawInputItemIds,
    disabledRecipeIds,
    disabledBuildingIds
  );
  const graphFinishedAt = currentTimeMs();
  recordSolverPerf({
    phase: 'graph',
    durationMs: graphFinishedAt - solveStartedAt,
    recipeCount: compiledGraph.recipes.length,
    optionCount: compiledGraph.options.length,
    recordedAt: Date.now(),
  });
  const resolvedRawInputItemIds = new Set(compiledGraph.resolvedRawInputItemIds);
  const externalItemIds = collectExternalItemIds(
    resolvedRawInputItemIds,
    compiledGraph.options,
    getCatalogSolveCache(catalog).anyRecipeOutputIndex
  );
  const diagnostics = [...compiledGraph.messages];
  const auditAttempts: SolveAuditAttempt[] = [];
  let model: Model<string, string>;
  let activeOptions: CompiledOptionContext[];
  let solution: Solution<string>;
  let modelDurationMs = 0;
  let lpDurationMs = 0;
  let surplusReweightTermination: SolveAudit['surplusReweightTermination'];
  const buildSolveAudit = (resultDurationMs: number, totalDurationMs: number): SolveAudit => ({
    prunedItemCount: compiledGraph.itemIds.length,
    prunedRecipeCount: compiledGraph.recipes.length,
    prunedOptionCount: compiledGraph.options.length,
    resolvedRawInputCount: resolvedRawInputItemIds.size,
    graphDurationMs: graphFinishedAt - solveStartedAt,
    modelDurationMs,
    solveDurationMs: lpDurationMs,
    resultDurationMs,
    totalDurationMs,
    attempts: auditAttempts,
    surplusReweightTermination,
  });

  const buildLinear = (buildOptions?: {
    surplusWeights?: ReadonlyMap<string, number>;
    primaryObjectiveUpperBound?: number;
    optimizePrimaryObjectiveFirst?: boolean;
  }) => {
    const startedAt = currentTimeMs();
    const build = buildLinearModel(
      request,
      compiledGraph.options,
      targetRateMap,
      externalItemIds,
      buildOptions
    );
    const durationMs = currentTimeMs() - startedAt;
    modelDurationMs += durationMs;
    return {
      ...build,
      buildDurationMs: durationMs,
    };
  };

  const solveModelWithImplementation = (
    solverImplementation: SolverImplementation,
    candidateModel: Model<string, string>,
    options?: SolverOptions
  ) => {
    const startedAt = currentTimeMs();
    const candidateSolution = solverImplementation.solve(candidateModel, options);
    const durationMs = currentTimeMs() - startedAt;
    lpDurationMs += durationMs;
    return {
      solution: candidateSolution,
      solveDurationMs: durationMs,
    };
  };

  const solveModel = (candidateModel: Model<string, string>, options?: SolverOptions) =>
    solveModelWithImplementation(implementation, candidateModel, options);

  const hasIncumbentSolution = (candidateSolution: Solution<string>) => {
    for (const [, value] of candidateSolution.variables) {
      if (Number.isFinite(value) && value > EPSILON) {
        return true;
      }
    }

    return false;
  };

  if (request.objective === 'min_complexity') {
    const seedRequest: SolveRequest = {
      ...request,
      objective: 'min_power',
    };
    const seedBuildStartedAt = currentTimeMs();
    const seedBuild = buildLinearModel(
      seedRequest,
      compiledGraph.options,
      targetRateMap,
      externalItemIds
    );
    const seedBuildDurationMs = currentTimeMs() - seedBuildStartedAt;
    modelDurationMs += seedBuildDurationMs;
    const seedSolve = solveModel(seedBuild.model);
    auditAttempts.push(
      buildSolveAuditAttempt({
        phase: 'complexity_seed_lp',
        modelKind: 'lp',
        itemCount: seedBuild.involvedItemCount,
        recipeCount: seedBuild.activeRecipeCount,
        optionCount: seedBuild.activeOptions.length,
        constraintCount: Object.keys(seedBuild.model.constraints).length,
        variableCount: Object.keys(seedBuild.model.variables).length,
        buildDurationMs: seedBuildDurationMs,
        solveDurationMs: seedSolve.solveDurationMs,
        status: seedSolve.solution.status,
        ...collectSolvedUsageCounts(seedBuild.activeOptions, seedSolve.solution.variables),
      })
    );
    if (seedSolve.solution.status !== 'optimal') {
      return buildInfeasibleSolveResult({
        targetRateMap,
        resolvedRawInputItemIds: Array.from(resolvedRawInputItemIds).sort((left, right) =>
          left.localeCompare(right)
        ),
        diagnostics: [
          ...diagnostics,
          `Complexity seed solve failed with status ${seedSolve.solution.status}.`,
        ],
        infoMessages: [...compiledGraph.infoMessages],
        solveAudit: buildSolveAudit(0, currentTimeMs() - solveStartedAt),
      });
    }

    const baseLinkUpperBound = estimateComplexityLinkUpperBound(
      seedSolve.solution.variables,
      targetRateMap
    );
    let complexityModel: Model<string, string> | null = null;
    let complexityOptions: CompiledOptionContext[] | null = null;
    let complexitySolution: Solution<string> | null = null;
    let lastFailureMessage = 'Complexity MILP solve did not produce an optimal solution.';

    for (const multiplier of COMPLEXITY_LINK_BOUND_MULTIPLIERS) {
      const linkUpperBound = baseLinkUpperBound * multiplier;
      const buildStartedAt = currentTimeMs();
      const complexityBuild = buildComplexityModel({
        catalog,
        request,
        compiledOptions: compiledGraph.options,
        targetRateMap,
        externalItemIds,
        linkUpperBound,
      });
      const complexityBuildDurationMs = currentTimeMs() - buildStartedAt;
      modelDurationMs += complexityBuildDurationMs;
      const candidateSolve = solveModel(complexityBuild.model);
      auditAttempts.push(
        buildSolveAuditAttempt({
          phase: 'complexity_milp',
          round: auditAttempts.filter(entry => entry.phase === 'complexity_milp').length,
          modelKind: 'milp',
          itemCount: complexityBuild.involvedItemCount,
          recipeCount: complexityBuild.activeRecipeCount,
          optionCount: complexityBuild.activeOptions.length,
          constraintCount: Object.keys(complexityBuild.model.constraints).length,
          variableCount: Object.keys(complexityBuild.model.variables).length,
          buildDurationMs: complexityBuildDurationMs,
          solveDurationMs: candidateSolve.solveDurationMs,
          status: candidateSolve.solution.status,
          ...collectSolvedUsageCounts(complexityBuild.activeOptions, candidateSolve.solution.variables),
        })
      );
      if (candidateSolve.solution.status !== 'optimal') {
        lastFailureMessage = `Complexity MILP failed with status ${candidateSolve.solution.status}.`;
        continue;
      }

      complexityModel = complexityBuild.model;
      complexityOptions = complexityBuild.activeOptions;
      complexitySolution = candidateSolve.solution;
      break;
    }

    if (!complexityModel || !complexityOptions || !complexitySolution) {
      return buildInfeasibleSolveResult({
        targetRateMap,
        resolvedRawInputItemIds: Array.from(resolvedRawInputItemIds).sort((left, right) =>
          left.localeCompare(right)
        ),
        diagnostics: [...diagnostics, lastFailureMessage],
        infoMessages: [...compiledGraph.infoMessages],
        solveAudit: buildSolveAudit(0, currentTimeMs() - solveStartedAt),
      });
    }

    model = complexityModel;
    activeOptions = complexityOptions;
    solution = complexitySolution;
  } else {
    const linearBuild = buildLinear(
      request.balancePolicy === 'allow_surplus' ? { optimizePrimaryObjectiveFirst: true } : undefined
    );
    model = linearBuild.model;
    activeOptions = linearBuild.activeOptions;
    const initialSolve = solveModel(model);
    solution = initialSolve.solution;
    auditAttempts.push(
      buildSolveAuditAttempt({
        phase: 'initial_lp',
        modelKind: 'lp',
        itemCount: linearBuild.involvedItemCount,
        recipeCount: linearBuild.activeRecipeCount,
        optionCount: linearBuild.activeOptions.length,
        constraintCount: Object.keys(linearBuild.model.constraints).length,
        variableCount: Object.keys(linearBuild.model.variables).length,
        buildDurationMs: linearBuild.buildDurationMs,
        solveDurationMs: initialSolve.solveDurationMs,
        status: initialSolve.solution.status,
        ...collectSolvedUsageCounts(activeOptions, initialSolve.solution.variables),
        surplusItemCount:
          request.balancePolicy === 'allow_surplus'
            ? collectSurplusSolutionMetrics(initialSolve.solution.variables).activeItemIds.length
            : undefined,
        surplusRatePerMin:
          request.balancePolicy === 'allow_surplus'
            ? collectSurplusSolutionMetrics(initialSolve.solution.variables).totalRatePerMin
            : undefined,
        primaryObjectiveValue:
          request.balancePolicy === 'allow_surplus' && initialSolve.solution.status === 'optimal'
            ? buildPrimaryObjectiveValue(request, activeOptions, initialSolve.solution.variables)
            : undefined,
      })
    );

    if (request.balancePolicy === 'allow_surplus' && solution.status === 'optimal') {
      const primaryObjectiveUpperBound = computePrimaryObjectiveUpperBound(
        buildPrimaryObjectiveValue(request, activeOptions, solution.variables)
      );
      let bestCandidate = buildLinearSolveCandidate({
        request,
        model,
        activeOptions,
        solution,
      });
      let previousCandidate = bestCandidate;
      const deadline = solveStartedAt + ALLOW_SURPLUS_SYNC_BUDGET_MS;
      let stagnantRounds = 0;
      const maxReweightedRounds = Math.max(0, ALLOW_SURPLUS_MAX_LINEAR_SOLVES - 1);

      for (let round = 0; round < maxReweightedRounds; round += 1) {
        if (currentTimeMs() >= deadline) {
          surplusReweightTermination = 'deadline';
          break;
        }

        const surplusWeights = buildReweightedSurplusWeights(
          bestCandidate.surplus,
          round
        );
        if (!surplusWeights) {
          surplusReweightTermination = 'converged';
          break;
        }

        const weightedBuild = buildLinear({
          surplusWeights,
          primaryObjectiveUpperBound,
        });
        if (currentTimeMs() >= deadline) {
          surplusReweightTermination = 'deadline';
          break;
        }

        let weightedSolve: ReturnType<typeof solveModel> | null = null;
        let weightedSurplusMetrics: SurplusSolutionMetrics | null = null;
        try {
          weightedSolve = solveModel(weightedBuild.model);
          weightedSurplusMetrics = collectSurplusSolutionMetrics(
            weightedSolve.solution.variables
          );
        } catch (error) {
          auditAttempts.push(
            buildSolveAuditAttempt({
              phase: 'reweighted_lp',
              round,
              modelKind: 'lp',
              itemCount: weightedBuild.involvedItemCount,
              recipeCount: weightedBuild.activeRecipeCount,
              optionCount: weightedBuild.activeOptions.length,
              constraintCount: Object.keys(weightedBuild.model.constraints).length,
              variableCount: Object.keys(weightedBuild.model.variables).length,
              buildDurationMs: weightedBuild.buildDurationMs,
              solveDurationMs: 0,
              status: 'error',
            })
          );
          surplusReweightTermination = 'error';
          break;
        }

        if (weightedSolve.solution.status !== 'optimal') {
          auditAttempts.push(
            buildSolveAuditAttempt({
              phase: 'reweighted_lp',
              round,
              modelKind: 'lp',
              itemCount: weightedBuild.involvedItemCount,
              recipeCount: weightedBuild.activeRecipeCount,
              optionCount: weightedBuild.activeOptions.length,
              constraintCount: Object.keys(weightedBuild.model.constraints).length,
              variableCount: Object.keys(weightedBuild.model.variables).length,
              buildDurationMs: weightedBuild.buildDurationMs,
              solveDurationMs: weightedSolve.solveDurationMs,
              status: weightedSolve.solution.status,
              ...collectSolvedUsageCounts(weightedBuild.activeOptions, weightedSolve.solution.variables),
              surplusItemCount: weightedSurplusMetrics!.activeItemIds.length,
              surplusRatePerMin: weightedSurplusMetrics!.totalRatePerMin,
              surplusWeights,
            })
          );
          surplusReweightTermination = 'infeasible';
          break;
        }

        const candidate = buildLinearSolveCandidate({
          request,
          model: weightedBuild.model,
          activeOptions: weightedBuild.activeOptions,
          solution: weightedSolve.solution,
        });

        const isBest = compareLinearSolveCandidates(candidate, bestCandidate) < 0;
        if (isBest) {
          bestCandidate = candidate;
        }

        const candidateDelta = compareLinearSolveCandidates(candidate, previousCandidate);
        const sameSupport =
          candidate.surplus.activeItemIds.length === previousCandidate.surplus.activeItemIds.length &&
          candidate.surplus.activeItemIds.every(
            (itemId, index) => itemId === previousCandidate.surplus.activeItemIds[index]
          );
        stagnantRounds = sameSupport && candidateDelta === 0 ? stagnantRounds + 1 : 0;
        previousCandidate = candidate;

        auditAttempts.push(
          buildSolveAuditAttempt({
            phase: 'reweighted_lp',
            round,
            modelKind: 'lp',
            itemCount: weightedBuild.involvedItemCount,
            recipeCount: weightedBuild.activeRecipeCount,
            optionCount: weightedBuild.activeOptions.length,
            constraintCount: Object.keys(weightedBuild.model.constraints).length,
            variableCount: Object.keys(weightedBuild.model.variables).length,
            buildDurationMs: weightedBuild.buildDurationMs,
            solveDurationMs: weightedSolve.solveDurationMs,
            status: weightedSolve.solution.status,
            solvedRecipeCount: candidate.activeRecipeCount,
            solvedOptionCount: candidate.activeOptionCount,
            surplusItemCount: weightedSurplusMetrics!.activeItemIds.length,
            surplusRatePerMin: weightedSurplusMetrics!.totalRatePerMin,
            primaryObjectiveValue: candidate.primaryObjectiveValue,
            surplusWeights,
            isBestCandidate: isBest,
            stagnantRounds,
          })
        );

        if (stagnantRounds >= 3) {
          surplusReweightTermination = 'stagnant';
          break;
        }

        if (round === maxReweightedRounds - 1) {
          surplusReweightTermination = 'max_rounds';
        }
      }

      // Once LP reweighting settles on a surplus support, polish that local
      // neighbourhood with a complexity MILP instead of reopening the full
      // graph to chase one fewer surplus type.
      if (bestCandidate.surplus.activeItemIds.length > 0) {
        // Recipe link big-M only needs to bound the max total rate of any
        // single recipe's options — much tighter than the surplus upper bound.
        const {
          optionRateUpperBoundByOptionId,
          defaultOptionRateUpperBound,
        } = estimateOptionRateUpperBounds(bestCandidate.solution.variables, targetRateMap);
        // Collect option IDs that the LP solution actually uses — only
        // these recipes need binary indicators in the MILP.
        const activeOptionIds = new Set<string>();
        for (const [varName, value] of bestCandidate.solution.variables) {
          if (value > EPSILON && !varName.startsWith('__') && !varName.startsWith('ext:')) {
            activeOptionIds.add(varName);
          }
        }
        const lpSurplusItemIds = new Set(bestCandidate.surplus.activeItemIds);
        const milpBuildStartedAt = currentTimeMs();
        const milpPhase: SolveAuditAttempt['phase'] = 'surplus_complexity_milp';
        const milpBuild = buildFixedSurplusRecipeMilpModel({
          catalog,
          request,
          compiledOptions: compiledGraph.options,
          targetRateMap,
          externalItemIds,
          optionRateUpperBoundByOptionId,
          defaultOptionRateUpperBound,
          activeOptionIds,
          allowedSurplusItemIds: lpSurplusItemIds,
          primaryObjectiveUpperBound,
        });
        const milpBuildDurationMs = currentTimeMs() - milpBuildStartedAt;
        modelDurationMs += milpBuildDurationMs;
        const milpConstraintCount = Object.keys(milpBuild.model.constraints).length;
        const milpVariableCount = Object.keys(milpBuild.model.variables).length;
        const skipMilp = shouldSkipSurplusComplexityMilp(
          implementation,
          milpBuild.activeOptions.length,
          milpBuild.binaryCount
        );

        let milpSolve: ReturnType<typeof solveModel> | null = null;
        let milpSurplusMetrics: SurplusSolutionMetrics | null = null;
        if (skipMilp) {
          auditAttempts.push(
            buildSolveAuditAttempt({
              phase: milpPhase,
              modelKind: 'milp',
              itemCount: milpBuild.involvedItemCount,
              recipeCount: milpBuild.activeRecipeCount,
              optionCount: milpBuild.activeOptions.length,
              constraintCount: milpConstraintCount,
              variableCount: milpVariableCount,
              binaryCount: milpBuild.binaryCount,
              buildDurationMs: milpBuildDurationMs,
              solveDurationMs: 0,
              status: 'skipped',
            })
          );
        } else {
          try {
            milpSolve = solveModel(milpBuild.model, {
              timeout: SURPLUS_MILP_TIMEOUT_MS,
              tolerance: SURPLUS_MILP_TOLERANCE,
            });
            milpSurplusMetrics = collectSurplusSolutionMetrics(
              milpSolve.solution.variables
            );
          } catch (error) {
            auditAttempts.push(
              buildSolveAuditAttempt({
                phase: milpPhase,
                modelKind: 'milp',
                itemCount: milpBuild.involvedItemCount,
                recipeCount: milpBuild.activeRecipeCount,
                optionCount: milpBuild.activeOptions.length,
                constraintCount: milpConstraintCount,
                variableCount: milpVariableCount,
                binaryCount: milpBuild.binaryCount,
                buildDurationMs: milpBuildDurationMs,
                solveDurationMs: 0,
                status: 'error',
              })
            );
            milpSolve = null;
          }
        }

        if (
          !skipMilp &&
          milpSolve === null &&
          implementation.implementationId !== yalpsSolverImplementation.implementationId
        ) {
          try {
            milpSolve = solveModelWithImplementation(yalpsSolverImplementation, milpBuild.model, {
              timeout: SURPLUS_MILP_TIMEOUT_MS,
              tolerance: SURPLUS_MILP_TOLERANCE,
            });
            milpSurplusMetrics = collectSurplusSolutionMetrics(
              milpSolve.solution.variables
            );
          } catch (error) {
            auditAttempts.push(
              buildSolveAuditAttempt({
                phase: milpPhase,
                round: 1,
                modelKind: 'milp',
              itemCount: milpBuild.involvedItemCount,
              recipeCount: milpBuild.activeRecipeCount,
              optionCount: milpBuild.activeOptions.length,
              constraintCount: milpConstraintCount,
              variableCount: milpVariableCount,
              binaryCount: milpBuild.binaryCount,
              buildDurationMs: 0,
              solveDurationMs: 0,
              status: 'error',
              })
            );
            milpSolve = null;
          }
        }

        const milpUsable = milpSolve !== null && milpSolve.solution.status === 'optimal';

        if (milpUsable && milpSolve) {
          const milpCandidate = buildLinearSolveCandidate({
            request,
            model: milpBuild.model,
            activeOptions: milpBuild.activeOptions,
            solution: milpSolve.solution,
          });

          const isBest = compareLinearSolveCandidates(milpCandidate, bestCandidate) <= 0;

          auditAttempts.push(
            buildSolveAuditAttempt({
              phase: milpPhase,
              modelKind: 'milp',
              itemCount: milpBuild.involvedItemCount,
              recipeCount: milpBuild.activeRecipeCount,
              optionCount: milpBuild.activeOptions.length,
              constraintCount: milpConstraintCount,
              variableCount: milpVariableCount,
              binaryCount: milpBuild.binaryCount,
              buildDurationMs: milpBuildDurationMs,
              solveDurationMs: milpSolve.solveDurationMs,
              status: milpSolve.solution.status,
              solvedRecipeCount: milpCandidate.activeRecipeCount,
              solvedOptionCount: milpCandidate.activeOptionCount,
              surplusItemCount: milpSurplusMetrics!.activeItemIds.length,
              surplusRatePerMin: milpSurplusMetrics!.totalRatePerMin,
              primaryObjectiveValue: milpCandidate.primaryObjectiveValue,
              isBestCandidate: isBest,
            })
          );

          if (isBest) {
            bestCandidate = milpCandidate;
            // Normalize timedout → optimal: the MILP found a valid integer
            // solution (just not provably optimal within the time budget),
            // which is good enough for downstream code that checks status.
            if (bestCandidate.solution.status === 'timedout') {
              bestCandidate = {
                ...bestCandidate,
                solution: { ...bestCandidate.solution, status: 'optimal' },
              };
            }
          }
        } else if (milpSolve) {
          auditAttempts.push(
            buildSolveAuditAttempt({
              phase: milpPhase,
              modelKind: 'milp',
              itemCount: milpBuild.involvedItemCount,
              recipeCount: milpBuild.activeRecipeCount,
              optionCount: milpBuild.activeOptions.length,
              constraintCount: Object.keys(milpBuild.model.constraints).length,
              variableCount: Object.keys(milpBuild.model.variables).length,
              binaryCount: milpBuild.binaryCount,
              buildDurationMs: milpBuildDurationMs,
              solveDurationMs: milpSolve.solveDurationMs,
              status: milpSolve.solution.status,
              ...collectSolvedUsageCounts(milpBuild.activeOptions, milpSolve.solution.variables),
              surplusItemCount: milpSurplusMetrics!.activeItemIds.length,
              surplusRatePerMin: milpSurplusMetrics!.totalRatePerMin,
            })
          );
        }
      }

      model = bestCandidate.model;
      activeOptions = bestCandidate.activeOptions;
      solution = bestCandidate.solution;
    }
  }
  const solveFinishedAt = currentTimeMs();
  recordSolverPerf({
    phase: 'model',
    durationMs: modelDurationMs,
    constraintCount: Object.keys(model.constraints).length,
    variableCount: Object.keys(model.variables).length,
    recordedAt: Date.now(),
  });
  recordSolverPerf({
    phase: 'lp',
    durationMs: lpDurationMs,
    constraintCount: Object.keys(model.constraints).length,
    variableCount: Object.keys(model.variables).length,
    status: solution.status,
    recordedAt: Date.now(),
  });

  if (solution.status !== 'optimal') {
    recordSolverPerf({
      phase: 'total',
      durationMs: solveFinishedAt - solveStartedAt,
      recipeCount: compiledGraph.recipes.length,
      optionCount: compiledGraph.options.length,
      constraintCount: Object.keys(model.constraints).length,
      variableCount: Object.keys(model.variables).length,
      status: solution.status,
      recordedAt: Date.now(),
    });
    return buildInfeasibleSolveResult({
      targetRateMap,
      resolvedRawInputItemIds: Array.from(resolvedRawInputItemIds).sort((left, right) =>
        left.localeCompare(right)
      ),
      diagnostics: [...diagnostics, `LP solve failed with status ${solution.status}.`],
      infoMessages: [...compiledGraph.infoMessages],
      solveAudit: buildSolveAudit(0, solveFinishedAt - solveStartedAt),
    });
  }

  const result = buildResultFromSolution({
    request,
    targetRateMap,
    compiledOptions: activeOptions,
    solutionVariables: new Map<string, number>(solution.variables),
    resolvedRawInputItemIds: Array.from(resolvedRawInputItemIds).sort((left, right) =>
      left.localeCompare(right)
    ),
  });
  const resultFinishedAt = currentTimeMs();
  recordSolverPerf({
    phase: 'result',
    durationMs: resultFinishedAt - solveFinishedAt,
    recipeCount: result.recipePlans.length,
    recordedAt: Date.now(),
  });
  recordSolverPerf({
    phase: 'total',
    durationMs: resultFinishedAt - solveStartedAt,
    recipeCount: compiledGraph.recipes.length,
    optionCount: compiledGraph.options.length,
    constraintCount: Object.keys(model.constraints).length,
    variableCount: Object.keys(model.variables).length,
    status: result.status,
    recordedAt: Date.now(),
  });

  return {
    ...result,
    diagnostics: {
      messages: diagnostics,
      infoMessages: compiledGraph.infoMessages,
      unmetPreferences: result.diagnostics.unmetPreferences,
    },
    solveAudit: buildSolveAudit(resultFinishedAt - solveFinishedAt, resultFinishedAt - solveStartedAt),
  };
}

function solveCatalogRequestValidatedCached(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  implementation: SolverImplementation
): SolveResult {
  const cached = getCachedSolvedRequestResult(catalog, request, implementation);
  if (cached) {
    return cached;
  }

  const result = solveCatalogRequestValidated(catalog, request, implementation);
  setCachedSolvedRequestResult(catalog, request, implementation, result);
  return result;
}


export interface SolveCatalogRequestOptions {
  implementation?: SolverImplementation;
}

export interface SolveCatalogRequestAsyncOptions extends SolveCatalogRequestOptions {
  implementationPromise?: Promise<SolverImplementation>;
}

export function solveCatalogRequest(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  options: SolveCatalogRequestOptions = {}
): SolveResult {
  const implementation = options.implementation ?? yalpsSolverImplementation;
  const validation = validateSolveRequest(catalog, request);
  if (!validation.valid) {
    return buildInvalidInputSolveResult(validation.messages);
  }

  return solveCatalogRequestValidatedCached(catalog, request, implementation);
}

export async function solveCatalogRequestAsync(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  options: SolveCatalogRequestAsyncOptions = {}
): Promise<SolveResult> {
  const implementation =
    options.implementation ??
    (options.implementationPromise
      ? await options.implementationPromise
      : yalpsSolverImplementation);
  const validation = validateSolveRequest(catalog, request);
  if (!validation.valid) {
    return buildInvalidInputSolveResult(validation.messages);
  }

  return solveCatalogRequestValidatedCached(catalog, request, implementation);
}
