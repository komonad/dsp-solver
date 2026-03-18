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

## Testing Rules

- Presentation grouping must be tested in `src/presentation`.
- Request-building behavior must be tested separately from React rendering.
- React components should be tested only against already-built presentation/request models.
- Browser smoke tests must validate that the built bundle shows the same labels and sections as the tested models.
