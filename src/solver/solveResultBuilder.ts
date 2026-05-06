import type { SolveRequest } from './request';
import type {
  BuildingSummary,
  ItemBalanceEntry,
  ItemRate,
  RecipePlan,
  SolveAudit,
  SolveResult,
} from './result';
import {
  EPSILON,
  type CompiledOptionContext,
  type SurplusSolutionMetrics,
} from './solveGraph';
import { buildEmptySolveAudit } from './modelBuilder';

const REPORTED_RATE_EPSILON = 5e-3;
const SURPLUS_OUTPUT_EPSILON = 1e-3;

export function roundUpCount(value: number): number {
  if (value <= EPSILON) {
    return 0;
  }

  return Math.ceil(value - EPSILON);
}

function calculateWorkingPowerMW(
  building: { workPowerMW: number },
  option: { powerMultiplier: number },
  exactBuildingCount: number
): number {
  return exactBuildingCount * building.workPowerMW * option.powerMultiplier;
}

function calculateWeightedPlacementPowerMW(
  building: { workPowerMW: number; idlePowerMW?: number },
  option: { powerMultiplier: number },
  exactBuildingCount: number,
  roundedUpBuildingCount: number
): number {
  const workingPowerMW = calculateWorkingPowerMW(building, option, exactBuildingCount);
  const idleBuildingCount = Math.max(0, roundedUpBuildingCount - exactBuildingCount);

  return workingPowerMW + idleBuildingCount * (building.idlePowerMW ?? 0);
}

function normalizeReportedRate(value: number): number {
  return Math.abs(value) < REPORTED_RATE_EPSILON ? 0 : value;
}

function sortItemRates(itemRates: Map<string, number>): ItemRate[] {
  return Array.from(itemRates.entries())
    .map(([itemId, rate]) => [itemId, normalizeReportedRate(rate)] as const)
    .filter(([, rate]) => rate !== 0)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([itemId, ratePerMin]) => ({
      itemId,
      ratePerMin,
    }));
}

export function collectSurplusSolutionMetrics(
  solutionVariables: Iterable<[string, number]>
): SurplusSolutionMetrics {
  const itemRateMap = new Map<string, number>();
  let totalRatePerMin = 0;

  for (const [variableName, value] of solutionVariables) {
    if (!variableName.startsWith('__surplus:') || value <= SURPLUS_OUTPUT_EPSILON) {
      continue;
    }

    const itemId = variableName.slice('__surplus:'.length);
    itemRateMap.set(itemId, value);
    totalRatePerMin += value;
  }

  return {
    activeItemIds: Array.from(itemRateMap.keys()).sort((left, right) => left.localeCompare(right)),
    itemRateMap,
    totalRatePerMin,
  };
}

export function countSolutionActiveRecipeIds(
  activeOptions: CompiledOptionContext[],
  solutionVariables: Iterable<[string, number]>
): number {
  const recipeIdByOptionId = new Map(
    activeOptions.map(({ option, recipe }) => [option.optionId, recipe.recipeId] as const)
  );
  const activeRecipeIds = new Set<string>();

  for (const [variableName, value] of solutionVariables) {
    if (value <= EPSILON) {
      continue;
    }

    const recipeId = recipeIdByOptionId.get(variableName);
    if (recipeId) {
      activeRecipeIds.add(recipeId);
    }
  }

  return activeRecipeIds.size;
}

export function countSolutionActiveOptionIds(solutionVariables: Iterable<[string, number]>): number {
  let activeOptionCount = 0;

  for (const [variableName, value] of solutionVariables) {
    if (
      value <= EPSILON ||
      variableName.startsWith('__') ||
      variableName.startsWith('ext:')
    ) {
      continue;
    }

    activeOptionCount += 1;
  }

  return activeOptionCount;
}

export function collectSolvedUsageCounts(
  activeOptions: CompiledOptionContext[],
  solutionVariables: Iterable<[string, number]>
): {
  solvedRecipeCount: number;
  solvedOptionCount: number;
} {
  return {
    solvedRecipeCount: countSolutionActiveRecipeIds(activeOptions, solutionVariables),
    solvedOptionCount: countSolutionActiveOptionIds(solutionVariables),
  };
}

