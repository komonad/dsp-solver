import type {
  ResolvedCatalogModel,
  ResolvedRecipeSpec,
} from '../catalog';
import type { SolveRequest } from './request';
import type {
  CompiledOption,
  SolveAudit,
  SolveAuditAttempt,
} from './result';
import type { Model } from './implementation';
import { recordSolverPerf } from './perf';
import {
  EPSILON,
  type CompiledOptionContext,
  currentTimeMs,
  getPreferredOptionPenalty,
  collectModelOptions,
  collectInvolvedItemIds,
  countActiveRecipeIds,
} from './solveGraph';

const PREFERENCE_EPSILON = 1e-3;
export const OBJECTIVE_EPSILON = 1e-6;
const SECONDARY_EPSILON = 1e-9;
const EXTERNAL_INPUT_ACTIVITY_EPSILON = 1e-9;
const PRIMARY_OBJECTIVE_BOUND_RELATIVE_EPSILON = 0.05;
const PRIMARY_OBJECTIVE_BOUND_ABSOLUTE_EPSILON = 1e-6;

export function buildObjectiveCoefficient(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): number {
  const preferencePenalty = getPreferredOptionPenalty(request, recipe, option);

  if (request.objective === 'min_buildings') {
    return (
      preferencePenalty * PREFERENCE_EPSILON +
      option.buildingCostPerRunPerMin * OBJECTIVE_EPSILON +
      option.powerCostMWPerRunPerMin * SECONDARY_EPSILON
    );
  }

  if (request.objective === 'min_power') {
    return (
      preferencePenalty * PREFERENCE_EPSILON +
      option.powerCostMWPerRunPerMin * OBJECTIVE_EPSILON +
      option.buildingCostPerRunPerMin * SECONDARY_EPSILON
    );
  }

  return (
    preferencePenalty * PREFERENCE_EPSILON +
    EXTERNAL_INPUT_ACTIVITY_EPSILON +
    option.buildingCostPerRunPerMin * SECONDARY_EPSILON +
    option.powerCostMWPerRunPerMin * SECONDARY_EPSILON * SECONDARY_EPSILON
  );
}

export function buildPrimaryObjectiveOptionCoefficient(
  request: SolveRequest,
  option: CompiledOption
): number {
  if (request.objective === 'min_buildings') {
    return option.buildingCostPerRunPerMin;
  }

  if (request.objective === 'min_power') {
    return option.powerCostMWPerRunPerMin;
  }

  return 0;
}

export function buildExternalInputObjectiveCoefficient(request: SolveRequest): number {
  if (request.objective !== 'min_external_input') {
    return 0;
  }

  return request.balancePolicy === 'allow_surplus' ? OBJECTIVE_EPSILON : 1;
}

function buildPrimaryObjectiveExternalInputCoefficient(request: SolveRequest): number {
  return request.objective === 'min_external_input' ? 1 : 0;
}

function buildPrimaryFirstObjectiveCoefficient(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): number {
  const primaryObjectiveCoefficient = buildPrimaryObjectiveOptionCoefficient(request, option);
  if (request.objective === 'min_external_input') {
    return buildObjectiveCoefficient(request, recipe, option);
  }

  return (
    primaryObjectiveCoefficient +
    getPreferredOptionPenalty(request, recipe, option) * SECONDARY_EPSILON +
    option.buildingCostPerRunPerMin * SECONDARY_EPSILON * SECONDARY_EPSILON +
    option.powerCostMWPerRunPerMin * SECONDARY_EPSILON * SECONDARY_EPSILON * SECONDARY_EPSILON
  );
}

export function computePrimaryObjectiveUpperBound(primaryObjectiveValue: number): number {
  return (
    primaryObjectiveValue +
    Math.max(
      PRIMARY_OBJECTIVE_BOUND_ABSOLUTE_EPSILON,
      Math.abs(primaryObjectiveValue) * PRIMARY_OBJECTIVE_BOUND_RELATIVE_EPSILON
    )
  );
}

