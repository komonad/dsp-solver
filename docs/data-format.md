# Data Format

This project keeps the raw dataset format intentionally close to the upstream `Vanilla.json` shape.

## Raw dataset

The raw catalog file contains only:

```json
{
  "items": [...],
  "recipes": [...]
}
```

The corresponding TypeScript shape is:

```ts
type VanillaDatasetSpec = {
  items: VanillaItemRecord[];
  recipes: VanillaRecipeRecord[];
};
```

### `VanillaItemRecord`

```ts
type VanillaItemRecord = {
  ID: number;
  Type: number;
  Name: string;
  IconName: string;
  GridIndex?: number;
  WorkEnergyPerTick?: number;
  Speed?: number;
  Space?: number;
  MultipleOutput?: number;
};
```

### `VanillaRecipeRecord`

```ts
type VanillaRecipeRecord = {
  ID: number;
  Type: number;
  Factories: number[];
  Name: string;
  Items: number[];
  ItemCounts: number[];
  Results: number[];
  ResultCounts: number[];
  TimeSpend: number;
  Proliferator: number;
  IconName: string;
};
```

`Factories` is the authoritative list of concrete buildings that may run the recipe. It is not derived from building categories.

`Proliferator` is a raw modifier code from the dataset. Its meaning is not hardcoded into the parser.

## Default config

Each dataset may optionally ship with a companion default config file such as [Vanilla.defaults.json](/D:/dsp-dev/dspcalc/data/Vanilla.defaults.json).

Its role is:

- provide dataset-coupled defaults that the raw dataset cannot express cleanly
- provide recommended defaults that users may later override in solver input
- avoid hardcoding dataset-specific semantics in the codebase

The current shape is:

```ts
type CatalogDefaultConfigSpec = {
  proliferatorLevels?: ProliferatorLevelConfigSpec[];
  buildingRules?: CatalogBuildingRuleSpec[];
  recipeModifierRules?: RecipeModifierRuleSpec[];
  recommendedRawItemIds?: number[];
  recommendedRawItemTypeIds?: number[];
  syntheticRecipeTypeIds?: number[];
  syntheticRecipeNamePrefixes?: string[];
  syntheticFactoryIds?: number[];
};
```

All top-level fields are optional.

### `proliferatorLevels`

Defines level-specific spray count and multipliers.

`ItemID` is optional. It is only needed when a dataset wants proliferator consumption to map to a concrete item in the catalog.

### `buildingRules`

Optional dataset defaults for building category, idle power, intrinsic productivity, or explicit overrides.

`Category` is optional. If missing, the resolved model falls back to `"factory"`.

### `recipeModifierRules`

Optional mapping from raw `recipe.Proliferator` codes to internal modifier meaning.

If a code is not configured, the parser falls back to a safe no-op interpretation:

- `modifierKind = 'none'`
- `supportsProliferatorModes = ['none']`
- `maxProliferatorLevel = 0`

### `recommendedRaw*` and `synthetic*`

These are optional defaults, not hard requirements. They help classify items and recipes for presentation and default solver behavior, but they are expected to be overridable by user input later.

## Resolution pipeline

The parser resolves:

`VanillaDatasetSpec + CatalogDefaultConfigSpec -> ResolvedCatalogModel`

The resolved model is what the solver should consume. The web layer should never re-derive raw dataset semantics on its own.
