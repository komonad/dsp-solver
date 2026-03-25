# 构建与测试流程

这份文档只描述当前仓库仍然有效的开发流程。更细的类型语义请直接看源码中的文档注释，尤其是：

- `src/catalog/spec.ts`
- `src/solver/request.ts`
- `src/solver/result.ts`

## 环境

- Node.js + npm
- Web / TypeScript 部分默认按跨平台维护
- `tools/dsp-runtime-exporter` 仍然是 Windows 专用工具，不在这份流程里强求跨平台

先安装依赖：

```bash
npm ci
```

## 常用命令

```bash
npm run typecheck
npm test
npm run build
npm run build:web
npm run host
npm run dev:web
```

含义：

- `npm run typecheck`: 检查库代码和 Web 代码的 TypeScript 类型
- `npm test`: 跑 Jest 测试
- `npm run build`: 产出库侧 `dist/`
- `npm run build:web`: 重新打包浏览器端 `dist-web/`
- `npm run host`: 本地托管 `dist-web/`
- `npm run dev:web`: 并行启动 Web watch 和本地静态托管

## 日常修改流程

### 只改文档或注释

通常不需要浏览器验证。确认文档内容和源码现状一致即可。

### 只改求解器 / catalog / presentation

最低要求：

```bash
npm run typecheck
npx jest <相关测试> --runInBand
```

如果修改了输入输出 spec、约束语义、展示 view model，应该优先补纯函数测试，而不是只依赖浏览器手测。

### 改 Web 前端

最低要求：

```bash
npm run typecheck
npx jest <相关测试> --runInBand
npx webpack --config webpack.config.js
```

然后做真实浏览器验证：

```bash
npm run host
```

至少确认：

- 页面能正常加载
- 改动对应的交互路径实际可用
- 控制台没有错误
- 如果涉及内部滚动区域，内部可以滚动，而且内部跳转不会把主页面滚动带偏

注意：这个仓库的浏览器页面加载的是打包后的 `dist-web/bundle.js`。前端改完如果不重新跑 `webpack`，浏览器看到的仍然可能是旧代码。

## 测试数据与内置数据集

- 当前内置发布的数据集只有 `data/Vanilla.json` 和 `data/OrbitalRing.json`，以及对应的 defaults
- 专门用于测试的场景数据集放在 `tests/fixtures/scenarios/`
- Web 打包时只会把 `data/` 下的内置数据集与图标资源复制进 `dist-web/`

## 提交前检查

提交前至少确认：

1. 改动范围对应的测试已经跑过
2. 如果改了前端，已经重新打包并做过真实浏览器验证
3. 文档里的说法和当前实现一致
4. 没有引入新的硬编码本机路径