export function addPrimaryObjectiveUpperBoundConstraint(params: {
  request: SolveRequest;
  activeOptions: CompiledOptionContext[];
  externalItemIds: ReadonlySet<string>;
  variables: Record<string, Record<string, number>>;
  constraints: Model<string, string>['constraints'];
  primaryObjectiveUpperBound?: number;
}) {
  const {
    request,
    activeOptions,
    externalItemIds,
    variables,
    constraints,
    primaryObjectiveUpperBound,
  } = params;
  if (primaryObjectiveUpperBound === undefined) {
    return;
  }

  const constraintName = '__primary_objective_bound__';
  constraints[constraintName] = { max: primaryObjectiveUpperBound };

  for (const { option } of activeOptions) {
    const coefficient = buildPrimaryObjectiveOptionCoefficient(request, option);
    if (coefficient > 0) {
      addVariableCoefficient(variables, option.optionId, constraintName, coefficient);
    }
  }

  const externalInputCoefficient = buildPrimaryObjectiveExternalInputCoefficient(request);
  if (externalInputCoefficient <= 0) {
    return;
  }

  for (const itemId of externalItemIds) {
    addVariableCoefficient(variables, `ext:${itemId}`, constraintName, externalInputCoefficient);
  }
}

export function buildComplexityPowerCoefficient(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): number {
  const preferencePenalty = getPreferredOptionPenalty(request, recipe, option);

  return (
    option.powerCostMWPerRunPerMin +
    preferencePenalty * SECONDARY_EPSILON +
    option.buildingCostPerRunPerMin * SECONDARY_EPSILON * SECONDARY_EPSILON
  );
}

export function buildSurplusVariableName(itemId: string): string {
  return `__surplus:${itemId}`;
}

export function buildExactItemBalanceConstraints(
  involvedItemIds: string[],
  targetRateMap: Map<string, number>
): Record<string, { equal?: number; min?: number; max?: number }> {
  const constraints: Record<string, { equal?: number; min?: number; max?: number }> = {};

  for (const itemId of involvedItemIds) {
    constraints[itemId] = { equal: targetRateMap.get(itemId) ?? 0 };
  }

  return constraints;
}

export function ensureVariableCoefficients(
  variables: Record<string, Record<string, number>>,
  variableName: string
): Record<string, number> {
  const existing = variables[variableName];
  if (existing) {
    return existing;
  }

  const created: Record<string, number> = {};
  variables[variableName] = created;
  return created;
}

export function addVariableCoefficient(
  variables: Record<string, Record<string, number>>,
  variableName: string,
  coefficientName: string,
  amount: number
): void {
  const coefficients = ensureVariableCoefficients(variables, variableName);
  coefficients[coefficientName] = (coefficients[coefficientName] ?? 0) + amount;
}

export function buildComplexityUsageVariableName(
  kind: 'recipe' | 'building' | 'item' | 'option',
  id: string
): string {
  return `__use:${kind}:${id}`;
}

export function isComplexityUsageVariable(variableName: string): boolean {
  return variableName.startsWith('__use:');
}

export function collectComplexityTrackedItemIds(
  catalog: ResolvedCatalogModel,
  compiledOptions: CompiledOptionContext[],
  externalItemIds: Set<string>
): string[] {
  const itemIds = new Set<string>();

  for (const { option } of compiledOptions) {
    for (const itemId of option.touchedItemIds) {
      if (catalog.itemMap.has(itemId)) {
        itemIds.add(itemId);
      }
    }
  }

  for (const itemId of externalItemIds) {
    if (catalog.itemMap.has(itemId)) {
      itemIds.add(itemId);
    }
  }

  return Array.from(itemIds).sort((left, right) => left.localeCompare(right));
}

export function estimateComplexityLinkUpperBound(
  solutionVariables: Iterable<[string, number]>,
  targetRateMap: Map<string, number>
): number {
  let totalSolvedRate = 0;
  let maxSolvedRate = 0;

  for (const [variableName, value] of solutionVariables) {
    if (value <= EPSILON || isComplexityUsageVariable(variableName)) {
      continue;
    }

    totalSolvedRate += value;
    maxSolvedRate = Math.max(maxSolvedRate, value);
  }

  const targetRates = Array.from(targetRateMap.values()).filter(rate => rate > EPSILON);
  const totalTargetRate = targetRates.reduce((sum, rate) => sum + rate, 0);
  const maxTargetRate = targetRates.reduce((maxRate, rate) => Math.max(maxRate, rate), 0);

  return Math.max(
    64,
    totalSolvedRate * 2,
    maxSolvedRate * 8,
    totalTargetRate * 8,
    maxTargetRate * 16
  );
}

export function buildEmptySolveAudit(): SolveAudit {
  return {
    prunedItemCount: 0,
    prunedRecipeCount: 0,
    prunedOptionCount: 0,
    resolvedRawInputCount: 0,
    graphDurationMs: 0,
    modelDurationMs: 0,
    solveDurationMs: 0,
    resultDurationMs: 0,
    totalDurationMs: 0,
    attempts: [],
  };
}

