# Minimal Test Fixture

The minimal fixture exists only to test the parser and catalog-resolution pipeline with a hand-checkable dataset.

It is not a product dataset.

## Fixture files

- [MinimalVanilla.json](../tests/fixtures/MinimalVanilla.json)
- [Minimal.defaults.json](../tests/fixtures/Minimal.defaults.json)

## Why it exists

It gives us a tiny end-to-end path:

`JSON file -> loader -> validation -> resolved catalog model`

without depending on the full Vanilla dataset.

It also gives us numbers that are trivial to verify by hand.

## Fixture contents

The fixture has:

- one raw input item: `ore`
- one product item: `plate`
- one proliferator item: `spray_mk1`
- one building: `smelter`
- one recipe: `ore_to_plate`
- one proliferator level: level 1

## Expected behavior

For the base recipe:

- `cycleTimeSec = 60`
- `baseRunsPerMin = 1`
- base input per run = `1 ore`
- base output per run = `1 plate`

For proliferator level 1:

- `sprayCount = 10`
- `speedMultiplier = 2`
- `productivityMultiplier = 2`
- `powerMultiplier = 2`

That means:

- extra proliferator input per run = `1 / 10 = 0.1 spray_mk1`
- speed variant single-building rate = `2 runs/min`
- productivity variant output per run = `2 plate/run`

## What this validates

- explicit `allowedBuildingIds`
- proliferator-as-variant modeling
- `/min` semantics
- derived building count semantics
- derived power semantics
- end-to-end file loading without hidden hardcoded dataset logic
