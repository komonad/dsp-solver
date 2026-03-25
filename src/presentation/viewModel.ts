import type { ProliferatorMode, ResolvedCatalogModel } from '../catalog';
import {
  DEFAULT_APP_LOCALE,
  formatPreferredProliferatorLabel,
  formatProliferatorLabel,
  formatWorkbenchProliferatorPolicy,
  getLocaleBundle,
  type AppLocale,
} from '../i18n';
import type { SolveRequest, SolveResult } from '../solver';

const EPSILON = 1e-3;

export interface PresentationCatalogSummary {
  datasetLabel?: string;
  datasetPath?: string;
  defaultConfigPath?: string;
  iconAtlasIds: string[];
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
  iconKey?: string;
}

export interface PresentationRequestTarget {
  itemId: string;
  itemName: string;
  iconKey?: string;
  ratePerMin: number;
}

export interface PresentationRecipePreference {
  recipeId: string;
  recipeName: string;
  recipeIconKey?: string;
  buildingName?: string;
  buildingIconKey?: string;
  proliferatorPreferenceLabel?: string;
}

export interface PresentationAllowedRecipeSetting {
  itemId: string;
  itemName: string;
  iconKey?: string;
  recipeId: string;
  recipeName: string;
  recipeIconKey?: string;
  cycleTimeSec: number;
  inputs: PresentationItemRate[];
  outputs: PresentationItemRate[];
}

export interface PresentationDisabledRecipeSetting {
  recipeId: string;
  recipeName: string;
  recipeIconKey?: string;
  cycleTimeSec: number;
  inputs: PresentationItemRate[];
  outputs: PresentationItemRate[];
}

export interface PresentationRequestSummary {
  solverVersion?: string;
  objective: SolveRequest['objective'];
  balancePolicy: SolveRequest['balancePolicy'];
  proliferatorPolicyLabel: string;
  targets: PresentationRequestTarget[];
  rawInputs: PresentationNamedItem[];
  allowedRecipeSettings: PresentationAllowedRecipeSetting[];
  disabledRecipeSettings: PresentationDisabledRecipeSetting[];
  disabledRecipes: PresentationNamedItem[];
  disabledBuildings: PresentationNamedItem[];
  preferredRecipeSettings: PresentationRecipePreference[];
  hasAdvancedOverrides: boolean;
}

export interface PresentationSolvedTarget {
  itemId: string;
  itemName: string;
  iconKey?: string;
  requestedRatePerMin: number;
  actualRatePerMin: number;
}

export interface PresentationItemRate {
  itemId: string;
  itemName: string;
  iconKey?: string;
  ratePerMin: number;
}

export interface PresentationRecipePlan {
  recipeId: string;
  recipeName: string;
  recipeIconKey?: string;
  buildingId: string;
  buildingName: string;
  buildingIconKey?: string;
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
  buildingIconKey?: string;
  category: string;
  exactCount: number;
  roundedUpCount: number;
  activePowerMW: number;
  roundedPlacementPowerMW: number;
}

export interface PresentationItemBalance {
  itemId: string;
  itemName: string;
  iconKey?: string;
  producedRatePerMin: number;
  consumedRatePerMin: number;
  netRatePerMin: number;
}

export type PresentationItemLedgerSectionKey =
  | 'net_inputs'
  | 'net_outputs'
  | 'intermediates';

export interface PresentationItemLedgerEntry {
  itemId: string;
  itemName: string;
  iconKey?: string;
  /** Internal production from selected recipe plans only. */
  producedRatePerMin: number;
  /** Internal consumption from selected recipe plans only. */
  consumedRatePerMin: number;
  /** Internal net flow: produced - consumed. */
  netRatePerMin: number;
  throughputRatePerMin: number;
  isRawInput: boolean;
  isTarget: boolean;
  isSurplusOutput: boolean;
  externalInputRatePerMin: number;
  targetRatePerMin: number;
  surplusRatePerMin: number;
}

export interface PresentationItemLedgerSection {
  key: PresentationItemLedgerSectionKey;
  title: string;
  items: PresentationItemLedgerEntry[];
}

export interface PresentationItemSlicePlan {
  recipeId: string;
  recipeName: string;
  recipeIconKey?: string;
  buildingId: string;
  buildingName: string;
  buildingIconKey?: string;
  proliferatorLabel: string;
  itemRatePerMin: number;
  runsPerMin: number;
  exactBuildingCount: number;
  roundedUpBuildingCount: number;
  roundedPlacementPowerMW: number;
  inputs: PresentationItemRate[];
  outputs: PresentationItemRate[];
}

