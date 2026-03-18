import type { ProliferatorMode, ResolvedCatalogModel } from '../catalog';
import type { SolveRequest, SolveResult } from '../solver';

export interface PresentationCatalogSummary {
  datasetLabel?: string;
  datasetPath?: string;
  defaultConfigPath?: string;
  itemCount: number;
  recipeCount: number;
  buildingCount: number;
  proliferatorLevelCount: number;
  rawItemCount: number;
  targetableItemCount: number;
}

export interface PresentationNamedItem {
  itemId: string;
  itemName: string;
}

export interface PresentationRequestTarget {
  itemId: string;
  itemName: string;
  ratePerMin: number;
}

export interface PresentationRecipePreference {
  recipeId: string;
  recipeName: string;
  buildingName?: string;
  proliferatorPreferenceLabel?: string;
}

export interface PresentationRequestSummary {
  objective: SolveRequest['objective'];
  balancePolicy: SolveRequest['balancePolicy'];
  proliferatorPolicyLabel: string;
  targets: PresentationRequestTarget[];
  rawInputs: PresentationNamedItem[];
  disabledRecipes: PresentationNamedItem[];
  disabledBuildings: PresentationNamedItem[];
  preferredRecipeSettings: PresentationRecipePreference[];
  hasAdvancedOverrides: boolean;
}

export interface PresentationSolvedTarget {
  itemId: string;
  itemName: string;
  requestedRatePerMin: number;
  actualRatePerMin: number;
}

export interface PresentationItemRate {
  itemId: string;
  itemName: string;
  ratePerMin: number;
}

export interface PresentationRecipePlan {
  recipeId: string;
  recipeName: string;
  buildingId: string;
  buildingName: string;
  proliferatorLevel: number;
  proliferatorMode: SolveResult['recipePlans'][number]['proliferatorMode'];
  proliferatorLabel: string;
  runsPerMin: number;
  exactBuildingCount: number;
  roundedUpBuildingCount: number;
  activePowerMW: number;
  roundedPlacementPowerMW: number;
  inputs: PresentationItemRate[];
  outputs: PresentationItemRate[];
}

export interface PresentationBuildingSummary {
  buildingId: string;
  buildingName: string;
  category: string;
  exactCount: number;
  roundedUpCount: number;
  activePowerMW: number;
  roundedPlacementPowerMW: number;
}

export interface PresentationItemBalance {
  itemId: string;
  itemName: string;
  producedRatePerMin: number;
  consumedRatePerMin: number;
  netRatePerMin: number;
}

export interface PresentationModel {
  catalogSummary: PresentationCatalogSummary;
  requestSummary?: PresentationRequestSummary;
  status: SolveResult['status'] | null;
  diagnostics: SolveResult['diagnostics'] | null;
  targets: PresentationSolvedTarget[];
  recipePlans: PresentationRecipePlan[];
  buildingSummary: PresentationBuildingSummary[];
  powerSummary: SolveResult['powerSummary'] | null;
  externalInputs: PresentationItemRate[];
  surplusOutputs: PresentationItemRate[];
  itemBalance: PresentationItemBalance[];
}

export interface BuildPresentationModelParams {
  catalog: ResolvedCatalogModel;
  request?: SolveRequest;
  result?: SolveResult | null;
  datasetLabel?: string;
  datasetPath?: string;
  defaultConfigPath?: string;
}

function getItemName(catalog: ResolvedCatalogModel, itemId: string): string {
  return catalog.itemMap.get(itemId)?.name ?? itemId;
}

function getRecipeName(catalog: ResolvedCatalogModel, recipeId: string): string {
  return catalog.recipeMap.get(recipeId)?.name ?? recipeId;
}

function getBuildingName(catalog: ResolvedCatalogModel, buildingId: string): string {
  return catalog.buildingMap.get(buildingId)?.name ?? buildingId;
}

function sortByName<T extends { itemName: string }>(items: T[]): T[] {
  return items.slice().sort((left, right) => left.itemName.localeCompare(right.itemName));
}

function sortNamedItems(items: PresentationNamedItem[]): PresentationNamedItem[] {
  return sortByName(items);
}

function mapItemRates(
  catalog: ResolvedCatalogModel,
  itemRates: SolveResult['externalInputs']
): PresentationItemRate[] {
  return itemRates.map(itemRate => ({
    itemId: itemRate.itemId,
    itemName: getItemName(catalog, itemRate.itemId),
    ratePerMin: itemRate.ratePerMin,
  }));
}

