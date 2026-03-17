import type { ProliferatorMode } from '../catalog';

export type SolveStatus = 'optimal' | 'infeasible' | 'invalid_input';

export interface SolveDiagnostics {
  messages: string[];
  unmetPreferences: string[];
}

export interface SolvedTarget {
  itemId: string;
  requestedRatePerMin: number;
  actualRatePerMin: number;
}

export interface ItemRate {
  itemId: string;
  ratePerMin: number;
}

export interface RecipePlan {
  recipeId: string;
  buildingId: string;
  proliferatorLevel: number;
  proliferatorMode: ProliferatorMode;
  runsPerMin: number;
  exactBuildingCount: number;
  roundedUpBuildingCount: number;
  activePowerMW: number;
  roundedPlacementPowerMW: number;
  inputs: ItemRate[];
  outputs: ItemRate[];
}

export interface BuildingSummary {
  buildingId: string;
  exactCount: number;
  roundedUpCount: number;
  activePowerMW: number;
  roundedPlacementPowerMW: number;
}

export interface PowerSummary {
  activePowerMW: number;
  roundedPlacementPowerMW: number;
}

export interface ItemBalanceEntry {
  itemId: string;
  producedRatePerMin: number;
  consumedRatePerMin: number;
  netRatePerMin: number;
}

export interface SolveResult {
  status: SolveStatus;
  diagnostics: SolveDiagnostics;
  targets: SolvedTarget[];
  recipePlans: RecipePlan[];
  buildingSummary: BuildingSummary[];
  powerSummary: PowerSummary;
  externalInputs: ItemRate[];
  surplusOutputs: ItemRate[];
  itemBalance: ItemBalanceEntry[];
}

export interface CompiledOption {
  optionId: string;
  recipeId: string;
  buildingId: string;
  proliferatorLevel: number;
  proliferatorMode: ProliferatorMode;
  singleBuildingRunsPerMin: number;
  buildingCostPerRunPerMin: number;
  powerCostMWPerRunPerMin: number;
  inputPerRun: Record<string, number>;
  outputPerRun: Record<string, number>;
}
