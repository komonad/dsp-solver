import type {
  ProliferatorMode,
  ResolvedBuildingSpec,
  ResolvedCatalogModel,
  ResolvedProliferatorLevelSpec,
  ResolvedRecipeSpec,
} from '../catalog';
import type { BuildingParameterOverride, SolveRequest } from './request';
import type {
  CompiledItemAmountEntry,
  CompiledOption,
  SolveResult,
} from './result';
import type { SolverImplementation } from './implementation';

export const EPSILON = 1e-8;

export interface CompiledOptionContext {
  option: CompiledOption;
  recipe: ResolvedRecipeSpec;
  building: ResolvedBuildingSpec;
}

interface CollectRecipesResult {
  recipes: ResolvedRecipeSpec[];
  messages: string[];
  infoMessages: string[];
  autoPromotedRawInputItemIds: string[];
}

export interface CompiledSolveGraph {
  itemIds: string[];
  recipes: ResolvedRecipeSpec[];
  options: CompiledOptionContext[];
  messages: string[];
  infoMessages: string[];
  resolvedRawInputItemIds: string[];
}

interface StaticCompilationMessage {
  message: string;
  buildingId?: string;
}

interface StaticRecipeOptionCompilation {
  options: CompiledOptionContext[];
  messages: StaticCompilationMessage[];
}

interface CachedRecipeOptionCompilation {
  options: CompiledOptionContext[];
  messages: string[];
}

export interface CatalogSolveCache {
  anyRecipeOutputIndex: Map<string, ResolvedRecipeSpec[]>;
  recipeOutputIndexByDisabledSetKey: Map<string, Map<string, ResolvedRecipeSpec[]>>;
  staticRecipeOptionCompilations: Map<string, StaticRecipeOptionCompilation>;
  solvedRequestResults: Map<string, SolveResult>;
}

export interface SurplusSolutionMetrics {
  activeItemIds: string[];
  itemRateMap: Map<string, number>;
  totalRatePerMin: number;
}

export interface LinearSolveCandidate {
  model: import('./implementation').Model<string, string>;
  activeOptions: CompiledOptionContext[];
  solution: import('./implementation').Solution<string>;
  surplus: SurplusSolutionMetrics;
  activeOptionCount: number;
  activeRecipeCount: number;
  primaryObjectiveValue: number;
}

const MAX_SOLVED_REQUEST_CACHE_SIZE = 48;
const catalogSolveCaches = new WeakMap<ResolvedCatalogModel, CatalogSolveCache>();

export function currentTimeMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function aggregateTargetRates(request: SolveRequest): Map<string, number> {
  const targetRates = new Map<string, number>();

  for (const target of request.targets) {
    targetRates.set(target.itemId, (targetRates.get(target.itemId) ?? 0) + target.ratePerMin);
  }

  return targetRates;
}

export function getForcedProliferatorModeForRecipe(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec
): ProliferatorMode | undefined {
  const perRecipeMode = request.forcedProliferatorModeByRecipe?.[recipe.recipeId];
  if (perRecipeMode) {
    return perRecipeMode;
  }

  const globalMode = request.globalForcedProliferatorMode;
  if (!globalMode) {
    return undefined;
  }

  if (globalMode === 'none' || recipe.supportsProliferatorModes.includes(globalMode)) {
    return globalMode;
  }

  return undefined;
}

export function getForcedProliferatorLevelForRecipe(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec
): number | undefined {
  const perRecipeLevel = request.forcedProliferatorLevelByRecipe?.[recipe.recipeId];
  if (perRecipeLevel !== undefined) {
    return perRecipeLevel;
  }

  const globalLevel = request.globalForcedProliferatorLevel;
  if (globalLevel === undefined) {
    return undefined;
  }

  const globalMode = request.globalForcedProliferatorMode;
  if (
    globalMode &&
    globalMode !== 'none' &&
    !recipe.supportsProliferatorModes.includes(globalMode)
  ) {
    return undefined;
  }

  if (globalLevel > recipe.maxProliferatorLevel) {
    return undefined;
  }

  return globalLevel;
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

function buildSetKey(values: Iterable<string>): string {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right)).join('|');
}

export function haveSameStringSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

export function buildAllowedRecipeSetMap(
  allowedRecipesByItem: Record<string, string[]> | undefined
): Map<string, ReadonlySet<string>> {
  const allowedRecipeSetMap = new Map<string, ReadonlySet<string>>();

  if (!allowedRecipesByItem) {
    return allowedRecipeSetMap;
  }

  for (const [itemId, recipeIds] of Object.entries(allowedRecipesByItem)) {
    if (recipeIds.length > 0) {
      allowedRecipeSetMap.set(itemId, new Set(recipeIds));
    }
  }

  return allowedRecipeSetMap;
}

