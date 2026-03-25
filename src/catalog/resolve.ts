import {
  type CatalogBuildingRuleSpec,
  type CatalogDefaultConfigSpec,
  type CatalogRecipeBuildingExpansionGroupSpec,
  type CatalogRecipeModifierPolicySpec,
  type CatalogRecipeRuleSpec,
  type ItemKind,
  type ProliferatorMode,
  type RecipeModifierRuleSpec,
  type ResolvedBuildingSpec,
  type ResolvedCatalogModel,
  type ResolvedItemSpec,
  type ResolvedProliferatorLevelSpec,
  type ResolvedRecipeSpec,
  type VanillaDatasetSpec,
  validateCatalogDefaultConfigSpec,
  validateVanillaDatasetSpec,
} from './spec';

function cloneDefaultConfig(defaultConfig: CatalogDefaultConfigSpec): CatalogDefaultConfigSpec {
  return {
    iconAtlasIds: defaultConfig.iconAtlasIds ? [...defaultConfig.iconAtlasIds] : undefined,
    proliferatorLevels: defaultConfig.proliferatorLevels?.map(level => ({ ...level })),
    buildingRules: defaultConfig.buildingRules?.map(rule => ({
      ...rule,
      Tags: rule.Tags ? [...rule.Tags] : undefined,
    })),
    recipeRules: defaultConfig.recipeRules?.map(rule => ({
      ...rule,
      AllowedBuildingIds: rule.AllowedBuildingIds ? [...rule.AllowedBuildingIds] : undefined,
    })),
    recipeModifierPolicy: defaultConfig.recipeModifierPolicy
      ? {
          ...defaultConfig.recipeModifierPolicy,
          speedOnlyRecipeIds: defaultConfig.recipeModifierPolicy.speedOnlyRecipeIds
            ? [...defaultConfig.recipeModifierPolicy.speedOnlyRecipeIds]
            : undefined,
        }
      : undefined,
    recipeBuildingExpansionGroups: defaultConfig.recipeBuildingExpansionGroups?.map(group => ({
      BuildingIds: [...group.BuildingIds],
    })),
    recipeBuildingUniversalIds: defaultConfig.recipeBuildingUniversalIds
      ? [...defaultConfig.recipeBuildingUniversalIds]
      : undefined,
    recipeModifierRules: defaultConfig.recipeModifierRules?.map(rule => ({
      ...rule,
      SupportedModes: rule.SupportedModes ? [...rule.SupportedModes] : undefined,
      Tags: rule.Tags ? [...rule.Tags] : undefined,
    })),
    recommendedSolve: defaultConfig.recommendedSolve
      ? { ...defaultConfig.recommendedSolve }
      : undefined,
    recommendedDisabledRecipeIds: defaultConfig.recommendedDisabledRecipeIds
      ? [...defaultConfig.recommendedDisabledRecipeIds]
      : undefined,
    recommendedDisabledBuildingIds: defaultConfig.recommendedDisabledBuildingIds
      ? [...defaultConfig.recommendedDisabledBuildingIds]
      : undefined,
    recommendedRawItemIds: defaultConfig.recommendedRawItemIds
      ? [...defaultConfig.recommendedRawItemIds]
      : undefined,
    recommendedRawItemTypeIds: defaultConfig.recommendedRawItemTypeIds
      ? [...defaultConfig.recommendedRawItemTypeIds]
      : undefined,
    syntheticRecipeTypeIds: defaultConfig.syntheticRecipeTypeIds
      ? [...defaultConfig.syntheticRecipeTypeIds]
      : undefined,
    syntheticRecipeNamePrefixes: defaultConfig.syntheticRecipeNamePrefixes
      ? [...defaultConfig.syntheticRecipeNamePrefixes]
      : undefined,
    syntheticFactoryIds: defaultConfig.syntheticFactoryIds
      ? [...defaultConfig.syntheticFactoryIds]
      : undefined,
  };
}