export interface PresentationItemSlice {
  itemId: string;
  itemName: string;
  iconKey?: string;
  /** Internal production from selected recipe plans only. */
  producedRatePerMin: number;
  /** Internal consumption from selected recipe plans only. */
  consumedRatePerMin: number;
  /** Internal net flow: produced - consumed. */
  netRatePerMin: number;
  externalInputRatePerMin: number;
  targetRatePerMin: number;
  surplusRatePerMin: number;
  isRawInput: boolean;
  isTarget: boolean;
  isSurplusOutput: boolean;
  producerPlans: PresentationItemSlicePlan[];
  consumerPlans: PresentationItemSlicePlan[];
}

export interface PresentationSolveSummary {
  netInputs: PresentationItemRate[];
  netOutputs: PresentationItemRate[];
  buildingTypeCount: number;
  roundedBuildingCount: number;
  recipeTypeCount: number;
  roundedPlacementPowerMW: number;
}

/**
 * Frontend-facing grouping for the top-level solved summary cards.
 *
 * Keeping this structure in the presentation layer prevents React components
 * from inventing their own grouping semantics for the same solver result.
 */
export interface PresentationOverviewSections {
  /** Targets plus the final external-input list shown beside them. */
  targetsAndExternalInputs: {
    title: string;
    targets: PresentationSolvedTarget[];
    externalInputs: PresentationItemRate[];
  };
  /** Building totals and power totals, without any unrelated result groups. */
  buildingsAndPower: {
    title: string;
    buildingSummary: PresentationBuildingSummary[];
    activePowerMW: number;
    roundedPlacementPowerMW: number;
  };
  /** Explicit surplus outputs shown as their own card. */
  surplusOutputs: {
    title: string;
    items: PresentationItemRate[];
  };
}

export interface PresentationModel {
  catalogSummary: PresentationCatalogSummary;
  requestSummary?: PresentationRequestSummary;
  status: SolveResult['status'] | null;
  diagnostics: SolveResult['diagnostics'] | null;
  solvedSummary: PresentationSolveSummary | null;
  targets: PresentationSolvedTarget[];
  recipePlans: PresentationRecipePlan[];
  buildingSummary: PresentationBuildingSummary[];
  powerSummary: SolveResult['powerSummary'] | null;
  externalInputs: PresentationItemRate[];
  surplusOutputs: PresentationItemRate[];
  itemBalance: PresentationItemBalance[];
  itemLedgerSections: PresentationItemLedgerSection[];
  itemSlicesById: Record<string, PresentationItemSlice>;
}

export interface BuildPresentationModelParams {
  catalog: ResolvedCatalogModel;
  request?: SolveRequest;
  result?: SolveResult | null;
  datasetLabel?: string;
  datasetPath?: string;
  defaultConfigPath?: string;
  locale?: AppLocale;
}

function getItemName(catalog: ResolvedCatalogModel, itemId: string): string {
  return catalog.itemMap.get(itemId)?.name ?? itemId;
}

function getItemIcon(catalog: ResolvedCatalogModel, itemId: string): string | undefined {
  return catalog.itemMap.get(itemId)?.icon;
}

function getRecipeName(catalog: ResolvedCatalogModel, recipeId: string): string {
  return catalog.recipeMap.get(recipeId)?.name ?? recipeId;
}

function getRecipeIcon(catalog: ResolvedCatalogModel, recipeId: string): string | undefined {
  const recipe = catalog.recipeMap.get(recipeId);
  if (!recipe) {
    return undefined;
  }
  if (recipe.icon) {
    return recipe.icon;
  }
  const firstOutputItemId = recipe.outputs[0]?.itemId;
  if (!firstOutputItemId) {
    return undefined;
  }
  return getItemIcon(catalog, firstOutputItemId);
}

function getBuildingName(catalog: ResolvedCatalogModel, buildingId: string): string {
  return catalog.buildingMap.get(buildingId)?.name ?? buildingId;
}

function getBuildingIcon(catalog: ResolvedCatalogModel, buildingId: string): string | undefined {
  return catalog.buildingMap.get(buildingId)?.icon;
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
    iconKey: getItemIcon(catalog, itemRate.itemId),
    ratePerMin: itemRate.ratePerMin,
  }));
}

function mapRecipeIoAmounts(
  catalog: ResolvedCatalogModel,
  itemRates: Array<{ itemId: string; amount: number }>
): PresentationItemRate[] {
  return itemRates.map(itemRate => ({
    itemId: itemRate.itemId,
    itemName: getItemName(catalog, itemRate.itemId),
    iconKey: getItemIcon(catalog, itemRate.itemId),
    ratePerMin: itemRate.amount,
  }));
}

function getPlanItemRate(
  items: PresentationItemRate[],
  itemId: string
): number {
  return items.find(item => item.itemId === itemId)?.ratePerMin ?? 0;
}

