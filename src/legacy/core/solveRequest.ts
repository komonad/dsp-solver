import { GameData } from '../types';
import { MultiDemandOptions, MultiDemandResult, solveMultiDemand } from './multiDemandSolver';

export interface SerializedProliferatorSetting {
  level: 0 | 1 | 2 | 3;
  mode: 'none' | 'speed' | 'productivity';
  sprayCount?: number;
}

export interface SolveRequest {
  demands: Array<{ itemId: string; rate: number }>;
  options: {
    objective?: 'min-buildings' | 'min-power' | 'min-waste';
    globalProliferator?: SerializedProliferatorSetting;
    treatAsRaw?: string[];
    existingSupplies?: Array<{ itemId: string; rate: number }>;
    selectedRecipes?: Array<[string, string]>;
    noByproducts?: boolean;
    recipeProliferators?: Array<[string, SerializedProliferatorSetting]>;
    recipeBuildings?: Array<[string, string]>;
  };
}

export function solveRequestToOptions(request: SolveRequest): MultiDemandOptions {
  return {
    objective: request.options.objective,
    globalProliferator: request.options.globalProliferator,
    treatAsRaw: request.options.treatAsRaw,
    existingSupplies: request.options.existingSupplies,
    selectedRecipes: request.options.selectedRecipes ? new Map(request.options.selectedRecipes) : undefined,
    noByproducts: request.options.noByproducts,
    recipeProliferators: request.options.recipeProliferators ? new Map(request.options.recipeProliferators) : undefined,
    recipeBuildings: request.options.recipeBuildings ? new Map(request.options.recipeBuildings) : undefined,
  };
}

export function solveFromRequest(request: SolveRequest, gameData: GameData): MultiDemandResult {
  return solveMultiDemand(request.demands, gameData, solveRequestToOptions(request));
}