function assertValidDataset(dataset: VanillaDatasetSpec): void {
  const validation = validateVanillaDatasetSpec(dataset);

  if (!validation.valid) {
    const issues = validation.errors.map(issue => `${issue.path}: ${issue.message}`).join('\n');
    throw new Error(`Invalid Vanilla dataset spec.\n${issues}`);
  }
}

function assertValidDefaultConfig(defaultConfig: CatalogDefaultConfigSpec): void {
  const validation = validateCatalogDefaultConfigSpec(defaultConfig);

  if (!validation.valid) {
    const issues = validation.errors.map(issue => `${issue.path}: ${issue.message}`).join('\n');
    throw new Error(`Invalid catalog default config spec.\n${issues}`);
  }
}

function inferItemKind(params: {
  itemType: number;
  itemId: number;
  recommendedRawItemIdSet: Set<number>;
  recommendedRawItemTypeSet: Set<number>;
  producedItemIds: Set<number>;
  consumedItemIds: Set<number>;
}): ItemKind {
  const {
    itemType,
    itemId,
    recommendedRawItemIdSet,
    recommendedRawItemTypeSet,
    producedItemIds,
    consumedItemIds,
  } = params;

  if (recommendedRawItemIdSet.has(itemId) || recommendedRawItemTypeSet.has(itemType)) {
    return 'raw';
  }

  if (itemType < 0) {
    return 'utility';
  }

  const isProduced = producedItemIds.has(itemId);
  const isConsumed = consumedItemIds.has(itemId);

  if (!isProduced && isConsumed) {
    return 'raw';
  }

  if (isProduced && isConsumed) {
    return 'intermediate';
  }

  if (isProduced && !isConsumed) {
    return 'product';
  }

  return 'utility';
}

function normalizeModes(rule: RecipeModifierRuleSpec): ProliferatorMode[] {
  const modes = rule.SupportedModes ?? [];

  if (modes.length === 0) {
    return ['none'];
  }

  if (modes.includes('none')) {
    return [...new Set(modes)];
  }

  return ['none', ...new Set(modes)];
}

function defaultNoneMode(): ProliferatorMode[] {
  return ['none'];
}

function matchesSpeedOnlyPolicy(
  recipe: VanillaDatasetSpec['recipes'][number],
  policy?: CatalogRecipeModifierPolicySpec
): boolean {
  if (!policy) {
    return false;
  }

  if (policy.speedOnlyRecipeIds?.includes(recipe.ID)) {
    return true;
  }

  if (!policy.speedOnlyWhenInputOutputCountsMatch) {
    return false;
  }

  for (let inputIndex = 0; inputIndex < recipe.Items.length; inputIndex += 1) {
    for (let outputIndex = 0; outputIndex < recipe.Results.length; outputIndex += 1) {
      if (recipe.Items[inputIndex] !== recipe.Results[outputIndex]) {
        continue;
      }

      if (recipe.ItemCounts[inputIndex] === recipe.ResultCounts[outputIndex]) {
        return true;
      }
    }
  }

  return false;
}

function deriveEffectiveModifierCode(
  recipe: VanillaDatasetSpec['recipes'][number],
  recipeRule: CatalogRecipeRuleSpec | undefined,
  policy: CatalogRecipeModifierPolicySpec | undefined
): number {
  if (recipeRule?.ModifierCodeOverride !== undefined) {
    return recipeRule.ModifierCodeOverride;
  }

  if (matchesSpeedOnlyPolicy(recipe, policy)) {
    return 1;
  }

  return recipe.Proliferator;
}

function deriveWorkPowerMW(
  buildingItem: { WorkEnergyPerTick?: number },
  rule?: CatalogBuildingRuleSpec
): number {
  if (rule?.WorkPowerMWOverride !== undefined) {
    return rule.WorkPowerMWOverride;
  }

  if (buildingItem.WorkEnergyPerTick === undefined) {
    const idText = rule ? `${rule.ID}` : 'unknown';
    throw new Error(
      `Building ${idText} is missing WorkEnergyPerTick and no WorkPowerMWOverride was provided.`
    );
  }

  return (buildingItem.WorkEnergyPerTick * 60) / 1_000_000;
}

