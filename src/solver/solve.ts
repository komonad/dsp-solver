import { solve as solveLinearProgram } from 'yalps';
import type { Model } from 'yalps';
import type {
  ProliferatorMode,
  ResolvedBuildingSpec,
  ResolvedCatalogModel,
  ResolvedProliferatorLevelSpec,
  ResolvedRecipeSpec,
} from '../catalog';
import type { SolveRequest } from './request';
import type {
  BuildingSummary,
  CompiledOption,
  ItemBalanceEntry,
  ItemRate,
  RecipePlan,
  SolveResult,
} from './result';

const EPSILON = 1e-8;
const PREFERENCE_EPSILON = 1e-6;
const SECONDARY_EPSILON = 1e-9;

interface ValidateResult {
  valid: boolean;
  messages: string[];
}

interface CompiledOptionContext {
  option: CompiledOption;
  recipe: ResolvedRecipeSpec;
  building: ResolvedBuildingSpec;
}

function aggregateTargetRates(request: SolveRequest): Map<string, number> {
  const targetRates = new Map<string, number>();

  for (const target of request.targets) {
    targetRates.set(target.itemId, (targetRates.get(target.itemId) ?? 0) + target.ratePerMin);
  }

  return targetRates;
}

function validateRecipeRecordMap(
  catalog: ResolvedCatalogModel,
  record: Record<string, string> | undefined,
  recordName: string,
  validator: (catalog: ResolvedCatalogModel, key: string, value: string) => boolean
): string[] {
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .filter(([key, value]) => !validator(catalog, key, value))
    .map(([key, value]) => `${recordName} contains an invalid entry: ${key} -> ${value}.`);
}

function validateNumericRecordMap(
  catalog: ResolvedCatalogModel,
  record: Record<string, number> | undefined,
  recordName: string,
  validator: (catalog: ResolvedCatalogModel, key: string, value: number) => boolean
): string[] {
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .filter(([, value]) => !Number.isFinite(value))
    .map(([key]) => `${recordName} contains a non-finite numeric value for ${key}.`)
    .concat(
      Object.entries(record)
        .filter(([key, value]) => Number.isFinite(value) && !validator(catalog, key, value))
        .map(([key, value]) => `${recordName} contains an invalid entry: ${key} -> ${value}.`)
    );
}

function validateModeRecordMap(
  catalog: ResolvedCatalogModel,
  record: Record<string, ProliferatorMode> | undefined,
  recordName: string
): string[] {
  if (!record) {
    return [];
  }

  const allowedModes = new Set<ProliferatorMode>(['none', 'speed', 'productivity']);

  return Object.entries(record)
    .filter(([key, value]) => !catalog.recipeMap.has(key) || !allowedModes.has(value))
    .map(([key, value]) => `${recordName} contains an invalid entry: ${key} -> ${value}.`);
}