function buildUnmetPreferences(
  request: SolveRequest,
  recipePlans: RecipePlan[]
): string[] {
  const unmet: string[] = [];
  const plansByRecipe = new Map<string, RecipePlan[]>();

  for (const plan of recipePlans) {
    const plans = plansByRecipe.get(plan.recipeId) ?? [];
    plans.push(plan);
    plansByRecipe.set(plan.recipeId, plans);
  }

  for (const [recipeId, preferredBuildingId] of Object.entries(request.preferredBuildingByRecipe ?? {})) {
    const plans = plansByRecipe.get(recipeId);
    if (plans && !plans.some(plan => plan.buildingId === preferredBuildingId)) {
      unmet.push(`Preferred building ${preferredBuildingId} was not used for recipe ${recipeId}.`);
    }
  }

  for (const [recipeId, preferredLevel] of Object.entries(request.preferredProliferatorLevelByRecipe ?? {})) {
    const plans = plansByRecipe.get(recipeId);
    if (plans && !plans.some(plan => plan.proliferatorLevel === preferredLevel)) {
      unmet.push(`Preferred proliferator level ${preferredLevel} was not used for recipe ${recipeId}.`);
    }
  }

  for (const [recipeId, preferredMode] of Object.entries(request.preferredProliferatorModeByRecipe ?? {})) {
    const plans = plansByRecipe.get(recipeId);
    if (plans && !plans.some(plan => plan.proliferatorMode === preferredMode)) {
      unmet.push(`Preferred proliferator mode ${preferredMode} was not used for recipe ${recipeId}.`);
    }
  }

  return unmet;
}

export function buildInfeasibleSolveResult(params: {
  targetRateMap: Map<string, number>;
  resolvedRawInputItemIds: string[];
  diagnostics: string[];
  infoMessages: string[];
  solveAudit?: SolveAudit;
}): SolveResult {
  const {
    targetRateMap,
    resolvedRawInputItemIds,
    diagnostics,
    infoMessages,
    solveAudit,
  } = params;

  return {
    status: 'infeasible',
    diagnostics: {
      messages: diagnostics,
      infoMessages,
      unmetPreferences: [],
    },
    solveAudit: solveAudit ?? buildEmptySolveAudit(),
    resolvedRawInputItemIds,
    targets: Array.from(targetRateMap.entries()).map(([itemId, requestedRatePerMin]) => ({
      itemId,
      requestedRatePerMin,
      actualRatePerMin: 0,
    })),
    recipePlans: [],
    buildingSummary: [],
    powerSummary: {
      activePowerMW: 0,
      roundedPlacementPowerMW: 0,
    },
    externalInputs: [],
    surplusOutputs: [],
    itemBalance: [],
  };
}

