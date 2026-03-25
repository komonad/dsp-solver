# Asset And Frontend Research

## Current icon approach

The web app now uses a sprite-atlas pipeline with dataset-configurable pack order:

- Atlas metadata: [vanillaAtlas.json](../data/icons/vanillaAtlas.json)
- Atlas image: [Vanilla.png](../data/icons/Vanilla.png)
- Additional atlas metadata:
  - [GenesisBook.json](../data/icons/GenesisBook.json)
  - [MoreMegaStructure.json](../data/icons/MoreMegaStructure.json)
- Additional atlas images:
  - [GenesisBook.png](../data/icons/GenesisBook.png)
  - [MoreMegaStructure.png](../data/icons/MoreMegaStructure.png)
- Runtime registry: [iconRegistry.ts](../src/web/shared/iconRegistry.ts)
- React rendering: [EntityIcon.tsx](../src/web/shared/EntityIcon.tsx)

Lookup key:

- Use dataset `IconName`
- Do not use localized display name
- Search atlas packs in `defaultConfig.iconAtlasIds` order
- Fall back to `Vanilla` when no pack order is configured

Fallback behavior:

- If `IconName` is present in the configured atlas packs, render the sprite
- Otherwise render a deterministic fallback badge from the entity label
- This keeps test datasets and custom mod datasets usable even when no icon pack exists

## Built-in dataset editor

The web app now includes two in-browser editing surfaces:

- Panel component: [DatasetEditorPanel.tsx](../src/web/catalog/editor/DatasetEditorPanel.tsx)
- Structured editor: [StructuredDatasetEditor.tsx](../src/web/catalog/editor/StructuredDatasetEditor.tsx)
- Pure helper layer: [catalogEditor.ts](../src/web/catalog/editor/catalogEditor.ts)
- Parse/resolve path: [catalogClient.ts](../src/web/catalog/catalogClient.ts)

Current scope:

- Edit raw dataset JSON
- Edit default-config JSON
- Edit items structurally
- Edit recipes structurally
- Edit building rules structurally
- Edit key default-config fields structurally
- Apply changes in the current browser session
- Reset editor text back to the last loaded source

Current limitation:

- Edited dataset text is not persisted across full page reloads
- Only workbench UI state is persisted today
- Recipe array fields are currently edited as comma-separated numeric lists, not a grid editor

## Recommended frontend direction

Current recommendation is not a full framework rewrite.

Reasons:

- The app is already a static React workbench with no server requirement
- A rushed migration to Next.js or another meta-framework would add routing/build complexity without solving the current bottleneck
- The bigger problem is component structure and interaction density, not SSR

Recommended next stack steps:

1. Replace the single large workbench component with feature components
   - request editor
   - result panels
   - dataset editor
   - icon/entity display primitives
   - item ledger + item slice inspector
2. Migrate the build tool from webpack to Vite when the UI surface stabilizes
3. Introduce targeted libraries instead of a full rewrite
   - Radix UI for primitives/dialogs/popovers
   - TanStack Table for dense item/recipe/building grids
   - CodeMirror or Monaco for the built-in JSON editor
4. If the app later needs pages, routing, or server-side asset tooling, then evaluate a larger framework change

## External icon asset source

The current icon source is the public `DSPCalculator/dsp-calc` repository:

- Repo: [DSPCalculator/dsp-calc](https://github.com/DSPCalculator/dsp-calc)
- Relevant paths:
  - `icon/Vanilla.json`
  - `icon/Vanilla.png`
  - `src/GameData.jsx`
  - `src/icon.jsx`

Useful findings:

- Main item/building icons are sprite-sheet based
- `IconName` maps cleanly to atlas keys
- The repo also contains mod-specific atlases and some individual PNGs
- `src/GameData.jsx` carries explicit mod GUIDs and composes dataset/icon packs by enabled mod list
- The `icon/` directory currently exposes at least:
  - `Vanilla`
  - `GenesisBook`
  - `MoreMegaStructure`
  - `FractionateEverything`

License handling:

- Upstream repo license: Mulan PSL v2
- Local copy: [dsp-calc.MulanPSL2.LICENSE](../third_party/dsp-calc.MulanPSL2.LICENSE)

## DSP data-dump research

Two viable export paths are clear now.

### Path A: offline asset extraction

Most practical offline path found so far:

1. Use a Unity asset extractor
   - [AssetRipper](https://github.com/AssetRipper/AssetRipper)
   - [uTinyRipper](https://github.com/mafaca/UtinyRipper)
2. Feed extracted assets into a DSP-specific conversion script
   - [GenerateDataDSP.py gist](https://gist.github.com/glcoder/44f33a9d1b5b9618a44fbe81af9ebda0)

What that gist already does:

- Reads extracted DSP proto assets
- Emits recipe/item/building-related JSON
- Builds an icon sprite sheet

This is the fastest route for a one-off or scripted offline dataset refresh because it does not require maintaining a live game mod.

### Path B: in-game BepInEx exporter mod

`GreyHak/dsp-csv-gen` is not a recipe exporter, but it proves the operational shape we need:

- BepInEx plugin
- in-game trigger
- disk output
- configurable output path
- support for loading additional world data before export

That makes it a good reference architecture for a future `dspcalc` exporter mod that would:

1. iterate game proto data in-process
2. write `dataset.json`
3. write `defaults.json`
4. emit icon atlas metadata and PNGs
5. optionally include enabled mod GUIDs in the export manifest

The real gap today is not feasibility; it is implementation effort. The exporter mod still needs to be written.

Other useful public references:

- [GreyHak/dsp-csv-gen](https://github.com/GreyHak/dsp-csv-gen)
  - Good reference for a DSP export mod shape
  - Focused on planetary resource data, not full recipe/icon export
- [johndoe31415/dspbptk](https://github.com/johndoe31415/dspbptk)
  - Useful for blueprint extraction/testing
  - Not a full catalog/icon exporter

Recommended future workflow:

1. Build a small offline exporter command for this repo
2. Let it consume extracted Unity assets
3. Generate:
   - dataset JSON
   - defaults JSON
   - icon atlas metadata
   - icon atlas PNG
4. Add a thin per-mod mapping layer instead of hard-coding mod semantics in app code