function formatProliferatorLabel(
  proliferatorMode: SolveResult['recipePlans'][number]['proliferatorMode'],
  proliferatorLevel: number
): string {
  if (proliferatorMode === 'none' || proliferatorLevel === 0) {
    return 'None';
  }

  if (proliferatorMode === 'speed') {
    return `Speed Lv.${proliferatorLevel}`;
  }

  return `Productivity Lv.${proliferatorLevel}`;
}

function formatPreferredProliferatorLabel(
  proliferatorMode?: ProliferatorMode,
  proliferatorLevel?: number
): string | undefined {
  if (proliferatorMode === undefined && proliferatorLevel === undefined) {
    return undefined;
  }

  if (proliferatorMode === 'none') {
    return 'None';
  }

  if (proliferatorMode === 'speed') {
    return proliferatorLevel !== undefined
      ? `Speed Lv.${proliferatorLevel}`
      : 'Speed (Auto Level)';
  }

  if (proliferatorMode === 'productivity') {
    return proliferatorLevel !== undefined
      ? `Productivity Lv.${proliferatorLevel}`
      : 'Productivity (Auto Level)';
  }

  if (proliferatorLevel !== undefined) {
    return `Auto Mode Lv.${proliferatorLevel}`;
  }

  return undefined;
}

function inferGlobalProliferatorPolicyLabel(
  catalog: ResolvedCatalogModel,
  request: SolveRequest
): string {
  const affectedRecipeIds = catalog.recipes
    .filter(
      recipe =>
        recipe.maxProliferatorLevel > 0 ||
        recipe.supportsProliferatorModes.some(mode => mode !== 'none')
    )
    .map(recipe => recipe.recipeId);

  if (affectedRecipeIds.length === 0) {
    return 'Auto';
  }

  const forcedModes = request.forcedProliferatorModeByRecipe ?? {};
  const forcedLevels = request.forcedProliferatorLevelByRecipe ?? {};
  const allDisabled = affectedRecipeIds.every(
    recipeId =>
      forcedModes[recipeId] === 'none' &&
      (forcedLevels[recipeId] === undefined || forcedLevels[recipeId] === 0)
  );

  return allDisabled ? 'Disabled' : 'Auto';
}

