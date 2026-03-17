import type { ProliferatorMode } from '../catalog';

export type SolveObjective = 'min_buildings' | 'min_power' | 'min_external_input';

export type BalancePolicy = 'allow_surplus' | 'force_balance';

export interface SolveTarget {
  itemId: string;
  ratePerMin: number;
}

export interface SolveRequest {
  targets: SolveTarget[];
  objective: SolveObjective;
  balancePolicy: BalancePolicy;
  rawInputItemIds?: string[];
  disabledRecipeIds?: string[];
  disabledBuildingIds?: string[];
  forcedRecipeByItem?: Record<string, string>;
  preferredRecipeByItem?: Record<string, string>;
  forcedBuildingByRecipe?: Record<string, string>;
  preferredBuildingByRecipe?: Record<string, string>;
  forcedProliferatorLevelByRecipe?: Record<string, number>;
  preferredProliferatorLevelByRecipe?: Record<string, number>;
  forcedProliferatorModeByRecipe?: Record<string, ProliferatorMode>;
  preferredProliferatorModeByRecipe?: Record<string, ProliferatorMode>;
}