function validateSolveRequest(catalog: ResolvedCatalogModel, request: SolveRequest): ValidateResult {
  const messages: string[] = [];

  if (request.targets.length === 0) {
    messages.push('SolveRequest.targets must not be empty.');
  }

  for (const target of request.targets) {
    if (!Number.isFinite(target.ratePerMin) || target.ratePerMin < 0) {
      messages.push(`Target rate must be a non-negative finite number: ${target.itemId}.`);
    }

    if (!catalog.itemMap.has(target.itemId)) {
      messages.push(`Unknown target item: ${target.itemId}.`);
    }
  }

  for (const itemId of request.rawInputItemIds ?? []) {
    if (!catalog.itemMap.has(itemId)) {
      messages.push(`Unknown raw-input item: ${itemId}.`);
    }
  }

  for (const itemId of request.disabledRawInputItemIds ?? []) {
    if (!catalog.itemMap.has(itemId)) {
      messages.push(`Unknown disabled raw-input item: ${itemId}.`);
    }
  }

  for (const recipeId of request.disabledRecipeIds ?? []) {
    if (!catalog.recipeMap.has(recipeId)) {
      messages.push(`Unknown disabled recipe: ${recipeId}.`);
    }
  }

  for (const buildingId of request.disabledBuildingIds ?? []) {
    if (!catalog.buildingMap.has(buildingId)) {
      messages.push(`Unknown disabled building: ${buildingId}.`);
    }
  }

  messages.push(
    ...validateRecipeRecordMap(
      catalog,
      request.forcedRecipeByItem,
      'forcedRecipeByItem',
      (innerCatalog, itemId, recipeId) =>
        innerCatalog.itemMap.has(itemId) &&
        innerCatalog.recipeMap.has(recipeId) &&
        innerCatalog.recipeMap.get(recipeId)!.outputs.some(output => output.itemId === itemId)
    )
  );

  messages.push(
    ...validateRecipeRecordMap(
      catalog,
      request.preferredRecipeByItem,
      'preferredRecipeByItem',
      (innerCatalog, itemId, recipeId) =>
        innerCatalog.itemMap.has(itemId) &&
        innerCatalog.recipeMap.has(recipeId) &&
        innerCatalog.recipeMap.get(recipeId)!.outputs.some(output => output.itemId === itemId)
    )
  );

  messages.push(
    ...validateRecipeRecordMap(
      catalog,
      request.forcedBuildingByRecipe,
      'forcedBuildingByRecipe',
      (innerCatalog, recipeId, buildingId) =>
        innerCatalog.recipeMap.has(recipeId) &&
        innerCatalog.buildingMap.has(buildingId)
    )
  );

  messages.push(
    ...validateRecipeRecordMap(
      catalog,
      request.preferredBuildingByRecipe,
      'preferredBuildingByRecipe',
      (innerCatalog, recipeId, buildingId) =>
        innerCatalog.recipeMap.has(recipeId) &&
        innerCatalog.buildingMap.has(buildingId)
    )
  );

  messages.push(
    ...validateNumericRecordMap(
      catalog,
      request.forcedProliferatorLevelByRecipe,
      'forcedProliferatorLevelByRecipe',
      (innerCatalog, recipeId, level) =>
        innerCatalog.recipeMap.has(recipeId) &&
        level >= 0 &&
        Number.isInteger(level) &&
        (level === 0 || innerCatalog.proliferatorLevelMap.has(level))
    )
  );

  messages.push(
    ...validateNumericRecordMap(
      catalog,
      request.preferredProliferatorLevelByRecipe,
      'preferredProliferatorLevelByRecipe',
      (innerCatalog, recipeId, level) =>
        innerCatalog.recipeMap.has(recipeId) &&
        level >= 0 &&
        Number.isInteger(level) &&
        (level === 0 || innerCatalog.proliferatorLevelMap.has(level))
    )
  );

  messages.push(
    ...validateModeRecordMap(
      catalog,
      request.forcedProliferatorModeByRecipe,
      'forcedProliferatorModeByRecipe'
    )
  );

  messages.push(
    ...validateModeRecordMap(
      catalog,
      request.preferredProliferatorModeByRecipe,
      'preferredProliferatorModeByRecipe'
    )
  );

  return {
    valid: messages.length === 0,
    messages,
  };
}

function buildRecipeOutputIndex(
  catalog: ResolvedCatalogModel,
  disabledRecipeIds: Set<string>
): Map<string, ResolvedRecipeSpec[]> {
  const recipesByOutputItem = new Map<string, ResolvedRecipeSpec[]>();

  for (const recipe of catalog.recipes) {
    if (disabledRecipeIds.has(recipe.recipeId)) {
      continue;
    }

    for (const output of recipe.outputs) {
      const recipes = recipesByOutputItem.get(output.itemId) ?? [];
      recipes.push(recipe);
      recipesByOutputItem.set(output.itemId, recipes);
    }
  }

  return recipesByOutputItem;
}

