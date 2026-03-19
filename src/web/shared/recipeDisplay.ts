import type { ResolvedCatalogModel } from '../../catalog';
import type { PresentationItemRate, PresentationRecipePlan } from '../../presentation';

export interface RecipeFlowDisplay {
  visibleInputs: PresentationItemRate[];
  auxiliaryProliferatorInput: PresentationItemRate | null;
}

/**
 * Remove the auxiliary proliferator consumable from the visible formula when it
 * is present only because the selected plan uses spray effects.
 *
 * The solver reports that item as a normal input rate, which is correct for
 * accounting. The workbench formula renders it as a suffix note instead of a
 * main recipe ingredient so the recipe flow stays readable.
 */
export function buildRecipeFlowDisplay(
  catalog: ResolvedCatalogModel | null,
  plan: PresentationRecipePlan
): RecipeFlowDisplay {
  if (!catalog || plan.proliferatorMode === 'none' || plan.proliferatorLevel <= 0) {
    return {
      visibleInputs: plan.inputs,
      auxiliaryProliferatorInput: null,
    };
  }

  const proliferatorItemId =
    catalog.proliferatorLevels.find(level => level.level === plan.proliferatorLevel)?.itemId ?? null;

  if (!proliferatorItemId) {
    return {
      visibleInputs: plan.inputs,
      auxiliaryProliferatorInput: null,
    };
  }

  const auxiliaryProliferatorInput =
    plan.inputs.find(input => input.itemId === proliferatorItemId) ?? null;

  if (!auxiliaryProliferatorInput) {
    return {
      visibleInputs: plan.inputs,
      auxiliaryProliferatorInput: null,
    };
  }

  return {
    visibleInputs: plan.inputs.filter(input => input.itemId !== proliferatorItemId),
    auxiliaryProliferatorInput,
  };
}