const RECIPE_PLAN_WEIGHT_DECAY = 0.72;
const MIN_PROPAGATED_INPUT_SHARE = 0.2;

function sortPresentationRecipePlans(
  result: SolveResult,
  plans: PresentationRecipePlan[]
): PresentationRecipePlan[] {
  if (plans.length <= 1) {
    return plans;
  }

  const planIndexesByOutputItemId = new Map<string, number[]>();

  plans.forEach((plan, index) => {
    plan.outputs.forEach(output => {
      const indexes = planIndexesByOutputItemId.get(output.itemId);
      if (indexes) {
        indexes.push(index);
      } else {
        planIndexesByOutputItemId.set(output.itemId, [index]);
      }
    });
  });

  for (const [itemId, indexes] of planIndexesByOutputItemId.entries()) {
    indexes.sort((leftIndex, rightIndex) => {
      const leftPlan = plans[leftIndex];
      const rightPlan = plans[rightIndex];
      const outputRateDelta =
        getPlanItemRate(rightPlan.outputs, itemId) -
        getPlanItemRate(leftPlan.outputs, itemId);

      if (Math.abs(outputRateDelta) > EPSILON) {
        return outputRateDelta;
      }

      const throughputDelta =
        Math.max(
          rightPlan.runsPerMin,
          rightPlan.exactBuildingCount,
          rightPlan.roundedUpBuildingCount
        ) -
        Math.max(
          leftPlan.runsPerMin,
          leftPlan.exactBuildingCount,
          leftPlan.roundedUpBuildingCount
        );
      if (Math.abs(throughputDelta) > EPSILON) {
        return throughputDelta;
      }

      const recipeNameDelta = leftPlan.recipeName.localeCompare(rightPlan.recipeName);
      if (recipeNameDelta !== 0) {
        return recipeNameDelta;
      }

      return leftPlan.buildingName.localeCompare(rightPlan.buildingName);
    });
  }

  const bestItemDepthById = new Map<string, number>();
  const planDepthByIndex = new Map<number, number>();
  const planWeightByIndex = new Map<number, number>();
  const planVisitOrderByIndex = new Map<number, number>();
  let frontierWeights = new Map<string, number>();
  let frontierOrderByItemId = new Map<string, number>();
  let nextFrontierItemOrder = 0;
  let nextVisitOrder = 0;

  result.targets.forEach(target => {
    const seedWeight = Math.max(target.actualRatePerMin, target.requestedRatePerMin, 0);
    if (seedWeight <= EPSILON) {
      return;
    }

    frontierWeights.set(target.itemId, (frontierWeights.get(target.itemId) ?? 0) + seedWeight);
    if (!frontierOrderByItemId.has(target.itemId)) {
      frontierOrderByItemId.set(target.itemId, nextFrontierItemOrder);
      nextFrontierItemOrder += 1;
    }
    bestItemDepthById.set(target.itemId, 0);
  });

  for (
    let depth = 0;
    frontierWeights.size > 0;
    depth += 1
  ) {
    const orderedFrontierEntries = Array.from(frontierWeights.entries()).sort(
      ([leftItemId, leftWeight], [rightItemId, rightWeight]) => {
        const weightDelta = rightWeight - leftWeight;
        if (Math.abs(weightDelta) > EPSILON) {
          return weightDelta;
        }

        return (
          (frontierOrderByItemId.get(leftItemId) ?? Number.MAX_SAFE_INTEGER) -
          (frontierOrderByItemId.get(rightItemId) ?? Number.MAX_SAFE_INTEGER)
        );
      }
    );
    const nextFrontierWeights = new Map<string, number>();
    const nextFrontierOrderByItemId = new Map<string, number>();

    orderedFrontierEntries.forEach(([itemId, itemWeight]) => {
      const knownDepth = bestItemDepthById.get(itemId);
      if (knownDepth === undefined || depth > knownDepth) {
        return;
      }

      const producerIndexes = planIndexesByOutputItemId.get(itemId) ?? [];
      producerIndexes.forEach(planIndex => {
        const existingPlanDepth = planDepthByIndex.get(planIndex);
        if (existingPlanDepth === undefined || depth < existingPlanDepth) {
          planDepthByIndex.set(planIndex, depth);
        }

        if (!planVisitOrderByIndex.has(planIndex)) {
          planVisitOrderByIndex.set(planIndex, nextVisitOrder);
          nextVisitOrder += 1;
        }

        planWeightByIndex.set(
          planIndex,
          (planWeightByIndex.get(planIndex) ?? 0) + itemWeight
        );

        const plan = plans[planIndex];
        const dominantInputRate = plan.inputs.reduce(
          (maxRate, input) => Math.max(maxRate, input.ratePerMin),
          0
        );

        plan.inputs.forEach(input => {
          const inputShare =
            dominantInputRate > EPSILON ? input.ratePerMin / dominantInputRate : 1;
          const propagatedWeight =
            itemWeight *
            RECIPE_PLAN_WEIGHT_DECAY *
            Math.max(inputShare, MIN_PROPAGATED_INPUT_SHARE);
          if (propagatedWeight <= EPSILON) {
            return;
          }

          const nextDepth = depth + 1;
          const knownInputDepth = bestItemDepthById.get(input.itemId);
          if (knownInputDepth !== undefined && knownInputDepth < nextDepth) {
            return;
          }

          if (knownInputDepth === undefined || nextDepth < knownInputDepth) {
            bestItemDepthById.set(input.itemId, nextDepth);
          }

          nextFrontierWeights.set(
            input.itemId,
            (nextFrontierWeights.get(input.itemId) ?? 0) + propagatedWeight
          );
          if (!nextFrontierOrderByItemId.has(input.itemId)) {
            nextFrontierOrderByItemId.set(input.itemId, nextFrontierItemOrder);
            nextFrontierItemOrder += 1;
          }
        });
      });
    });

    frontierWeights = nextFrontierWeights;
    frontierOrderByItemId = nextFrontierOrderByItemId;
  }

  return plans
    .map((plan, index) => ({
      plan,
      originalIndex: index,
      depth: planDepthByIndex.get(index) ?? Number.MAX_SAFE_INTEGER,
      visitOrder: planVisitOrderByIndex.get(index) ?? Number.MAX_SAFE_INTEGER,
      propagatedWeight: planWeightByIndex.get(index) ?? 0,
      throughputRate: Math.max(
        plan.runsPerMin,
        ...plan.inputs.map(input => input.ratePerMin),
        ...plan.outputs.map(output => output.ratePerMin)
      ),
    }))
    .sort((left, right) => {
      const depthDelta = left.depth - right.depth;
      if (depthDelta !== 0) {
        return depthDelta;
      }

      const weightDelta = right.propagatedWeight - left.propagatedWeight;
      if (Math.abs(weightDelta) > EPSILON) {
        return weightDelta;
      }

      const visitOrderDelta = left.visitOrder - right.visitOrder;
      if (visitOrderDelta !== 0) {
        return visitOrderDelta;
      }

      const throughputDelta = right.throughputRate - left.throughputRate;
      if (Math.abs(throughputDelta) > EPSILON) {
        return throughputDelta;
      }

      const recipeNameDelta = left.plan.recipeName.localeCompare(right.plan.recipeName);
      if (recipeNameDelta !== 0) {
        return recipeNameDelta;
      }

      const buildingNameDelta = left.plan.buildingName.localeCompare(right.plan.buildingName);
      if (buildingNameDelta !== 0) {
        return buildingNameDelta;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(entry => entry.plan);
}

function buildEffectiveRawInputSet(
  catalog: ResolvedCatalogModel,
  request: SolveRequest | undefined,
  result: SolveResult | undefined
): Set<string> {
  if (result) {
    return new Set(result.resolvedRawInputItemIds);
  }

  const rawInputIds = new Set<string>(catalog.rawItemIds);

  for (const itemId of request?.disabledRawInputItemIds ?? []) {
    rawInputIds.delete(itemId);
  }

  for (const itemId of request?.rawInputItemIds ?? []) {
    rawInputIds.add(itemId);
  }

  return rawInputIds;
}

function sortItemLedgerEntries(
  items: PresentationItemLedgerEntry[],
  sectionKey: PresentationItemLedgerSectionKey
): PresentationItemLedgerEntry[] {
  return items.slice().sort((left, right) => {
    const sectionRate =
      sectionKey === 'net_inputs'
        ? right.externalInputRatePerMin - left.externalInputRatePerMin
        : sectionKey === 'net_outputs'
          ? Math.max(
              right.targetRatePerMin,
              right.surplusRatePerMin,
              Math.abs(right.netRatePerMin)
            ) -
            Math.max(
              left.targetRatePerMin,
              left.surplusRatePerMin,
              Math.abs(left.netRatePerMin)
            )
          : right.throughputRatePerMin - left.throughputRatePerMin;

    if (Math.abs(sectionRate) > EPSILON) {
      return sectionRate;
    }

    const throughputRate = right.throughputRatePerMin - left.throughputRatePerMin;
    if (Math.abs(throughputRate) > EPSILON) {
      return throughputRate;
    }

    return left.itemName.localeCompare(right.itemName);
  });
}

function buildPresentationItemLedgerSections(
  catalog: ResolvedCatalogModel,
  request: SolveRequest | undefined,
  result: SolveResult,
  locale: AppLocale
): PresentationItemLedgerSection[] {
  const bundle = getLocaleBundle(locale);
  const effectiveRawInputIds = buildEffectiveRawInputSet(catalog, request, result);
  const internalProducedRateByItem = new Map<string, number>();
  const internalConsumedRateByItem = new Map<string, number>();
  const targetRateByItem = new Map(
    result.targets.map(target => [target.itemId, target.requestedRatePerMin])
  );
  const externalInputRateByItem = new Map(
    result.externalInputs.map(entry => [entry.itemId, entry.ratePerMin])
  );
  const surplusRateByItem = new Map(
    result.surplusOutputs.map(entry => [entry.itemId, entry.ratePerMin])
  );
  const involvedItemIds = new Set<string>();

  result.recipePlans.forEach(plan => {
    plan.inputs.forEach(input => {
      involvedItemIds.add(input.itemId);
      internalConsumedRateByItem.set(
        input.itemId,
        (internalConsumedRateByItem.get(input.itemId) ?? 0) + input.ratePerMin
      );
    });
    plan.outputs.forEach(output => {
      involvedItemIds.add(output.itemId);
      internalProducedRateByItem.set(
        output.itemId,
        (internalProducedRateByItem.get(output.itemId) ?? 0) + output.ratePerMin
      );
    });
  });

  result.itemBalance.forEach(entry => involvedItemIds.add(entry.itemId));
  result.targets.forEach(entry => involvedItemIds.add(entry.itemId));
  result.externalInputs.forEach(entry => involvedItemIds.add(entry.itemId));
  result.surplusOutputs.forEach(entry => involvedItemIds.add(entry.itemId));

  const allEntries = Array.from(involvedItemIds)
    .sort((left, right) => left.localeCompare(right))
    .map(itemId => {
      const producedRatePerMin = internalProducedRateByItem.get(itemId) ?? 0;
      const consumedRatePerMin = internalConsumedRateByItem.get(itemId) ?? 0;
      const externalInputRatePerMin = externalInputRateByItem.get(itemId) ?? 0;
      const targetRatePerMin = targetRateByItem.get(itemId) ?? 0;
      const surplusRatePerMin = surplusRateByItem.get(itemId) ?? 0;
      const netRatePerMin = producedRatePerMin - consumedRatePerMin;

      return {
        itemId,
        itemName: getItemName(catalog, itemId),
        iconKey: getItemIcon(catalog, itemId),
        producedRatePerMin,
        consumedRatePerMin,
        netRatePerMin,
        throughputRatePerMin: Math.max(producedRatePerMin, consumedRatePerMin),
        isRawInput: effectiveRawInputIds.has(itemId),
        isTarget: targetRatePerMin > EPSILON,
        isSurplusOutput: surplusRatePerMin > EPSILON,
        externalInputRatePerMin,
        targetRatePerMin,
        surplusRatePerMin,
      };
    });

  const netOutputs = allEntries.filter(entry => entry.isTarget || entry.isSurplusOutput);
  const netInputs = allEntries.filter(
    entry =>
      !entry.isTarget &&
      !entry.isSurplusOutput &&
      entry.externalInputRatePerMin > EPSILON
  );
  const intermediates = allEntries.filter(
    entry =>
      !entry.isTarget &&
      !entry.isSurplusOutput &&
      entry.externalInputRatePerMin <= EPSILON
  );

  return [
    {
      key: 'net_inputs',
      title: bundle.itemLedger.netInputsTitle,
      items: sortItemLedgerEntries(netInputs, 'net_inputs'),
    },
    {
      key: 'net_outputs',
      title: bundle.itemLedger.netOutputsTitle,
      items: sortItemLedgerEntries(netOutputs, 'net_outputs'),
    },
    {
      key: 'intermediates',
      title: bundle.itemLedger.intermediatesTitle,
      items: sortItemLedgerEntries(intermediates, 'intermediates'),
    },
  ];
}

function sortItemSlicePlans(
  plans: PresentationItemSlicePlan[]
): PresentationItemSlicePlan[] {
  return plans.slice().sort((left, right) => {
    const rateDelta = right.itemRatePerMin - left.itemRatePerMin;
    if (Math.abs(rateDelta) > EPSILON) {
      return rateDelta;
    }

    const buildingDelta = right.roundedUpBuildingCount - left.roundedUpBuildingCount;
    if (buildingDelta !== 0) {
      return buildingDelta;
    }

    const recipeNameDelta = left.recipeName.localeCompare(right.recipeName);
    if (recipeNameDelta !== 0) {
      return recipeNameDelta;
    }

    return left.buildingName.localeCompare(right.buildingName);
  });
}

function buildPresentationItemSlices(
  recipePlans: PresentationRecipePlan[],
  itemLedgerSections: PresentationItemLedgerSection[]
): Record<string, PresentationItemSlice> {
  const ledgerByItemId = new Map<string, PresentationItemLedgerEntry>();
  itemLedgerSections.forEach(section => {
    section.items.forEach(entry => {
      ledgerByItemId.set(entry.itemId, entry);
    });
  });

  return Object.fromEntries(
    Array.from(ledgerByItemId.values()).map(entry => {
      const producerPlans = sortItemSlicePlans(
        recipePlans
          .filter(plan => plan.outputs.some(output => output.itemId === entry.itemId))
          .map(plan => ({
            recipeId: plan.recipeId,
            recipeName: plan.recipeName,
            recipeIconKey: plan.recipeIconKey,
            buildingId: plan.buildingId,
            buildingName: plan.buildingName,
            buildingIconKey: plan.buildingIconKey,
            proliferatorLabel: plan.proliferatorLabel,
            itemRatePerMin:
              plan.outputs.find(output => output.itemId === entry.itemId)?.ratePerMin ?? 0,
            runsPerMin: plan.runsPerMin,
            exactBuildingCount: plan.exactBuildingCount,
            roundedUpBuildingCount: plan.roundedUpBuildingCount,
            roundedPlacementPowerMW: plan.roundedPlacementPowerMW,
            inputs: plan.inputs,
            outputs: plan.outputs,
          }))
      );
      const consumerPlans = sortItemSlicePlans(
        recipePlans
          .filter(plan => plan.inputs.some(input => input.itemId === entry.itemId))
          .map(plan => ({
            recipeId: plan.recipeId,
            recipeName: plan.recipeName,
            recipeIconKey: plan.recipeIconKey,
            buildingId: plan.buildingId,
            buildingName: plan.buildingName,
            buildingIconKey: plan.buildingIconKey,
            proliferatorLabel: plan.proliferatorLabel,
            itemRatePerMin:
              plan.inputs.find(input => input.itemId === entry.itemId)?.ratePerMin ?? 0,
            runsPerMin: plan.runsPerMin,
            exactBuildingCount: plan.exactBuildingCount,
            roundedUpBuildingCount: plan.roundedUpBuildingCount,
            roundedPlacementPowerMW: plan.roundedPlacementPowerMW,
            inputs: plan.inputs,
            outputs: plan.outputs,
          }))
      );

      const slice: PresentationItemSlice = {
        itemId: entry.itemId,
        itemName: entry.itemName,
        iconKey: entry.iconKey,
        producedRatePerMin: entry.producedRatePerMin,
        consumedRatePerMin: entry.consumedRatePerMin,
        netRatePerMin: entry.netRatePerMin,
        externalInputRatePerMin: entry.externalInputRatePerMin,
        targetRatePerMin: entry.targetRatePerMin,
        surplusRatePerMin: entry.surplusRatePerMin,
        isRawInput: entry.isRawInput,
        isTarget: entry.isTarget,
        isSurplusOutput: entry.isSurplusOutput,
        producerPlans,
        consumerPlans,
      };

      return [entry.itemId, slice];
    })
  );
}

function buildPresentationSolveSummary(
  result: SolveResult,
  catalog: ResolvedCatalogModel
): PresentationSolveSummary {
  const netOutputsByItem = new Map<string, PresentationItemRate>();

  for (const target of result.targets) {
    netOutputsByItem.set(target.itemId, {
      itemId: target.itemId,
      itemName: getItemName(catalog, target.itemId),
      iconKey: getItemIcon(catalog, target.itemId),
      ratePerMin: target.actualRatePerMin,
    });
  }

  for (const surplus of result.surplusOutputs) {
    const existing = netOutputsByItem.get(surplus.itemId);
    netOutputsByItem.set(surplus.itemId, {
      itemId: surplus.itemId,
      itemName: getItemName(catalog, surplus.itemId),
      iconKey: getItemIcon(catalog, surplus.itemId),
      ratePerMin: (existing?.ratePerMin ?? 0) + surplus.ratePerMin,
    });
  }

  return {
    netInputs: sortByName(mapItemRates(catalog, result.externalInputs)),
    netOutputs: sortByName(Array.from(netOutputsByItem.values())),
    buildingTypeCount: result.buildingSummary.length,
    roundedBuildingCount: result.buildingSummary.reduce(
      (sum, entry) => sum + entry.roundedUpCount,
      0
    ),
    recipeTypeCount: new Set(result.recipePlans.map(plan => plan.recipeId)).size,
    roundedPlacementPowerMW: result.powerSummary.roundedPlacementPowerMW,
  };
}

function inferGlobalProliferatorPolicyLabel(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  locale: AppLocale
): string {
  const bundle = getLocaleBundle(locale);
  const affectedRecipes = catalog.recipes.filter(
    recipe =>
      recipe.maxProliferatorLevel > 0 ||
      recipe.supportsProliferatorModes.some(mode => mode !== 'none')
  );

  if (affectedRecipes.length === 0) {
    return bundle.common.auto;
  }

  const forcedModes = request.forcedProliferatorModeByRecipe ?? {};
  const forcedLevels = request.forcedProliferatorLevelByRecipe ?? {};
  const allDisabled = affectedRecipes.every(
    recipe =>
      forcedModes[recipe.recipeId] === 'none' &&
      (forcedLevels[recipe.recipeId] === undefined || forcedLevels[recipe.recipeId] === 0)
  );
  if (allDisabled) {
    return formatWorkbenchProliferatorPolicy('none', locale);
  }

  const nonNoneForcedModes = new Set<ProliferatorMode>();
  const nonNoneForcedLevels = new Set<number>();
  let hasNonNoneAllowedRecipe = false;

  for (const recipe of affectedRecipes) {
    const forcedMode = forcedModes[recipe.recipeId];
    if (!forcedMode || forcedMode === 'none') {
      continue;
    }

    const forcedLevel = forcedLevels[recipe.recipeId];
    if (
      typeof forcedLevel === 'number' &&
      Number.isFinite(forcedLevel) &&
      forcedLevel > 0
    ) {
      hasNonNoneAllowedRecipe = true;
      nonNoneForcedModes.add(forcedMode);
      nonNoneForcedLevels.add(forcedLevel);
    }
  }

  if (
    hasNonNoneAllowedRecipe &&
    nonNoneForcedModes.size === 1 &&
    nonNoneForcedLevels.size === 1
  ) {
    return formatProliferatorLabel(
      Array.from(nonNoneForcedModes)[0],
      Array.from(nonNoneForcedLevels)[0],
      locale
    );
  }

  return bundle.common.auto;
}

/**
 * Build the solved-summary card groups that the web workbench renders above
 * the detailed plan tables.
 *
 * This keeps section membership stable and independently testable.
 */
export function buildPresentationOverviewSections(
  model: PresentationModel,
  locale: AppLocale = DEFAULT_APP_LOCALE
): PresentationOverviewSections {
  const bundle = getLocaleBundle(locale);

  return {
    targetsAndExternalInputs: {
      title: bundle.overview.targetsAndExternalInputsTitle,
      targets: model.targets,
      externalInputs: model.externalInputs,
    },
    buildingsAndPower: {
      title: bundle.overview.buildingsAndPowerTitle,
      buildingSummary: model.buildingSummary,
      activePowerMW: model.powerSummary?.activePowerMW ?? 0,
      roundedPlacementPowerMW: model.powerSummary?.roundedPlacementPowerMW ?? 0,
    },
    surplusOutputs: {
      title: bundle.overview.surplusOutputsTitle,
      items: model.surplusOutputs,
    },
  };
}

export function buildPresentationModel(
  params: BuildPresentationModelParams
): PresentationModel {
  const {
    catalog,
    request,
    result,
    datasetLabel,
    datasetPath,
    defaultConfigPath,
    locale = DEFAULT_APP_LOCALE,
  } = params;
  const requestSummary: PresentationRequestSummary | undefined = request
    ? {
        solverVersion: request.solverVersion,
        objective: request.objective,
        balancePolicy: request.balancePolicy,
        proliferatorPolicyLabel: inferGlobalProliferatorPolicyLabel(catalog, request, locale),
        targets: request.targets.map(target => ({
          itemId: target.itemId,
          itemName: getItemName(catalog, target.itemId),
          iconKey: getItemIcon(catalog, target.itemId),
          ratePerMin: target.ratePerMin,
        })),
        rawInputs: sortNamedItems(
          (request.rawInputItemIds ?? []).map(itemId => ({
            itemId,
            itemName: getItemName(catalog, itemId),
            iconKey: getItemIcon(catalog, itemId),
          }))
        ),
        allowedRecipeSettings: Object.entries(request.allowedRecipesByItem ?? {})
          .flatMap(([itemId, recipeIds]) =>
            recipeIds.map(recipeId => {
              const recipe = catalog.recipeMap.get(recipeId);
              return {
                itemId,
                itemName: getItemName(catalog, itemId),
                iconKey: getItemIcon(catalog, itemId),
                recipeId,
                recipeName: getRecipeName(catalog, recipeId),
                recipeIconKey: getRecipeIcon(catalog, recipeId),
                cycleTimeSec: recipe?.cycleTimeSec ?? 0,
                inputs: recipe ? mapRecipeIoAmounts(catalog, recipe.inputs) : [],
                outputs: recipe ? mapRecipeIoAmounts(catalog, recipe.outputs) : [],
              };
            })
          )
          .sort(
            (left, right) =>
              left.itemName.localeCompare(right.itemName) ||
              left.recipeName.localeCompare(right.recipeName)
          ),
        disabledRecipeSettings: (request.disabledRecipeIds ?? [])
          .map(recipeId => {
            const recipe = catalog.recipeMap.get(recipeId);
            return {
              recipeId,
              recipeName: getRecipeName(catalog, recipeId),
              recipeIconKey: getRecipeIcon(catalog, recipeId),
              cycleTimeSec: recipe?.cycleTimeSec ?? 0,
              inputs: recipe ? mapRecipeIoAmounts(catalog, recipe.inputs) : [],
              outputs: recipe ? mapRecipeIoAmounts(catalog, recipe.outputs) : [],
            };
          })
          .sort((left, right) => left.recipeName.localeCompare(right.recipeName)),
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
            iconKey: getBuildingIcon(catalog, buildingId),
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
            recipeIconKey: getRecipeIcon(catalog, recipeId),
            buildingName: request.preferredBuildingByRecipe?.[recipeId]
              ? getBuildingName(catalog, request.preferredBuildingByRecipe[recipeId])
              : undefined,
            buildingIconKey: request.preferredBuildingByRecipe?.[recipeId]
              ? getBuildingIcon(catalog, request.preferredBuildingByRecipe[recipeId])
              : undefined,
            proliferatorPreferenceLabel: formatPreferredProliferatorLabel(
              request.preferredProliferatorModeByRecipe?.[recipeId],
              request.preferredProliferatorLevelByRecipe?.[recipeId],
              locale
            ),
          }))
          .sort((left, right) => left.recipeName.localeCompare(right.recipeName)),
        hasAdvancedOverrides:
          Object.keys(request.allowedRecipesByItem ?? {}).length > 0 ||
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
        iconAtlasIds: [...catalog.iconAtlasIds],
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
      solvedSummary: null,
      targets: [],
      recipePlans: [],
      buildingSummary: [],
      powerSummary: null,
      externalInputs: [],
      surplusOutputs: [],
      itemBalance: [],
      itemLedgerSections: [],
      itemSlicesById: {},
    };
  }

  const recipePlans = sortPresentationRecipePlans(
    result,
    result.recipePlans.map(plan => ({
      recipeId: plan.recipeId,
      recipeName: getRecipeName(catalog, plan.recipeId),
      recipeIconKey: getRecipeIcon(catalog, plan.recipeId),
      buildingId: plan.buildingId,
      buildingName: getBuildingName(catalog, plan.buildingId),
      buildingIconKey: getBuildingIcon(catalog, plan.buildingId),
      proliferatorLevel: plan.proliferatorLevel,
      proliferatorMode: plan.proliferatorMode,
      proliferatorLabel: formatProliferatorLabel(
        plan.proliferatorMode,
        plan.proliferatorLevel,
        locale
      ),
      runsPerMin: plan.runsPerMin,
      exactBuildingCount: plan.exactBuildingCount,
      roundedUpBuildingCount: plan.roundedUpBuildingCount,
      activePowerMW: plan.activePowerMW,
      roundedPlacementPowerMW: plan.roundedPlacementPowerMW,
      inputs: mapItemRates(catalog, plan.inputs),
      outputs: mapItemRates(catalog, plan.outputs),
    }))
  );
  const itemLedgerSections = buildPresentationItemLedgerSections(catalog, request, result, locale);

  return {
    catalogSummary: {
      datasetLabel,
      datasetPath,
      defaultConfigPath,
      iconAtlasIds: [...catalog.iconAtlasIds],
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
    solvedSummary: buildPresentationSolveSummary(result, catalog),
    targets: result.targets.map(target => ({
      itemId: target.itemId,
      itemName: getItemName(catalog, target.itemId),
      iconKey: getItemIcon(catalog, target.itemId),
      requestedRatePerMin: target.requestedRatePerMin,
      actualRatePerMin: target.actualRatePerMin,
    })),
    recipePlans,
    buildingSummary: result.buildingSummary.map(summary => ({
      buildingId: summary.buildingId,
      buildingName: getBuildingName(catalog, summary.buildingId),
      buildingIconKey: getBuildingIcon(catalog, summary.buildingId),
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
      iconKey: getItemIcon(catalog, entry.itemId),
      producedRatePerMin: entry.producedRatePerMin,
      consumedRatePerMin: entry.consumedRatePerMin,
      netRatePerMin: entry.netRatePerMin,
    })),
    itemLedgerSections,
    itemSlicesById: buildPresentationItemSlices(recipePlans, itemLedgerSections),
  };
}
