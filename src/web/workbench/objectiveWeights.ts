import type { SolveRequest, SolveObjective, ObjectiveWeights } from '../../solver';

export const OBJECTIVE_PRESETS: Record<SolveObjective, ObjectiveWeights> = {
  min_buildings: { resources: 0, footprint: 1, power: 0, recipes: 0 },
  min_power: { resources: 0, footprint: 0, power: 1, recipes: 0 },
  min_external_input: { resources: 1, footprint: 0, power: 0, recipes: 0 },
  min_weighted: { resources: 1, footprint: 1, power: 0, recipes: 0 },
  min_complexity: { resources: 0, footprint: 1, power: 0, recipes: 100 },
};

export function resolveObjectiveWeights(objective: SolveObjective, overrides: Partial<SolveRequest>, baselineCost = 1): ObjectiveWeights {
  if (overrides.objectiveWeights) return overrides.objectiveWeights;
  const preset = OBJECTIVE_PRESETS[objective];
  return { ...preset,
    ...(objective === 'min_weighted' ? {
      resources: overrides.resourceWeight ?? 1, footprint: overrides.footprintWeight ?? 1, power: overrides.powerWeight ?? 0,
    } : {}),
    recipes: overrides.recipeWeight ?? (overrides.recipeCountPenalty?.weight ? overrides.recipeCountPenalty.weight * baselineCost : preset.recipes),
  };
}

export function matchObjectivePreset(weights: ObjectiveWeights): SolveObjective | 'custom' {
  return (Object.keys(OBJECTIVE_PRESETS) as SolveObjective[]).find(id =>
    (Object.keys(weights) as Array<keyof ObjectiveWeights>).every(key => weights[key] === OBJECTIVE_PRESETS[id][key])) ?? 'custom';
}

export function updateObjectiveWeightsText(
  text: string,
  patch: Pick<SolveRequest, 'inputWeights' | 'footprintWeight' | 'resourceWeight' | 'recipeCountPenalty' | 'objectiveWeights' | 'powerWeight' | 'recipeWeight' | 'milpTimeLimitMs' | 'milpRelativeGap'>
): string {
  const value: unknown = text.trim() ? JSON.parse(text) : {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Solve overrides must be an object.');
  }
  return JSON.stringify({ ...value, ...patch }, null, 2);
}