function collectUpstreamRecipes(
  catalog: ResolvedCatalogModel,
  targetItemIds: string[],
  rawInputItemIds: Set<string>,
  disabledRecipeIds: Set<string>,
  forcedRecipeByItem: Record<string, string>
): { recipes: ResolvedRecipeSpec[]; messages: string[] } {
  const messages: string[] = [];
  const recipesByOutputItem = buildRecipeOutputIndex(catalog, disabledRecipeIds);
  const visitedItems = new Set<string>();
  const selectedRecipeIds = new Set<string>();
  const queue = [...targetItemIds];

  while (queue.length > 0) {
    const itemId = queue.shift()!;
    if (visitedItems.has(itemId) || rawInputItemIds.has(itemId)) {
      continue;
    }
    visitedItems.add(itemId);

    const forcedRecipeId = forcedRecipeByItem[itemId];
    const producers = forcedRecipeId
      ? [catalog.recipeMap.get(forcedRecipeId)].filter(
          (recipe): recipe is ResolvedRecipeSpec => recipe !== undefined
        )
      : (recipesByOutputItem.get(itemId) ?? []);

    if (forcedRecipeId && producers.length === 0) {
      messages.push(`Forced recipe ${forcedRecipeId} for item ${itemId} does not exist.`);
      continue;
    }

    if (
      forcedRecipeId &&
      !producers.some(recipe => recipe.outputs.some(output => output.itemId === itemId))
    ) {
      messages.push(`Forced recipe ${forcedRecipeId} does not produce item ${itemId}.`);
      continue;
    }

    for (const recipe of producers) {
      if (selectedRecipeIds.has(recipe.recipeId)) {
        continue;
      }

      selectedRecipeIds.add(recipe.recipeId);

      for (const input of recipe.inputs) {
        if (!visitedItems.has(input.itemId)) {
          queue.push(input.itemId);
        }
      }
    }
  }

  return {
    recipes: Array.from(selectedRecipeIds, recipeId => catalog.recipeMap.get(recipeId)!).filter(Boolean),
    messages,
  };
}

function getPreferredRecipePenalty(
  recipe: ResolvedRecipeSpec,
  preferredRecipeByItem: Record<string, string>
): number {
  for (const output of recipe.outputs) {
    const preferredRecipeId = preferredRecipeByItem[output.itemId];
    if (preferredRecipeId) {
      return preferredRecipeId === recipe.recipeId ? 0 : 1;
    }
  }

  return 0;
}

function createProliferatorItemId(level: ResolvedProliferatorLevelSpec): string {
  return level.itemId ?? `__proliferator_level_${level.level}`;
}

function getPreferredOptionPenalty(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): number {
  let penalty = 0;

  penalty += getPreferredRecipePenalty(recipe, request.preferredRecipeByItem ?? {});

  const preferredBuildingId = request.preferredBuildingByRecipe?.[recipe.recipeId];
  if (preferredBuildingId && preferredBuildingId !== option.buildingId) {
    penalty += 1;
  }

  const preferredLevel = request.preferredProliferatorLevelByRecipe?.[recipe.recipeId];
  if (preferredLevel !== undefined && preferredLevel !== option.proliferatorLevel) {
    penalty += 1;
  }

  const preferredMode = request.preferredProliferatorModeByRecipe?.[recipe.recipeId];
  if (preferredMode && preferredMode !== option.proliferatorMode) {
    penalty += 1;
  }

  return penalty;
}

function buildObjectiveCoefficient(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): number {
  const preferencePenalty = getPreferredOptionPenalty(request, recipe, option);

  if (request.objective === 'min_buildings') {
    return (
      option.buildingCostPerRunPerMin +
      preferencePenalty * PREFERENCE_EPSILON +
      option.powerCostMWPerRunPerMin * SECONDARY_EPSILON
    );
  }

  if (request.objective === 'min_power') {
    return (
      option.powerCostMWPerRunPerMin +
      preferencePenalty * PREFERENCE_EPSILON +
      option.buildingCostPerRunPerMin * SECONDARY_EPSILON
    );
  }

  return (
    preferencePenalty * PREFERENCE_EPSILON +
    option.buildingCostPerRunPerMin * SECONDARY_EPSILON +
    option.powerCostMWPerRunPerMin * SECONDARY_EPSILON * SECONDARY_EPSILON
  );
}

