import type { Model, Solution, SolverImplementation } from './implementation';
import type { RecipeCountOptimization } from './result';
import type { SolveRequest } from './request';
import type { CompiledOptionContext } from './solveGraph';
import { currentTimeMs, EPSILON } from './solveGraph';
import { isFeasibleAssignment } from './solutionValidation';

/** Refine a feasible weighted LP using one binary indicator per recipe ID. */
export function optimizeRecipeCount(
  request: SolveRequest,
  baseModel: Model,
  baseline: Solution,
  options: CompiledOptionContext[],
  implementation: SolverImplementation,
  onIncumbent?: (solution: Solution, summary: RecipeCountOptimization) => void
): { solution: Solution; summary: RecipeCountOptimization; model?: Model } {
  const start = currentTimeMs();
  const config = request.recipeCountPenalty ?? { weight: 0 };
  const timeLimitMs = request.milpTimeLimitMs !== undefined ? request.milpTimeLimitMs
    : config.timeLimitMs ?? (request.recipeWeight !== undefined || request.singleRecipeVariant ? null : 3000);
  const deadline = timeLimitMs === null ? Infinity : start + timeLimitMs;
  const recipes = new Map<string, string[]>();
  for (const { option, recipe } of options) {
    const ids = recipes.get(recipe.recipeId) ?? [];
    ids.push(option.optionId);
    recipes.set(recipe.recipeId, ids);
  }
  const count = (values: ReadonlyMap<string, number>) => Array.from(recipes.values())
    .filter(ids => ids.some(id => (values.get(id) ?? 0) > EPSILON)).length;
  const costs = new Map(Object.entries(baseModel.variables).map(([id, c]) => [id, c[baseModel.objective] ?? 0]));
  const cost = (values: ReadonlyMap<string, number>) => Array.from(costs)
    .reduce((sum, [id, coefficient]) => sum + coefficient * (values.get(id) ?? 0), 0);
  const baselineCost = cost(baseline.variables);
  const baselineRecipeCount = count(baseline.variables);
  const penaltyPerRecipe = request.recipeWeight ?? baselineCost * config.weight;
  const normalizedPenalty = baselineCost > 0 ? penaltyPerRecipe / baselineCost : 0;
  const summary: RecipeCountOptimization = {
    status: 'baseline', timeLimitMs, durationMs: 0, weight: normalizedPenalty, penaltyPerRecipe,
    baselineCost, finalCost: baselineCost, baselineRecipeCount,
    finalRecipeCount: baselineRecipeCount, binaryCount: recipes.size,
  };
  let best = baseline;
  const finish = (solution = best, model?: Model) => {
    summary.durationMs = currentTimeMs() - start;
    return { solution: { ...solution, status: 'optimal' }, summary, model };
  };
  onIncumbent?.(baseline, { ...summary, status: 'optimizing' });
  if (!(baselineCost > EPSILON) || !Number.isFinite(baselineCost)) {
    summary.reason = 'zero_cost';
    return finish();
  }
  // The incumbent bounds the full cost-plus-count objective, so bounds do not
  // exclude any improving solution, including alternatives outside its support.
  const upper = 1 + normalizedPenalty * baselineRecipeCount;
  let bestScore = upper;
  if (!Number.isFinite(upper)) { summary.reason = 'zero_cost'; return finish(); }
  const model = structuredClone(baseModel);
  model.binaries = new Set<string>();
  model.constraints.__recipe_cutoff = { max: upper + 1e-7 };
  for (const [id, coefficients] of Object.entries(model.variables)) {
    coefficients[model.objective] = (costs.get(id) ?? 0) / baselineCost;
    coefficients.__recipe_cutoff = coefficients[model.objective];
  }
  const seed = new Map(baseline.variables);
  try {
    for (const [recipe, ids] of recipes) {
      if (currentTimeMs() >= deadline) { summary.status = 'time_limit'; return finish(); }
      const indicator = `__recipe_use:${recipe}`;
      const row = `recipe-link:${recipe}`;
      let bound = upper;
      const costBounded = ids.every(id => model.variables[id][model.objective] > 0);
      if (!costBounded) {
        const auxiliary = structuredClone(baseModel);
        auxiliary.direction = 'maximize';
        auxiliary.objective = '__recipe_bound';
        auxiliary.constraints.__recipe_cost_bound = { max: upper + 1e-7 };
        for (const [id, coefficients] of Object.entries(auxiliary.variables)) {
          coefficients.__recipe_cost_bound = (costs.get(id) ?? 0) / baselineCost;
        }
        for (const id of ids) auxiliary.variables[id].__recipe_bound = 1;
        const maximum = implementation.solve(auxiliary, { ...(Number.isFinite(deadline) ? { timeout: Math.max(1, deadline - currentTimeMs()) } : {}) });
        if (maximum.status !== 'optimal' || !Number.isFinite(maximum.result)) {
          summary.reason = 'unbounded';
          if (currentTimeMs() >= deadline) summary.status = 'time_limit';
          return finish();
        }
        bound = Math.max(0, maximum.result) * (1 + 1e-6) + 1e-6;
      }
      model.constraints[row] = { max: 0 };
      model.variables[indicator] = { [model.objective]: normalizedPenalty, __recipe_cutoff: normalizedPenalty, [row]: -bound };
      (model.binaries as Set<string>).add(indicator);
      for (const id of ids) model.variables[id][row] = costBounded ? model.variables[id][model.objective] : 1;
      seed.set(indicator, ids.some(id => (seed.get(id) ?? 0) > EPSILON) ? 1 : 0);
      if (request.singleRecipeVariant && ids.length > 1) {
        const choiceRow = `single-variant:${recipe}`;
        model.constraints[choiceRow] = { max: 1 };
        for (const id of ids) {
          const use = `__variant_use:${id}`;
          const link = `variant-link:${id}`;
          model.constraints[link] = { max: 0 };
          model.variables[use] = { [model.objective]: 0, [choiceRow]: 1, [link]: -bound };
          model.variables[id][link] = costBounded ? model.variables[id][model.objective] : 1;
          (model.binaries as Set<string>).add(use);
          seed.set(use, (seed.get(id) ?? 0) > EPSILON ? 1 : 0);
        }
      }
    }
    summary.binaryCount = model.binaries.size;
    if (!isFeasibleAssignment(model, seed)) { summary.reason = 'invalid_candidate'; return finish(); }
    const remaining = deadline - currentTimeMs();
    if (remaining <= 0) { summary.status = 'time_limit'; return finish(); }
    const accept = (candidate: Solution) => {
      if (request.singleRecipeVariant && [...recipes.values()].some(ids =>
        ids.filter(id => (candidate.variables.get(id) ?? 0) > EPSILON).length > 1)) return false;
      const candidateCost = cost(candidate.variables);
      const candidateCount = count(candidate.variables);
      const score = candidateCost / baselineCost + normalizedPenalty * candidateCount;
      if (!isFeasibleAssignment(model, candidate.variables) || score > bestScore + 1e-7) return false;
      best = candidate;
      bestScore = score;
      summary.finalCost = candidateCost;
      summary.finalRecipeCount = candidateCount;
      if (candidate.mipGap !== undefined && Number.isFinite(candidate.mipGap)) summary.relativeGap = candidate.mipGap;
      return true;
    };
    const candidate = implementation.solve(model, {
      ...(Number.isFinite(remaining) ? { timeout: remaining } : {}),
      tolerance: request.milpRelativeGap ?? 0.01, initialSolution: seed,
      onIncumbent: candidate => {
        if (accept(candidate)) onIncumbent?.(candidate, { ...summary, status: 'optimizing', durationMs: currentTimeMs() - start });
      },
    });
    if (!['optimal', 'timedout'].includes(candidate.status) || !accept(candidate)) {
      summary.reason = 'invalid_candidate';
      summary.status = candidate.status === 'timedout' ? 'time_limit' : 'baseline';
      return finish();
    }
    summary.status = candidate.status === 'optimal' ? 'converged' : 'time_limit';
    // Public result status and termination metadata preserve the distinction
    // between a feasible incumbent and a proven integer optimum.
    return finish({ ...best, status: 'optimal' }, model);
  } catch {
    summary.reason = 'solver_error';
    return finish();
  }
}
