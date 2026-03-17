import {
  type CatalogBuildingRuleSpec,
  type CatalogRuleSetSpec,
  type ItemKind,
  type ProliferatorMode,
  type RecipeModifierRuleSpec,
  type ResolvedBuildingSpec,
  type ResolvedCatalogModel,
  type ResolvedItemSpec,
  type ResolvedProliferatorLevelSpec,
  type ResolvedRecipeSpec,
  type VanillaDatasetSpec,
  validateCatalogRuleSetSpec,
  validateVanillaDatasetSpec,
} from './spec';

function cloneRuleSet(rules: CatalogRuleSetSpec): CatalogRuleSetSpec {
  return {
    proliferatorLevels: rules.proliferatorLevels.map(level => ({ ...level })),
    buildingRules: rules.buildingRules.map(rule => ({
      ...rule,
      Tags: rule.Tags ? [...rule.Tags] : undefined,
    })),
    recipeModifierRules: rules.recipeModifierRules.map(rule => ({
      ...rule,
      SupportedModes: rule.SupportedModes ? [...rule.SupportedModes] : undefined,
      Tags: rule.Tags ? [...rule.Tags] : undefined,
    })),
    rawItemTypeIds: rules.rawItemTypeIds ? [...rules.rawItemTypeIds] : undefined,
    syntheticRecipeTypeIds: rules.syntheticRecipeTypeIds ? [...rules.syntheticRecipeTypeIds] : undefined,
    syntheticRecipeNamePrefixes: rules.syntheticRecipeNamePrefixes ? [...rules.syntheticRecipeNamePrefixes] : undefined,
    syntheticFactoryIds: rules.syntheticFactoryIds ? [...rules.syntheticFactoryIds] : undefined,
  };
}

function assertValidDataset(dataset: VanillaDatasetSpec): void {
  const validation = validateVanillaDatasetSpec(dataset);

  if (!validation.valid) {
    const issues = validation.errors.map(issue => `${issue.path}: ${issue.message}`).join('\n');
    throw new Error(`Invalid Vanilla dataset spec.\n${issues}`);
  }
}

function assertValidRuleSet(rules: CatalogRuleSetSpec): void {
  const validation = validateCatalogRuleSetSpec(rules);

  if (!validation.valid) {
    const issues = validation.errors.map(issue => `${issue.path}: ${issue.message}`).join('\n');
    throw new Error(`Invalid catalog rule set spec.\n${issues}`);
  }
}

function inferItemKind(params: {
  itemType: number;
  itemId: number;
  rawItemTypeSet: Set<number>;
  producedItemIds: Set<number>;
  consumedItemIds: Set<number>;
}): ItemKind {
  const {
    itemType,
    itemId,
    rawItemTypeSet,
    producedItemIds,
    consumedItemIds,
  } = params;

  if (rawItemTypeSet.has(itemType)) {
    return 'raw';
  }

  if (itemType < 0) {
    return 'utility';
  }

  if (producedItemIds.has(itemId) && consumedItemIds.has(itemId)) {
    return 'intermediate';
  }

  if (producedItemIds.has(itemId) && !consumedItemIds.has(itemId)) {
    return 'product';
  }

  return 'utility';
}

function normalizeModes(rule: RecipeModifierRuleSpec): ProliferatorMode[] {
  const modes = rule.SupportedModes ?? [];

  if (modes.includes('none')) {
    return [...new Set(modes)];
  }

  return ['none', ...modes];
}

function defaultNoneMode(): ProliferatorMode[] {
  return ['none'];
}

function deriveWorkPowerMW(buildingItem: { WorkEnergyPerTick?: number }, rule: CatalogBuildingRuleSpec): number {
  if (rule.WorkPowerMWOverride !== undefined) {
    return rule.WorkPowerMWOverride;
  }

  if (buildingItem.WorkEnergyPerTick === undefined) {
    throw new Error(`Building ${rule.ID} is missing WorkEnergyPerTick and no WorkPowerMWOverride was provided.`);
  }

  return (buildingItem.WorkEnergyPerTick * 60) / 1_000_000;
}