function buildNoneVariant(
  recipe: ResolvedRecipeSpec,
  building: ResolvedBuildingSpec
): CompiledOption {
  const singleBuildingRunsPerMin = (60 / recipe.cycleTimeSec) * building.speedMultiplier;
  const outputPerRun = Object.fromEntries(
    recipe.outputs.map(output => [
      output.itemId,
      output.amount * (1 + building.intrinsicProductivityBonus),
    ])
  );
  const inputPerRun = Object.fromEntries(recipe.inputs.map(input => [input.itemId, input.amount]));

  return {
    optionId: `${recipe.recipeId}:${building.buildingId}:none:0`,
    recipeId: recipe.recipeId,
    buildingId: building.buildingId,
    proliferatorLevel: 0,
    proliferatorMode: 'none',
    powerMultiplier: 1,
    singleBuildingRunsPerMin,
    buildingCostPerRunPerMin: 1 / singleBuildingRunsPerMin,
    powerCostMWPerRunPerMin: building.workPowerMW / singleBuildingRunsPerMin,
    inputPerRun,
    outputPerRun,
  };
}

function buildProliferatorVariant(
  recipe: ResolvedRecipeSpec,
  building: ResolvedBuildingSpec,
  level: ResolvedProliferatorLevelSpec,
  mode: Exclude<ProliferatorMode, 'none'>
): CompiledOption {
  const baseRunsPerMin = 60 / recipe.cycleTimeSec;
  const speedModeMultiplier = mode === 'speed' ? level.speedMultiplier : 1;
  const productivityModeMultiplier = mode === 'productivity' ? level.productivityMultiplier : 1;
  const powerMultiplier = level.powerMultiplier;
  const singleBuildingRunsPerMin =
    baseRunsPerMin * building.speedMultiplier * speedModeMultiplier;
  const inputPerRun = Object.fromEntries(recipe.inputs.map(input => [input.itemId, input.amount]));
  const totalInputAmountPerRun = recipe.inputs.reduce((sum, input) => sum + input.amount, 0);
  const proliferatorItemId = createProliferatorItemId(level);
  inputPerRun[proliferatorItemId] =
    (inputPerRun[proliferatorItemId] ?? 0) + totalInputAmountPerRun / (level.sprayCount ?? 1);

  const outputPerRun = Object.fromEntries(
    recipe.outputs.map(output => [
      output.itemId,
      output.amount *
        (1 + building.intrinsicProductivityBonus) *
        productivityModeMultiplier,
    ])
  );

  return {
    optionId: `${recipe.recipeId}:${building.buildingId}:${mode}:${level.level}`,
    recipeId: recipe.recipeId,
    buildingId: building.buildingId,
    proliferatorLevel: level.level,
    proliferatorMode: mode,
    proliferatorItemId,
    powerMultiplier,
    singleBuildingRunsPerMin,
    buildingCostPerRunPerMin: 1 / singleBuildingRunsPerMin,
    powerCostMWPerRunPerMin:
      (building.workPowerMW * powerMultiplier) / singleBuildingRunsPerMin,
    inputPerRun,
    outputPerRun,
  };
}

function isOptionAllowedByForce(
  option: CompiledOption,
  recipe: ResolvedRecipeSpec,
  request: SolveRequest
): boolean {
  const forcedLevel = request.forcedProliferatorLevelByRecipe?.[recipe.recipeId];
  const forcedMode = request.forcedProliferatorModeByRecipe?.[recipe.recipeId];

  if (forcedLevel !== undefined && option.proliferatorLevel !== forcedLevel) {
    return false;
  }

  if (forcedMode && option.proliferatorMode !== forcedMode) {
    return false;
  }

  return true;
}