function deriveSpeedMultiplier(
  buildingItem: { Speed?: number },
  rule?: CatalogBuildingRuleSpec
): number {
  if (rule?.SpeedMultiplierOverride !== undefined) {
    return rule.SpeedMultiplierOverride;
  }

  if (buildingItem.Speed === undefined) {
    const idText = rule ? `${rule.ID}` : 'unknown';
    throw new Error(`Building ${idText} is missing Speed and no SpeedMultiplierOverride was provided.`);
  }

  if (buildingItem.Speed >= 1000) {
    return buildingItem.Speed / 10000;
  }

  return buildingItem.Speed;
}

function deriveBuildingCategory(rule?: CatalogBuildingRuleSpec): string {
  return rule?.Category?.trim() || 'factory';
}

function expandAllowedBuildingIds(
  baseBuildingIds: number[],
  expansionGroups: CatalogRecipeBuildingExpansionGroupSpec[],
  universalBuildingIds: number[]
): number[] {
  const expanded = [...baseBuildingIds];
  const expandedSet = new Set(expanded);

  for (const group of expansionGroups) {
    if (!group.BuildingIds.some(buildingId => expandedSet.has(buildingId))) {
      continue;
    }

    for (const buildingId of group.BuildingIds) {
      if (expandedSet.has(buildingId)) {
        continue;
      }
      expanded.push(buildingId);
      expandedSet.add(buildingId);
    }
  }

  for (const buildingId of universalBuildingIds) {
    if (expandedSet.has(buildingId)) {
      continue;
    }
    expanded.push(buildingId);
    expandedSet.add(buildingId);
  }

  return expanded;
}

function buildRecipeTags(params: {
  recipeName: string;
  recipeType: number;
  recipeFactories: number[];
  recipeInputCount: number;
  outputCount: number;
  modifier?: RecipeModifierRuleSpec;
  syntheticRecipeTypeSet: Set<number>;
  syntheticRecipeNamePrefixes: string[];
  syntheticFactoryIdSet: Set<number>;
}): { isSynthetic: boolean; tags: string[] } {
  const {
    recipeName,
    recipeType,
    recipeFactories,
    recipeInputCount,
    outputCount,
    modifier,
    syntheticRecipeTypeSet,
    syntheticRecipeNamePrefixes,
    syntheticFactoryIdSet,
  } = params;

  const tags: string[] = [];
  const isSynthetic =
    recipeInputCount === 0 ||
    syntheticRecipeTypeSet.has(recipeType) ||
    recipeFactories.some(factoryId => syntheticFactoryIdSet.has(factoryId)) ||
    syntheticRecipeNamePrefixes.some(prefix => recipeName.startsWith(prefix));

  if (isSynthetic) {
    tags.push('synthetic');
  }

  if (outputCount > 1) {
    tags.push('multi-output');
  }

  if (modifier?.Tags) {
    tags.push(...modifier.Tags);
  }

  return {
    isSynthetic,
    tags: Array.from(new Set(tags)),
  };
}

