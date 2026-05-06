import type { ResolvedCatalogModel } from '../../catalog';
import type { PresentationItemRate, PresentationRecipePlan } from '../../presentation';

export interface RecipeFlowDisplay {
  visibleInputs: PresentationItemRate[];
  auxiliaryProliferatorInput: PresentationItemRate | null;
}

/**
 * Remove accounting-only inputs from the visible formula.
 *
 * The solver reports these as normal input rates, which is correct for
 * accounting. The workbench formula keeps virtual power demand hidden and
 * renders proliferator consumption as a suffix note.
 */
export function buildRecipeFlowDisplay(
  catalog: ResolvedCatalogModel | null,
  plan: PresentationRecipePlan
): RecipeFlowDisplay {
  if (!catalog) {
    return {
      visibleInputs: plan.inputs,
      auxiliaryProliferatorInput: null,
    };
  }

  const hiddenInputItemIds = new Set<string>();
  if (catalog.powerItemId) {
    hiddenInputItemIds.add(catalog.powerItemId);
  }

  if (plan.proliferatorMode === 'none' || plan.proliferatorLevel <= 0) {
    return {
      visibleInputs: plan.inputs.filter(input => !hiddenInputItemIds.has(input.itemId)),
      auxiliaryProliferatorInput: null,
    };
  }

  const proliferatorItemId =
    catalog.proliferatorLevels.find(level => level.level === plan.proliferatorLevel)?.itemId ?? null;

  if (!proliferatorItemId) {
    return {
      visibleInputs: plan.inputs.filter(input => !hiddenInputItemIds.has(input.itemId)),
      auxiliaryProliferatorInput: null,
    };
  }

  hiddenInputItemIds.add(proliferatorItemId);

  const auxiliaryProliferatorInput =
    plan.inputs.find(input => input.itemId === proliferatorItemId) ?? null;

  if (!auxiliaryProliferatorInput) {
    return {
      visibleInputs: plan.inputs.filter(input => !hiddenInputItemIds.has(input.itemId)),
      auxiliaryProliferatorInput: null,
    };
  }

  return {
    visibleInputs: plan.inputs.filter(input => !hiddenInputItemIds.has(input.itemId)),
    auxiliaryProliferatorInput,
  };
}
