# DSP Runtime Exporter

This subproject contains a minimal BepInEx mod that exports the current game's
runtime-loaded items and recipes to the same dataset shape used by this
repository.

Current scope:

- export `items`
- export `recipes`
- read the final runtime `LDB` state after mods have loaded
- write one `*.json` dataset file compatible with `src/catalog/spec.ts`

Intentionally out of scope for the first version:

- icon atlas generation
- defaults inference
- full raw dump / debug dump layers
- automatic export on every startup by default

## Why this exists

Static parsers are useful for vanilla data, but they do not see the final
runtime proto state after BepInEx mods modify the game through tools such as
LDBTool/CommonAPI. This exporter reads the loaded runtime data instead.

## Build prerequisites

You need a local Dyson Sphere Program install plus BepInEx already installed
into that game directory.

The project expects either:

- `-p:DSPGameDir="C:\Games\Dyson Sphere Program"`

or both:

- `-p:DSPManagedDir="C:\Games\Dyson Sphere Program\DSPGAME_Data\Managed"`
- `-p:BepInExCoreDir="C:\Games\Dyson Sphere Program\BepInEx\core"`

## Build

```powershell
dotnet restore tools\dsp-runtime-exporter\DspCalc.RuntimeExporter.csproj
dotnet build tools\dsp-runtime-exporter\DspCalc.RuntimeExporter.csproj -c Release -p:DSPGameDir="C:\Games\Dyson Sphere Program"
```

## Install

Copy the built DLL into a BepInEx plugins folder, for example:

```text
<DSPGameDir>\BepInEx\plugins\DspCalc.RuntimeExporter\DspCalc.RuntimeExporter.dll
```

## Use

1. Launch the game with your target mods enabled.
2. Wait until the game reaches the main menu or an in-game scene.
3. Press `F8`.

The exporter writes a dataset JSON file to:

```text
<DSPGameDir>\BepInEx\config\dspcalc-exporter\CurrentGame.json
```

The hotkey and output location are configurable through the generated BepInEx
config file.

## Output format

The exported JSON uses the current canonical raw dataset shape:

- top-level `items`
- top-level `recipes`
- item fields such as `ID`, `Type`, `Name`, `IconName`
- recipe fields such as `Factories`, `Items`, `ItemCounts`, `Results`,
  `ResultCounts`, `TimeSpend`, `Proliferator`

Optional fields are emitted only when they can be read reliably at runtime.

## Notes

- The exporter uses runtime reflection on `LDB.items` and `LDB.recipes`.
- It does not depend on a particular external data-extraction mod.
- It does not currently export icon atlases. Missing icons can use the web
  fallback path until atlas export is added later.
