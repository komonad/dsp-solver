import { solve as solveLinearProgram } from 'yalps';
import type { Model, Options as SolverOptions, Solution } from 'yalps';
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
  CompiledItemAmountEntry,
  CompiledOption,
  ItemBalanceEntry,
  ItemRate,
  RecipePlan,
  SolveAudit,
  SolveAuditAttempt,
  SolveResult,
} from './result';
import { recordSolverPerf } from './perf';

const EPSILON = 1e-8;
const PREFERENCE_EPSILON = 1e-3;
const OBJECTIVE_EPSILON = 1e-6;
const SECONDARY_EPSILON = 1e-9;
const EXTERNAL_INPUT_ACTIVITY_EPSILON = 1e-9;
const SURPLUS_OUTPUT_EPSILON = 1e-3;
const ALLOW_SURPLUS_SYNC_BUDGET_MS = 200;
const ALLOW_SURPLUS_MAX_LINEAR_SOLVES = 5;
const ALLOW_SURPLUS_REWEIGHT_MAX_FACTOR = 256;
const ALLOW_SURPLUS_REWEIGHT_MAX_EXPONENT = 4;
const COMPLEXITY_LINK_BOUND_FLOOR = 64;
const COMPLEXITY_LINK_BOUND_MULTIPLIERS = [1, 4, 16, 64, 256];
const SURPLUS_MILP_TIMEOUT_MS = 500;
const SURPLUS_MILP_TOLERANCE = 0.10;
const VALID_PROLIFERATOR_MODES: ProliferatorMode[] = ['none', 'speed', 'productivity'];

interface ValidateResult {
  valid: boolean;
  messages: string[];
}

