import type { SolveRequest } from './request';
import type { SolveResult } from './result';
import type { CompiledOptionContext } from './solveGraph';

/** Reference throughput for explicit objective coefficients, in items/min. */
export const OBJECTIVE_REFERENCE_RATE_PER_MIN = 60;

/** Positive target rates share one scale, preserving multi-output proportions. */
export function getObjectiveProductionScale(request: Pick<SolveRequest, 'targets'>): number {
  const total = request.targets.reduce((sum, target) => sum + target.ratePerMin, 0);
  return total > 0 ? total / OBJECTIVE_REFERENCE_RATE_PER_MIN : 1;
}

export function normalizeObjectiveRequest(request: SolveRequest): SolveRequest {
  const w = request.objectiveWeights;
  const scale = getObjectiveProductionScale(request);
  return w ? { ...request, objective: 'min_weighted', resourceWeight: w.resources / scale,
    footprintWeight: w.footprint / scale, powerWeight: w.power / scale, recipeWeight: w.recipes, recipeCountPenalty: undefined,
    milpTimeLimitMs: request.milpTimeLimitMs === undefined ? null : request.milpTimeLimitMs } : request;
}

export function buildWeightedObjectiveCost(request: SolveRequest, result: SolveResult,
  options: CompiledOptionContext[], values: ReadonlyMap<string, number>): NonNullable<SolveResult['objectiveCost']> {
  const weightedInputCost = result.externalInputs.reduce((sum, input) => sum + input.ratePerMin * getInputUnitCost(request, input.itemId), 0);
  const placementArea = options.reduce((sum, entry) => sum + entry.option.buildingCostPerRunPerMin * (values.get(entry.option.optionId) ?? 0), 0);
  const footprintCost = placementArea * (request.footprintWeight ?? 1);
  const resourceCost = weightedInputCost * (request.resourceWeight ?? 1);
  const powerCost = result.powerSummary.activePowerMW * (request.powerWeight ?? 0);
  return { weightedInputCost, resourceCost, placementArea, footprintCost, powerCost,
    productionScale: request.objectiveWeights ? getObjectiveProductionScale(request) : 1,
    total: resourceCost + footprintCost + powerCost };
}

export function getInputUnitCost(request: SolveRequest, itemId: string): number {
  return request.inputWeights?.[itemId] ?? 1;
}