export function buildSolveAuditAttempt(params: {
  phase: SolveAuditAttempt['phase'];
  round?: number;
  modelKind: SolveAuditAttempt['modelKind'];
  itemCount: number;
  recipeCount: number;
  optionCount: number;
  constraintCount: number;
  variableCount: number;
  binaryCount?: number;
  buildDurationMs: number;
  solveDurationMs: number;
  status: string;
  surplusItemCount?: number;
  surplusRatePerMin?: number;
  solvedRecipeCount?: number;
  solvedOptionCount?: number;
  primaryObjectiveValue?: number;
  surplusWeights?: ReadonlyMap<string, number>;
  isBestCandidate?: boolean;
  stagnantRounds?: number;
}): SolveAuditAttempt {
  const {
    phase,
    round,
    modelKind,
    itemCount,
    recipeCount,
    optionCount,
    constraintCount,
    variableCount,
    binaryCount,
    buildDurationMs,
    solveDurationMs,
    status,
    surplusItemCount,
    surplusRatePerMin,
    solvedRecipeCount,
    solvedOptionCount,
    primaryObjectiveValue,
    surplusWeights,
    isBestCandidate,
    stagnantRounds,
  } = params;

  const attempt = {
    phase,
    round,
    modelKind,
    itemCount,
    recipeCount,
    optionCount,
    constraintCount,
    variableCount,
    binaryCount,
    buildDurationMs,
    solveDurationMs,
    totalDurationMs: buildDurationMs + solveDurationMs,
    status,
    surplusItemCount,
    surplusRatePerMin,
    solvedRecipeCount,
    solvedOptionCount,
    primaryObjectiveValue,
    surplusWeights: surplusWeights ? Object.fromEntries(surplusWeights) : undefined,
    isBestCandidate,
    stagnantRounds,
  };

  recordSolverPerf({
    phase: 'attempt',
    durationMs: attempt.totalDurationMs,
    recipeCount,
    optionCount,
    usedRecipeCount: solvedRecipeCount,
    usedOptionCount: solvedOptionCount,
    constraintCount,
    variableCount,
    status: `${phase}:${status}`,
    recordedAt: currentTimeMs(),
  });

  return attempt;
}

export function buildLinearModel(
  request: SolveRequest,
  compiledOptions: CompiledOptionContext[],
  targetRateMap: Map<string, number>,
  externalItemIds: Set<string>,
  buildOptions?: {
    surplusWeights?: ReadonlyMap<string, number>;
    primaryObjectiveUpperBound?: number;
    optimizePrimaryObjectiveFirst?: boolean;
  }
): {
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  involvedItemCount: number;
  activeRecipeCount: number;
} {
  const {
    surplusWeights,
    primaryObjectiveUpperBound,
    optimizePrimaryObjectiveFirst = false,
  } = buildOptions ?? {};
  const activeOptions = collectModelOptions(request, compiledOptions);
  const involvedItemIds = collectInvolvedItemIds(activeOptions, targetRateMap, externalItemIds);
  const constraints = buildExactItemBalanceConstraints(involvedItemIds, targetRateMap);
  const variables: Record<string, Record<string, number>> = {};

  for (const { option, recipe } of activeOptions) {
    const coefficients: Record<string, number> = {
      __objective__: optimizePrimaryObjectiveFirst
        ? buildPrimaryFirstObjectiveCoefficient(request, recipe, option)
        : buildObjectiveCoefficient(request, recipe, option),
    };

    for (const [itemId, amount] of option.netItemEntries) {
      coefficients[itemId] = amount;
    }

    variables[option.optionId] = coefficients;
  }

  for (const itemId of externalItemIds) {
    variables[`ext:${itemId}`] = {
      [itemId]: 1,
      __objective__: optimizePrimaryObjectiveFirst
        ? buildPrimaryObjectiveExternalInputCoefficient(request)
        : buildExternalInputObjectiveCoefficient(request),
    };
  }

  if (request.balancePolicy === 'allow_surplus') {
    for (const itemId of involvedItemIds) {
      variables[buildSurplusVariableName(itemId)] = {
        [itemId]: -1,
        __objective__: optimizePrimaryObjectiveFirst ? 0 : (surplusWeights?.get(itemId) ?? 1),
      };
    }
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
    },
    activeOptions,
    involvedItemCount: involvedItemIds.length,
    activeRecipeCount: countActiveRecipeIds(activeOptions),
  };
}

