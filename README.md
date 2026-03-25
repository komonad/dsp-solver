# DSP Production Solver

`DSP Production Solver` 是一个面向《戴森球计划》的配方量化求解器，所有代码均使用 GPT-5.4 和 Claude Opus 4.6 进行开发。

在线版本（GitHub Pages）：

- [https://komonad.github.io/dsp-solver/](https://komonad.github.io/dsp-solver/)

当前特性：

- 支持 原版 与 MOD 星环+更多巨构 两套内置数据集，并可以通过静态路径加载自定义数据集
- 求解目标支持 `最少建筑`、`最低功耗`、`最少外部输入`
- 能够处理多产物配方的配平
- 支持目标物品、允许配方、禁用配方、禁用建筑、原矿覆盖、偏好建筑、增产偏好、配方级强制策略等约束
- 结果包含配方方案、建筑汇总、功耗汇总、外部输入、冗余产物、全量物品平衡和诊断信息
- Web 工作台支持直接编辑求解快照、跳转相关配方、查看物品截面
- 附带运行时导出器，可从游戏运行时导出 `items`、`recipes` 和逐物品 icon PNG，再离线打包 atlas 接入 Web

TODO：
- [ ] 添加其它 MOD 支持，例如 GenesisBook
- [ ] 支持按照建筑卡顿或者矿物稀缺度进行加权的求解惩罚
- [ ] 提供基于产线复杂度的求解目标，在出现冗余产物时能自动简化冗余物品


文档入口：

- 用户使用说明：[`docs/web.md`](docs/web.md)
- 构建与测试流程：[`docs/dev/build-and-test.md`](docs/dev/build-and-test.md)
- 求解器概览：[`docs/dev/solver-overview.md`](docs/dev/solver-overview.md)
- 运行时导出器：[`docs/dev/runtime-exporter.md`](docs/dev/runtime-exporter.md)
