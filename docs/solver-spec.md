# Solver Spec

This document captures the current architecture decisions for the rebuild.

## Goals

- solve multi-product, multi-recipe balancing problems with linear programming
- keep solver input and output explicit and testable
- ensure every number shown in the browser can be reproduced from solver output in tests
- keep the web layer free from self-invented business logic

## Layer boundaries

1. Raw dataset
   A vanilla-compatible JSON file that contains only `items` and `recipes`.
2. Dataset default config
   Optional dataset-coupled defaults such as proliferator tables, modifier-code meanings, and recommended classifications.
3. Solver request / result
   The contract consumed and produced by the solver.
4. Presentation / web
   Pure reformatting, grouping, sorting, filtering, and display.

## Canonical units

- item flow: `items/min`
- recipe execution rate: `runs/min`
- recipe cycle: `seconds/cycle`
- building speed: dimensionless multiplier
- power: `MW`
- building count: continuous count for solver output, rounded count for user-facing placement summary

## Core principle

The solver should optimize over flow, not over recipe cycle counts or building counts.

The internal decision variable is:

```ts
x(option): number // actual recipe execution rate in runs/min
```

An `option` is a compiled solver choice such as:

- recipe
- building
- proliferator level
- proliferator mode

## Derived formulas

### Single-building execution rate

```ts
baseRunsPerMin = 60 / cycleTimeSec;

singleBuildingRunsPerMin =
  baseRunsPerMin *
  building.speedMultiplier *
  speedModeMultiplier;
```

### Per-run IO

```ts
effectiveInputAmountPerRun = baseInputAmount;

effectiveOutputAmountPerRun =
  baseOutputAmount *
  (1 + building.intrinsicProductivityBonus) *
  productivityModeMultiplier;
```

### Net item rate

```ts
netItemRate(itemId) =
  sum(x(option) * outputPerRun(itemId, option)) -
  sum(x(option) * inputPerRun(itemId, option));
```

### Building count

```ts
exactBuildingCount(option) = x(option) / singleBuildingRunsPerMin(option);
roundedUpBuildingCount(option) = ceil(exactBuildingCount(option));
```

### Power

```ts
activePowerMW(option) =
  roundedUpBuildingCount(option) *
  building.workPowerMW *
  proliferatorPowerMultiplier;

roundedPlacementPowerMW(option) =
  roundedUpBuildingCount(option) *
  building.workPowerMW *
  proliferatorPowerMultiplier;
```

Current implementation expectation:

- user-facing power is based on rounded-up building count
- idle power is ignored for now
- until we intentionally separate them again, `activePowerMW` and `roundedPlacementPowerMW` may be reported with the same rounded working-power value

## Proliferator modeling

Proliferator effects are modeled as recipe variants, not as building abilities.

For a recipe variant with proliferator enabled:

- the recipe gains an extra proliferator input
- the added proliferator consumption is derived from total input consumption and spray count
- speed, productivity, and power multipliers come from the selected proliferator level

`itemId` on a proliferator level is optional metadata. It is only required when we want solver-visible proliferator consumption to refer to a concrete catalog item.

That keeps proliferator behavior in solver-visible IO, instead of hiding it in the web layer.

Current implementation note:

- proliferator variants are compiled into the LP option set
- proliferator consumption is currently treated as an external input, not yet expanded into its own upstream production chain

## Resolved catalog model

The solver consumes a resolved model, not the raw dataset file directly.

```ts
type ResolvedCatalogModel = {
  version: string;
  dataset: VanillaDatasetSpec;
  defaultConfig: CatalogDefaultConfigSpec;
  items: ResolvedItemSpec[];
  recipes: ResolvedRecipeSpec[];
  buildings: ResolvedBuildingSpec[];
  proliferatorLevels: ResolvedProliferatorLevelSpec[];
  itemMap: Map<string, ResolvedItemSpec>;
  recipeMap: Map<string, ResolvedRecipeSpec>;
  buildingMap: Map<string, ResolvedBuildingSpec>;
  proliferatorLevelMap: Map<number, ResolvedProliferatorLevelSpec>;
  rawItemIds: string[];
  syntheticRecipeIds: string[];
};
```

Important details:

- `allowedBuildingIds` comes directly from each recipe's `Factories` list
- building category is presentation metadata only
- missing default-config entries should degrade safely instead of requiring hardcoded dataset semantics

## Solver request

The request shape still targets explicit constraints and user overrides:

```ts
type SolveRequest = {
  targets: Array<{ itemId: string; ratePerMin: number }>;
  objective: 'min_buildings' | 'min_power' | 'min_external_input';
  balancePolicy: 'allow_surplus' | 'force_balance';
  rawInputItemIds?: string[];
  disabledRecipeIds?: string[];
  disabledBuildingIds?: string[];
  forcedRecipeByItem?: Record<string, string>;
  preferredRecipeByItem?: Record<string, string>;
  forcedBuildingByRecipe?: Record<string, string>;
  preferredBuildingByRecipe?: Record<string, string>;
  forcedProliferatorLevelByRecipe?: Record<string, number>;
  preferredProliferatorLevelByRecipe?: Record<string, number>;
  forcedProliferatorModeByRecipe?: Record<string, 'none' | 'speed' | 'productivity'>;
  preferredProliferatorModeByRecipe?: Record<string, 'none' | 'speed' | 'productivity'>;
};
```

User input is expected to override dataset defaults whenever both are present.

## Solver result

The result must be rich enough for direct rendering:

```ts
type SolveResult = {
  status: 'optimal' | 'infeasible' | 'invalid_input';
  diagnostics: {
    messages: string[];
    unmetPreferences: string[];
  };
  targets: Array<{
    itemId: string;
    requestedRatePerMin: number;
    actualRatePerMin: number;
  }>;
  recipePlans: Array<{
    recipeId: string;
    buildingId: string;
    proliferatorLevel: number;
    proliferatorMode: 'none' | 'speed' | 'productivity';
    runsPerMin: number;
    exactBuildingCount: number;
    roundedUpBuildingCount: number;
    activePowerMW: number;
    roundedPlacementPowerMW: number;
    inputs: Array<{ itemId: string; ratePerMin: number }>;
    outputs: Array<{ itemId: string; ratePerMin: number }>;
  }>;
  buildingSummary: Array<{
    buildingId: string;
    exactCount: number;
    roundedUpCount: number;
    activePowerMW: number;
    roundedPlacementPowerMW: number;
  }>;
  powerSummary: {
    activePowerMW: number;
    roundedPlacementPowerMW: number;
  };
  externalInputs: Array<{ itemId: string; ratePerMin: number }>;
  surplusOutputs: Array<{ itemId: string; ratePerMin: number }>;
  itemBalance: Array<{
    itemId: string;
    producedRatePerMin: number;
    consumedRatePerMin: number;
    netRatePerMin: number;
  }>;
};
```

## Web constraints

The web layer may:

- gather user input
- call the solver
- group, sort, filter, and format solver output

The web layer may not:

- hardcode multipliers
- recalculate building counts as business logic
- derive hidden power formulas
- reinterpret recipe semantics from raw dataset fields

If the UI needs a display-specific structure, it must be produced from `SolveResult` by a pure, separately tested presentation function.