export function stableSerialize(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (Array.isArray(value)) {
    return `[${value.map(entry => stableSerialize(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort((left, right) => left.localeCompare(right))
      .map(key => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function getCatalogSolveCache(catalog: ResolvedCatalogModel): CatalogSolveCache {
  const cached = catalogSolveCaches.get(catalog);
  if (cached) {
    return cached;
  }

  const anyRecipeOutputIndex = buildRecipeOutputIndex(catalog, new Set<string>());
  const nextCache: CatalogSolveCache = {
    anyRecipeOutputIndex,
    recipeOutputIndexByDisabledSetKey: new Map<string, Map<string, ResolvedRecipeSpec[]>>([
      ['', anyRecipeOutputIndex],
    ]),
    staticRecipeOptionCompilations: new Map<string, StaticRecipeOptionCompilation>(),
    solvedRequestResults: new Map<string, SolveResult>(),
  };
  catalogSolveCaches.set(catalog, nextCache);
  return nextCache;
}

export function getRecipeOutputIndexForDisabledRecipes(
  catalog: ResolvedCatalogModel,
  disabledRecipeIds: Set<string>
): Map<string, ResolvedRecipeSpec[]> {
  const cache = getCatalogSolveCache(catalog);
  const disabledSetKey = buildSetKey(disabledRecipeIds);
  const cached = cache.recipeOutputIndexByDisabledSetKey.get(disabledSetKey);
  if (cached) {
    return cached;
  }

  const built = buildRecipeOutputIndex(catalog, disabledRecipeIds);
  cache.recipeOutputIndexByDisabledSetKey.set(disabledSetKey, built);
  return built;
}

function isFractionationRecipe(recipe: ResolvedRecipeSpec): boolean {
  return (
    typeof recipe.fractionationProbability === 'number' &&
    Number.isFinite(recipe.fractionationProbability) &&
    recipe.fractionationProbability > 0
  );
}

function buildSingleBuildingBaseRunsPerMin(
  recipe: ResolvedRecipeSpec,
  building: ResolvedBuildingSpec
): number {
  if (!isFractionationRecipe(recipe)) {
    return (60 / recipe.cycleTimeSec) * building.speedMultiplier;
  }

  const beltSpeed = building.fractionatorBeltSpeedItemsPerMin;
  const maxStack = building.fractionatorMaxItemStack;
  if (
    !Number.isFinite(beltSpeed) ||
    beltSpeed === undefined ||
    beltSpeed <= 0 ||
    !Number.isFinite(maxStack) ||
    maxStack === undefined ||
    maxStack <= 0
  ) {
    throw new Error(
      `Fractionation recipe ${recipe.recipeId} requires FractionatorBeltSpeedItemsPerMin and FractionatorMaxItemStack on building ${building.buildingId}.`
    );
  }

  return beltSpeed * maxStack * recipe.fractionationProbability!;
}

function hasFractionationBuildingThroughputConfig(building: ResolvedBuildingSpec): boolean {
  return Boolean(
    Number.isFinite(building.fractionatorBeltSpeedItemsPerMin) &&
    building.fractionatorBeltSpeedItemsPerMin !== undefined &&
    building.fractionatorBeltSpeedItemsPerMin > 0 &&
    Number.isFinite(building.fractionatorMaxItemStack) &&
    building.fractionatorMaxItemStack !== undefined &&
    building.fractionatorMaxItemStack > 0
  );
}

function buildInputPerRun(recipe: ResolvedRecipeSpec): Record<string, number> {
  return Object.fromEntries(
    recipe.inputs.map(input => [input.itemId, isFractionationRecipe(recipe) ? 1 : input.amount])
  );
}

function buildOutputPerRun(
  recipe: ResolvedRecipeSpec,
  building: ResolvedBuildingSpec,
  productivityModeMultiplier = 1
): Record<string, number> {
  if (isFractionationRecipe(recipe)) {
    return Object.fromEntries(recipe.outputs.map(output => [output.itemId, 1]));
  }

  return Object.fromEntries(
    recipe.outputs.map(output => [
      output.itemId,
      output.amount *
        (1 + building.intrinsicProductivityBonus) *
        productivityModeMultiplier,
    ])
  );
}

function buildCompiledItemEntries(perRun: Record<string, number>): CompiledItemAmountEntry[] {
  const entries: CompiledItemAmountEntry[] = [];

  for (const itemId in perRun) {
    if (Object.prototype.hasOwnProperty.call(perRun, itemId)) {
      entries.push([itemId, perRun[itemId]] as const);
    }
  }

  return entries;
}

function buildTouchedItemIds(
  inputEntries: readonly CompiledItemAmountEntry[],
  outputEntries: readonly CompiledItemAmountEntry[],
  proliferatorItemId?: string
): string[] {
  const itemIds = new Set<string>();

  for (const [itemId] of inputEntries) {
    itemIds.add(itemId);
  }

  for (const [itemId] of outputEntries) {
    itemIds.add(itemId);
  }

  if (proliferatorItemId) {
    itemIds.add(proliferatorItemId);
  }

  return Array.from(itemIds);
}

function buildNetItemEntries(
  inputEntries: readonly CompiledItemAmountEntry[],
  outputEntries: readonly CompiledItemAmountEntry[]
): CompiledItemAmountEntry[] {
  const netByItem = new Map<string, number>();

  for (const [itemId, amount] of outputEntries) {
    netByItem.set(itemId, (netByItem.get(itemId) ?? 0) + amount);
  }

  for (const [itemId, amount] of inputEntries) {
    netByItem.set(itemId, (netByItem.get(itemId) ?? 0) - amount);
  }

  return Array.from(netByItem.entries()).map(([itemId, amount]) => [itemId, amount] as const);
}

function finalizeCompiledOption(
  option: Omit<CompiledOption, 'inputEntries' | 'outputEntries' | 'netItemEntries' | 'touchedItemIds'>
): CompiledOption {
  const inputEntries = buildCompiledItemEntries(option.inputPerRun);
  const outputEntries = buildCompiledItemEntries(option.outputPerRun);

  return {
    ...option,
    inputEntries,
    outputEntries,
    netItemEntries: buildNetItemEntries(inputEntries, outputEntries),
    touchedItemIds: buildTouchedItemIds(inputEntries, outputEntries, option.proliferatorItemId),
  };
}

function buildNoneVariant(
  recipe: ResolvedRecipeSpec,
  building: ResolvedBuildingSpec,
  powerItemId?: string
): CompiledOption {
  const singleBuildingRunsPerMin = buildSingleBuildingBaseRunsPerMin(recipe, building);
  const outputPerRun = buildOutputPerRun(recipe, building);
  const inputPerRun = buildInputPerRun(recipe);
  const powerCostMWPerRunPerMin = building.workPowerMW / singleBuildingRunsPerMin;
  if (powerItemId && powerCostMWPerRunPerMin > EPSILON) {
    inputPerRun[powerItemId] = (inputPerRun[powerItemId] ?? 0) + powerCostMWPerRunPerMin;
  }

  return finalizeCompiledOption({
    optionId: `${recipe.recipeId}:${building.buildingId}:none:0`,
    recipeId: recipe.recipeId,
    buildingId: building.buildingId,
    proliferatorLevel: 0,
    proliferatorMode: 'none',
    powerMultiplier: 1,
    singleBuildingRunsPerMin,
    buildingCostPerRunPerMin: building.space / singleBuildingRunsPerMin,
    powerCostMWPerRunPerMin,
    inputPerRun,
    outputPerRun,
  });
}

function createProliferatorItemId(level: ResolvedProliferatorLevelSpec): string {
  return level.itemId ?? `__proliferator_level_${level.level}`;
}

function buildProliferatorVariant(
  recipe: ResolvedRecipeSpec,
  building: ResolvedBuildingSpec,
  level: ResolvedProliferatorLevelSpec,
  mode: Exclude<ProliferatorMode, 'none'>,
  powerItemId?: string
): CompiledOption {
  const baseRunsPerMin = buildSingleBuildingBaseRunsPerMin(recipe, building);
  const speedModeMultiplier = mode === 'speed' ? level.speedMultiplier : 1;
  const productivityModeMultiplier = mode === 'productivity' ? level.productivityMultiplier : 1;
  const powerMultiplier = level.powerMultiplier;
  const singleBuildingRunsPerMin = baseRunsPerMin * speedModeMultiplier;
  const inputPerRun = buildInputPerRun(recipe);
  const totalInputAmountPerRun = Object.values(inputPerRun).reduce((sum, amount) => sum + amount, 0);
  const proliferatorItemId = createProliferatorItemId(level);
  inputPerRun[proliferatorItemId] =
    (inputPerRun[proliferatorItemId] ?? 0) + totalInputAmountPerRun / (level.sprayCount ?? 1);
  const powerCostMWPerRunPerMin =
    (building.workPowerMW * powerMultiplier) / singleBuildingRunsPerMin;
  if (powerItemId && powerCostMWPerRunPerMin > EPSILON) {
    inputPerRun[powerItemId] = (inputPerRun[powerItemId] ?? 0) + powerCostMWPerRunPerMin;
  }

  const outputPerRun = buildOutputPerRun(recipe, building, productivityModeMultiplier);

  return finalizeCompiledOption({
    optionId: `${recipe.recipeId}:${building.buildingId}:${mode}:${level.level}`,
    recipeId: recipe.recipeId,
    buildingId: building.buildingId,
    proliferatorLevel: level.level,
    proliferatorMode: mode,
    proliferatorItemId,
    powerMultiplier,
    singleBuildingRunsPerMin,
    buildingCostPerRunPerMin: building.space / singleBuildingRunsPerMin,
    powerCostMWPerRunPerMin,
    inputPerRun,
    outputPerRun,
  });
}

function isOptionAllowedByForce(
  option: CompiledOption,
  recipe: ResolvedRecipeSpec,
  request: SolveRequest
): boolean {
  const forcedLevel = getForcedProliferatorLevelForRecipe(request, recipe);
  const forcedMode = getForcedProliferatorModeForRecipe(request, recipe);

  if (forcedLevel !== undefined && option.proliferatorLevel !== forcedLevel) {
    return false;
  }

  if (forcedMode && option.proliferatorMode !== forcedMode) {
    return false;
  }

  return true;
}

function getStaticRecipeOptionCompilation(
  catalog: ResolvedCatalogModel,
  recipe: ResolvedRecipeSpec
): StaticRecipeOptionCompilation {
  const cache = getCatalogSolveCache(catalog);
  const cached = cache.staticRecipeOptionCompilations.get(recipe.recipeId);
  if (cached) {
    return cached;
  }

  const messages: StaticCompilationMessage[] = [];
  const options: CompiledOptionContext[] = [];

  for (const buildingId of recipe.allowedBuildingIds) {
    const building = catalog.buildingMap.get(buildingId);
    if (!building) {
      messages.push({
        buildingId,
        message: `Unknown building ${buildingId} referenced by recipe ${recipe.recipeId}.`,
      });
      continue;
    }

    if (isFractionationRecipe(recipe) && !hasFractionationBuildingThroughputConfig(building)) {
      messages.push({
        buildingId: building.buildingId,
        message: `Fractionation recipe ${recipe.recipeId} skips building ${building.buildingId} because it lacks FractionatorBeltSpeedItemsPerMin or FractionatorMaxItemStack.`,
      });
      continue;
    }

    options.push({
      option: buildNoneVariant(recipe, building, catalog.powerItemId),
      recipe,
      building,
    });

    for (const level of catalog.proliferatorLevels) {
      if (level.level === 0 || level.level > recipe.maxProliferatorLevel) {
        continue;
      }

      if (recipe.supportsProliferatorModes.includes('speed')) {
        options.push({
          option: buildProliferatorVariant(recipe, building, level, 'speed', catalog.powerItemId),
          recipe,
          building,
        });
      }

      if (recipe.supportsProliferatorModes.includes('productivity')) {
        options.push({
          option: buildProliferatorVariant(recipe, building, level, 'productivity', catalog.powerItemId),
          recipe,
          building,
        });
      }
    }
  }

  const compilation = { options, messages };
  cache.staticRecipeOptionCompilations.set(recipe.recipeId, compilation);
  return compilation;
}

function getSolvedRequestCacheKey(
  request: SolveRequest,
  implementation: SolverImplementation
): string {
  return `${implementation.implementationId}\u0000${stableSerialize(request)}`;
}

export function getCachedSolvedRequestResult(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  implementation: SolverImplementation
): SolveResult | null {
  const cache = getCatalogSolveCache(catalog);
  const requestKey = getSolvedRequestCacheKey(request, implementation);
  const cached = cache.solvedRequestResults.get(requestKey);
  if (!cached) {
    return null;
  }

  cache.solvedRequestResults.delete(requestKey);
  cache.solvedRequestResults.set(requestKey, cached);
  return cached;
}

export function setCachedSolvedRequestResult(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  implementation: SolverImplementation,
  result: SolveResult
): void {
  const cache = getCatalogSolveCache(catalog);
  const requestKey = getSolvedRequestCacheKey(request, implementation);
  if (cache.solvedRequestResults.has(requestKey)) {
    cache.solvedRequestResults.delete(requestKey);
  }
  cache.solvedRequestResults.set(requestKey, result);

  while (cache.solvedRequestResults.size > MAX_SOLVED_REQUEST_CACHE_SIZE) {
    const oldestKey = cache.solvedRequestResults.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cache.solvedRequestResults.delete(oldestKey);
  }
}

function collectAuxiliaryInputItemIds(
  compiledOptions: CompiledOptionContext[]
): string[] {
  const auxiliaryItemIds = new Set<string>();

  for (const { option, recipe } of compiledOptions) {
    const recipeInputIds = new Set(recipe.inputs.map(input => input.itemId));
    for (const [itemId] of option.inputEntries) {
      if (!recipeInputIds.has(itemId)) {
        auxiliaryItemIds.add(itemId);
      }
    }
  }

  return Array.from(auxiliaryItemIds).sort((left, right) => left.localeCompare(right));
}

function applyBuildingOverride(
  option: CompiledOption,
  recipe: ResolvedRecipeSpec,
  building: ResolvedBuildingSpec,
  override: BuildingParameterOverride,
  powerItemId?: string
): CompiledOption {
  const needsBeltSpeedOverride =
    isFractionationRecipe(recipe) &&
    override.beltSpeedItemsPerMin !== undefined &&
    override.beltSpeedItemsPerMin > 0;

  if (!needsBeltSpeedOverride && (override.stackLayers === undefined || override.stackLayers <= 1)) {
    return option;
  }

  if (needsBeltSpeedOverride) {
    const beltSpeed = override.beltSpeedItemsPerMin!;
    const maxStack = building.fractionatorMaxItemStack ?? 1;
    const singleBuildingRunsPerMin = beltSpeed * maxStack * recipe.fractionationProbability!;
    const effectiveSpace = building.space / (override.stackLayers ?? 1);
    const powerCostMWPerRunPerMin =
      (building.workPowerMW * option.powerMultiplier) / singleBuildingRunsPerMin;
    const inputPerRun = { ...option.inputPerRun };
    if (powerItemId) {
      const oldPower = (building.workPowerMW * option.powerMultiplier) / option.singleBuildingRunsPerMin;
      if (oldPower > EPSILON) {
        inputPerRun[powerItemId] = (inputPerRun[powerItemId] ?? 0) - oldPower + (powerCostMWPerRunPerMin > EPSILON ? powerCostMWPerRunPerMin : 0);
      } else if (powerCostMWPerRunPerMin > EPSILON) {
        inputPerRun[powerItemId] = (inputPerRun[powerItemId] ?? 0) + powerCostMWPerRunPerMin;
      }
    }
    return finalizeCompiledOption({
      ...option,
      singleBuildingRunsPerMin,
      buildingCostPerRunPerMin: effectiveSpace / singleBuildingRunsPerMin,
      powerCostMWPerRunPerMin,
      inputPerRun,
    });
  }

  const effectiveSpace = building.space / (override.stackLayers ?? 1);
  return {
    ...option,
    buildingCostPerRunPerMin: effectiveSpace / option.singleBuildingRunsPerMin,
  };
}

function applyBuildingOverrides(
  options: CompiledOptionContext[],
  recipe: ResolvedRecipeSpec,
  buildingOverrides: Record<string, BuildingParameterOverride>,
  powerItemId?: string
): CompiledOptionContext[] {
  let anyChanged = false;
  const result = options.map(ctx => {
    const override = buildingOverrides[ctx.building.buildingId];
    if (!override) {
      return ctx;
    }
    const newOption = applyBuildingOverride(ctx.option, recipe, ctx.building, override, powerItemId);
    if (newOption === ctx.option) {
      return ctx;
    }
    anyChanged = true;
    return { ...ctx, option: newOption };
  });
  return anyChanged ? result : options;
}

function compileRecipeOptions(
  catalog: ResolvedCatalogModel,
  recipe: ResolvedRecipeSpec,
  request: SolveRequest,
  disabledBuildingIds: Set<string>,
  messages?: string[]
): CompiledOptionContext[] {
  const staticCompilation = getStaticRecipeOptionCompilation(catalog, recipe);

  let allowedBuildingIds = recipe.allowedBuildingIds.filter(
    buildingId => !disabledBuildingIds.has(buildingId)
  );

  const forcedBuildingId = request.forcedBuildingByRecipe?.[recipe.recipeId];
  if (forcedBuildingId) {
    if (!allowedBuildingIds.includes(forcedBuildingId)) {
      messages?.push(
        `Forced building ${forcedBuildingId} is not allowed for recipe ${recipe.recipeId}.`
      );
      return [];
    }
    allowedBuildingIds = [forcedBuildingId];
  }

  if (allowedBuildingIds.length === 0) {
    messages?.push(
      ...staticCompilation.messages
        .filter(entry => entry.buildingId === undefined)
        .map(entry => entry.message)
    );
    messages?.push(`Recipe ${recipe.recipeId} has no available buildings after filtering.`);
    return [];
  }

  const allowedBuildingIdSet = new Set(allowedBuildingIds);
  messages?.push(
    ...staticCompilation.messages
      .filter(
        entry => entry.buildingId === undefined || allowedBuildingIdSet.has(entry.buildingId)
      )
      .map(entry => entry.message)
  );

  const forcedLevel = getForcedProliferatorLevelForRecipe(request, recipe);
  const forcedMode = getForcedProliferatorModeForRecipe(request, recipe);
  const allowedModes = new Set(recipe.supportsProliferatorModes);

  if (forcedMode && !allowedModes.has(forcedMode)) {
    messages?.push(
      `Forced proliferator mode ${forcedMode} is not supported by recipe ${recipe.recipeId}.`
    );
    return [];
  }

  if (forcedLevel !== undefined && forcedLevel > recipe.maxProliferatorLevel) {
    messages?.push(
      `Forced proliferator level ${forcedLevel} exceeds max level for recipe ${recipe.recipeId}.`
    );
    return [];
  }

  const filteredOptions = staticCompilation.options.filter(
    ({ option }) =>
      allowedBuildingIdSet.has(option.buildingId) && isOptionAllowedByForce(option, recipe, request)
  );
  const overriddenOptions = request.buildingOverrides
    ? applyBuildingOverrides(filteredOptions, recipe, request.buildingOverrides, catalog.powerItemId)
    : filteredOptions;
  const compiledOptions = pruneDominatedCompiledOptions(
    overriddenOptions,
    request.preferredBuildingByRecipe?.[recipe.recipeId]
  );

  if (compiledOptions.length === 0) {
    messages?.push(
      `Recipe ${recipe.recipeId} has no available proliferator variants after filtering.`
    );
  }

  return compiledOptions;
}

function collectUpstreamRecipes(
  catalog: ResolvedCatalogModel,
  targetItemIds: string[],
  rawInputItemIds: Set<string>,
  recipeOutputIndex: Map<string, ResolvedRecipeSpec[]>,
  autoPromoteUnavailableItemsToRawInputs: boolean,
  allowedRecipeSetMap: ReadonlyMap<string, ReadonlySet<string>>,
  getCompiledRecipeOptions: (recipe: ResolvedRecipeSpec) => CompiledOptionContext[]
): CollectRecipesResult {
  const messages: string[] = [];
  const infoMessages: string[] = [];
  const visitedItems = new Set<string>();
  const selectedRecipeIds = new Set<string>();
  const autoPromotedRawInputIds = new Set<string>();
  const queue = [...targetItemIds];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const itemId = queue[queueIndex];
    queueIndex += 1;
    if (visitedItems.has(itemId) || rawInputItemIds.has(itemId) || autoPromotedRawInputIds.has(itemId)) {
      continue;
    }
    visitedItems.add(itemId);

    const allowedRecipeIds = allowedRecipeSetMap.get(itemId);
    const availableProducers = recipeOutputIndex.get(itemId) ?? [];
    const producers =
      allowedRecipeIds && allowedRecipeIds.size > 0
        ? availableProducers.filter(recipe => allowedRecipeIds.has(recipe.recipeId))
        : availableProducers;

    if (allowedRecipeIds && allowedRecipeIds.size > 0 && producers.length === 0) {
      if (autoPromoteUnavailableItemsToRawInputs) {
        autoPromotedRawInputIds.add(itemId);
        infoMessages.push(
          `Unavailable item ${itemId} (${catalog.itemMap.get(itemId)?.name ?? itemId}) was treated as an external/raw input.`
        );
      } else {
        messages.push(
          `Allowed recipes ${Array.from(allowedRecipeIds).join(', ')} for item ${itemId} do not exist.`
        );
      }
      continue;
    }

    if (
      allowedRecipeIds &&
      allowedRecipeIds.size > 0 &&
      !producers.some(recipe => recipe.outputs.some(output => output.itemId === itemId))
    ) {
      if (autoPromoteUnavailableItemsToRawInputs) {
        autoPromotedRawInputIds.add(itemId);
        infoMessages.push(
          `Unavailable item ${itemId} (${catalog.itemMap.get(itemId)?.name ?? itemId}) was treated as an external/raw input.`
        );
      } else {
        messages.push(
          `Allowed recipes ${Array.from(allowedRecipeIds).join(', ')} do not produce item ${itemId}.`
        );
      }
      continue;
    }

    const feasibleProducers = producers.filter(recipe => getCompiledRecipeOptions(recipe).length > 0);

    if (feasibleProducers.length === 0) {
      if (autoPromoteUnavailableItemsToRawInputs) {
        autoPromotedRawInputIds.add(itemId);
        infoMessages.push(
          `Unavailable item ${itemId} (${catalog.itemMap.get(itemId)?.name ?? itemId}) was treated as an external/raw input.`
        );
      }
      continue;
    }

    for (const recipe of feasibleProducers) {
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
    infoMessages,
    autoPromotedRawInputItemIds: Array.from(autoPromotedRawInputIds).sort((left, right) =>
      left.localeCompare(right)
    ),
  };
}

function serializeCompiledItemEntries(entries: readonly CompiledItemAmountEntry[]): string {
  return entries
    .map(([itemId, amount]) => `${itemId}:${amount}`)
    .join('|');
}

function buildCompiledOptionDominanceKey(option: CompiledOption): string {
  return [
    option.recipeId,
    option.proliferatorMode,
    option.proliferatorLevel,
    option.proliferatorItemId ?? '',
    serializeCompiledItemEntries(option.netItemEntries),
  ].join('::');
}

function isCompiledOptionDominated(left: CompiledOption, right: CompiledOption): boolean {
  const buildingNotWorse =
    right.buildingCostPerRunPerMin <= left.buildingCostPerRunPerMin + EPSILON;
  const powerNotWorse = right.powerCostMWPerRunPerMin <= left.powerCostMWPerRunPerMin + EPSILON;
  const buildingStrictlyBetter =
    right.buildingCostPerRunPerMin < left.buildingCostPerRunPerMin - EPSILON;
  const powerStrictlyBetter =
    right.powerCostMWPerRunPerMin < left.powerCostMWPerRunPerMin - EPSILON;

  return buildingNotWorse && powerNotWorse && (buildingStrictlyBetter || powerStrictlyBetter);
}

function pruneDominatedCompiledOptions(
  compiledOptions: CompiledOptionContext[],
  preferredBuildingId?: string
): CompiledOptionContext[] {
  if (compiledOptions.length <= 1) {
    return compiledOptions;
  }

  const groupedOptions = new Map<string, CompiledOptionContext[]>();
  for (const entry of compiledOptions) {
    const groupKey = buildCompiledOptionDominanceKey(entry.option);
    const group = groupedOptions.get(groupKey) ?? [];
    group.push(entry);
    groupedOptions.set(groupKey, group);
  }

  const prunedOptions: CompiledOptionContext[] = [];
  for (const group of groupedOptions.values()) {
    for (const candidate of group) {
      if (preferredBuildingId && candidate.option.buildingId === preferredBuildingId) {
        prunedOptions.push(candidate);
        continue;
      }

      const dominated = group.some(
        other =>
          other !== candidate &&
          (!preferredBuildingId || other.option.buildingId !== preferredBuildingId) &&
          isCompiledOptionDominated(candidate.option, other.option)
      );
      if (!dominated) {
        prunedOptions.push(candidate);
      }
    }
  }

  return prunedOptions;
}

export function getPreferredOptionPenalty(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): number {
  let penalty = 0;

  const preferredBuildingId = request.preferredBuildingByRecipe?.[recipe.recipeId];
  if (preferredBuildingId && preferredBuildingId !== option.buildingId) {
    penalty += 1;
  }

  const forcedLevel = getForcedProliferatorLevelForRecipe(request, recipe);
  const preferredLevel = request.preferredProliferatorLevelByRecipe?.[recipe.recipeId]
    ?? request.globalPreferredProliferatorLevel;
  if (preferredLevel !== undefined && forcedLevel === undefined && preferredLevel !== option.proliferatorLevel) {
    penalty += 1;
  }

  const forcedMode = getForcedProliferatorModeForRecipe(request, recipe);
  const preferredMode = request.preferredProliferatorModeByRecipe?.[recipe.recipeId];
  if (preferredMode && !forcedMode && preferredMode !== option.proliferatorMode) {
    penalty += 1;
  }

  return penalty;
}

function collectCompiledGraphItemIds(
  targetItemIds: Iterable<string>,
  resolvedRawInputItemIds: Iterable<string>,
  compiledOptions: CompiledOptionContext[]
): string[] {
  const itemIds = new Set<string>();

  for (const itemId of targetItemIds) {
    itemIds.add(itemId);
  }

  for (const itemId of resolvedRawInputItemIds) {
    itemIds.add(itemId);
  }

  for (const { option } of compiledOptions) {
    for (const itemId of option.touchedItemIds) {
      itemIds.add(itemId);
    }
  }

  return Array.from(itemIds).sort((left, right) => left.localeCompare(right));
}

export function compileSolveGraph(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  targetItemIds: string[],
  initialRawInputItemIds: Set<string>,
  disabledRecipeIds: Set<string>,
  disabledBuildingIds: Set<string>
): CompiledSolveGraph {
  const availableRecipeOutputIndex = getRecipeOutputIndexForDisabledRecipes(catalog, disabledRecipeIds);
  const diagnostics = new Set<string>();
  const infoDiagnostics = new Set<string>();
  const recipeOptionCache = new Map<string, CachedRecipeOptionCompilation>();
  const allowedRecipeSetMap = buildAllowedRecipeSetMap(request.allowedRecipesByItem);
  const getCompiledRecipeOptions = (recipe: ResolvedRecipeSpec): CompiledOptionContext[] => {
    const cached = recipeOptionCache.get(recipe.recipeId);
    if (cached) {
      return cached.options;
    }

    const messages: string[] = [];
    const options = compileRecipeOptions(catalog, recipe, request, disabledBuildingIds, messages);
    recipeOptionCache.set(recipe.recipeId, { options, messages });
    return options;
  };
  const effectiveRawInputItemIds = new Set(initialRawInputItemIds);
  let requiredItemIds = new Set(targetItemIds);
  let recipes: ResolvedRecipeSpec[] = [];
  let compiledOptions: CompiledOptionContext[] = [];
  let previousRecipeIdSet = new Set<string>();
  let previousRequiredItemIds = new Set<string>();
  let previousRawInputItemIds = new Set<string>(initialRawInputItemIds);

  const maxIterations =
    catalog.items.length + catalog.recipes.length + catalog.proliferatorLevels.length + 8;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const collected = collectUpstreamRecipes(
      catalog,
      Array.from(requiredItemIds),
      effectiveRawInputItemIds,
      availableRecipeOutputIndex,
      Boolean(request.autoPromoteUnavailableItemsToRawInputs),
      allowedRecipeSetMap,
      getCompiledRecipeOptions
    );
    collected.messages.forEach(message => diagnostics.add(message));
    collected.infoMessages.forEach(message => infoDiagnostics.add(message));
    collected.autoPromotedRawInputItemIds.forEach(itemId =>
      effectiveRawInputItemIds.add(itemId)
    );

    for (const recipe of collected.recipes) {
      const cached = recipeOptionCache.get(recipe.recipeId);
      if (!cached) {
        continue;
      }
      cached.messages.forEach(message => diagnostics.add(message));
    }
    const compiledOptionsForRecipes: CompiledOptionContext[] = [];
    for (const recipe of collected.recipes) {
      compiledOptionsForRecipes.push(...getCompiledRecipeOptions(recipe));
    }

    const auxiliaryItemIds = collectAuxiliaryInputItemIds(compiledOptionsForRecipes);
    const nextRequiredItemIds = new Set([...targetItemIds, ...auxiliaryItemIds]);
    const nextRecipeIdSet = new Set(collected.recipes.map(recipe => recipe.recipeId));

    recipes = collected.recipes;
    compiledOptions = compiledOptionsForRecipes;

    if (
      haveSameStringSet(previousRecipeIdSet, nextRecipeIdSet) &&
      haveSameStringSet(previousRequiredItemIds, nextRequiredItemIds) &&
      haveSameStringSet(previousRawInputItemIds, effectiveRawInputItemIds)
    ) {
      break;
    }

    previousRecipeIdSet = nextRecipeIdSet;
    previousRequiredItemIds = nextRequiredItemIds;
    previousRawInputItemIds = new Set(effectiveRawInputItemIds);
    requiredItemIds = nextRequiredItemIds;
  }

  return {
    itemIds: collectCompiledGraphItemIds(
      targetItemIds,
      effectiveRawInputItemIds,
      compiledOptions
    ),
    recipes,
    options: compiledOptions,
    messages: Array.from(diagnostics),
    infoMessages: Array.from(infoDiagnostics),
    resolvedRawInputItemIds: Array.from(effectiveRawInputItemIds).sort((left, right) =>
      left.localeCompare(right)
    ),
  };
}

export function isOptionFilteredByAllowedRecipes(
  allowedRecipeSetMap: ReadonlyMap<string, ReadonlySet<string>>,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): boolean {
  if (allowedRecipeSetMap.size === 0) {
    return false;
  }

  for (const [itemId, allowedRecipeIds] of allowedRecipeSetMap.entries()) {
    const netProducedAmount = (option.outputPerRun[itemId] ?? 0) - (option.inputPerRun[itemId] ?? 0);
    if (
      allowedRecipeIds.size > 0 &&
      !allowedRecipeIds.has(recipe.recipeId) &&
      netProducedAmount > EPSILON
    ) {
      return true;
    }
  }

  return false;
}

export function collectModelOptions(
  request: SolveRequest,
  compiledOptions: CompiledOptionContext[]
): CompiledOptionContext[] {
  const allowedRecipeSetMap = buildAllowedRecipeSetMap(request.allowedRecipesByItem);
  return compiledOptions.filter(
    ({ option, recipe }) => !isOptionFilteredByAllowedRecipes(allowedRecipeSetMap, recipe, option)
  );
}

export function collectInvolvedItemIds(
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
    for (const itemId of option.touchedItemIds) {
      itemIds.add(itemId);
    }
  }

  return Array.from(itemIds);
}

export function collectExternalItemIds(
  rawInputItemIds: Set<string>,
  compiledOptions: CompiledOptionContext[],
  recipeOutputIndex: Map<string, ResolvedRecipeSpec[]>
): Set<string> {
  const externalItemIds = new Set(rawInputItemIds);

  for (const { option, recipe } of compiledOptions) {
    const recipeInputIds = new Set(recipe.inputs.map(input => input.itemId));
    for (const [itemId] of option.inputEntries) {
      if (!recipeInputIds.has(itemId) && (recipeOutputIndex.get(itemId) ?? []).length === 0) {
        externalItemIds.add(itemId);
      }
    }
  }

  return externalItemIds;
}

export function countActiveRecipeIds(activeOptions: CompiledOptionContext[]): number {
  return new Set(activeOptions.map(({ recipe }) => recipe.recipeId)).size;
}
