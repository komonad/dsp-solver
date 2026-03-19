# Runtime Exporter

This repository now includes a minimal BepInEx runtime exporter subproject at:

- [tools/dsp-runtime-exporter](/D:/dsp-dev/dspcalc/tools/dsp-runtime-exporter)

Its purpose is narrow:

- read the final runtime-loaded DSP item and recipe data after mods have patched
  the game
- export that data directly into the current canonical raw dataset format used
  by `src/catalog/spec.ts`

## Why runtime export

Static parsers can read vanilla resources from disk, but they do not necessarily
see the final runtime proto state after BepInEx mods add or edit items and
recipes.

For calculator correctness, the authoritative source for a modded dataset is:

`game runtime after mods load`

not:

`static vanilla files on disk`

## Current behavior

The first version exports:

- `items`
- `recipes`

It does not yet export:

- icon atlases
- dataset defaults
- a separate raw debug dump

Those can be added later without changing the canonical dataset shape.

## Build path convention

The exporter now follows the same local-path pattern as
[MinimalDSPModTemplate](/D:/dsp-dev/MinimalDSPModTemplate):

- copy [Local.props.example](/D:/dsp-dev/dspcalc/tools/dsp-runtime-exporter/Local.props.example)
  to `Local.props`
- fill in `DSPManagedPath`
- fill in `BepInExDllPath`
- optionally fill in `ProfileRoot` to enable `DeployToProfile`

This does not copy the template's full setup pipeline. Public DSP mods use
multiple build styles, so the exporter keeps only the minimal local-path
configuration that it actually needs.

The plugin GUID is `com.comonad.dspcalc.runtime-exporter`.

## Output

The exporter writes a JSON file matching the current raw dataset schema:

- [src/catalog/spec.ts](/D:/dsp-dev/dspcalc/src/catalog/spec.ts)

That means the main project can consume the exported file directly through the
existing loader and resolver pipeline.
