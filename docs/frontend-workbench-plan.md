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

### 3. Detailed Result Surfaces

Show:

- Factory-centered plan view
- Full item ledger
- Single-item slice
- Diagnostics
- Item balance
- JSON audit panels

Why:

- The solution needs both a global factory view and an item-centric inspection workflow.

## Factory Plan View And Item Ledger

The current flat recipe-plan list is not enough.

The result area should be split into three connected views:

- a default factory-centered plan view
- a full item ledger
- a single-item slice panel

### Core Rules

#### 1. The default main view remains factory-centered

The default main result view should still be organized around selected recipe/building plans.

Why:

- This is the most direct way to inspect the chosen solution.
- It matches how users verify building counts, power, and proliferator decisions.

But the ordering still must follow graph structure rather than a flat alphabetical sort.

#### 2. Factory plan order must follow graph traversal order

The default plan list should not be sorted alphabetically or by raw recipe ID.

Recommended rule:

- Start from the requested target items.
- Traverse upstream through the actually used plans.
- Emit plans in traversal order.
- Keep directly related plans close together.

Why:

- This gives users locality.
- Neighboring rows stay related in the same part of the graph.
- Large plans remain inspectable without mentally reconstructing the dependency graph from scratch.

Recommended implementation:

- Build a solved dependency graph from `SolveResult.recipePlans`.
- Use a stable DFS or BFS from targets.
- Preserve a deterministic tie-break:
  - first by shortest distance from any target
  - then by upstream appearance order
  - then by recipe/building ID as a final stable fallback

#### 3. We need a full item ledger, not an intermediate-only list

This list should contain every involved item in the solved logistics graph:

- net inputs
- net outputs
- intermediate items

Recommended ordering:

- first: items with positive net external input
- second: requested outputs and other net outputs
- third: all remaining intermediate items

For the remaining intermediate items, sort by throughput:

- `max(totalProducedRatePerMin, totalConsumedRatePerMin)` descending

Why:

- Users need one place to inspect the full solved item ledger.
- Inputs and outputs should stay visibly separated from pure transit items.
- High-throughput intermediates matter more than tiny edge cases.

Each item row should show:

- item name
- total produced rate
- total consumed rate
- net rate
- whether it is treated as raw input
- whether it is a requested target

Rule:

- if `netRatePerMin === 0`, net can be visually muted or omitted
- produced and consumed should always be shown

#### 4. Any item in the ledger must support direct strategy edits

The item ledger is not read-only.

For every item, the UI should allow:

- mark as raw input
- unmark as raw input
- open the item slice

Optional later:

- preferred recipe
- forced recipe

This should be possible directly from the item row, without forcing the user back to the global request form.

#### 5. We need a local slice for any single item

The full item ledger is the global entry point.

From any item row, the user should be able to open an item slice showing:

- item summary
- all producer plans
- all consumer plans
- full plan IO for each related plan
- item-level strategy controls

This slice should work for every item in the graph, including:

- raw inputs
- requested outputs
- intermediate items

#### 6. Plans may appear in multiple item slices

This duplication is correct and intentional.

Why:

- Users reason about one item's local cross-section at a time.
- Multi-output recipes legitimately participate in multiple item slices.

Recommended item-slice header content:

- item name
- produced rate
- consumed rate
- net rate
- whether it is treated as raw input
- whether it is a requested target
- short summary of active item-level strategy

Recommended related-plan row content:

- recipe name
- building name
- proliferator label
- contribution rate for this item
- full input/output list
- building count and power

## Presentation Model Changes Needed

To support this interaction model, the presentation layer should stop exposing only a flat `recipePlans` array for the main UI.

Add higher-level structures such as:

- `factoryPlanSections[]`
- `itemLedger[]`
- `itemSlicesById`

`itemLedger[]` should contain:

- `itemId`
- `itemName`
- `producedRatePerMin`
- `consumedRatePerMin`
- `netRatePerMin`
- `isRawInput`
- `isTarget`
- `sortBucket`
- `throughputRatePerMin`

`itemSlicesById[itemId]` should contain:

- item summary
- item-level strategy state derived from request
- ordered producer entries
- ordered consumer entries

Each related plan entry should include:

- `planKey`
- `recipeId`
- `buildingId`
- `proliferatorLabel`
- `contributedProducedRatePerMin`
- `contributedConsumedRatePerMin`
- full plan inputs/outputs

Important:

- This structure must be built in `src/presentation`, not inside React.
- Duplication of multi-output plans across item slices is acceptable.
- The ordering algorithm must be deterministic and separately unit tested.

## Recommended Next UI Refactor

When splitting the current page, add these result panels:

- `ResultOverviewPanel`
- `FactoryPlanPanel`
- `ItemLedgerPanel`
- `ItemSlicePanel`
- `DiagnosticsPanel`

`FactoryPlanPanel` is the default main result view.

`ItemLedgerPanel` is the global item index and the main entry point for item-level edits.

`ItemSlicePanel` is the local analysis surface for one selected item.

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
  - target-rooted factory plan ordering
  - item-ledger bucket ordering
  - item-ledger throughput ordering for intermediates
  - multi-output plan duplication across item slices
  - item-level strategy summaries in item ledger and item slice

### Step 7

- Add UI interactions for item-level strategy editing directly from the item ledger and item slice.

## Testing Rules

- Presentation grouping must be tested in `src/presentation`.
- Request-building behavior must be tested separately from React rendering.
- React components should be tested only against already-built presentation/request models.
- Browser smoke tests must validate that the built bundle shows the same labels and sections as the tested models.
- Production graph ordering must be validated with deterministic unit tests, not only browser snapshots.
