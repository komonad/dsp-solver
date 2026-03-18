# Frontend Workbench Plan

## Goals

- Keep solver semantics outside React components.
- Make every displayed number traceable to a tested presentation model.
- Support multiple datasets and multiple solve scenarios without rewriting the page.
- Keep room for future locale expansion and more advanced request editing.

## Recommended Frontend Layers

### 1. App Shell

Responsibility:

- Route-level layout
- Dataset loading lifecycle
- Persisted page-level state
- Error boundary and top-level notifications

Current direction:

- The current `App.tsx` already behaves like an app shell, but it still owns too much request editing and result rendering logic.

Target split:

- `src/web/app/AppShell.tsx`
- `src/web/app/WorkbenchPage.tsx`
- `src/web/app/useWorkbenchState.ts`

### 2. Data Source Layer

Responsibility:

- Load dataset/default-config files
- Normalize load errors
- Provide preset metadata

Target files:

- `src/web/data/catalogClient.ts`
- `src/web/data/datasetPresets.ts`

### 3. Request Editor Layer

Responsibility:

- Own editable UI state for targets and overrides
- Convert UI state into `SolveRequest`
- Keep advanced JSON editing isolated from the rest of the form

Target files:

- `src/web/request-editor/requestState.ts`
- `src/web/request-editor/requestBuilder.ts`
- `src/web/request-editor/components/*`

### 4. Result Presentation Layer

Responsibility:

- Convert solver result into stable, testable view sections
- Group and label cards/tables
- No hidden business calculations

Target files:

- `src/presentation/viewModel.ts`
- `src/presentation/sections.ts`

### 5. UI Component Layer

Responsibility:

- Pure visual rendering
- Stateless or minimally stateful components
- No solver/domain logic

Target files:

- `src/web/components/cards/*`
- `src/web/components/forms/*`
- `src/web/components/tables/*`

## Recommended Interaction Model

### Primary Page Layout

- Left column: request editor
- Right column: solve snapshot and results

This matches the current workbench and should stay. It is the right interaction model for comparison between request and result.

### Request Editor Sections

#### A. Dataset Source

Controls:

- Preset selector
- Dataset path
- Default-config path
- Load button

Why:

- Dataset switching is a core testing workflow, not an advanced feature.

#### B. Targets

Controls:

- Multi-target list
- Item selector
- Rate input
- Add/remove row

Why:

- This is the main entry point for almost every solve request.

#### C. Global Solve Options

Controls:

- Objective
- Balance policy
- Global proliferator policy

Why:

- These are high-frequency controls and should stay visible.

#### D. Common Constraints

Controls:

- Raw-input item tags
- Disabled recipe tags
- Disabled building tags

Why:

- These are common enough to deserve direct UI, and they map cleanly to chips/tag editors.

#### E. Recipe Preferences

Controls:

- Add preferred recipe row
- Per-row building preference
- Per-row proliferator mode preference
- Per-row proliferator level preference

Why:

- These are frequent enough for guided UI, but still more advanced than the top-level controls.

#### F. Advanced JSON

Controls:

- Raw JSON textarea
- Parsed error panel

Why:

- This is the escape hatch for low-frequency or not-yet-modeled request fields.

## Recommended Result Areas

### 1. Solve Snapshot

Show:

- Objective
- Balance policy
- Proliferator policy
- Status
- Target summary
- Raw overrides summary
- Disabled counts
- Preference summary

Why:

- Users need to audit what request produced the visible plan.

### 2. Overview Cards

Show as separate cards:

- Targets & External Inputs
- Buildings & Power
- Surplus Outputs

Why:

- These are top-level summaries and should stay visually independent.

### 3. Detailed Plan

Show:

- Recipe plans
- Diagnostics
- Item balance
- JSON audit panels

Why:

- These are debugging and validation views, but still essential.

## Production Graph View

The current flat recipe-plan list is not enough. The main production view should become a product-grouped production graph.

### Core Rules

#### 1. Recipe order must follow graph traversal order

The list should not be sorted alphabetically or by raw recipe ID.

Recommended rule:

- Start from the requested target items.
- Traverse upstream through the actually used plans.
- Emit product groups in traversal order.
- Within each group, keep producer plans close to the consumers that caused them to appear.

