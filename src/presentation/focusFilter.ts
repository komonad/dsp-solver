import type { PresentationRecipePlan } from './viewModel';

export interface FocusFilterResult {
  /** Indices into the unchanged presentation recipe-plan array. */
  focusedRecipeIndices: Set<number>;
  /** Selected items and every positive input/output of their upstream plans. */
  focusedItemIds: Set<string>;
  /** Input boundaries used only for display; they do not modify the solve request. */
  viewRawInputItemIds: Set<string>;
  /** Whole-plan totals; shared upstream capacity is counted once. */
  summary: {
    recipeCount: number;
    buildingCount: number;
    roundedPlacementPowerMW: number;
  };
}

export interface FocusFilterOptions {
  viewRawInputItemIds?: readonly string[];
  /** Explicit targets keep cyclic production branches reachable when only boundaries are selected. */
  targetItemIds?: readonly string[];
}

/**
 * Selects whole upstream plans from the current solution, stopping at raw inputs.
 * Co-products are visible boundary outputs; they do not expand the traversal.
 * View input boundaries stop traversal even when the same item is focused.
 * Without focus, only upstream plans exclusive to the boundaries are dimmed.
 * Shared plans remain visible when another retained branch needs their outputs.
 * Multiple selections share plans, and plan quantities remain unchanged.
 */
export function computeFocusFilter(
  focusItemIds: string[],
  recipePlans: PresentationRecipePlan[],
  rawInputItemIds: Set<string>,
  options: FocusFilterOptions = {},
): FocusFilterResult {
  const producersByItem = new Map<string, number[]>();
  for (let i = 0; i < recipePlans.length; i++) {
    for (const output of recipePlans[i].outputs) {
      if (output.ratePerMin < 1e-6) continue;
      let list = producersByItem.get(output.itemId);
      if (!list) {
        list = [];
        producersByItem.set(output.itemId, list);
      }
      list.push(i);
    }
  }

  function collectUpstream(seeds: readonly string[], boundaries: ReadonlySet<string>, retainedPlans: number[] = []) {
    const focusedRecipeIndices = new Set<number>();
    const focusedItemIds = new Set<string>(seeds);
    const visitedItemIds = new Set<string>();
    const queue = [...seeds];

    function visitPlan(index: number) {
      if (focusedRecipeIndices.has(index)) return;
      focusedRecipeIndices.add(index);
      for (const output of recipePlans[index].outputs) {
        if (output.ratePerMin >= 1e-6) focusedItemIds.add(output.itemId);
      }
      for (const input of recipePlans[index].inputs) {
        if (input.ratePerMin < 1e-6) continue;
        focusedItemIds.add(input.itemId);
        queue.push(input.itemId);
      }
    }

    retainedPlans.forEach(visitPlan);
    while (queue.length > 0) {
      const itemId = queue.pop()!;
      if (visitedItemIds.has(itemId) || boundaries.has(itemId)) continue;
      visitedItemIds.add(itemId);
      for (const index of producersByItem.get(itemId) ?? []) {
        visitPlan(index);
      }
    }
    return { focusedRecipeIndices, focusedItemIds };
  }

  const viewRawInputItemIds = new Set(options.viewRawInputItemIds);
  const boundaries = new Set([...rawInputItemIds, ...viewRawInputItemIds]);
  let retainedPlans: number[] = [];
  let seeds = focusItemIds;
  if (focusItemIds.length === 0 && viewRawInputItemIds.size > 0) {
    const excludedUpstream = collectUpstream([...viewRawInputItemIds], rawInputItemIds);
    retainedPlans = recipePlans.flatMap((_, index) =>
      excludedUpstream.focusedRecipeIndices.has(index) ? [] : [index],
    );
    seeds = [...(options.targetItemIds ?? []), ...viewRawInputItemIds];
  }
  const { focusedRecipeIndices, focusedItemIds } = collectUpstream(seeds, boundaries, retainedPlans);
  const summary = { recipeCount: 0, buildingCount: 0, roundedPlacementPowerMW: 0 };
  const recipeIds = new Set<string>();
  for (const index of focusedRecipeIndices) {
    const plan = recipePlans[index];
    recipeIds.add(plan.recipeId);
    summary.buildingCount += plan.roundedUpBuildingCount;
    summary.roundedPlacementPowerMW += plan.roundedPlacementPowerMW;
  }
  summary.recipeCount = recipeIds.size;
  return { focusedRecipeIndices, focusedItemIds, viewRawInputItemIds, summary };
}
