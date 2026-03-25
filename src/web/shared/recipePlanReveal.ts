import type {
  PresentationItemSlicePlan,
  PresentationRecipePlan,
} from '../../presentation';

type RecipePlanRevealReference = Pick<
  PresentationRecipePlan | PresentationItemSlicePlan,
  'recipeId' | 'buildingId' | 'proliferatorLabel'
>;

export function buildRecipePlanRevealKey(
  plan: RecipePlanRevealReference
): string {
  return `${plan.recipeId}:${plan.buildingId}:${plan.proliferatorLabel}`;
}
