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

## Web hosting

The current web app is a static frontend bundle. There is no backend service yet.

### Local hosting

1. Install dependencies:

```bash
npm install
```

2. Build the web bundle:

```bash
npm run build:web
```

3. Host the generated `dist-web` directory:

```bash
npm run host
```

By default this serves [dist-web](/D:/dsp-dev/dspcalc/dist-web) at `http://127.0.0.1:8081`.

You can override host and port:

```bash
npm run host -- --host 0.0.0.0 --port 8081
```

For a watch-and-host workflow during frontend development:

```bash
npm run dev:web
```

### Static deployment

For deployment, build [dist-web](/D:/dsp-dev/dspcalc/dist-web) and publish it with any static file server such as Nginx, Caddy, IIS, or a simple internal file host.

```bash
npm run build:web
```

Deploy the contents of [dist-web](/D:/dsp-dev/dspcalc/dist-web) as the web root.

### Dataset file placement

The browser loads dataset JSON files through `fetch`, so dataset paths must be reachable from the same hosted web root.

Bundled files currently copied into [dist-web](/D:/dsp-dev/dspcalc/dist-web) include:

- [Vanilla.json](/D:/dsp-dev/dspcalc/data/Vanilla.json)
- [Vanilla.defaults.json](/D:/dsp-dev/dspcalc/data/Vanilla.defaults.json)
- [DemoSmelting.json](/D:/dsp-dev/dspcalc/data/DemoSmelting.json)
- [DemoSmelting.defaults.json](/D:/dsp-dev/dspcalc/data/DemoSmelting.defaults.json)

If you want to use a custom dataset in the browser, place that dataset JSON and its optional defaults JSON under the hosted web root and then point the UI at those relative paths.

## Key docs

- [data-format.md](/D:/dsp-dev/dspcalc/docs/data-format.md)
- [solver-spec.md](/D:/dsp-dev/dspcalc/docs/solver-spec.md)
- [minimal-test-config.md](/D:/dsp-dev/dspcalc/docs/minimal-test-config.md)
