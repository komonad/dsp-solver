# dspcalc

`dspcalc` 是一个面向《戴森球计划》及其模组数据集的产线求解器与静态 Web 工作台。仓库当前强调四层分离：

- 原始数据集
- 数据集默认配置
- 求解器输入/输出 spec
- 纯展示与 Web 渲染

前端不应在渲染阶段重新发明业务逻辑，所有展示结果都应该能从可测试的数据模型独立推出。

## 目录

- [`src/catalog`](src/catalog): 数据集格式、默认配置格式、加载与 resolve
- [`src/solver`](src/solver): 求解器输入、输出与 LP 求解逻辑
- [`src/presentation`](src/presentation): 面向展示层的纯 view model
- [`src/web`](src/web): 当前 Web 工作台
- [`tools/dsp-runtime-exporter`](tools/dsp-runtime-exporter): 运行时导出工具

## 数据文件

- [`data/Vanilla.json`](data/Vanilla.json)
- [`data/Vanilla.defaults.json`](data/Vanilla.defaults.json)
- [`data/RefineryBalance.json`](data/RefineryBalance.json)
- [`data/RefineryBalance.defaults.json`](data/RefineryBalance.defaults.json)
- [`data/FullereneLoop.json`](data/FullereneLoop.json)
- [`data/FullereneLoop.defaults.json`](data/FullereneLoop.defaults.json)
- [`data/OrbitalRing.json`](data/OrbitalRing.json)
- [`data/OrbitalRing.defaults.json`](data/OrbitalRing.defaults.json)

测试用的最小样例在 [`tests/fixtures`](tests/fixtures)。

## 常用命令

```bash
npm install
npm run build
npm run typecheck
npm test -- --runInBand
npm run build:web
npm run host
```

## Web 开发

本项目的 Web 端是纯静态前端，没有后端服务。

本地开发：

```bash
npm run build:web
npm run host
```

默认会把 [`dist-web`](dist-web) 目录托管到 `http://127.0.0.1:8081`。

需要 watch 模式时可以使用：

```bash
npm run dev:web
```

## 静态部署

构建产物在 [`dist-web`](dist-web)。该目录中的 `bundle.js`、数据集 JSON、默认配置 JSON 和图标 atlas 都使用相对路径，可直接部署到静态文件服务器，也适合放在 GitHub Pages 这类子路径站点下。

```bash
npm run build:web
```

部署时发布整个 `dist-web/` 目录内容即可。

如果你要在 GitHub Pages 上托管：

1. 运行 `npm run build:web`
2. 发布 `dist-web/` 目录内容到 Pages 对应分支或发布目录
3. 保持数据集与图标文件和 `index.html` 处于同一个静态站点根下

浏览器中的数据集路径通过 `fetch` 加载，因此自定义数据集也应放在同一个静态站点里，并在 UI 中填写相对路径。

## 关键文档

- [`docs/data-format.md`](docs/data-format.md)
- [`docs/solver-spec.md`](docs/solver-spec.md)
- [`docs/minimal-test-config.md`](docs/minimal-test-config.md)
- [`docs/asset-and-frontend-research.md`](docs/asset-and-frontend-research.md)
- [`docs/runtime-exporter.md`](docs/runtime-exporter.md)

## 第三方资源

当前随 Web 一起打包的 vanilla 图标 atlas 来源于公开仓库 `DSPCalculator/dsp-calc`。

- 上游仓库: [DSPCalculator/dsp-calc](https://github.com/DSPCalculator/dsp-calc)
- 本地许可证副本: [`third_party/dsp-calc.MulanPSL2.LICENSE`](third_party/dsp-calc.MulanPSL2.LICENSE)

当前接入的 atlas pack：

- `Vanilla`
- `GenesisBook`
- `MoreMegaStructure`
- `OrbitalRing`