export function buildComplexityModel(params: {
  catalog: ResolvedCatalogModel;
  request: SolveRequest;
  compiledOptions: CompiledOptionContext[];
  targetRateMap: Map<string, number>;
  externalItemIds: Set<string>;
  linkUpperBound: number;
}): {
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  involvedItemCount: number;
  activeRecipeCount: number;
} {
  const {
    catalog,
    request,
    compiledOptions,
    targetRateMap,
    externalItemIds,
    linkUpperBound,
  } = params;
  const activeOptions = collectModelOptions(request, compiledOptions);
  const involvedItemIds = collectInvolvedItemIds(activeOptions, targetRateMap, externalItemIds);
  const constraints = buildExactItemBalanceConstraints(involvedItemIds, targetRateMap);
  const variables: Record<string, Record<string, number>> = {};
  const binaries = new Set<string>();
  const totalPowerCoefficient = activeOptions.reduce(
    (sum, { option, recipe }) => sum + buildComplexityPowerCoefficient(request, recipe, option),
    0
  );
  const powerTieBreakScale =
    totalPowerCoefficient > 0
      ? 0.5 / (linkUpperBound * totalPowerCoefficient + 1)
      : 0;

  for (const { option, recipe } of activeOptions) {
    const scaledPowerCoefficient =
      buildComplexityPowerCoefficient(request, recipe, option) * powerTieBreakScale;
    const coefficients: Record<string, number> = {
      __complexity__: scaledPowerCoefficient,
    };

    for (const [itemId, amount] of option.netItemEntries) {
      coefficients[itemId] = amount;
    }

    variables[option.optionId] = coefficients;
  }

  for (const itemId of externalItemIds) {
    variables[`ext:${itemId}`] = {
      [itemId]: 1,
    };
  }

  if (request.balancePolicy === 'allow_surplus') {
    for (const itemId of involvedItemIds) {
      variables[buildSurplusVariableName(itemId)] = {
        [itemId]: -1,
        __complexity__: powerTieBreakScale * OBJECTIVE_EPSILON,
      };
    }
  }

  const ensureUsageVariable = (variableName: string) => {
    const coefficients = ensureVariableCoefficients(variables, variableName);
    coefficients.__complexity__ = 1;
    binaries.add(variableName);
  };

  const recipeUsageMap = new Map<string, string[]>();
  const buildingUsageMap = new Map<string, string[]>();
  const itemUsageMap = new Map<string, string[]>();

  for (const { option, recipe } of activeOptions) {
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

  for (const itemId of collectComplexityTrackedItemIds(catalog, activeOptions, externalItemIds)) {
    const itemVariableIds = itemUsageMap.get(itemId) ?? [];
    if (externalItemIds.has(itemId)) {
      itemVariableIds.push(`ext:${itemId}`);
    }
    itemUsageMap.set(itemId, itemVariableIds);
  }

  for (const [recipeId, optionIds] of recipeUsageMap.entries()) {
    const constraintName = `__complexity_link:recipe:${recipeId}`;
    constraints[constraintName] = { max: 0 };
    for (const optionId of optionIds) {
      addVariableCoefficient(variables, optionId, constraintName, 1);
    }
    const usageVariable = buildComplexityUsageVariableName('recipe', recipeId);
    ensureUsageVariable(usageVariable);
    addVariableCoefficient(variables, usageVariable, constraintName, -linkUpperBound);
  }

  for (const [buildingId, optionIds] of buildingUsageMap.entries()) {
    const constraintName = `__complexity_link:building:${buildingId}`;
    constraints[constraintName] = { max: 0 };
    for (const optionId of optionIds) {
      addVariableCoefficient(variables, optionId, constraintName, 1);
    }
    const usageVariable = buildComplexityUsageVariableName('building', buildingId);
    ensureUsageVariable(usageVariable);
    addVariableCoefficient(variables, usageVariable, constraintName, -linkUpperBound);
  }

  for (const [itemId, variableIds] of itemUsageMap.entries()) {
    if (variableIds.length === 0) {
      continue;
    }

    const constraintName = `__complexity_link:item:${itemId}`;
    constraints[constraintName] = { max: 0 };
    for (const variableId of variableIds) {
      addVariableCoefficient(variables, variableId, constraintName, 1);
    }
    const usageVariable = buildComplexityUsageVariableName('item', itemId);
    ensureUsageVariable(usageVariable);
    addVariableCoefficient(variables, usageVariable, constraintName, -linkUpperBound);
  }

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
  };
}
