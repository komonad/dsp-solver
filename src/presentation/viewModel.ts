import type { ResolvedCatalogModel } from '../catalog';
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

export interface PresentationRequestSummary {
  objective: SolveRequest['objective'];
  balancePolicy: SolveRequest['balancePolicy'];
  targets: PresentationRequestTarget[];
  rawInputs: PresentationNamedItem[];
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

function sortNamedItems(items: PresentationNamedItem[]): PresentationNamedItem[] {
  return items.slice().sort((left, right) => left.itemName.localeCompare(right.itemName));
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

export function buildPresentationModel(
  params: BuildPresentationModelParams
): PresentationModel {
  const { catalog, request, result, datasetLabel, datasetPath, defaultConfigPath } = params;
  const requestSummary: PresentationRequestSummary | undefined = request
    ? {
        objective: request.objective,
        balancePolicy: request.balancePolicy,
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
