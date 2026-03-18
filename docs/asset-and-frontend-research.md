# Asset And Frontend Research

## Current icon approach

The web app now uses a sprite-atlas pipeline for vanilla-compatible icons:

- Atlas metadata: [vanillaAtlas.json](/D:/dsp-dev/dspcalc/src/web/iconAtlas/vanillaAtlas.json)
- Atlas image: [Vanilla.png](/D:/dsp-dev/dspcalc/data/icons/Vanilla.png)
- Runtime registry: [iconRegistry.ts](/D:/dsp-dev/dspcalc/src/web/iconRegistry.ts)
- React rendering: [EntityIcon.tsx](/D:/dsp-dev/dspcalc/src/web/EntityIcon.tsx)

Lookup key:

- Use dataset `IconName`
- Do not use localized display name

Fallback behavior:

- If `IconName` is present in the vanilla atlas, render the sprite
- Otherwise render a deterministic fallback badge from the entity label
- This keeps test datasets and custom mod datasets usable even when no icon pack exists

## Built-in dataset editor

The web app now includes an in-browser dataset/default-config editor:

- Panel component: [DatasetEditorPanel.tsx](/D:/dsp-dev/dspcalc/src/web/DatasetEditorPanel.tsx)
- Parse/resolve path: [catalogClient.ts](/D:/dsp-dev/dspcalc/src/web/catalogClient.ts)

Current scope:

- Edit raw dataset JSON
- Edit default-config JSON
- Apply changes in the current browser session
- Reset editor text back to the last loaded source

Current limitation:

- Edited dataset text is not persisted across full page reloads
- Only workbench UI state is persisted today

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

License handling:

- Upstream repo license: Mulan PSL v2
- Local copy: [dsp-calc.MulanPSL2.LICENSE](/D:/dsp-dev/dspcalc/third_party/dsp-calc.MulanPSL2.LICENSE)

## DSP data-dump research

Most practical export path found so far:

1. Use a Unity asset extractor
   - [AssetRipper](https://github.com/AssetRipper/AssetRipper)
   - [uTinyRipper](https://github.com/mafaca/UtinyRipper)
2. Feed extracted assets into a DSP-specific conversion script
   - [GenerateDataDSP.py gist](https://gist.github.com/glcoder/44f33a9d1b5b9618a44fbe81af9ebda0)

What that gist already does:

- Reads extracted DSP proto assets
- Emits recipe/item/building-related JSON
- Builds an icon sprite sheet

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