interface CompiledOptionContext {
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

interface CompiledSolveGraph {
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

interface CatalogSolveCache {
  anyRecipeOutputIndex: Map<string, ResolvedRecipeSpec[]>;
  recipeOutputIndexByDisabledSetKey: Map<string, Map<string, ResolvedRecipeSpec[]>>;
  staticRecipeOptionCompilations: Map<string, StaticRecipeOptionCompilation>;
  solvedRequestResults: Map<string, SolveResult>;
}

interface SurplusSolutionMetrics {
  activeItemIds: string[];
  itemRateMap: Map<string, number>;
  totalRatePerMin: number;
}

interface LinearSolveCandidate {
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  solution: Solution<string>;
  surplus: SurplusSolutionMetrics;
  primaryObjectiveValue: number;
}

const MAX_SOLVED_REQUEST_CACHE_SIZE = 48;
const catalogSolveCaches = new WeakMap<ResolvedCatalogModel, CatalogSolveCache>();

function currentTimeMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
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

function validateRecipeArrayRecordMap(
  catalog: ResolvedCatalogModel,
  record: Record<string, string[]> | undefined,
  recordName: string,
  validator: (catalog: ResolvedCatalogModel, key: string, value: string) => boolean
): string[] {
  if (!record) {
    return [];
  }

  return Object.entries(record).flatMap(([key, values]) =>
    values
      .filter(value => !validator(catalog, key, value))
      .map(value => `${recordName} contains an invalid entry: ${key} -> ${value}.`)
  );
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
    ...validateRecipeArrayRecordMap(
      catalog,
      request.allowedRecipesByItem,
      'allowedRecipesByItem',
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

  if (
    request.globalForcedProliferatorLevel !== undefined &&
    !(
      request.globalForcedProliferatorLevel >= 0 &&
      Number.isInteger(request.globalForcedProliferatorLevel) &&
      (request.globalForcedProliferatorLevel === 0 ||
        catalog.proliferatorLevelMap.has(request.globalForcedProliferatorLevel))
    )
  ) {
    messages.push('globalForcedProliferatorLevel must be 0 or a known proliferator level.');
  }

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

  if (
    request.globalForcedProliferatorMode !== undefined &&
    !VALID_PROLIFERATOR_MODES.includes(request.globalForcedProliferatorMode)
  ) {
    messages.push('globalForcedProliferatorMode must be none, speed, or productivity.');
  }

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

function getForcedProliferatorModeForRecipe(
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

function getForcedProliferatorLevelForRecipe(
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

function haveSameStringSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
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

function buildAllowedRecipeSetMap(
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

function stableSerialize(value: unknown): string {
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

function getCatalogSolveCache(catalog: ResolvedCatalogModel): CatalogSolveCache {
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

function getRecipeOutputIndexForDisabledRecipes(
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
      option: buildNoneVariant(recipe, building),
      recipe,
      building,
    });

    for (const level of catalog.proliferatorLevels) {
      if (level.level === 0 || level.level > recipe.maxProliferatorLevel) {
        continue;
      }

      if (recipe.supportsProliferatorModes.includes('speed')) {
        options.push({
          option: buildProliferatorVariant(recipe, building, level, 'speed'),
          recipe,
          building,
        });
      }

      if (recipe.supportsProliferatorModes.includes('productivity')) {
        options.push({
          option: buildProliferatorVariant(recipe, building, level, 'productivity'),
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

function getSolvedRequestCacheKey(request: SolveRequest): string {
  return stableSerialize(request);
}

function getCachedSolvedRequestResult(
  catalog: ResolvedCatalogModel,
  request: SolveRequest
): SolveResult | null {
  const cache = getCatalogSolveCache(catalog);
  const requestKey = getSolvedRequestCacheKey(request);
  const cached = cache.solvedRequestResults.get(requestKey);
  if (!cached) {
    return null;
  }

  cache.solvedRequestResults.delete(requestKey);
  cache.solvedRequestResults.set(requestKey, cached);
  return cached;
}

function setCachedSolvedRequestResult(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  result: SolveResult
): void {
  const cache = getCatalogSolveCache(catalog);
  const requestKey = getSolvedRequestCacheKey(request);
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

function collectResolvableAuxiliaryItemIds(
  compiledOptions: CompiledOptionContext[],
  recipeOutputIndex: Map<string, ResolvedRecipeSpec[]>
): string[] {
  const auxiliaryItemIds = new Set<string>();

  for (const { option } of compiledOptions) {
    const proliferatorItemId = option.proliferatorItemId;
    if (!proliferatorItemId) {
      continue;
    }

    if ((recipeOutputIndex.get(proliferatorItemId) ?? []).length === 0) {
      continue;
    }

    auxiliaryItemIds.add(proliferatorItemId);
  }

  return Array.from(auxiliaryItemIds).sort((left, right) => left.localeCompare(right));
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

  const compiledOptions = staticCompilation.options.filter(
    ({ option }) =>
      allowedBuildingIdSet.has(option.buildingId) && isOptionAllowedByForce(option, recipe, request)
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

function compileSolveGraph(
  catalog: ResolvedCatalogModel,
  request: SolveRequest,
  targetItemIds: string[],
  initialRawInputItemIds: Set<string>,
  disabledRecipeIds: Set<string>,
  disabledBuildingIds: Set<string>
): CompiledSolveGraph {
  const catalogSolveCache = getCatalogSolveCache(catalog);
  const availableRecipeOutputIndex = getRecipeOutputIndexForDisabledRecipes(catalog, disabledRecipeIds);
  const anyRecipeOutputIndex = catalogSolveCache.anyRecipeOutputIndex;
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

    const auxiliaryItemIds = collectResolvableAuxiliaryItemIds(
      compiledOptionsForRecipes,
      anyRecipeOutputIndex
    );
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

function createProliferatorItemId(level: ResolvedProliferatorLevelSpec): string {
  return level.itemId ?? `__proliferator_level_${level.level}`;
}

function getPreferredOptionPenalty(
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
  const preferredLevel = request.preferredProliferatorLevelByRecipe?.[recipe.recipeId];
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

function buildObjectiveCoefficient(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): number {
  const preferencePenalty = getPreferredOptionPenalty(request, recipe, option);

  if (request.objective === 'min_buildings') {
    return (
      preferencePenalty * PREFERENCE_EPSILON +
      option.buildingCostPerRunPerMin * OBJECTIVE_EPSILON +
      option.powerCostMWPerRunPerMin * SECONDARY_EPSILON
    );
  }

  if (request.objective === 'min_power') {
    return (
      preferencePenalty * PREFERENCE_EPSILON +
      option.powerCostMWPerRunPerMin * OBJECTIVE_EPSILON +
      option.buildingCostPerRunPerMin * SECONDARY_EPSILON
    );
  }

  return (
    preferencePenalty * PREFERENCE_EPSILON +
    EXTERNAL_INPUT_ACTIVITY_EPSILON +
    option.buildingCostPerRunPerMin * SECONDARY_EPSILON +
    option.powerCostMWPerRunPerMin * SECONDARY_EPSILON * SECONDARY_EPSILON
  );
}

function buildExternalInputObjectiveCoefficient(request: SolveRequest): number {
  if (request.objective !== 'min_external_input') {
    return 0;
  }

  return request.balancePolicy === 'allow_surplus' ? OBJECTIVE_EPSILON : 1;
}

function buildComplexityPowerCoefficient(
  request: SolveRequest,
  recipe: ResolvedRecipeSpec,
  option: CompiledOption
): number {
  const preferencePenalty = getPreferredOptionPenalty(request, recipe, option);

  return (
    option.powerCostMWPerRunPerMin +
    preferencePenalty * SECONDARY_EPSILON +
    option.buildingCostPerRunPerMin * SECONDARY_EPSILON * SECONDARY_EPSILON
  );
}

function isOptionFilteredByAllowedRecipes(
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

function collectModelOptions(
  request: SolveRequest,
  compiledOptions: CompiledOptionContext[]
): CompiledOptionContext[] {
  const allowedRecipeSetMap = buildAllowedRecipeSetMap(request.allowedRecipesByItem);
  return compiledOptions.filter(
    ({ option, recipe }) => !isOptionFilteredByAllowedRecipes(allowedRecipeSetMap, recipe, option)
  );
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
  building: ResolvedBuildingSpec
): CompiledOption {
  const singleBuildingRunsPerMin = buildSingleBuildingBaseRunsPerMin(recipe, building);
  const outputPerRun = buildOutputPerRun(recipe, building);
  const inputPerRun = buildInputPerRun(recipe);

  return finalizeCompiledOption({
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
  });
}

function buildProliferatorVariant(
  recipe: ResolvedRecipeSpec,
  building: ResolvedBuildingSpec,
  level: ResolvedProliferatorLevelSpec,
  mode: Exclude<ProliferatorMode, 'none'>
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
    buildingCostPerRunPerMin: 1 / singleBuildingRunsPerMin,
    powerCostMWPerRunPerMin:
      (building.workPowerMW * powerMultiplier) / singleBuildingRunsPerMin,
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
    for (const itemId of option.touchedItemIds) {
      itemIds.add(itemId);
    }
  }

  return Array.from(itemIds);
}

function buildSurplusVariableName(itemId: string): string {
  return `__surplus:${itemId}`;
}

function buildExactItemBalanceConstraints(
  involvedItemIds: string[],
  targetRateMap: Map<string, number>
): Record<string, { equal?: number; min?: number; max?: number }> {
  const constraints: Record<string, { equal?: number; min?: number; max?: number }> = {};

  for (const itemId of involvedItemIds) {
    constraints[itemId] = { equal: targetRateMap.get(itemId) ?? 0 };
  }

  return constraints;
}

function ensureVariableCoefficients(
  variables: Record<string, Record<string, number>>,
  variableName: string
): Record<string, number> {
  const existing = variables[variableName];
  if (existing) {
    return existing;
  }

  const created: Record<string, number> = {};
  variables[variableName] = created;
  return created;
}

function addVariableCoefficient(
  variables: Record<string, Record<string, number>>,
  variableName: string,
  coefficientName: string,
  amount: number
): void {
  const coefficients = ensureVariableCoefficients(variables, variableName);
  coefficients[coefficientName] = (coefficients[coefficientName] ?? 0) + amount;
}

function buildComplexityUsageVariableName(
  kind: 'recipe' | 'building' | 'item',
  id: string
): string {
  return `__use:${kind}:${id}`;
}

function isComplexityUsageVariable(variableName: string): boolean {
  return variableName.startsWith('__use:');
}

function collectComplexityTrackedItemIds(
  catalog: ResolvedCatalogModel,
  compiledOptions: CompiledOptionContext[],
  externalItemIds: Set<string>
): string[] {
  const itemIds = new Set<string>();

  for (const { option } of compiledOptions) {
    for (const itemId of option.touchedItemIds) {
      if (catalog.itemMap.has(itemId)) {
        itemIds.add(itemId);
      }
    }
  }

  for (const itemId of externalItemIds) {
    if (catalog.itemMap.has(itemId)) {
      itemIds.add(itemId);
    }
  }

  return Array.from(itemIds).sort((left, right) => left.localeCompare(right));
}

function estimateComplexityLinkUpperBound(
  solutionVariables: Iterable<[string, number]>,
  targetRateMap: Map<string, number>
): number {
  let totalSolvedRate = 0;
  let maxSolvedRate = 0;

  for (const [variableName, value] of solutionVariables) {
    if (value <= EPSILON || isComplexityUsageVariable(variableName)) {
      continue;
    }

    totalSolvedRate += value;
    maxSolvedRate = Math.max(maxSolvedRate, value);
  }

  const targetRates = Array.from(targetRateMap.values()).filter(rate => rate > EPSILON);
  const totalTargetRate = targetRates.reduce((sum, rate) => sum + rate, 0);
  const maxTargetRate = targetRates.reduce((maxRate, rate) => Math.max(maxRate, rate), 0);

  return Math.max(
    COMPLEXITY_LINK_BOUND_FLOOR,
    totalSolvedRate * 2,
    maxSolvedRate * 8,
    totalTargetRate * 8,
    maxTargetRate * 16
  );
}

function collectExternalItemIds(
  rawInputItemIds: Set<string>,
  compiledOptions: CompiledOptionContext[],
  recipeOutputIndex: Map<string, ResolvedRecipeSpec[]>
): Set<string> {
  const externalItemIds = new Set(rawInputItemIds);

  for (const { option } of compiledOptions) {
    if (option.proliferatorMode === 'none') {
      continue;
    }

    const proliferatorItemId =
      option.proliferatorItemId ?? `__proliferator_level_${option.proliferatorLevel}`;
    if ((recipeOutputIndex.get(proliferatorItemId) ?? []).length === 0) {
      externalItemIds.add(proliferatorItemId);
    }
  }

  return externalItemIds;
}

function countActiveRecipeIds(activeOptions: CompiledOptionContext[]): number {
  return new Set(activeOptions.map(({ recipe }) => recipe.recipeId)).size;
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

function buildEmptySolveAudit(): SolveAudit {
  return {
    prunedItemCount: 0,
    prunedRecipeCount: 0,
    prunedOptionCount: 0,
    resolvedRawInputCount: 0,
    graphDurationMs: 0,
    modelDurationMs: 0,
    solveDurationMs: 0,
    resultDurationMs: 0,
    totalDurationMs: 0,
    attempts: [],
  };
}

function buildSolveAuditAttempt(params: {
  phase: SolveAuditAttempt['phase'];
  round?: number;
  modelKind: SolveAuditAttempt['modelKind'];
  itemCount: number;
  recipeCount: number;
  optionCount: number;
  constraintCount: number;
  variableCount: number;
  binaryCount?: number;
  buildDurationMs: number;
  solveDurationMs: number;
  status: string;
  surplusItemCount?: number;
  surplusRatePerMin?: number;
  primaryObjectiveValue?: number;
  surplusWeights?: ReadonlyMap<string, number>;
  isBestCandidate?: boolean;
  stagnantRounds?: number;
}): SolveAuditAttempt {
  const {
    phase,
    round,
    modelKind,
    itemCount,
    recipeCount,
    optionCount,
    constraintCount,
    variableCount,
    binaryCount,
    buildDurationMs,
    solveDurationMs,
    status,
    surplusItemCount,
    surplusRatePerMin,
    primaryObjectiveValue,
    surplusWeights,
    isBestCandidate,
    stagnantRounds,
  } = params;

  return {
    phase,
    round,
    modelKind,
    itemCount,
    recipeCount,
    optionCount,
    constraintCount,
    variableCount,
    binaryCount,
    buildDurationMs,
    solveDurationMs,
    totalDurationMs: buildDurationMs + solveDurationMs,
    status,
    surplusItemCount,
    surplusRatePerMin,
    primaryObjectiveValue,
    surplusWeights: surplusWeights ? Object.fromEntries(surplusWeights) : undefined,
    isBestCandidate,
    stagnantRounds,
  };
}

function buildLinearModel(
  request: SolveRequest,
  compiledOptions: CompiledOptionContext[],
  targetRateMap: Map<string, number>,
  externalItemIds: Set<string>,
  surplusWeights?: ReadonlyMap<string, number>
): {
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  involvedItemCount: number;
  activeRecipeCount: number;
} {
  const activeOptions = collectModelOptions(request, compiledOptions);
  const involvedItemIds = collectInvolvedItemIds(activeOptions, targetRateMap, externalItemIds);
  const constraints = buildExactItemBalanceConstraints(involvedItemIds, targetRateMap);
  const variables: Record<string, Record<string, number>> = {};

  for (const { option, recipe } of activeOptions) {
    const coefficients: Record<string, number> = {
      __objective__: buildObjectiveCoefficient(request, recipe, option),
    };

    for (const [itemId, amount] of option.netItemEntries) {
      coefficients[itemId] = amount;
    }

    variables[option.optionId] = coefficients;
  }

  for (const itemId of externalItemIds) {
    variables[`ext:${itemId}`] = {
      [itemId]: 1,
      __objective__: buildExternalInputObjectiveCoefficient(request),
    };
  }

  if (request.balancePolicy === 'allow_surplus') {
    for (const itemId of involvedItemIds) {
      variables[buildSurplusVariableName(itemId)] = {
        [itemId]: -1,
        __objective__: surplusWeights?.get(itemId) ?? 1,
      };
    }
  }

  return {
    model: {
      direction: 'minimize',
      objective: '__objective__',
      constraints,
      variables,
    },
    activeOptions,
    involvedItemCount: involvedItemIds.length,
    activeRecipeCount: countActiveRecipeIds(activeOptions),
  };
}

function buildComplexityModel(params: {
  catalog: ResolvedCatalogModel;
  request: SolveRequest;
  compiledOptions: CompiledOptionContext[];
  targetRateMap: Map<string, number>;
  externalItemIds: Set<string>;
  linkUpperBound: number;
}): {
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  involvedItemCount: number;
  activeRecipeCount: number;
} {
  const {
    catalog,
    request,
    compiledOptions,
    targetRateMap,
    externalItemIds,
    linkUpperBound,
  } = params;
  const activeOptions = collectModelOptions(request, compiledOptions);
  const involvedItemIds = collectInvolvedItemIds(activeOptions, targetRateMap, externalItemIds);
  const constraints = buildExactItemBalanceConstraints(involvedItemIds, targetRateMap);
  const variables: Record<string, Record<string, number>> = {};
  const binaries = new Set<string>();
  const totalPowerCoefficient = activeOptions.reduce(
    (sum, { option, recipe }) => sum + buildComplexityPowerCoefficient(request, recipe, option),
    0
  );
  const powerTieBreakScale =
    totalPowerCoefficient > 0
      ? 0.5 / (linkUpperBound * totalPowerCoefficient + 1)
      : 0;

  for (const { option, recipe } of activeOptions) {
    const scaledPowerCoefficient =
      buildComplexityPowerCoefficient(request, recipe, option) * powerTieBreakScale;
    const coefficients: Record<string, number> = {
      __complexity__: scaledPowerCoefficient,
    };

    for (const [itemId, amount] of option.netItemEntries) {
      coefficients[itemId] = amount;
    }

    variables[option.optionId] = coefficients;
  }

  for (const itemId of externalItemIds) {
    variables[`ext:${itemId}`] = {
      [itemId]: 1,
    };
  }

  if (request.balancePolicy === 'allow_surplus') {
    for (const itemId of involvedItemIds) {
      variables[buildSurplusVariableName(itemId)] = {
        [itemId]: -1,
        __complexity__: powerTieBreakScale * OBJECTIVE_EPSILON,
      };
    }
  }

  const ensureUsageVariable = (variableName: string) => {
    const coefficients = ensureVariableCoefficients(variables, variableName);
    coefficients.__complexity__ = 1;
    binaries.add(variableName);
  };

  const recipeUsageMap = new Map<string, string[]>();
  const buildingUsageMap = new Map<string, string[]>();
  const itemUsageMap = new Map<string, string[]>();

  for (const { option, recipe } of activeOptions) {
    const recipeOptionIds = recipeUsageMap.get(recipe.recipeId) ?? [];
    recipeOptionIds.push(option.optionId);
    recipeUsageMap.set(recipe.recipeId, recipeOptionIds);

    const buildingOptionIds = buildingUsageMap.get(option.buildingId) ?? [];
    buildingOptionIds.push(option.optionId);
    buildingUsageMap.set(option.buildingId, buildingOptionIds);

    const touchedItemIds = new Set<string>();
    for (const itemId of option.touchedItemIds) {
      if (catalog.itemMap.has(itemId)) {
        touchedItemIds.add(itemId);
      }
    }
    for (const itemId of touchedItemIds) {
      const itemVariableIds = itemUsageMap.get(itemId) ?? [];
      itemVariableIds.push(option.optionId);
      itemUsageMap.set(itemId, itemVariableIds);
    }
  }

  for (const itemId of collectComplexityTrackedItemIds(catalog, activeOptions, externalItemIds)) {
    const itemVariableIds = itemUsageMap.get(itemId) ?? [];
    if (externalItemIds.has(itemId)) {
      itemVariableIds.push(`ext:${itemId}`);
    }
    itemUsageMap.set(itemId, itemVariableIds);
  }

  for (const [recipeId, optionIds] of recipeUsageMap.entries()) {
    const constraintName = `__complexity_link:recipe:${recipeId}`;
    constraints[constraintName] = { max: 0 };
    for (const optionId of optionIds) {
      addVariableCoefficient(variables, optionId, constraintName, 1);
    }
    const usageVariable = buildComplexityUsageVariableName('recipe', recipeId);
    ensureUsageVariable(usageVariable);
    addVariableCoefficient(variables, usageVariable, constraintName, -linkUpperBound);
  }

  for (const [buildingId, optionIds] of buildingUsageMap.entries()) {
    const constraintName = `__complexity_link:building:${buildingId}`;
    constraints[constraintName] = { max: 0 };
    for (const optionId of optionIds) {
      addVariableCoefficient(variables, optionId, constraintName, 1);
    }
    const usageVariable = buildComplexityUsageVariableName('building', buildingId);
    ensureUsageVariable(usageVariable);
    addVariableCoefficient(variables, usageVariable, constraintName, -linkUpperBound);
  }

  for (const [itemId, variableIds] of itemUsageMap.entries()) {
    if (variableIds.length === 0) {
      continue;
    }

    const constraintName = `__complexity_link:item:${itemId}`;
    constraints[constraintName] = { max: 0 };
    for (const variableId of variableIds) {
      addVariableCoefficient(variables, variableId, constraintName, 1);
    }
    const usageVariable = buildComplexityUsageVariableName('item', itemId);
    ensureUsageVariable(usageVariable);
    addVariableCoefficient(variables, usageVariable, constraintName, -linkUpperBound);
  }

  return {
    model: {
      direction: 'minimize',
      objective: '__complexity__',
      constraints,
      variables,
      binaries,
    },
    activeOptions,
    involvedItemCount: involvedItemIds.length,
    activeRecipeCount: countActiveRecipeIds(activeOptions),
  };
}

/** Weight for recipe-usage binary indicators in the surplus-type MILP.
 *  Surplus type indicators have weight 1 (integer), so recipe count is a
 *  secondary tiebreaker: 100 recipes = 1 surplus type.  Typical recipe
 *  counts are < 50, so surplus type count always dominates. */
const SURPLUS_MILP_RECIPE_WEIGHT = 1e-2;

/** Weight for LP-inactive recipe indicators.  Much higher than
 *  `SURPLUS_MILP_RECIPE_WEIGHT` so the MILP only introduces a recipe that
 *  was not used in the LP when it substantially reduces surplus type count.
 *  At weight 0.5, the MILP needs to save at least 1 surplus type to justify
 *  introducing 2 new recipes. */
const SURPLUS_MILP_NEW_RECIPE_WEIGHT = 0.5;

function buildSurplusTypeMilpModel(params: {
  request: SolveRequest;
  compiledOptions: CompiledOptionContext[];
  targetRateMap: Map<string, number>;
  externalItemIds: Set<string>;
  surplusUpperBound: number;
  recipeLinkUpperBound: number;
  /** Option IDs with non-zero rates in the LP solution — only recipes
   *  that are actually used get binary indicators, dramatically reducing
   *  the number of binaries for the branch-and-bound solver. */
  activeOptionIds: ReadonlySet<string>;
  /** Item IDs that could potentially accumulate surplus if the MILP
   *  changes recipe usage.  Includes LP surplus items plus all output
   *  items of LP-active recipes. */
  surplusCandidateItemIds: ReadonlySet<string>;
}): {
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  involvedItemCount: number;
  activeRecipeCount: number;
  binaryCount: number;
} {
  const {
    request,
    compiledOptions,
    targetRateMap,
    externalItemIds,
    surplusUpperBound,
    recipeLinkUpperBound,
    activeOptionIds,
    surplusCandidateItemIds,
  } = params;

  const activeOptions = collectModelOptions(request, compiledOptions);
  const involvedItemIds = collectInvolvedItemIds(activeOptions, targetRateMap, externalItemIds);
  const constraints = buildExactItemBalanceConstraints(involvedItemIds, targetRateMap);
  const variables: Record<string, Record<string, number>> = {};
  const binaries = new Set<string>();

  // Build recipe → option mapping for recipe-usage linking constraints.
  const recipeUsageMap = new Map<string, string[]>();

  // For each item, collect the set of recipes that produce it (positive net
  // output) and whether any recipe consumes it.  Used to identify:
  // (a) items that can never have surplus (no producer exists)
  // (b) required recipes (sole producer of a consumed/target item)
  const itemProducerRecipes = new Map<string, Set<string>>();
  const itemIsConsumed = new Set<string>();

  for (const { option, recipe } of activeOptions) {
    const coefficients: Record<string, number> = {
      __objective__: buildObjectiveCoefficient(request, recipe, option),
    };
    for (const [itemId, amount] of option.netItemEntries) {
      coefficients[itemId] = amount;
      if (amount > EPSILON) {
        let producers = itemProducerRecipes.get(itemId);
        if (!producers) {
          producers = new Set();
          itemProducerRecipes.set(itemId, producers);
        }
        producers.add(recipe.recipeId);
      } else if (amount < -EPSILON) {
        itemIsConsumed.add(itemId);
      }
    }
    variables[option.optionId] = coefficients;

    const optionIds = recipeUsageMap.get(recipe.recipeId) ?? [];
    optionIds.push(option.optionId);
    recipeUsageMap.set(recipe.recipeId, optionIds);
  }

  // A recipe is required if it is the sole producer of any item that must
  // be produced (target item or consumed by another recipe).  Its binary
  // indicator can be fixed to 1 (i.e. omitted), reducing the MILP search
  // space without changing the feasible set.
  const requiredRecipeIds = new Set<string>();
  for (const itemId of involvedItemIds) {
    const producers = itemProducerRecipes.get(itemId);
    if (!producers || producers.size !== 1) {
      continue;
    }
    const isTarget = (targetRateMap.get(itemId) ?? 0) > EPSILON;
    if (isTarget || itemIsConsumed.has(itemId)) {
      requiredRecipeIds.add(producers.values().next().value!);
    }
  }

  // Items that have no producing recipe can never accumulate surplus —
  // their surplus variable will always be zero.  Skip their binary
  // indicator to shrink the MILP.
  //
  // Additionally, if ALL recipes that touch an item (produce or consume)
  // are required, the MILP cannot change that item's supply/demand balance,
  // so it can never gain surplus either.
  const itemConsumerRecipes = new Map<string, Set<string>>();
  for (const { option, recipe } of activeOptions) {
    for (const [itemId, amount] of option.netItemEntries) {
      if (amount < -EPSILON) {
        let consumers = itemConsumerRecipes.get(itemId);
        if (!consumers) {
          consumers = new Set();
          itemConsumerRecipes.set(itemId, consumers);
        }
        consumers.add(recipe.recipeId);
      }
    }
  }

  const itemCanHaveSurplus = new Set<string>();
  for (const itemId of involvedItemIds) {
    const producers = itemProducerRecipes.get(itemId);
    if (!producers) {
      continue; // no producer → surplus always 0
    }
    // Check if any producer or consumer is non-required (i.e. the MILP
    // could toggle it, potentially disrupting this item's balance).
    let hasToggleableRecipe = false;
    for (const recipeId of producers) {
      if (!requiredRecipeIds.has(recipeId)) {
        hasToggleableRecipe = true;
        break;
      }
    }
    if (!hasToggleableRecipe) {
      const consumers = itemConsumerRecipes.get(itemId);
      if (consumers) {
        for (const recipeId of consumers) {
          if (!requiredRecipeIds.has(recipeId)) {
            hasToggleableRecipe = true;
            break;
          }
        }
      }
    }
    if (hasToggleableRecipe) {
      itemCanHaveSurplus.add(itemId);
    }
  }

  for (const itemId of externalItemIds) {
    variables[`ext:${itemId}`] = {
      [itemId]: 1,
      __objective__: buildExternalInputObjectiveCoefficient(request),
    };
  }

  for (const itemId of involvedItemIds) {
    const linkConstraint = `__surplus_type_link:${itemId}`;
    constraints[linkConstraint] = { min: 0 };

    // Surplus variable: absorbs excess production, no direct objective cost.
    variables[buildSurplusVariableName(itemId)] = {
      [itemId]: -1,
      [linkConstraint]: -1,
    };

    // Binary indicator: y_i = 1 iff item i has any surplus.
    // Only add for items that (a) have a producing recipe and (b) had
    // non-zero surplus in the LP solution.  Other items can still
    // accumulate surplus via the continuous variable, but won't incur
    // the binary indicator cost in the MILP objective.
    if (itemCanHaveSurplus.has(itemId) && surplusCandidateItemIds.has(itemId)) {
      const indicatorName = `__surplus_type:${itemId}`;
      variables[indicatorName] = {
        [linkConstraint]: surplusUpperBound,
        __objective__: 1,
      };
      binaries.add(indicatorName);
    }
  }

  // Recipe-usage binary indicators: penalise the number of distinct recipes
  // used.  This prevents the solver from adding entire production chains
  // (e.g. bio-chain) solely to consume a small byproduct surplus.
  // LP-active recipes get a light penalty (SURPLUS_MILP_RECIPE_WEIGHT) since
  // they are already part of the solution.  LP-inactive recipes get a much
  // heavier penalty (SURPLUS_MILP_NEW_RECIPE_WEIGHT) so the MILP only
  // introduces them when doing so substantially reduces surplus type count.
  // Required recipes (sole producer of some needed item) are skipped — their
  // binary would always be 1, wasting branch-and-bound effort.
  for (const [recipeId, optionIds] of recipeUsageMap.entries()) {
    if (requiredRecipeIds.has(recipeId)) {
      continue;
    }
    const hasActiveOption = optionIds.some(id => activeOptionIds.has(id));
    const weight = hasActiveOption
      ? SURPLUS_MILP_RECIPE_WEIGHT
      : SURPLUS_MILP_NEW_RECIPE_WEIGHT;
    const constraintName = `__surplus_recipe_link:${recipeId}`;
    constraints[constraintName] = { max: 0 };
    for (const optionId of optionIds) {
      addVariableCoefficient(variables, optionId, constraintName, 1);
    }
    const usageVariable = `__surplus_recipe:${recipeId}`;
    const coefficients = ensureVariableCoefficients(variables, usageVariable);
    coefficients.__objective__ = weight;
    binaries.add(usageVariable);
    addVariableCoefficient(variables, usageVariable, constraintName, -recipeLinkUpperBound);
  }

  return {
    model: {
      direction: 'minimize',
      objective: '__objective__',
      constraints,
      variables,
      binaries,
    },
    activeOptions,
    involvedItemCount: involvedItemIds.length,
    activeRecipeCount: countActiveRecipeIds(activeOptions),
    binaryCount: binaries.size,
  };
}

function estimateSurplusUpperBound(
  solutionVariables: Iterable<[string, number]>,
  targetRateMap: Map<string, number>
): number {
  let totalRate = 0;
  let maxRate = 0;

  for (const [variableName, value] of solutionVariables) {
    if (value <= EPSILON || variableName.startsWith('__')) {
      continue;
    }
    totalRate += value;
    maxRate = Math.max(maxRate, value);
  }

  const totalTargetRate = Array.from(targetRateMap.values())
    .filter(rate => rate > EPSILON)
    .reduce((sum, rate) => sum + rate, 0);

  return Math.max(COMPLEXITY_LINK_BOUND_FLOOR, totalRate * 2, maxRate * 8, totalTargetRate * 8);
}

/** Estimate a tight big-M for recipe-usage linking constraints.
 *  Only needs to bound the maximum rate of any single option variable —
 *  much smaller than the surplus upper bound. */
function estimateRecipeLinkUpperBound(
  solutionVariables: Iterable<[string, number]>
): number {
  let maxRate = 0;
  for (const [variableName, value] of solutionVariables) {
    if (value <= EPSILON || variableName.startsWith('__')) {
      continue;
    }
    maxRate = Math.max(maxRate, value);
  }
  // Use 4× the max observed option rate as headroom for the MILP to
  // explore alternative recipe combinations.
  return Math.max(COMPLEXITY_LINK_BOUND_FLOOR, maxRate * 4);
}

function roundUpCount(value: number): number {
  if (value <= EPSILON) {
    return 0;
  }

  return Math.ceil(value - EPSILON);
}

function sortItemRates(itemRates: Map<string, number>): ItemRate[] {
  return Array.from(itemRates.entries())
    .filter(([, rate]) => Math.abs(rate) > SURPLUS_OUTPUT_EPSILON)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([itemId, ratePerMin]) => ({
      itemId,
      ratePerMin,
    }));
}

function collectSurplusSolutionMetrics(
  solutionVariables: Iterable<[string, number]>
): SurplusSolutionMetrics {
  const itemRateMap = new Map<string, number>();
  let totalRatePerMin = 0;

  for (const [variableName, value] of solutionVariables) {
    if (!variableName.startsWith('__surplus:') || value <= SURPLUS_OUTPUT_EPSILON) {
      continue;
    }

    const itemId = variableName.slice('__surplus:'.length);
    itemRateMap.set(itemId, value);
    totalRatePerMin += value;
  }

  return {
    activeItemIds: Array.from(itemRateMap.keys()).sort((left, right) => left.localeCompare(right)),
    itemRateMap,
    totalRatePerMin,
  };
}

function buildPrimaryObjectiveValue(
  request: SolveRequest,
  activeOptions: CompiledOptionContext[],
  solutionVariables: Iterable<[string, number]>
): number {
  const optionById = new Map(activeOptions.map(entry => [entry.option.optionId, entry.option]));
  let total = 0;

  for (const [variableName, value] of solutionVariables) {
    if (value <= EPSILON) {
      continue;
    }

    if (variableName.startsWith('ext:')) {
      if (request.objective === 'min_external_input') {
        total += value;
      }
      continue;
    }

    const option = optionById.get(variableName);
    if (!option) {
      continue;
    }

    if (request.objective === 'min_buildings') {
      total += option.buildingCostPerRunPerMin * value;
    } else if (request.objective === 'min_power') {
      total += option.powerCostMWPerRunPerMin * value;
    }
  }

  return total;
}

function compareLinearSolveCandidates(left: LinearSolveCandidate, right: LinearSolveCandidate): number {
  if (left.surplus.activeItemIds.length !== right.surplus.activeItemIds.length) {
    return left.surplus.activeItemIds.length - right.surplus.activeItemIds.length;
  }

  if (
    Math.abs(left.surplus.totalRatePerMin - right.surplus.totalRatePerMin) > SURPLUS_OUTPUT_EPSILON
  ) {
    return left.surplus.totalRatePerMin - right.surplus.totalRatePerMin;
  }

  if (Math.abs(left.primaryObjectiveValue - right.primaryObjectiveValue) > OBJECTIVE_EPSILON) {
    return left.primaryObjectiveValue - right.primaryObjectiveValue;
  }

  return 0;
}

function buildReweightedSurplusWeights(
  metrics: SurplusSolutionMetrics,
  round: number
): ReadonlyMap<string, number> | undefined {
  if (metrics.activeItemIds.length <= 1 || metrics.totalRatePerMin <= SURPLUS_OUTPUT_EPSILON) {
    return undefined;
  }

  const exponent = Math.min(ALLOW_SURPLUS_REWEIGHT_MAX_EXPONENT, 2 + round);
  const weights = new Map<string, number>();
  for (const itemId of metrics.activeItemIds) {
    const rate = metrics.itemRateMap.get(itemId) ?? 0;
    const baseWeight = metrics.totalRatePerMin / Math.max(rate, EPSILON);
    weights.set(
      itemId,
      Math.max(
        1,
        Math.min(ALLOW_SURPLUS_REWEIGHT_MAX_FACTOR, Math.pow(baseWeight, exponent))
      )
    );
  }
  return weights;
}

function buildLinearSolveCandidate(params: {
  request: SolveRequest;
  model: Model<string, string>;
  activeOptions: CompiledOptionContext[];
  solution: Solution<string>;
}): LinearSolveCandidate {
  const { request, model, activeOptions, solution } = params;
  return {
    model,
    activeOptions,
    solution,
    surplus: collectSurplusSolutionMetrics(solution.variables),
    primaryObjectiveValue: buildPrimaryObjectiveValue(request, activeOptions, solution.variables),
  };
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

  return unmet;
}

function buildInfeasibleSolveResult(params: {
  targetRateMap: Map<string, number>;
  resolvedRawInputItemIds: string[];
  diagnostics: string[];
  infoMessages: string[];
  solveAudit?: SolveAudit;
}): SolveResult {
  const {
    targetRateMap,
    resolvedRawInputItemIds,
    diagnostics,
    infoMessages,
    solveAudit,
  } = params;

  return {
    status: 'infeasible',
    diagnostics: {
      messages: diagnostics,
      infoMessages,
      unmetPreferences: [],
    },
    solveAudit: solveAudit ?? buildEmptySolveAudit(),
    resolvedRawInputItemIds,
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

function buildResultFromSolution(params: {
  request: SolveRequest;
  targetRateMap: Map<string, number>;
  compiledOptions: CompiledOptionContext[];
  solutionVariables: Map<string, number>;
  resolvedRawInputItemIds: string[];
}): SolveResult {
  const {
    request,
    targetRateMap,
    compiledOptions,
    solutionVariables,
    resolvedRawInputItemIds,
  } = params;
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

    const inputs = option.inputEntries.map(([itemId, amount]) => ({
      itemId,
      ratePerMin: amount * value,
    }));
    const outputs = option.outputEntries.map(([itemId, amount]) => ({
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

      if (request.balancePolicy === 'allow_surplus' && netRatePerMin > SURPLUS_OUTPUT_EPSILON) {
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
      infoMessages: [],
      unmetPreferences: buildUnmetPreferences(request, recipePlans),
    },
    resolvedRawInputItemIds,
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

function solveCatalogRequestValidated(
  catalog: ResolvedCatalogModel,
  request: SolveRequest
): SolveResult {
  const solveStartedAt = currentTimeMs();
  const targetRateMap = aggregateTargetRates(request);
  const disabledRawInputItemIds = new Set(request.disabledRawInputItemIds ?? []);
  const rawInputItemIds = new Set<string>(
    [...catalog.rawItemIds, ...(request.rawInputItemIds ?? [])].filter(
      itemId => !disabledRawInputItemIds.has(itemId)
    )
  );
  const disabledRecipeIds = new Set(request.disabledRecipeIds ?? []);
  const disabledBuildingIds = new Set(request.disabledBuildingIds ?? []);
  const compiledGraph = compileSolveGraph(
    catalog,
    request,
    Array.from(targetRateMap.keys()),
    rawInputItemIds,
    disabledRecipeIds,
    disabledBuildingIds
  );
  const graphFinishedAt = currentTimeMs();
  recordSolverPerf({
    phase: 'graph',
    durationMs: graphFinishedAt - solveStartedAt,
    recipeCount: compiledGraph.recipes.length,
    optionCount: compiledGraph.options.length,
    recordedAt: Date.now(),
  });
  const resolvedRawInputItemIds = new Set(compiledGraph.resolvedRawInputItemIds);
  const externalItemIds = collectExternalItemIds(
    resolvedRawInputItemIds,
    compiledGraph.options,
    getCatalogSolveCache(catalog).anyRecipeOutputIndex
  );
  const diagnostics = [...compiledGraph.messages];
  const auditAttempts: SolveAuditAttempt[] = [];
  let model: Model<string, string>;
  let activeOptions: CompiledOptionContext[];
  let solution: Solution<string>;
  let modelDurationMs = 0;
  let lpDurationMs = 0;
  let surplusReweightTermination: SolveAudit['surplusReweightTermination'];
  const buildSolveAudit = (resultDurationMs: number, totalDurationMs: number): SolveAudit => ({
    prunedItemCount: compiledGraph.itemIds.length,
    prunedRecipeCount: compiledGraph.recipes.length,
    prunedOptionCount: compiledGraph.options.length,
    resolvedRawInputCount: resolvedRawInputItemIds.size,
    graphDurationMs: graphFinishedAt - solveStartedAt,
    modelDurationMs,
    solveDurationMs: lpDurationMs,
    resultDurationMs,
    totalDurationMs,
    attempts: auditAttempts,
    surplusReweightTermination,
  });

  const buildLinear = (
    surplusWeights?: ReadonlyMap<string, number>
  ) => {
    const startedAt = currentTimeMs();
    const build = buildLinearModel(
      request,
      compiledGraph.options,
      targetRateMap,
      externalItemIds,
      surplusWeights
    );
    const durationMs = currentTimeMs() - startedAt;
    modelDurationMs += durationMs;
    return {
      ...build,
      buildDurationMs: durationMs,
    };
  };

  const solveModel = (candidateModel: Model<string, string>, options?: SolverOptions) => {
    const startedAt = currentTimeMs();
    const candidateSolution = solveLinearProgram(candidateModel, options);
    const durationMs = currentTimeMs() - startedAt;
    lpDurationMs += durationMs;
    return {
      solution: candidateSolution,
      solveDurationMs: durationMs,
    };
  };

  if (request.objective === 'min_complexity') {
    const seedRequest: SolveRequest = {
      ...request,
      objective: 'min_power',
    };
    const seedBuildStartedAt = currentTimeMs();
    const seedBuild = buildLinearModel(
      seedRequest,
      compiledGraph.options,
      targetRateMap,
      externalItemIds
    );
    const seedBuildDurationMs = currentTimeMs() - seedBuildStartedAt;
    modelDurationMs += seedBuildDurationMs;
    const seedSolve = solveModel(seedBuild.model);
    auditAttempts.push(
      buildSolveAuditAttempt({
        phase: 'complexity_seed_lp',
        modelKind: 'lp',
        itemCount: seedBuild.involvedItemCount,
        recipeCount: seedBuild.activeRecipeCount,
        optionCount: seedBuild.activeOptions.length,
        constraintCount: Object.keys(seedBuild.model.constraints).length,
        variableCount: Object.keys(seedBuild.model.variables).length,
        buildDurationMs: seedBuildDurationMs,
        solveDurationMs: seedSolve.solveDurationMs,
        status: seedSolve.solution.status,
      })
    );
    if (seedSolve.solution.status !== 'optimal') {
      return buildInfeasibleSolveResult({
        targetRateMap,
        resolvedRawInputItemIds: Array.from(resolvedRawInputItemIds).sort((left, right) =>
          left.localeCompare(right)
        ),
        diagnostics: [
          ...diagnostics,
          `Complexity seed solve failed with status ${seedSolve.solution.status}.`,
        ],
        infoMessages: [...compiledGraph.infoMessages],
        solveAudit: buildSolveAudit(0, currentTimeMs() - solveStartedAt),
      });
    }

    const baseLinkUpperBound = estimateComplexityLinkUpperBound(
      seedSolve.solution.variables,
      targetRateMap
    );
    let complexityModel: Model<string, string> | null = null;
    let complexityOptions: CompiledOptionContext[] | null = null;
    let complexitySolution: Solution<string> | null = null;
    let lastFailureMessage = 'Complexity MILP solve did not produce an optimal solution.';

    for (const multiplier of COMPLEXITY_LINK_BOUND_MULTIPLIERS) {
      const linkUpperBound = baseLinkUpperBound * multiplier;
      const buildStartedAt = currentTimeMs();
      const complexityBuild = buildComplexityModel({
        catalog,
        request,
        compiledOptions: compiledGraph.options,
        targetRateMap,
        externalItemIds,
        linkUpperBound,
      });
      const complexityBuildDurationMs = currentTimeMs() - buildStartedAt;
      modelDurationMs += complexityBuildDurationMs;
      const candidateSolve = solveModel(complexityBuild.model);
      auditAttempts.push(
        buildSolveAuditAttempt({
          phase: 'complexity_milp',
          round: auditAttempts.filter(entry => entry.phase === 'complexity_milp').length,
          modelKind: 'milp',
          itemCount: complexityBuild.involvedItemCount,
          recipeCount: complexityBuild.activeRecipeCount,
          optionCount: complexityBuild.activeOptions.length,
          constraintCount: Object.keys(complexityBuild.model.constraints).length,
          variableCount: Object.keys(complexityBuild.model.variables).length,
          buildDurationMs: complexityBuildDurationMs,
          solveDurationMs: candidateSolve.solveDurationMs,
          status: candidateSolve.solution.status,
        })
      );
      if (candidateSolve.solution.status !== 'optimal') {
        lastFailureMessage = `Complexity MILP failed with status ${candidateSolve.solution.status}.`;
        continue;
      }

      complexityModel = complexityBuild.model;
      complexityOptions = complexityBuild.activeOptions;
      complexitySolution = candidateSolve.solution;
      break;
    }

    if (!complexityModel || !complexityOptions || !complexitySolution) {
      return buildInfeasibleSolveResult({
        targetRateMap,
        resolvedRawInputItemIds: Array.from(resolvedRawInputItemIds).sort((left, right) =>
          left.localeCompare(right)
        ),
        diagnostics: [...diagnostics, lastFailureMessage],
        infoMessages: [...compiledGraph.infoMessages],
        solveAudit: buildSolveAudit(0, currentTimeMs() - solveStartedAt),
      });
    }

    model = complexityModel;
    activeOptions = complexityOptions;
    solution = complexitySolution;
  } else {
    const linearBuild = buildLinear();
    model = linearBuild.model;
    activeOptions = linearBuild.activeOptions;
    const initialSolve = solveModel(model);
    solution = initialSolve.solution;
    auditAttempts.push(
      buildSolveAuditAttempt({
        phase: 'initial_lp',
        modelKind: 'lp',
        itemCount: linearBuild.involvedItemCount,
        recipeCount: linearBuild.activeRecipeCount,
        optionCount: linearBuild.activeOptions.length,
        constraintCount: Object.keys(linearBuild.model.constraints).length,
        variableCount: Object.keys(linearBuild.model.variables).length,
        buildDurationMs: linearBuild.buildDurationMs,
        solveDurationMs: initialSolve.solveDurationMs,
        status: initialSolve.solution.status,
        surplusItemCount:
          request.balancePolicy === 'allow_surplus'
            ? collectSurplusSolutionMetrics(initialSolve.solution.variables).activeItemIds.length
            : undefined,
        surplusRatePerMin:
          request.balancePolicy === 'allow_surplus'
            ? collectSurplusSolutionMetrics(initialSolve.solution.variables).totalRatePerMin
            : undefined,
        primaryObjectiveValue:
          request.balancePolicy === 'allow_surplus' && initialSolve.solution.status === 'optimal'
            ? buildPrimaryObjectiveValue(request, activeOptions, initialSolve.solution.variables)
            : undefined,
      })
    );

    if (request.balancePolicy === 'allow_surplus' && solution.status === 'optimal') {
      let bestCandidate = buildLinearSolveCandidate({
        request,
        model,
        activeOptions,
        solution,
      });
      let previousCandidate = bestCandidate;
      const deadline = solveStartedAt + ALLOW_SURPLUS_SYNC_BUDGET_MS;
      let stagnantRounds = 0;
      const maxReweightedRounds = Math.max(0, ALLOW_SURPLUS_MAX_LINEAR_SOLVES - 1);

      for (let round = 0; round < maxReweightedRounds; round += 1) {
        if (currentTimeMs() >= deadline) {
          surplusReweightTermination = 'deadline';
          break;
        }

        const surplusWeights = buildReweightedSurplusWeights(
          bestCandidate.surplus,
          round
        );
        if (!surplusWeights) {
          surplusReweightTermination = 'converged';
          break;
        }

        const weightedBuild = buildLinear(surplusWeights);
        if (currentTimeMs() >= deadline) {
          surplusReweightTermination = 'deadline';
          break;
        }

        const weightedSolve = solveModel(weightedBuild.model);
        const weightedSurplusMetrics = collectSurplusSolutionMetrics(
          weightedSolve.solution.variables
        );

        if (weightedSolve.solution.status !== 'optimal') {
          auditAttempts.push(
            buildSolveAuditAttempt({
              phase: 'reweighted_lp',
              round,
              modelKind: 'lp',
              itemCount: weightedBuild.involvedItemCount,
              recipeCount: weightedBuild.activeRecipeCount,
              optionCount: weightedBuild.activeOptions.length,
              constraintCount: Object.keys(weightedBuild.model.constraints).length,
              variableCount: Object.keys(weightedBuild.model.variables).length,
              buildDurationMs: weightedBuild.buildDurationMs,
              solveDurationMs: weightedSolve.solveDurationMs,
              status: weightedSolve.solution.status,
              surplusItemCount: weightedSurplusMetrics.activeItemIds.length,
              surplusRatePerMin: weightedSurplusMetrics.totalRatePerMin,
              surplusWeights,
            })
          );
          surplusReweightTermination = 'infeasible';
          break;
        }

        const candidate = buildLinearSolveCandidate({
          request,
          model: weightedBuild.model,
          activeOptions: weightedBuild.activeOptions,
          solution: weightedSolve.solution,
        });

        const isBest = compareLinearSolveCandidates(candidate, bestCandidate) < 0;
        if (isBest) {
          bestCandidate = candidate;
        }

        const candidateDelta = compareLinearSolveCandidates(candidate, previousCandidate);
        const sameSupport =
          candidate.surplus.activeItemIds.length === previousCandidate.surplus.activeItemIds.length &&
          candidate.surplus.activeItemIds.every(
            (itemId, index) => itemId === previousCandidate.surplus.activeItemIds[index]
          );
        stagnantRounds = sameSupport && candidateDelta === 0 ? stagnantRounds + 1 : 0;
        previousCandidate = candidate;

        auditAttempts.push(
          buildSolveAuditAttempt({
            phase: 'reweighted_lp',
            round,
            modelKind: 'lp',
            itemCount: weightedBuild.involvedItemCount,
            recipeCount: weightedBuild.activeRecipeCount,
            optionCount: weightedBuild.activeOptions.length,
            constraintCount: Object.keys(weightedBuild.model.constraints).length,
            variableCount: Object.keys(weightedBuild.model.variables).length,
            buildDurationMs: weightedBuild.buildDurationMs,
            solveDurationMs: weightedSolve.solveDurationMs,
            status: weightedSolve.solution.status,
            surplusItemCount: weightedSurplusMetrics.activeItemIds.length,
            surplusRatePerMin: weightedSurplusMetrics.totalRatePerMin,
            primaryObjectiveValue: candidate.primaryObjectiveValue,
            surplusWeights,
            isBestCandidate: isBest,
            stagnantRounds,
          })
        );

        if (stagnantRounds >= 3) {
          surplusReweightTermination = 'stagnant';
          break;
        }

        if (round === maxReweightedRounds - 1) {
          surplusReweightTermination = 'max_rounds';
        }
      }

      // Surplus type + recipe count minimization MILP: the weighted LP
      // reweighting loop minimises weighted surplus cost, but cannot reduce
      // surplus TYPE COUNT because spreading surplus across many low-weight
      // items is always cheaper than concentrating it on fewer items.  Use a
      // MILP with binary indicator variables to directly minimise type count
      // and penalise recipe usage (preventing excessive recipe chains added
      // solely to consume small byproduct surpluses).
      {
        const surplusUpperBound = estimateSurplusUpperBound(
          bestCandidate.solution.variables,
          targetRateMap
        );
        // Recipe link big-M only needs to bound the max total rate of any
        // single recipe's options — much tighter than the surplus upper bound.
        const recipeLinkUpperBound = estimateRecipeLinkUpperBound(
          bestCandidate.solution.variables
        );
        // Collect option IDs that the LP solution actually uses — only
        // these recipes need binary indicators in the MILP.
        const activeOptionIds = new Set<string>();
        for (const [varName, value] of bestCandidate.solution.variables) {
          if (value > EPSILON && !varName.startsWith('__') && !varName.startsWith('ext:')) {
            activeOptionIds.add(varName);
          }
        }
        const lpSurplusItemIds = new Set(bestCandidate.surplus.activeItemIds);
        // Surplus candidates: items that currently have surplus, plus all
        // output items of LP-active non-required recipes.  When the MILP
        // toggles a recipe off, its output items may accumulate surplus.
        const surplusCandidateItemIds = new Set(lpSurplusItemIds);
        for (const { option } of bestCandidate.activeOptions) {
          const isActive = option.netItemEntries.some(
            ([, amount]) => amount > EPSILON
          ) && activeOptionIds.has(option.optionId);
          if (isActive) {
            for (const [itemId, amount] of option.netItemEntries) {
              if (amount > EPSILON) {
                surplusCandidateItemIds.add(itemId);
              }
            }
          }
        }
        const milpBuildStartedAt = currentTimeMs();
        const milpBuild = buildSurplusTypeMilpModel({
          request,
          compiledOptions: compiledGraph.options,
          targetRateMap,
          externalItemIds,
          surplusUpperBound,
          recipeLinkUpperBound,
          activeOptionIds,
          surplusCandidateItemIds,
        });
        const milpBuildDurationMs = currentTimeMs() - milpBuildStartedAt;
        modelDurationMs += milpBuildDurationMs;

        const milpSolve = solveModel(milpBuild.model, {
          timeout: SURPLUS_MILP_TIMEOUT_MS,
          tolerance: SURPLUS_MILP_TOLERANCE,
        });
        const milpSurplusMetrics = collectSurplusSolutionMetrics(
          milpSolve.solution.variables
        );

        // Accept both optimal and timedout (best sub-optimal integer solution
        // found before the deadline).
        const milpUsable =
          milpSolve.solution.status === 'optimal' ||
          (milpSolve.solution.status === 'timedout' && !isNaN(milpSolve.solution.result));

        if (milpUsable) {
          const milpCandidate = buildLinearSolveCandidate({
            request,
            model: milpBuild.model,
            activeOptions: milpBuild.activeOptions,
            solution: milpSolve.solution,
          });

          // The MILP objective already balances surplus type count vs recipe
          // count vs power.  Accept the MILP result whenever it does not
          // increase surplus type count — don't let the LP's lower surplus
          // *rate* override the MILP's recipe-count savings.
          const isBest =
            milpCandidate.surplus.activeItemIds.length <=
            bestCandidate.surplus.activeItemIds.length;

          auditAttempts.push(
            buildSolveAuditAttempt({
              phase: 'surplus_type_milp',
              modelKind: 'milp',
              itemCount: milpBuild.involvedItemCount,
              recipeCount: milpBuild.activeRecipeCount,
              optionCount: milpBuild.activeOptions.length,
              constraintCount: Object.keys(milpBuild.model.constraints).length,
              variableCount: Object.keys(milpBuild.model.variables).length,
              binaryCount: milpBuild.binaryCount,
              buildDurationMs: milpBuildDurationMs,
              solveDurationMs: milpSolve.solveDurationMs,
              status: milpSolve.solution.status,
              surplusItemCount: milpSurplusMetrics.activeItemIds.length,
              surplusRatePerMin: milpSurplusMetrics.totalRatePerMin,
              primaryObjectiveValue: milpCandidate.primaryObjectiveValue,
              isBestCandidate: isBest,
            })
          );

          if (isBest) {
            bestCandidate = milpCandidate;
            // Normalize timedout → optimal: the MILP found a valid integer
            // solution (just not provably optimal within the time budget),
            // which is good enough for downstream code that checks status.
            if (bestCandidate.solution.status === 'timedout') {
              bestCandidate = {
                ...bestCandidate,
                solution: { ...bestCandidate.solution, status: 'optimal' },
              };
            }
          }
        } else {
          auditAttempts.push(
            buildSolveAuditAttempt({
              phase: 'surplus_type_milp',
              modelKind: 'milp',
              itemCount: milpBuild.involvedItemCount,
              recipeCount: milpBuild.activeRecipeCount,
              optionCount: milpBuild.activeOptions.length,
              constraintCount: Object.keys(milpBuild.model.constraints).length,
              variableCount: Object.keys(milpBuild.model.variables).length,
              binaryCount: milpBuild.binaryCount,
              buildDurationMs: milpBuildDurationMs,
              solveDurationMs: milpSolve.solveDurationMs,
              status: milpSolve.solution.status,
              surplusItemCount: milpSurplusMetrics.activeItemIds.length,
              surplusRatePerMin: milpSurplusMetrics.totalRatePerMin,
            })
          );
        }
      }

      model = bestCandidate.model;
      activeOptions = bestCandidate.activeOptions;
      solution = bestCandidate.solution;
    }
  }
  const solveFinishedAt = currentTimeMs();
  recordSolverPerf({
    phase: 'model',
    durationMs: modelDurationMs,
    constraintCount: Object.keys(model.constraints).length,
    variableCount: Object.keys(model.variables).length,
    recordedAt: Date.now(),
  });
  recordSolverPerf({
    phase: 'lp',
    durationMs: lpDurationMs,
    constraintCount: Object.keys(model.constraints).length,
    variableCount: Object.keys(model.variables).length,
    status: solution.status,
    recordedAt: Date.now(),
  });

  if (solution.status !== 'optimal') {
    recordSolverPerf({
      phase: 'total',
      durationMs: solveFinishedAt - solveStartedAt,
      recipeCount: compiledGraph.recipes.length,
      optionCount: compiledGraph.options.length,
      constraintCount: Object.keys(model.constraints).length,
      variableCount: Object.keys(model.variables).length,
      status: solution.status,
      recordedAt: Date.now(),
    });
    return buildInfeasibleSolveResult({
      targetRateMap,
      resolvedRawInputItemIds: Array.from(resolvedRawInputItemIds).sort((left, right) =>
        left.localeCompare(right)
      ),
      diagnostics: [...diagnostics, `LP solve failed with status ${solution.status}.`],
      infoMessages: [...compiledGraph.infoMessages],
      solveAudit: buildSolveAudit(0, solveFinishedAt - solveStartedAt),
    });
  }

  const result = buildResultFromSolution({
    request,
    targetRateMap,
    compiledOptions: activeOptions,
    solutionVariables: new Map<string, number>(solution.variables),
    resolvedRawInputItemIds: Array.from(resolvedRawInputItemIds).sort((left, right) =>
      left.localeCompare(right)
    ),
  });
  const resultFinishedAt = currentTimeMs();
  recordSolverPerf({
    phase: 'result',
    durationMs: resultFinishedAt - solveFinishedAt,
    recipeCount: result.recipePlans.length,
    recordedAt: Date.now(),
  });
  recordSolverPerf({
    phase: 'total',
    durationMs: resultFinishedAt - solveStartedAt,
    recipeCount: compiledGraph.recipes.length,
    optionCount: compiledGraph.options.length,
    constraintCount: Object.keys(model.constraints).length,
    variableCount: Object.keys(model.variables).length,
    status: result.status,
    recordedAt: Date.now(),
  });

  return {
    ...result,
    diagnostics: {
      messages: diagnostics,
      infoMessages: compiledGraph.infoMessages,
      unmetPreferences: result.diagnostics.unmetPreferences,
    },
    solveAudit: buildSolveAudit(resultFinishedAt - solveFinishedAt, resultFinishedAt - solveStartedAt),
  };
}

function solveCatalogRequestValidatedCached(
  catalog: ResolvedCatalogModel,
  request: SolveRequest
): SolveResult {
  const cached = getCachedSolvedRequestResult(catalog, request);
  if (cached) {
    return cached;
  }

  const result = solveCatalogRequestValidated(catalog, request);
  setCachedSolvedRequestResult(catalog, request, result);
  return result;
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
        infoMessages: [],
        unmetPreferences: [],
      },
      solveAudit: buildEmptySolveAudit(),
      resolvedRawInputItemIds: [],
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

  return solveCatalogRequestValidatedCached(catalog, request);
}