function compileOptions(
  catalog: ResolvedCatalogModel,
  recipes: ResolvedRecipeSpec[],
  request: SolveRequest,
  disabledBuildingIds: Set<string>
): { options: CompiledOptionContext[]; messages: string[] } {
  const messages: string[] = [];
  const compiledOptions: CompiledOptionContext[] = [];

  for (const recipe of recipes) {
    let allowedBuildingIds = recipe.allowedBuildingIds.filter(
      buildingId => !disabledBuildingIds.has(buildingId)
    );

    const forcedBuildingId = request.forcedBuildingByRecipe?.[recipe.recipeId];
    if (forcedBuildingId) {
      if (!allowedBuildingIds.includes(forcedBuildingId)) {
        messages.push(
          `Forced building ${forcedBuildingId} is not allowed for recipe ${recipe.recipeId}.`
        );
        continue;
      }
      allowedBuildingIds = [forcedBuildingId];
    }

    if (allowedBuildingIds.length === 0) {
      messages.push(`Recipe ${recipe.recipeId} has no available buildings after filtering.`);
      continue;
    }

    const forcedLevel = request.forcedProliferatorLevelByRecipe?.[recipe.recipeId];
    const forcedMode = request.forcedProliferatorModeByRecipe?.[recipe.recipeId];
    const allowedModes = new Set(recipe.supportsProliferatorModes);

    if (forcedMode && !allowedModes.has(forcedMode)) {
      messages.push(`Forced proliferator mode ${forcedMode} is not supported by recipe ${recipe.recipeId}.`);
      continue;
    }

    if (forcedLevel !== undefined && forcedLevel > recipe.maxProliferatorLevel) {
      messages.push(`Forced proliferator level ${forcedLevel} exceeds max level for recipe ${recipe.recipeId}.`);
      continue;
    }

    for (const buildingId of allowedBuildingIds) {
      const building = catalog.buildingMap.get(buildingId);
      if (!building) {
        messages.push(`Unknown building ${buildingId} referenced by recipe ${recipe.recipeId}.`);
        continue;
      }

      const optionCandidates: CompiledOption[] = [];
      const noneVariant = buildNoneVariant(recipe, building);
      optionCandidates.push(noneVariant);

      for (const level of catalog.proliferatorLevels) {
        if (level.level === 0 || level.level > recipe.maxProliferatorLevel) {
          continue;
        }

        if (allowedModes.has('speed')) {
          optionCandidates.push(buildProliferatorVariant(recipe, building, level, 'speed'));
        }

        if (allowedModes.has('productivity')) {
          optionCandidates.push(buildProliferatorVariant(recipe, building, level, 'productivity'));
        }
      }

      const allowedCandidates = optionCandidates.filter(option =>
        isOptionAllowedByForce(option, recipe, request)
      );

      if (allowedCandidates.length === 0) {
        messages.push(`Recipe ${recipe.recipeId} has no available proliferator variants after filtering.`);
        continue;
      }

      for (const option of allowedCandidates) {
        compiledOptions.push({
          option,
          recipe,
          building,
        });
      }
    }
  }

  return {
    options: compiledOptions,
    messages,
  };
}

function collectInvolvedItemIds(
  compiledOptions: CompiledOptionContext[],
  targetRateMap: Map<string, number>,
  externalItemIds: Set<string>
): string[] {
  const itemIds = new Set<string>();

  for (const itemId of targetRateMap.keys()) {
    itemIds.add(itemId);
  }

  for (const itemId of externalItemIds) {
    itemIds.add(itemId);
  }

  for (const { option } of compiledOptions) {
    for (const itemId of Object.keys(option.inputPerRun)) {
      itemIds.add(itemId);
    }

    for (const itemId of Object.keys(option.outputPerRun)) {
      itemIds.add(itemId);
    }
  }

  return Array.from(itemIds);
}

function collectExternalItemIds(
  rawInputItemIds: Set<string>,
  compiledOptions: CompiledOptionContext[]
): Set<string> {
  const externalItemIds = new Set(rawInputItemIds);

  for (const { option } of compiledOptions) {
    if (option.proliferatorMode !== 'none') {
      const proliferatorItemId = option.proliferatorItemId ?? `__proliferator_level_${option.proliferatorLevel}`;
      externalItemIds.add(proliferatorItemId);
    }
  }

  return externalItemIds;
}