export function resolveCatalogModel(
  dataset: VanillaDatasetSpec,
  defaultConfig: CatalogDefaultConfigSpec = {}
): ResolvedCatalogModel {
  assertValidDataset(dataset);
  assertValidDefaultConfig(defaultConfig);

  const resolvedDefaultConfig = cloneDefaultConfig(defaultConfig);
  const recommendedRawItemIdSet = new Set(resolvedDefaultConfig.recommendedRawItemIds ?? []);
  const recommendedRawItemTypeSet = new Set(
    resolvedDefaultConfig.recommendedRawItemTypeIds ?? []
  );
  const syntheticRecipeTypeSet = new Set(resolvedDefaultConfig.syntheticRecipeTypeIds ?? []);
  const syntheticRecipeNamePrefixes = resolvedDefaultConfig.syntheticRecipeNamePrefixes ?? [];
  const syntheticFactoryIdSet = new Set(resolvedDefaultConfig.syntheticFactoryIds ?? []);
  const buildingRuleMap = new Map<number, CatalogBuildingRuleSpec>(
    (resolvedDefaultConfig.buildingRules ?? []).map(rule => [rule.ID, rule])
  );
  const recipeRuleMap = new Map<number, CatalogRecipeRuleSpec>(
    (resolvedDefaultConfig.recipeRules ?? []).map(rule => [rule.ID, rule])
  );
  const recipeBuildingExpansionGroups = resolvedDefaultConfig.recipeBuildingExpansionGroups ?? [];
  const recipeBuildingUniversalIds = resolvedDefaultConfig.recipeBuildingUniversalIds ?? [];
  const recipeModifierPolicy = resolvedDefaultConfig.recipeModifierPolicy;
  const modifierRuleMap = new Map<number, RecipeModifierRuleSpec>(
    (resolvedDefaultConfig.recipeModifierRules ?? []).map(rule => [rule.Code, rule])
  );
  const itemById = new Map(dataset.items.map(item => [item.ID, item]));
  const usedFactoryIds = Array.from(
    new Set([
      ...dataset.recipes.flatMap(recipe => recipe.Factories),
      ...(resolvedDefaultConfig.recipeRules ?? []).flatMap(rule => rule.AllowedBuildingIds ?? []),
      ...recipeBuildingExpansionGroups.flatMap(group => group.BuildingIds),
      ...recipeBuildingUniversalIds,
    ])
  ).sort((a, b) => a - b);
  const producedItemIds = new Set(dataset.recipes.flatMap(recipe => recipe.Results));
  const consumedItemIds = new Set(dataset.recipes.flatMap(recipe => recipe.Items));
  const highestConfiguredProliferatorLevel = Math.max(
    0,
    ...(resolvedDefaultConfig.proliferatorLevels ?? []).map(level => level.Level)
  );
  const iconAtlasIds =
    resolvedDefaultConfig.iconAtlasIds && resolvedDefaultConfig.iconAtlasIds.length > 0
      ? Array.from(new Set(resolvedDefaultConfig.iconAtlasIds.map(entry => entry.trim()).filter(Boolean)))
      : ['Vanilla'];

  const items: ResolvedItemSpec[] = dataset.items.map(item => ({
    itemId: item.ID.toString(),
    typeId: item.Type,
    name: item.Name,
    kind: inferItemKind({
      itemType: item.Type,
      itemId: item.ID,
      recommendedRawItemIdSet,
      recommendedRawItemTypeSet,
      producedItemIds,
      consumedItemIds,
    }),
    icon: item.IconName,
    source: item,
  }));

  const recipes: ResolvedRecipeSpec[] = dataset.recipes.map(recipe => {
    const recipeRule = recipeRuleMap.get(recipe.ID);
    const effectiveModifierCode = deriveEffectiveModifierCode(
      recipe,
      recipeRule,
      recipeModifierPolicy
    );
    const modifier = modifierRuleMap.get(effectiveModifierCode);
    const modifierKind = modifier?.Kind ?? 'none';
    const supportsProliferatorModes =
      modifierKind === 'proliferator' && modifier ? normalizeModes(modifier) : defaultNoneMode();
    const maxProliferatorLevel =
      modifierKind === 'proliferator'
        ? (modifier?.MaxLevel ?? highestConfiguredProliferatorLevel)
        : 0;
    const allowedBuildingIds = expandAllowedBuildingIds(
      recipeRule?.AllowedBuildingIds ?? recipe.Factories,
      recipeBuildingExpansionGroups,
      recipeBuildingUniversalIds
    );
    const { isSynthetic, tags } = buildRecipeTags({
      recipeName: recipe.Name,
      recipeType: recipe.Type,
      recipeFactories: allowedBuildingIds,
      recipeInputCount: recipe.Items.length,
      outputCount: recipe.Results.length,
      modifier,
      syntheticRecipeTypeSet,
      syntheticRecipeNamePrefixes,
      syntheticFactoryIdSet,
    });

    return {
      recipeId: recipe.ID.toString(),
      typeId: recipe.Type,
      name: recipe.Name,
      icon: recipe.IconName,
      cycleTimeSec: recipe.TimeSpend / 60,
      timeSpend: recipe.TimeSpend,
      fractionationProbability: recipeRule?.FractionationProbability,
      inputs: recipe.Items.map((itemId, index) => ({
        itemId: itemId.toString(),
        amount: recipe.ItemCounts[index] ?? 0,
      })),
      outputs: recipe.Results.map((itemId, index) => ({
        itemId: itemId.toString(),
        amount: recipe.ResultCounts[index] ?? 0,
      })),
      allowedBuildingIds: allowedBuildingIds.map(factoryId => factoryId.toString()),
      modifierCode: effectiveModifierCode,
      modifierKind,
      supportsProliferatorModes,
      maxProliferatorLevel,
      isSynthetic,
      tags: tags.length > 0 ? tags : undefined,
      source: {
        recipe,
        rule: recipeRule,
      },
    };
  });

  const buildings: ResolvedBuildingSpec[] = usedFactoryIds.map(factoryId => {
    const item = itemById.get(factoryId);
    const rule = buildingRuleMap.get(factoryId);

    if (!item) {
      throw new Error(`Factory item ${factoryId} is referenced by recipes but missing from items.`);
    }

    return {
      buildingId: factoryId.toString(),
      typeId: item.Type,
      name: item.Name,
      icon: item.IconName,
      category: deriveBuildingCategory(rule),
      speedMultiplier: deriveSpeedMultiplier(item, rule),
      workPowerMW: deriveWorkPowerMW(item, rule),
      fractionatorBeltSpeedItemsPerMin: rule?.FractionatorBeltSpeedItemsPerMin,
      fractionatorMaxItemStack: rule?.FractionatorMaxItemStack,
      idlePowerMW: rule?.IdlePowerMW,
      intrinsicProductivityBonus: rule?.IntrinsicProductivityBonus ?? 0,
      tags: rule?.Tags ? [...rule.Tags] : undefined,
      source: {
        item,
        rule,
      },
    };
  });

  const proliferatorLevels: ResolvedProliferatorLevelSpec[] = (
    resolvedDefaultConfig.proliferatorLevels ?? []
  )
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
  const syntheticRecipeIds = recipes
    .filter(recipe => recipe.isSynthetic)
    .map(recipe => recipe.recipeId);
  const itemMap = new Map(items.map(item => [item.itemId, item]));
  const recipeMap = new Map(recipes.map(recipe => [recipe.recipeId, recipe]));
  const buildingMap = new Map(buildings.map(building => [building.buildingId, building]));
  const proliferatorLevelMap = new Map(proliferatorLevels.map(level => [level.level, level]));
  const recommendedDisabledBuildingIds = (
    resolvedDefaultConfig.recommendedDisabledBuildingIds ?? []
  )
    .map(buildingId => buildingId.toString())
    .filter(buildingId => buildingMap.has(buildingId));
  const recommendedDisabledRecipeIds = (
    resolvedDefaultConfig.recommendedDisabledRecipeIds ?? []
  )
    .map(recipeId => recipeId.toString())
    .filter(recipeId => recipeMap.has(recipeId));

  return {
    version: 'vanilla-compatible@1',
    dataset,
    defaultConfig: resolvedDefaultConfig,
    iconAtlasIds,
    items,
    recipes,
    buildings,
    proliferatorLevels,
    itemMap,
    recipeMap,
    buildingMap,
    proliferatorLevelMap,
    recommendedSolve: resolvedDefaultConfig.recommendedSolve ?? {},
    recommendedDisabledRecipeIds,
    recommendedDisabledBuildingIds,
    rawItemIds,
    syntheticRecipeIds,
  };
}
