import type { PresentationRecipePlan } from './viewModel';

export interface FocusFilterResult {
  /** Indices into the unchanged presentation recipe-plan array. */
  focusedRecipeIndices: Set<number>;
  /** Selected items and every positive input/output of their upstream plans. */
  focusedItemIds: Set<string>;
  /** Whole-plan totals; shared upstream capacity is counted once. */
  summary: {
    recipeCount: number;
    buildingCount: number;
    roundedPlacementPowerMW: number;
  };
}

/**
 * Selects whole upstream plans from the current solution, stopping at raw inputs.
 * Co-products are visible boundary outputs; they do not expand the traversal.
 * Multiple selections share plans, and plan quantities remain unchanged.
 */
export function computeFocusFilter(
  focusItemIds: string[],
  recipePlans: PresentationRecipePlan[],
  rawInputItemIds: Set<string>,
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

  const focusedRecipeIndices = new Set<number>();
  const focusedItemIds = new Set<string>(focusItemIds);
  const visitedItemIds = new Set<string>();
  const queue = [...focusItemIds];

  while (queue.length > 0) {
    const itemId = queue.pop()!;
    if (visitedItemIds.has(itemId) || rawInputItemIds.has(itemId)) continue;
    visitedItemIds.add(itemId);
    const producers = producersByItem.get(itemId);
    if (!producers) continue;

    for (const recipeIdx of producers) {
      if (focusedRecipeIndices.has(recipeIdx)) continue;
      focusedRecipeIndices.add(recipeIdx);

      for (const output of recipePlans[recipeIdx].outputs) {
        if (output.ratePerMin >= 1e-6) focusedItemIds.add(output.itemId);
      }
      for (const input of recipePlans[recipeIdx].inputs) {
        if (input.ratePerMin < 1e-6) continue;
        focusedItemIds.add(input.itemId);
        if (!visitedItemIds.has(input.itemId) && !rawInputItemIds.has(input.itemId)) {
          queue.push(input.itemId);
        }
      }
    }
  }

  const summary = { recipeCount: 0, buildingCount: 0, roundedPlacementPowerMW: 0 };
  const recipeIds = new Set<string>();
  for (const index of focusedRecipeIndices) {
    const plan = recipePlans[index];
    recipeIds.add(plan.recipeId);
    summary.buildingCount += plan.roundedUpBuildingCount;
    summary.roundedPlacementPowerMW += plan.roundedPlacementPowerMW;
  }
  summary.recipeCount = recipeIds.size;
  return { focusedRecipeIndices, focusedItemIds, summary };
}