export function buildResultFromSolution(params: {
  request: SolveRequest;
  targetRateMap: Map<string, number>;
  compiledOptions: CompiledOptionContext[];
  solutionVariables: Map<string, number>;
  resolvedRawInputItemIds: string[];
}): SolveResult {
  const {
    request,
    targetRateMap,
    compiledOptions,
    solutionVariables,
    resolvedRawInputItemIds,
  } = params;
  const optionById = new Map(compiledOptions.map(entry => [entry.option.optionId, entry]));
  const recipePlans: RecipePlan[] = [];
  const externalInputMap = new Map<string, number>();
  const producedMap = new Map<string, number>();
  const recipeConsumedMap = new Map<string, number>();

  for (const [variableName, value] of solutionVariables.entries()) {
    if (value <= EPSILON) {
      continue;
    }

    if (variableName.startsWith('ext:')) {
      const itemId = variableName.slice(4);
      externalInputMap.set(itemId, (externalInputMap.get(itemId) ?? 0) + value);
      producedMap.set(itemId, (producedMap.get(itemId) ?? 0) + value);
      continue;
    }

    const compiled = optionById.get(variableName);
    if (!compiled) {
      continue;
    }

    const { option, building } = compiled;
    const exactBuildingCount = value / option.singleBuildingRunsPerMin;
    const roundedUpBuildingCount = roundUpCount(exactBuildingCount);
    const activePowerMW = calculateWorkingPowerMW(building, option, exactBuildingCount);
    const weightedPlacementPowerMW = calculateWeightedPlacementPowerMW(
      building,
      option,
      exactBuildingCount,
      roundedUpBuildingCount
    );

    const inputs = option.inputEntries.map(([itemId, amount]) => ({
      itemId,
      ratePerMin: amount * value,
    }));
    const outputs = option.outputEntries.map(([itemId, amount]) => ({
      itemId,
      ratePerMin: amount * value,
    }));

    for (const input of inputs) {
      recipeConsumedMap.set(input.itemId, (recipeConsumedMap.get(input.itemId) ?? 0) + input.ratePerMin);
    }

    for (const output of outputs) {
      producedMap.set(output.itemId, (producedMap.get(output.itemId) ?? 0) + output.ratePerMin);
    }

    recipePlans.push({
      recipeId: option.recipeId,
      buildingId: option.buildingId,
      proliferatorLevel: option.proliferatorLevel,
      proliferatorMode: option.proliferatorMode,
      runsPerMin: value,
      exactBuildingCount,
      roundedUpBuildingCount,
      activePowerMW,
      roundedPlacementPowerMW: weightedPlacementPowerMW,
      inputs: inputs.sort((left, right) => left.itemId.localeCompare(right.itemId)),
      outputs: outputs.sort((left, right) => left.itemId.localeCompare(right.itemId)),
    });
  }

  recipePlans.sort(
    (left, right) =>
      left.recipeId.localeCompare(right.recipeId) ||
      left.buildingId.localeCompare(right.buildingId) ||
      left.proliferatorMode.localeCompare(right.proliferatorMode) ||
      left.proliferatorLevel - right.proliferatorLevel
  );

  const buildingSummaryMap = new Map<string, BuildingSummary>();
  for (const plan of recipePlans) {
    const current = buildingSummaryMap.get(plan.buildingId);
    if (current) {
      current.exactCount += plan.exactBuildingCount;
      current.roundedUpCount += plan.roundedUpBuildingCount;
      current.activePowerMW += plan.activePowerMW;
      current.roundedPlacementPowerMW += plan.roundedPlacementPowerMW;
    } else {
      buildingSummaryMap.set(plan.buildingId, {
        buildingId: plan.buildingId,
        exactCount: plan.exactBuildingCount,
        roundedUpCount: plan.roundedUpBuildingCount,
        activePowerMW: plan.activePowerMW,
        roundedPlacementPowerMW: plan.roundedPlacementPowerMW,
      });
    }
  }

  const buildingSummary = Array.from(buildingSummaryMap.values()).sort((left, right) =>
    left.buildingId.localeCompare(right.buildingId)
  );

  const itemIds = new Set<string>([
    ...producedMap.keys(),
    ...recipeConsumedMap.keys(),
    ...targetRateMap.keys(),
    ...externalInputMap.keys(),
  ]);

  const surplusOutputs: ItemRate[] = [];
  const itemBalance: ItemBalanceEntry[] = Array.from(itemIds)
    .sort((left, right) => left.localeCompare(right))
    .map(itemId => {
      const targetRate = targetRateMap.get(itemId) ?? 0;
      const producedRatePerMin = producedMap.get(itemId) ?? 0;
      const consumedRatePerMin = (recipeConsumedMap.get(itemId) ?? 0) + targetRate;
      const netRatePerMin = normalizeReportedRate(producedRatePerMin - consumedRatePerMin);

      if (request.balancePolicy === 'allow_surplus' && netRatePerMin > 0) {
        surplusOutputs.push({ itemId, ratePerMin: netRatePerMin });
      }

      return {
        itemId,
        producedRatePerMin,
        consumedRatePerMin,
        netRatePerMin,
      };
    });

  const targets = Array.from(targetRateMap.entries())
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([itemId, requestedRatePerMin]) => ({
      itemId,
      requestedRatePerMin,
      actualRatePerMin:
        (producedMap.get(itemId) ?? 0) - (recipeConsumedMap.get(itemId) ?? 0),
    }));

  return {
    status: 'optimal',
    diagnostics: {
      messages: [],
      infoMessages: [],
      unmetPreferences: buildUnmetPreferences(request, recipePlans),
    },
    resolvedRawInputItemIds,
    targets,
    recipePlans,
    buildingSummary,
    powerSummary: {
      activePowerMW: buildingSummary.reduce((sum, entry) => sum + entry.activePowerMW, 0),
      roundedPlacementPowerMW: buildingSummary.reduce(
        (sum, entry) => sum + entry.roundedPlacementPowerMW,
        0
      ),
    },
    externalInputs: sortItemRates(externalInputMap),
    surplusOutputs: surplusOutputs.sort((left, right) => left.itemId.localeCompare(right.itemId)),
    itemBalance,
  };
}

export function buildInvalidInputSolveResult(messages: string[]): SolveResult {
  return {
    status: 'invalid_input',
    diagnostics: {
      messages,
      infoMessages: [],
      unmetPreferences: [],
    },
    solveAudit: buildEmptySolveAudit(),
    resolvedRawInputItemIds: [],
    targets: [],
    recipePlans: [],
    buildingSummary: [],
    powerSummary: {
      activePowerMW: 0,
      roundedPlacementPowerMW: 0,
    },
    externalInputs: [],
    surplusOutputs: [],
    itemBalance: [],
  };
}