export function buildPresentationModel(
  params: BuildPresentationModelParams
): PresentationModel {
  const { catalog, request, result, datasetLabel, datasetPath, defaultConfigPath } = params;
  const requestSummary: PresentationRequestSummary | undefined = request
    ? {
        objective: request.objective,
        balancePolicy: request.balancePolicy,
        proliferatorPolicyLabel: inferGlobalProliferatorPolicyLabel(catalog, request),
        targets: request.targets.map(target => ({
          itemId: target.itemId,
          itemName: getItemName(catalog, target.itemId),
          ratePerMin: target.ratePerMin,
        })),
        rawInputs: sortNamedItems(
          (request.rawInputItemIds ?? []).map(itemId => ({
            itemId,
            itemName: getItemName(catalog, itemId),
          }))
        ),
        disabledRecipes: sortByName(
          (request.disabledRecipeIds ?? []).map(recipeId => ({
            itemId: recipeId,
            itemName: getRecipeName(catalog, recipeId),
          }))
        ),
        disabledBuildings: sortByName(
          (request.disabledBuildingIds ?? []).map(buildingId => ({
            itemId: buildingId,
            itemName: getBuildingName(catalog, buildingId),
          }))
        ),
        preferredRecipeSettings: Array.from(
          new Set([
            ...Object.keys(request.preferredBuildingByRecipe ?? {}),
            ...Object.keys(request.preferredProliferatorModeByRecipe ?? {}),
            ...Object.keys(request.preferredProliferatorLevelByRecipe ?? {}),
          ])
        )
          .map(recipeId => ({
            recipeId,
            recipeName: getRecipeName(catalog, recipeId),
            buildingName: request.preferredBuildingByRecipe?.[recipeId]
              ? getBuildingName(catalog, request.preferredBuildingByRecipe[recipeId])
              : undefined,
            proliferatorPreferenceLabel: formatPreferredProliferatorLabel(
              request.preferredProliferatorModeByRecipe?.[recipeId],
              request.preferredProliferatorLevelByRecipe?.[recipeId]
            ),
          }))
          .sort((left, right) => left.recipeName.localeCompare(right.recipeName)),
        hasAdvancedOverrides:
          Object.keys(request.forcedRecipeByItem ?? {}).length > 0 ||
          Object.keys(request.preferredRecipeByItem ?? {}).length > 0 ||
          Object.keys(request.forcedBuildingByRecipe ?? {}).length > 0 ||
          Object.keys(request.preferredBuildingByRecipe ?? {}).length > 0 ||
          Object.keys(request.forcedProliferatorLevelByRecipe ?? {}).length > 0 ||
          Object.keys(request.preferredProliferatorLevelByRecipe ?? {}).length > 0 ||
          Object.keys(request.forcedProliferatorModeByRecipe ?? {}).length > 0 ||
          Object.keys(request.preferredProliferatorModeByRecipe ?? {}).length > 0,
      }
    : undefined;

  if (!result) {
    return {
      catalogSummary: {
        datasetLabel,
        datasetPath,
        defaultConfigPath,
        itemCount: catalog.items.length,
        recipeCount: catalog.recipes.length,
        buildingCount: catalog.buildings.length,
        proliferatorLevelCount: catalog.proliferatorLevels.length,
        rawItemCount: catalog.rawItemIds.length,
        targetableItemCount: catalog.items.filter(item => item.kind !== 'utility').length,
      },
      requestSummary,
      status: null,
      diagnostics: null,
      targets: [],
      recipePlans: [],
      buildingSummary: [],
      powerSummary: null,
      externalInputs: [],
      surplusOutputs: [],
      itemBalance: [],
    };
  }

  return {
    catalogSummary: {
      datasetLabel,
      datasetPath,
      defaultConfigPath,
      itemCount: catalog.items.length,
      recipeCount: catalog.recipes.length,
      buildingCount: catalog.buildings.length,
      proliferatorLevelCount: catalog.proliferatorLevels.length,
      rawItemCount: catalog.rawItemIds.length,
      targetableItemCount: catalog.items.filter(item => item.kind !== 'utility').length,
    },
    requestSummary,
    status: result.status,
    diagnostics: result.diagnostics,
    targets: result.targets.map(target => ({
      itemId: target.itemId,
      itemName: getItemName(catalog, target.itemId),
      requestedRatePerMin: target.requestedRatePerMin,
      actualRatePerMin: target.actualRatePerMin,
    })),
    recipePlans: result.recipePlans.map(plan => ({
      recipeId: plan.recipeId,
      recipeName: getRecipeName(catalog, plan.recipeId),
      buildingId: plan.buildingId,
      buildingName: getBuildingName(catalog, plan.buildingId),
      proliferatorLevel: plan.proliferatorLevel,
      proliferatorMode: plan.proliferatorMode,
      proliferatorLabel: formatProliferatorLabel(plan.proliferatorMode, plan.proliferatorLevel),
      runsPerMin: plan.runsPerMin,
      exactBuildingCount: plan.exactBuildingCount,
      roundedUpBuildingCount: plan.roundedUpBuildingCount,
      activePowerMW: plan.activePowerMW,
      roundedPlacementPowerMW: plan.roundedPlacementPowerMW,
      inputs: mapItemRates(catalog, plan.inputs),
      outputs: mapItemRates(catalog, plan.outputs),
    })),
    buildingSummary: result.buildingSummary.map(summary => ({
      buildingId: summary.buildingId,
      buildingName: getBuildingName(catalog, summary.buildingId),
      category: catalog.buildingMap.get(summary.buildingId)?.category ?? 'factory',
      exactCount: summary.exactCount,
      roundedUpCount: summary.roundedUpCount,
      activePowerMW: summary.activePowerMW,
      roundedPlacementPowerMW: summary.roundedPlacementPowerMW,
    })),
    powerSummary: result.powerSummary,
    externalInputs: mapItemRates(catalog, result.externalInputs),
    surplusOutputs: mapItemRates(catalog, result.surplusOutputs),
    itemBalance: result.itemBalance.map(entry => ({
      itemId: entry.itemId,
      itemName: getItemName(catalog, entry.itemId),
      producedRatePerMin: entry.producedRatePerMin,
      consumedRatePerMin: entry.consumedRatePerMin,
      netRatePerMin: entry.netRatePerMin,
    })),
  };
}
