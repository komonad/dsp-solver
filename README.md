# dspcalc

当前仓库处于重构阶段。

现阶段保留并维护的是一条新的 `catalog -> resolve -> solver spec -> presentation` 链路，目标是为《戴森球计划》及其 MOD 提供一个基于线性规划的多产物、多配方配平求解器。

## 当前状态

- 原始数据格式以 [data/Vanilla.json](D:/dsp-dev/dspcalc/data/Vanilla.json) 兼容结构为基准
- 新的 catalog 入口位于 [src/catalog](D:/dsp-dev/dspcalc/src/catalog)
- Web 目前只是重构占位入口，不代表最终产品能力
- [src/legacy](D:/dsp-dev/dspcalc/src/legacy) 仅保留作历史参考，不再作为当前架构的测试目标

## 当前保留的测试

- [tests/catalog-vanilla-format.test.ts](D:/dsp-dev/dspcalc/tests/catalog-vanilla-format.test.ts)
- [tests/catalog-resolve.test.ts](D:/dsp-dev/dspcalc/tests/catalog-resolve.test.ts)
- [tests/minimal-abstract-config.test.ts](D:/dsp-dev/dspcalc/tests/minimal-abstract-config.test.ts)
- [tests/minimal-file-load.test.ts](D:/dsp-dev/dspcalc/tests/minimal-file-load.test.ts)

这些测试覆盖的是当前仍然有效的内容：

- `Vanilla.json` 兼容格式校验
- 原始数据到解析模型的装载流程
- 最小抽象配置的系数与变种展开语义

## 关键文档

- [docs/solver-spec.md](D:/dsp-dev/dspcalc/docs/solver-spec.md)
- [docs/data-format.md](D:/dsp-dev/dspcalc/docs/data-format.md)
- [docs/minimal-test-config.md](D:/dsp-dev/dspcalc/docs/minimal-test-config.md)

## 常用命令

```bash
npm run build
npm run typecheck
npm test -- --runInBand
npx webpack --config webpack.config.js
```

## 目录说明

- [src/catalog](D:/dsp-dev/dspcalc/src/catalog): 原始数据格式、规则文件、文件装载、解析模型
- [src/solver](D:/dsp-dev/dspcalc/src/solver): 新 solver 的输入输出类型
- [src/presentation](D:/dsp-dev/dspcalc/src/presentation): 展示层纯模型
- [src/web](D:/dsp-dev/dspcalc/src/web): 当前 Web 入口
- [src/legacy](D:/dsp-dev/dspcalc/src/legacy): 历史实现参考
