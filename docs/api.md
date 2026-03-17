# API Notes

This file is intentionally non-authoritative during the rebuild.

The current authoritative documents are:

- [data-format.md](/D:/dsp-dev/dspcalc/docs/data-format.md)
- [solver-spec.md](/D:/dsp-dev/dspcalc/docs/solver-spec.md)

Important current proliferator defaults for the vanilla dataset are:

- level 1: `+12.5% productivity`, `+25% speed`, `+30% extra power`, `13 sprays`
- level 2: `+20% productivity`, `+50% speed`, `+70% extra power`, `28 sprays`
- level 3: `+25% productivity`, `+100% speed`, `+150% extra power`, `75 sprays`

When represented in configuration multipliers, that means:

- level 1: `productivityMultiplier=1.125`, `speedMultiplier=1.25`, `powerMultiplier=1.3`
- level 2: `productivityMultiplier=1.2`, `speedMultiplier=1.5`, `powerMultiplier=1.7`
- level 3: `productivityMultiplier=1.25`, `speedMultiplier=2.0`, `powerMultiplier=2.5`

`ItemID` for a proliferator level is optional. It is only needed if the dataset wants proliferator use to map to a concrete item in the catalog.
