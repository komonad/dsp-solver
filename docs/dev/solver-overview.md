# 当前求解器在做什么

这份文档描述当前求解器的大致职责、输入、输出和求解流程。权威字段定义仍然在源码里：

- `src/catalog/spec.ts`
- `src/solver/request.ts`
- `src/solver/result.ts`

## 输入

求解器实际接收两部分输入。

### 1. 已解析的数据集

入口不是原始 JSON，而是已经 resolve 过的 `ResolvedCatalogModel`。它来自：

1. 原始 `dataset JSON`
2. 对应的 `defaults JSON`
3. `src/catalog/resolve.ts` 对建筑、配方、增产规则、图标 atlas、默认原矿等语义的整理

这一步会把原始 `items / recipes` 记录转成求解器更容易消费的结构，例如：

- 标准化后的字符串 ID
- 建筑分类与建筑速度
- 配方允许建筑集合
- 增产模式与等级支持范围
- 默认原矿集合
- 分馏类配方的特殊参数

### 2. 一次求解请求

`SolveRequest` 定义在 `src/solver/request.ts`。当前重要字段可以按下面理解：

- `targets`: 目标物品及其净产出速率，单位是 `个/分`
- `objective`: 主优化目标，当前公开使用的是 `min_buildings`、`min_power`、`min_external_input`
- `balancePolicy`: 中间产物是否必须严格配平
- `rawInputItemIds` / `disabledRawInputItemIds`: 显式指定哪些物品按外部输入处理，哪些默认原矿要收回
- `disabledRecipeIds` / `disabledBuildingIds`: 全局禁用项
- `allowedRecipesByItem`: 某个产物只允许哪些配方供给
- `forced*ByRecipe`: 硬约束，直接限制具体配方能用什么建筑或增产策略
- `preferred*ByRecipe`: 软偏好，只用于 tie-break，不是硬限制

## 求解流程

当前实现大致是这条线：

1. 校验请求是否合法
2. 根据数据集默认原矿、请求覆盖和自动提升原矿规则，确定这次求解里哪些物品视为外部输入
3. 从目标物品开始沿依赖图向上游做闭包，只保留当前请求下仍然可行的配方范围
4. 把每个可行的 `配方 + 建筑 + 增产模式 + 增产等级` 组合编译成求解器内部 option
5. 基于这些 option 建立线性约束：
   - 目标物品净产出约束
   - 中间物品守恒或允许盈余
   - 建筑/配方/增产相关硬约束
   - 原矿与外部输入处理
6. 按 `objective` 选择目标函数，用 `yalps` 做 LP 求解
7. 从求解结果还原出用户可读的方案、建筑汇总、功率汇总和物品平衡表

这意味着求解器当前做的是“配方链路选择 + 连续建筑用量分配”的规划，不是工厂布局模拟器。

## 输出

求解结果类型是 `SolveResult`，定义在 `src/solver/result.ts`。

主要字段：

- `status`: `optimal` / `infeasible` / `invalid_input`
- `diagnostics`: 错误、警告、信息和未满足软偏好
- `resolvedRawInputItemIds`: 这次求解里最终被当作外部输入的物品
- `targets`: 目标需求和实际达成速率
- `recipePlans`: 具体到 `配方 + 建筑 + 增产` 粒度的方案条目
- `buildingSummary`: 按建筑类型聚合后的数量与功耗
- `powerSummary`: 总工作功耗与按取整建筑估算的功耗
- `externalInputs`: 需要外部提供的物品及速率
- `surplusOutputs`: 在允许盈余时留下的剩余产物
- `itemBalance`: 全量物品审计表，记录每个物品的生成、消耗和净值

Web 展示层和测试应该尽量依赖这些显式结果，而不是在组件里再偷偷推导一套业务公式。

## 当前语义边界

当前求解器明确在做这些事：

- 选择可行配方链
- 选择建筑和增产策略
- 计算连续建筑数
- 生成用户可审计的物品平衡与功耗汇总

当前求解器明确没有在做这些事：

- 物流带宽、分拣器吞吐、星际运输站吞吐的整体仿真
- 厂区布局或空间排布
- 离散化建筑摆放优化
- 多阶段生产时序仿真

有一个还保留在核心里的实验目标 `min_complexity`，但 Web 入口目前不暴露它；当前对外仍然以 `最少建筑 / 最低功耗 / 最少外部输入` 这三个目标为主。