function deriveSpeedMultiplier(buildingItem: { Speed?: number }, rule: CatalogBuildingRuleSpec): number {
  if (rule.SpeedMultiplierOverride !== undefined) {
    return rule.SpeedMultiplierOverride;
  }

  if (buildingItem.Speed === undefined) {
    throw new Error(`Building ${rule.ID} is missing Speed and no SpeedMultiplierOverride was provided.`);
  }

  return buildingItem.Speed;
}

function buildRecipeTags(params: {
  recipeName: string;
  recipeType: number;
  recipeFactories: number[];
  outputCount: number;
  modifier: RecipeModifierRuleSpec;
  syntheticRecipeTypeSet: Set<number>;
  syntheticRecipeNamePrefixes: string[];
  syntheticFactoryIdSet: Set<number>;
}): { isSynthetic: boolean; tags: string[] } {
  const {
    recipeName,
    recipeType,
    recipeFactories,
    outputCount,
    modifier,
    syntheticRecipeTypeSet,
    syntheticRecipeNamePrefixes,
    syntheticFactoryIdSet,
  } = params;

  const tags: string[] = [];
  const isSynthetic =
    syntheticRecipeTypeSet.has(recipeType) ||
    recipeFactories.some(factoryId => syntheticFactoryIdSet.has(factoryId)) ||
    syntheticRecipeNamePrefixes.some(prefix => recipeName.startsWith(prefix));

  if (isSynthetic) {
    tags.push('synthetic');
  }

  if (outputCount > 1) {
    tags.push('multi-output');
  }

  if (modifier.Tags) {
    tags.push(...modifier.Tags);
  }

  return {
    isSynthetic,
    tags: Array.from(new Set(tags)),
  };
}