Why:

- This gives users locality.
- Neighbouring rows stay related in the same part of the graph.
- Large plans remain inspectable without mentally reconstructing the dependency graph from scratch.

Recommended implementation:

- Build a solved dependency graph from `SolveResult.recipePlans`.
- Use a stable DFS or BFS from targets.
- Preserve a deterministic tie-break:
  - first by shortest distance from any target
  - then by upstream appearance order
  - then by recipe/building ID as a final stable fallback

#### 2. Recipe plans must be grouped by produced item

The primary view should group by product item, not by recipe.

That means:

- Each group represents one item.
- The group shows all plan entries that produce that item.
- The same plan entry may appear in more than one group if it has multiple outputs.

This duplication is correct and should be intentional.

Why:

- Users reason about “how this item is made”, not “what every recipe does globally”.
- Multi-output recipes participate in multiple item decisions, so they need to be visible in multiple groups.

Recommended group header content:

- Item name
- Requested/actual/net rate
- Whether it is treated as raw input
- Whether surplus exists
- Short summary of active production strategy

Recommended row content inside one group:

- Recipe name
- Building name
- Proliferator label
- Rate contribution for this group item
- Full input/output list
- Building count and power

### 3. Product-level strategy controls must exist in the product group

If the user wants to change how one item is produced, that interaction should be attached to that item’s group.

Examples:

- Mark this item as raw input
- Prefer a specific recipe for this item
- Force a specific recipe for this item
- Inspect which recipes are currently producing this item

Why:

- The user intent is item-centric.
- Putting these controls only in the left-side global form forces too much context switching.

Recommended interaction:

- Each product group header gets a compact “strategy” action area.
- Clicking it opens an inline editor or side panel scoped to that item.

Recommended controls in that item strategy editor:

- `Treat as raw input`
- `Preferred recipe`
- `Forced recipe`
- `Clear item overrides`

Optional later:

- default building preference for recipes producing this item
- default proliferator preference for recipes producing this item

## Presentation Model Changes Needed

To support the production graph view, the presentation layer should stop exposing only a flat `recipePlans` array for the main UI.

Add a higher-level structure such as:

- `productionGroups[]`
- each group keyed by `itemId`
- each group contains:
  - item summary
  - item-level strategy state derived from request
  - ordered producer entries

Each producer entry should include:

- `planKey`
- `recipeId`
- `buildingId`
- `proliferator label`
- `contributedOutputRatePerMin` for the current group item
- full plan inputs/outputs

Important:

- This grouping must be built in `src/presentation`, not inside React.
- Duplication of multi-output plans across groups is acceptable.
- The ordering algorithm must be deterministic and separately unit tested.

## Recommended Next UI Refactor

When splitting the current page, add one more layer:

- `ResultOverviewPanel`
- `ProductionGraphPanel`
- `DiagnosticsPanel`

`ProductionGraphPanel` should become the main interaction surface for item-level strategy editing.

## Next Engineering Steps

### Step 1

- Split the current `App.tsx` into `AppShell`, `RequestEditor`, and `ResultPanel`.

### Step 2

- Extract reusable chip-selector controls for raw inputs, disabled recipes, and disabled buildings.

### Step 3

- Extract result cards into pure components that accept only presentation-model props.

### Step 4

- Add a real local state module for request editing instead of ad hoc `useState` fields in the page component.

### Step 5

- Add browser-level regression cases for:
  - dataset switching
  - solving
  - disabling buildings
  - recipe preferences
  - surplus output visibility
  - Chinese UI labels

### Step 6

- Add presentation tests for:
  - target-rooted production group ordering
  - multi-output plan duplication across item groups
  - item-level strategy summaries in group headers

### Step 7

- Add UI interactions for item-level strategy editing directly from product groups.

## Testing Rules

- Presentation grouping must be tested in `src/presentation`.
- Request-building behavior must be tested separately from React rendering.
- React components should be tested only against already-built presentation/request models.
- Browser smoke tests must validate that the built bundle shows the same labels and sections as the tested models.
- Production graph ordering must be validated with deterministic unit tests, not only browser snapshots.
