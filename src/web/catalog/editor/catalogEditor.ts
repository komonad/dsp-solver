import type {
  CatalogBuildingRuleSpec,
  CatalogDefaultConfigSpec,
  VanillaDatasetSpec,
  VanillaItemRecord,
  VanillaRecipeRecord,
} from '../../../catalog';

export interface EditableCatalogSource {
  dataset: VanillaDatasetSpec;
  defaultConfig: CatalogDefaultConfigSpec;
}

export interface EditableBuildingEntry {
  id: number;
  label: string;
  item?: VanillaItemRecord;
  rule?: CatalogBuildingRuleSpec;
}

function cloneDataset(dataset: VanillaDatasetSpec): VanillaDatasetSpec {
  return {
    items: dataset.items.map(item => ({ ...item })),
    recipes: dataset.recipes.map(recipe => ({
      ...recipe,
      Factories: [...recipe.Factories],
      Items: [...recipe.Items],
      ItemCounts: [...recipe.ItemCounts],
      Results: [...recipe.Results],
      ResultCounts: [...recipe.ResultCounts],
    })),
  };
}

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

function nextAvailableNumericId(existingIds: number[], startAt = 1): number {
  const used = new Set(existingIds);
  let nextId = Math.max(startAt, 1);

  while (used.has(nextId)) {
    nextId += 1;
  }

  return nextId;
}

export function parseEditableCatalogSource(
  datasetText: string,
  defaultConfigText = '{}'
): EditableCatalogSource {
  return {
    dataset: JSON.parse(datasetText) as VanillaDatasetSpec,
    defaultConfig: JSON.parse(defaultConfigText || '{}') as CatalogDefaultConfigSpec,
  };
}

export function stringifyEditableCatalogSource(source: EditableCatalogSource): {
  datasetText: string;
  defaultConfigText: string;
} {
  return {
    datasetText: JSON.stringify(source.dataset, null, 2),
    defaultConfigText: JSON.stringify(source.defaultConfig, null, 2),
  };
}

export function buildEditableBuildingEntries(source: EditableCatalogSource): EditableBuildingEntry[] {
  const buildingIds = new Set<number>();

  source.dataset.items.forEach(item => {
    if (item.Speed !== undefined || item.WorkEnergyPerTick !== undefined) {
      buildingIds.add(item.ID);
    }
  });

  source.dataset.recipes.forEach(recipe => {
    recipe.Factories.forEach(factoryId => buildingIds.add(factoryId));
  });

  source.defaultConfig.buildingRules?.forEach(rule => buildingIds.add(rule.ID));

  const itemMap = new Map(source.dataset.items.map(item => [item.ID, item]));
  const ruleMap = new Map((source.defaultConfig.buildingRules ?? []).map(rule => [rule.ID, rule]));

  return Array.from(buildingIds)
    .sort((left, right) => left - right)
    .map(id => {
      const item = itemMap.get(id);
      const rule = ruleMap.get(id);
      return {
        id,
        item,
        rule,
        label: item ? `${item.Name} (#${id})` : `#${id}`,
      };
    });
}

export function createEditableItem(source: EditableCatalogSource): VanillaItemRecord {
  return {
    ID: nextAvailableNumericId(source.dataset.items.map(item => item.ID), 1000),
    Type: 0,
    Name: 'New Item',
    IconName: '',
  };
}

export function createEditableRecipe(source: EditableCatalogSource): VanillaRecipeRecord {
  return {
    ID: nextAvailableNumericId(source.dataset.recipes.map(recipe => recipe.ID), 1),
    Type: 0,
    Factories: [],
    Name: 'New Recipe',
    Items: [],
    ItemCounts: [],
    Results: [],
    ResultCounts: [],
    TimeSpend: 60,
    Proliferator: 0,
    IconName: '',
  };
}

export function createEditableBuildingRule(source: EditableCatalogSource): CatalogBuildingRuleSpec {
  const existingIds = buildEditableBuildingEntries(source).map(entry => entry.id);
  return {
    ID: nextAvailableNumericId(existingIds, 1),
    Category: 'factory',
  };
}