function buildModel(
  request: SolveRequest,
  compiledOptions: CompiledOptionContext[],
  targetRateMap: Map<string, number>,
  externalItemIds: Set<string>
): Model<string, string> {
  const constraints: Record<string, { equal?: number; min?: number }> = {};
  const variables: Record<string, Record<string, number>> = {};
  const involvedItemIds = collectInvolvedItemIds(compiledOptions, targetRateMap, externalItemIds);

  for (const itemId of involvedItemIds) {
    const targetRate = targetRateMap.get(itemId);
    constraints[itemId] =
      request.balancePolicy === 'force_balance'
        ? { equal: targetRate ?? 0 }
        : { min: targetRate ?? 0 };
  }

  for (const { option, recipe } of compiledOptions) {
    const coefficients: Record<string, number> = {
      __objective__: buildObjectiveCoefficient(request, recipe, option),
    };

    for (const [itemId, amount] of Object.entries(option.outputPerRun)) {
      coefficients[itemId] = (coefficients[itemId] ?? 0) + amount;
    }

    for (const [itemId, amount] of Object.entries(option.inputPerRun)) {
      coefficients[itemId] = (coefficients[itemId] ?? 0) - amount;
    }

    variables[option.optionId] = coefficients;
  }

  for (const itemId of externalItemIds) {
    variables[`ext:${itemId}`] = {
      [itemId]: 1,
      __objective__: request.objective === 'min_external_input' ? 1 : 0,
    };
  }

  return {
    direction: 'minimize',
    objective: '__objective__',
    constraints,
    variables,
  };
}

function roundUpCount(value: number): number {
  if (value <= EPSILON) {
    return 0;
  }

  return Math.ceil(value - EPSILON);
}

function sortItemRates(itemRates: Map<string, number>): ItemRate[] {
  return Array.from(itemRates.entries())
    .filter(([, rate]) => Math.abs(rate) > EPSILON)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([itemId, ratePerMin]) => ({
      itemId,
      ratePerMin,
    }));
}

function buildUnmetPreferences(
  request: SolveRequest,
  recipePlans: RecipePlan[]
): string[] {
  const unmet: string[] = [];
  const plansByRecipe = new Map<string, RecipePlan[]>();

  for (const plan of recipePlans) {
    const plans = plansByRecipe.get(plan.recipeId) ?? [];
    plans.push(plan);
    plansByRecipe.set(plan.recipeId, plans);
  }

  for (const [recipeId, preferredBuildingId] of Object.entries(request.preferredBuildingByRecipe ?? {})) {
    const plans = plansByRecipe.get(recipeId);
    if (plans && !plans.some(plan => plan.buildingId === preferredBuildingId)) {
      unmet.push(`Preferred building ${preferredBuildingId} was not used for recipe ${recipeId}.`);
    }
  }

  for (const [recipeId, preferredLevel] of Object.entries(request.preferredProliferatorLevelByRecipe ?? {})) {
    const plans = plansByRecipe.get(recipeId);
    if (plans && !plans.some(plan => plan.proliferatorLevel === preferredLevel)) {
      unmet.push(`Preferred proliferator level ${preferredLevel} was not used for recipe ${recipeId}.`);
    }
  }

  for (const [recipeId, preferredMode] of Object.entries(request.preferredProliferatorModeByRecipe ?? {})) {
    const plans = plansByRecipe.get(recipeId);
    if (plans && !plans.some(plan => plan.proliferatorMode === preferredMode)) {
      unmet.push(`Preferred proliferator mode ${preferredMode} was not used for recipe ${recipeId}.`);
    }
  }

  for (const [itemId, preferredRecipeId] of Object.entries(request.preferredRecipeByItem ?? {})) {
    const plans = recipePlans.filter(plan => plan.recipeId === preferredRecipeId);
    const itemHasAnyPlan = recipePlans.length > 0 && recipePlans.some(plan => plan.outputs.some(output => output.itemId === itemId));
    if (itemHasAnyPlan && plans.length === 0) {
      unmet.push(`Preferred recipe ${preferredRecipeId} was not used for item ${itemId}.`);
    }
  }

  return unmet;
}