export function resolveCatalogModel(
  dataset: VanillaDatasetSpec,
  rules: CatalogRuleSetSpec
): ResolvedCatalogModel {
  assertValidDataset(dataset);
  assertValidRuleSet(rules);

  const resolvedRules = cloneRuleSet(rules);
  const rawItemTypeSet = new Set(resolvedRules.rawItemTypeIds ?? []);
  const syntheticRecipeTypeSet = new Set(resolvedRules.syntheticRecipeTypeIds ?? []);
  const syntheticRecipeNamePrefixes = resolvedRules.syntheticRecipeNamePrefixes ?? [];
  const syntheticFactoryIdSet = new Set(resolvedRules.syntheticFactoryIds ?? []);
  const buildingRuleMap = new Map<number, CatalogBuildingRuleSpec>(
    resolvedRules.buildingRules.map(rule => [rule.ID, rule])
  );
  const modifierRuleMap = new Map<number, RecipeModifierRuleSpec>(
    resolvedRules.recipeModifierRules.map(rule => [rule.Code, rule])
  );
  const itemById = new Map(dataset.items.map(item => [item.ID, item]));
  const usedFactoryIds = Array.from(
    new Set(dataset.recipes.flatMap(recipe => recipe.Factories))
  ).sort((a, b) => a - b);
  const producedItemIds = new Set(dataset.recipes.flatMap(recipe => recipe.Results));
  const consumedItemIds = new Set(dataset.recipes.flatMap(recipe => recipe.Items));
  const highestConfiguredProliferatorLevel = Math.max(
    0,
    ...resolvedRules.proliferatorLevels.map(level => level.Level)
  );

  const items: ResolvedItemSpec[] = dataset.items.map(item => ({
    itemId: item.ID.toString(),
    typeId: item.Type,
    name: item.Name,
    kind: inferItemKind({
      itemType: item.Type,
      itemId: item.ID,
      rawItemTypeSet,
      producedItemIds,
      consumedItemIds,
    }),
    icon: item.IconName,
    source: item,
  }));

  const recipes: ResolvedRecipeSpec[] = dataset.recipes.map(recipe => {
    const modifier = modifierRuleMap.get(recipe.Proliferator);

    if (!modifier) {
      throw new Error(`Recipe ${recipe.ID} (${recipe.Name}) references unknown modifier code ${recipe.Proliferator}.`);
    }

    const { isSynthetic, tags } = buildRecipeTags({
      recipeName: recipe.Name,
      recipeType: recipe.Type,
      recipeFactories: recipe.Factories,
      outputCount: recipe.Results.length,
      modifier,
      syntheticRecipeTypeSet,
      syntheticRecipeNamePrefixes,
      syntheticFactoryIdSet,
    });

    const supportsProliferatorModes =
      modifier.Kind === 'proliferator' ? normalizeModes(modifier) : defaultNoneMode();
    const maxProliferatorLevel =
      modifier.Kind === 'proliferator'
        ? (modifier.MaxLevel ?? highestConfiguredProliferatorLevel)
        : 0;

    return {
      recipeId: recipe.ID.toString(),
      typeId: recipe.Type,
      name: recipe.Name,
      cycleTimeSec: recipe.TimeSpend / 60,
      timeSpend: recipe.TimeSpend,
      inputs: recipe.Items.map((itemId, index) => ({
        itemId: itemId.toString(),
        amount: recipe.ItemCounts[index] ?? 0,
      })),
      outputs: recipe.Results.map((itemId, index) => ({
        itemId: itemId.toString(),
        amount: recipe.ResultCounts[index] ?? 0,
      })),
      allowedBuildingIds: recipe.Factories.map(factoryId => factoryId.toString()),
      modifierCode: recipe.Proliferator,
      modifierKind: modifier.Kind,
      supportsProliferatorModes,
      maxProliferatorLevel,
      isSynthetic,
      tags: tags.length > 0 ? tags : undefined,
      source: recipe,
    };
  });

  const buildings: ResolvedBuildingSpec[] = usedFactoryIds.map(factoryId => {
    const item = itemById.get(factoryId);
    const rule = buildingRuleMap.get(factoryId);

    if (!item) {
      throw new Error(`Factory item ${factoryId} is referenced by recipes but missing from items.`);
    }

    if (!rule) {
      throw new Error(`Factory item ${factoryId} (${item.Name}) is missing a building rule.`);
    }

    return {
      buildingId: factoryId.toString(),
      typeId: item.Type,
      name: item.Name,
      category: rule.Category,
      speedMultiplier: deriveSpeedMultiplier(item, rule),
      workPowerMW: deriveWorkPowerMW(item, rule),
      idlePowerMW: rule.IdlePowerMW,
      intrinsicProductivityBonus: rule.IntrinsicProductivityBonus ?? 0,
      tags: rule.Tags ? [...rule.Tags] : undefined,
      source: {
        item,
        rule,
      },
    };
  });

  const proliferatorLevels: ResolvedProliferatorLevelSpec[] = resolvedRules.proliferatorLevels
    .slice()
    .sort((left, right) => left.Level - right.Level)
    .map(level => ({
      level: level.Level,
      itemId: level.ItemID?.toString(),
      sprayCount: level.SprayCount,
      speedMultiplier: level.SpeedMultiplier,
      productivityMultiplier: level.ProductivityMultiplier,
      powerMultiplier: level.PowerMultiplier,
      source: level,
    }));

  const rawItemIds = items.filter(item => item.kind === 'raw').map(item => item.itemId);
  const syntheticRecipeIds = recipes.filter(recipe => recipe.isSynthetic).map(recipe => recipe.recipeId);
  const itemMap = new Map(items.map(item => [item.itemId, item]));
  const recipeMap = new Map(recipes.map(recipe => [recipe.recipeId, recipe]));
  const buildingMap = new Map(buildings.map(building => [building.buildingId, building]));
  const proliferatorLevelMap = new Map(proliferatorLevels.map(level => [level.level, level]));

  return {
    version: 'vanilla-compatible@1',
    dataset,
    rules: resolvedRules,
    items,
    recipes,
    buildings,
    proliferatorLevels,
    itemMap,
    recipeMap,
    buildingMap,
    proliferatorLevelMap,
    rawItemIds,
    syntheticRecipeIds,
  };
}
