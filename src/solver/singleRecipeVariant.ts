import type { Model, Solution, SolverImplementation } from './implementation';
import { EPSILON, type CompiledOptionContext } from './solveGraph';
import { isFeasibleAssignment } from './solutionValidation';

export function groupRecipeVariantIds(options: CompiledOptionContext[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const { recipe, option } of options) {
    const group = groups.get(recipe.recipeId) ?? [];
    group.push(option.optionId);
    groups.set(recipe.recipeId, group);
  }
  return [...groups.values()].filter(ids => ids.length > 1);
}

/** Find a feasible exclusive seed; the subsequent MILP optimizes its cost. */
export function findSingleRecipeVariantSeed(model: Model, baseline: Solution,
  options: CompiledOptionContext[], implementation: SolverImplementation): Solution {
  const groups = groupRecipeVariantIds(options);
  const conflict = (solution: Solution) => groups.map(ids => ids.filter(id => (solution.variables.get(id) ?? 0) > EPSILON))
    .find(ids => ids.length > 1);
  if (!conflict(baseline)) return baseline;
  const solveRestricted = (excluded: ReadonlySet<string>) => {
    const restricted = structuredClone(model);
    for (const id of excluded) {
      const row = `single-variant-seed:${id}`;
      restricted.constraints[row] = { max: 0 };
      restricted.variables[id][row] = 1;
    }
    const solution = implementation.solve(restricted);
    return solution.status === 'optimal' && isFeasibleAssignment(restricted, solution.variables) ? solution : null;
  };
  const preferredExclusions = new Set<string>();
  for (const ids of groups) {
    const preferred = ids.reduce((best, id) => (baseline.variables.get(id) ?? 0) > (baseline.variables.get(best) ?? 0) ? id : best);
    for (const id of ids) if (id !== preferred) preferredExclusions.add(id);
  }
  const preferred = solveRestricted(preferredExclusions);
  if (preferred && !conflict(preferred)) return preferred;

  // Every exclusive solution sets at least one member of a conflicting pair
  // to zero. Branching on that disjunction requires no finite flow bounds.
  const pending = [{ excluded: new Set<string>(), solution: baseline }];
  while (pending.length) {
    const node = pending.pop()!;
    const ids = conflict(node.solution);
    if (!ids) return node.solution;
    const [first, second] = ids.sort((left, right) =>
      (node.solution.variables.get(left) ?? 0) - (node.solution.variables.get(right) ?? 0));
    for (const id of [second, first]) {
      const excluded = new Set(node.excluded).add(id);
      const solution = solveRestricted(excluded);
      if (!solution) continue;
      if (!conflict(solution)) return solution;
      pending.push({ excluded, solution });
    }
  }
  return { status: 'infeasible', result: NaN, variables: new Map() };
}