function buildResultFromSolution(params: {
  request: SolveRequest;
  targetRateMap: Map<string, number>;
  compiledOptions: CompiledOptionContext[];
  solutionVariables: Map<string, number>;
}): SolveResult {
  const { request, targetRateMap, compiledOptions, solutionVariables } = params;
  const optionById = new Map(compiledOptions.map(entry => [entry.option.optionId, entry]));
  const recipePlans: RecipePlan[] = [];
  const externalInputMap = new Map<string, number>();
  const producedMap = new Map<string, number>();
  const recipeConsumedMap = new Map<string, number>();

  for (const [variableName, value] of solutionVariables.entries()) {
    if (value <= EPSILON) {
      continue;
    }

    if (variableName.startsWith('ext:')) {
      const itemId = variableName.slice(4);
      externalInputMap.set(itemId, (externalInputMap.get(itemId) ?? 0) + value);
      producedMap.set(itemId, (producedMap.get(itemId) ?? 0) + value);
      continue;
    }

    const compiled = optionById.get(variableName);
    if (!compiled) {
      continue;
    }

    const { option, building } = compiled;
    const exactBuildingCount = value / option.singleBuildingRunsPerMin;
    const roundedUpBuildingCount = roundUpCount(exactBuildingCount);
    const powerMW = roundedUpBuildingCount * building.workPowerMW * option.powerMultiplier;

    const inputs = Object.entries(option.inputPerRun).map(([itemId, amount]) => ({
      itemId,
      ratePerMin: amount * value,
    }));
    const outputs = Object.entries(option.outputPerRun).map(([itemId, amount]) => ({
      itemId,
      ratePerMin: amount * value,
    }));

    for (const input of inputs) {
      recipeConsumedMap.set(input.itemId, (recipeConsumedMap.get(input.itemId) ?? 0) + input.ratePerMin);
    }

    for (const output of outputs) {
      producedMap.set(output.itemId, (producedMap.get(output.itemId) ?? 0) + output.ratePerMin);
    }

    recipePlans.push({
      recipeId: option.recipeId,
      buildingId: option.buildingId,
      proliferatorLevel: option.proliferatorLevel,
      proliferatorMode: option.proliferatorMode,
      runsPerMin: value,
      exactBuildingCount,
      roundedUpBuildingCount,
      activePowerMW: powerMW,
      roundedPlacementPowerMW: powerMW,
      inputs: inputs.sort((left, right) => left.itemId.localeCompare(right.itemId)),
      outputs: outputs.sort((left, right) => left.itemId.localeCompare(right.itemId)),
    });
  }

  recipePlans.sort(
    (left, right) =>
      left.recipeId.localeCompare(right.recipeId) ||
      left.buildingId.localeCompare(right.buildingId) ||
      left.proliferatorMode.localeCompare(right.proliferatorMode) ||
      left.proliferatorLevel - right.proliferatorLevel
  );

  const buildingSummaryMap = new Map<string, BuildingSummary>();
  for (const plan of recipePlans) {
    const current = buildingSummaryMap.get(plan.buildingId);
    if (current) {
      current.exactCount += plan.exactBuildingCount;
      current.roundedUpCount += plan.roundedUpBuildingCount;
      current.activePowerMW += plan.activePowerMW;
      current.roundedPlacementPowerMW += plan.roundedPlacementPowerMW;
    } else {
      buildingSummaryMap.set(plan.buildingId, {
        buildingId: plan.buildingId,
        exactCount: plan.exactBuildingCount,
        roundedUpCount: plan.roundedUpBuildingCount,
        activePowerMW: plan.activePowerMW,
        roundedPlacementPowerMW: plan.roundedPlacementPowerMW,
      });
    }
  }

  const buildingSummary = Array.from(buildingSummaryMap.values()).sort((left, right) =>
    left.buildingId.localeCompare(right.buildingId)
  );

  const itemIds = new Set<string>([
    ...producedMap.keys(),
    ...recipeConsumedMap.keys(),
    ...targetRateMap.keys(),
    ...externalInputMap.keys(),
  ]);

  const surplusOutputs: ItemRate[] = [];
  const itemBalance: ItemBalanceEntry[] = Array.from(itemIds)
    .sort((left, right) => left.localeCompare(right))
    .map(itemId => {
      const targetRate = targetRateMap.get(itemId) ?? 0;
      const producedRatePerMin = producedMap.get(itemId) ?? 0;
      const consumedRatePerMin = (recipeConsumedMap.get(itemId) ?? 0) + targetRate;
      const netRatePerMin = producedRatePerMin - consumedRatePerMin;

      if (request.balancePolicy === 'allow_surplus' && netRatePerMin > EPSILON) {
        surplusOutputs.push({ itemId, ratePerMin: netRatePerMin });
      }

      return {
        itemId,
        producedRatePerMin,
        consumedRatePerMin,
        netRatePerMin,
      };
    });

  const targets = Array.from(targetRateMap.entries())
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([itemId, requestedRatePerMin]) => ({
      itemId,
      requestedRatePerMin,
      actualRatePerMin:
        (producedMap.get(itemId) ?? 0) - (recipeConsumedMap.get(itemId) ?? 0),
    }));

  return {
    status: 'optimal',
    diagnostics: {
      messages: [],
      unmetPreferences: buildUnmetPreferences(request, recipePlans),
    },
    targets,
    recipePlans,
    buildingSummary,
    powerSummary: {
      activePowerMW: buildingSummary.reduce((sum, entry) => sum + entry.activePowerMW, 0),
      roundedPlacementPowerMW: buildingSummary.reduce(
        (sum, entry) => sum + entry.roundedPlacementPowerMW,
        0
      ),
    },
    externalInputs: sortItemRates(externalInputMap),
    surplusOutputs: surplusOutputs.sort((left, right) => left.itemId.localeCompare(right.itemId)),
    itemBalance,
  };
}