export function upsertEditableItem(
  source: EditableCatalogSource,
  nextItem: VanillaItemRecord
): EditableCatalogSource {
  const dataset = cloneDataset(source.dataset);
  const itemIndex = dataset.items.findIndex(item => item.ID === nextItem.ID);

  if (itemIndex >= 0) {
    dataset.items[itemIndex] = { ...nextItem };
  } else {
    dataset.items.push({ ...nextItem });
  }

  return {
    dataset,
    defaultConfig: cloneDefaultConfig(source.defaultConfig),
  };
}

export function removeEditableItem(
  source: EditableCatalogSource,
  itemId: number
): EditableCatalogSource {
  return {
    dataset: {
      items: source.dataset.items.filter(item => item.ID !== itemId).map(item => ({ ...item })),
      recipes: source.dataset.recipes.map(recipe => ({
        ...recipe,
        Factories: [...recipe.Factories],
        Items: [...recipe.Items],
        ItemCounts: [...recipe.ItemCounts],
        Results: [...recipe.Results],
        ResultCounts: [...recipe.ResultCounts],
      })),
    },
    defaultConfig: cloneDefaultConfig(source.defaultConfig),
  };
}

export function upsertEditableRecipe(
  source: EditableCatalogSource,
  nextRecipe: VanillaRecipeRecord
): EditableCatalogSource {
  const dataset = cloneDataset(source.dataset);
  const recipeIndex = dataset.recipes.findIndex(recipe => recipe.ID === nextRecipe.ID);
  const normalizedRecipe = {
    ...nextRecipe,
    Factories: [...nextRecipe.Factories],
    Items: [...nextRecipe.Items],
    ItemCounts: [...nextRecipe.ItemCounts],
    Results: [...nextRecipe.Results],
    ResultCounts: [...nextRecipe.ResultCounts],
  };

  if (recipeIndex >= 0) {
    dataset.recipes[recipeIndex] = normalizedRecipe;
  } else {
    dataset.recipes.push(normalizedRecipe);
  }

  return {
    dataset,
    defaultConfig: cloneDefaultConfig(source.defaultConfig),
  };
}

export function removeEditableRecipe(
  source: EditableCatalogSource,
  recipeId: number
): EditableCatalogSource {
  return {
    dataset: {
      items: source.dataset.items.map(item => ({ ...item })),
      recipes: source.dataset.recipes
        .filter(recipe => recipe.ID !== recipeId)
        .map(recipe => ({
          ...recipe,
          Factories: [...recipe.Factories],
          Items: [...recipe.Items],
          ItemCounts: [...recipe.ItemCounts],
          Results: [...recipe.Results],
          ResultCounts: [...recipe.ResultCounts],
        })),
    },
    defaultConfig: cloneDefaultConfig(source.defaultConfig),
  };
}

export function upsertEditableBuildingRule(
  source: EditableCatalogSource,
  nextRule: CatalogBuildingRuleSpec
): EditableCatalogSource {
  const defaultConfig = cloneDefaultConfig(source.defaultConfig);
  const buildingRules = defaultConfig.buildingRules ? [...defaultConfig.buildingRules] : [];
  const ruleIndex = buildingRules.findIndex(rule => rule.ID === nextRule.ID);
  const normalizedRule = {
    ...nextRule,
    Tags: nextRule.Tags ? [...nextRule.Tags] : undefined,
  };

  if (ruleIndex >= 0) {
    buildingRules[ruleIndex] = normalizedRule;
  } else {
    buildingRules.push(normalizedRule);
  }

  defaultConfig.buildingRules = buildingRules;

  return {
    dataset: cloneDataset(source.dataset),
    defaultConfig,
  };
}

export function removeEditableBuildingRule(
  source: EditableCatalogSource,
  buildingId: number
): EditableCatalogSource {
  const defaultConfig = cloneDefaultConfig(source.defaultConfig);
  defaultConfig.buildingRules = (defaultConfig.buildingRules ?? []).filter(rule => rule.ID !== buildingId);

  return {
    dataset: cloneDataset(source.dataset),
    defaultConfig,
  };
}
