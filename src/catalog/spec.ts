export type ItemKind = 'raw' | 'intermediate' | 'product' | 'utility';

export type ProliferatorMode = 'none' | 'speed' | 'productivity';

export interface ItemSpec {
  itemId: string;
  name: string;
  kind: ItemKind;
  icon?: string;
  tags?: string[];
}

export interface RecipeIOItem {
  itemId: string;
  amount: number;
}

export interface RecipeSpec {
  recipeId: string;
  name: string;
  cycleTimeSec: number;
  inputs: RecipeIOItem[];
  outputs: RecipeIOItem[];
  allowedBuildingIds: string[];
  supportsProliferatorModes: ProliferatorMode[];
  maxProliferatorLevel: number;
  tags?: string[];
}

export interface BuildingSpec {
  buildingId: string;
  name: string;
  category: string;
  speedMultiplier: number;
  workPowerMW: number;
  idlePowerMW?: number;
  supportsProliferator: boolean;
  intrinsicProductivityBonus: number;
  tags?: string[];
}

export interface ProliferatorLevelSpec {
  level: number;
  speedMultiplier: number;
  productivityMultiplier: number;
  powerMultiplier: number;
}

export interface CatalogDefaults {
  rawInputItemIds?: string[];
  disabledRecipeIds?: string[];
  disabledBuildingIds?: string[];
}

export interface CatalogSpec {
  version: string;
  items: ItemSpec[];
  recipes: RecipeSpec[];
  buildings: BuildingSpec[];
  proliferatorLevels: ProliferatorLevelSpec[];
  defaults?: CatalogDefaults;
}