export function solveCatalogRequest(
  catalog: ResolvedCatalogModel,
  request: SolveRequest
): SolveResult {
  const validation = validateSolveRequest(catalog, request);
  if (!validation.valid) {
    return {
      status: 'invalid_input',
      diagnostics: {
        messages: validation.messages,
        unmetPreferences: [],
      },
      targets: [],
      recipePlans: [],
      buildingSummary: [],
      powerSummary: {
        activePowerMW: 0,
        roundedPlacementPowerMW: 0,
      },
      externalInputs: [],
      surplusOutputs: [],
      itemBalance: [],
    };
  }

  const targetRateMap = aggregateTargetRates(request);
  const disabledRawInputItemIds = new Set(request.disabledRawInputItemIds ?? []);
  const rawInputItemIds = new Set<string>(
    [...catalog.rawItemIds, ...(request.rawInputItemIds ?? [])].filter(
      itemId => !disabledRawInputItemIds.has(itemId)
    )
  );
  const disabledRecipeIds = new Set(request.disabledRecipeIds ?? []);
  const disabledBuildingIds = new Set(request.disabledBuildingIds ?? []);
  const collected = collectUpstreamRecipes(
    catalog,
    Array.from(targetRateMap.keys()),
    rawInputItemIds,
    disabledRecipeIds,
    request.forcedRecipeByItem ?? {}
  );
  const compiled = compileOptions(catalog, collected.recipes, request, disabledBuildingIds);
  const diagnostics = [...collected.messages, ...compiled.messages];

  const externalItemIds = collectExternalItemIds(rawInputItemIds, compiled.options);
  const model = buildModel(request, compiled.options, targetRateMap, externalItemIds);
  const solution = solveLinearProgram(model);

  if (solution.status !== 'optimal') {
    return {
      status: 'infeasible',
      diagnostics: {
        messages: [...diagnostics, `LP solve failed with status ${solution.status}.`],
        unmetPreferences: [],
      },
      targets: Array.from(targetRateMap.entries()).map(([itemId, requestedRatePerMin]) => ({
        itemId,
        requestedRatePerMin,
        actualRatePerMin: 0,
      })),
      recipePlans: [],
      buildingSummary: [],
      powerSummary: {
        activePowerMW: 0,
        roundedPlacementPowerMW: 0,
      },
      externalInputs: [],
      surplusOutputs: [],
      itemBalance: [],
    };
  }

  const result = buildResultFromSolution({
    request,
    targetRateMap,
    compiledOptions: compiled.options,
    solutionVariables: new Map<string, number>(solution.variables),
  });

  return {
    ...result,
    diagnostics: {
      messages: diagnostics,
      unmetPreferences: result.diagnostics.unmetPreferences,
    },
  };
}
