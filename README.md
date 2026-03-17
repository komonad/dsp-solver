# dspcalc

This repository is being rebuilt around a strict split between:

- raw dataset files
- default dataset configuration
- solver input/output specs
- presentation/web rendering

The current goal is a linear-programming-based production solver for Dyson Sphere Program and its mods, with browser rendering that never invents business logic on its own.

## Current structure

- [src/catalog](/D:/dsp-dev/dspcalc/src/catalog): dataset format, default config format, loading, and resolution into the internal catalog model
- [src/solver](/D:/dsp-dev/dspcalc/src/solver): solver request/result types
- [src/presentation](/D:/dsp-dev/dspcalc/src/presentation): pure presentation-facing view models
- [src/web](/D:/dsp-dev/dspcalc/src/web): current web entry
- [src/legacy](/D:/dsp-dev/dspcalc/src/legacy): historical reference only

## Data files

- [Vanilla.json](/D:/dsp-dev/dspcalc/data/Vanilla.json): raw dataset in the external vanilla-compatible format
- [Vanilla.defaults.json](/D:/dsp-dev/dspcalc/data/Vanilla.defaults.json): optional default configuration for that dataset

Minimal examples used only for tests live under [tests/fixtures](/D:/dsp-dev/dspcalc/tests/fixtures).

## Tests kept during refactor

- [catalog-vanilla-format.test.ts](/D:/dsp-dev/dspcalc/tests/catalog-vanilla-format.test.ts)
- [catalog-resolve.test.ts](/D:/dsp-dev/dspcalc/tests/catalog-resolve.test.ts)
- [minimal-abstract-config.test.ts](/D:/dsp-dev/dspcalc/tests/minimal-abstract-config.test.ts)
- [minimal-file-load.test.ts](/D:/dsp-dev/dspcalc/tests/minimal-file-load.test.ts)

## Common commands

```bash
npm run build
npm run typecheck
npm test -- --runInBand
npx webpack --config webpack.config.js
```

## Key docs

- [data-format.md](/D:/dsp-dev/dspcalc/docs/data-format.md)
- [solver-spec.md](/D:/dsp-dev/dspcalc/docs/solver-spec.md)
- [minimal-test-config.md](/D:/dsp-dev/dspcalc/docs/minimal-test-config.md)
