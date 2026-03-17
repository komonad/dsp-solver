# 求解器与渲染层 SPEC（草案）

本文档定义项目后续重构的权威边界。目标是把求解器、展示模型、Web 前端彻底解耦，并保证浏览器展示数字与求解器测试数字严格一致。

## 1. 目标

项目目标：

- 面向《戴森球计划》及其 MOD 的多产物、多配方配平求解器
- 基于线性规划进行求解
- 明确、稳定、可测试的输入与输出定义
- Web 前端只负责输入采集与结果渲染，不包含自作主张的业务计算

非目标：

- 不在 Web 层重新计算配方速率、建筑数量、功耗、增产倍率
- 不把“建筑数量”作为求解变量
- 不把“配方周期”作为对外求解语义

## 2. 分层约束

系统分为四层：

1. `Catalog Spec`
   定义静态数据：物品、配方、建筑、增产剂等级。
2. `Solve Request Spec`
   定义一次求解允许传入的目标、约束、禁用项和偏好项。
3. `Solve Result Spec`
   定义求解器的标准输出。Web 端必须仅消费这一层。
4. `Presentation / Web`
   只做展示重排、排序、筛选、格式化，不做新的业务计算。

强约束：

- 所有页面展示数值必须能从 `SolveResult` 直接获得，或由 presentation 纯函数做无损重排后获得。
- presentation 层不得引入新的业务倍率、经验公式或硬编码常数。
- Web 前端不得单独定义“某建筑产率”“某增产等级倍率”“某配方额外产出”。

## 3. 统一语义与单位

### 3.1 Canonical Units

统一单位如下：

- 物品流速：`items/min`
- 配方执行速率：`runs/min`
- 配方周期：`seconds/cycle`
- 建筑速度：无量纲倍率 `speedMultiplier`
- 功耗：`MW`
- 建筑数量：`count`

### 3.2 核心原则

核心原则如下：

- 求解器内部统一使用“每分钟流量”语义。
- 配方周期只作为原始数据和展示参考存在。
- 建筑数量只作为解出后的派生结果存在。

因此，求解器内部不使用以下概念作为决策变量：

- 建筑数量
- 周期数
- “每个建筑每分钟产多少某主产物”

### 3.3 决策变量

对于每个可行方案 `option`，定义决策变量：

```ts
x(option): number // 该方案的实际执行速率，单位 runs/min
```

其中 `option` 是一个编译后的求解选项，至少包含：

- `recipe`
- `building`
- `proliferatorLevel`
- `proliferatorMode`

## 4. 派生公式

### 4.1 单建筑执行速率

```ts
baseRunsPerMin = 60 / cycleTimeSec

singleBuildingRunsPerMin =
  baseRunsPerMin
  * building.speedMultiplier
  * speedModeMultiplier
```

说明：

- `speedModeMultiplier` 仅在增产策略为“加速”时生效。
- 建筑内置增产不影响执行速率，只影响每次执行的产出。

### 4.2 单次执行物料变化

```ts
effectiveOutputAmountPerRun =
  baseOutputAmount
  * (1 + building.intrinsicProductivityBonus)
  * productivityModeMultiplier

effectiveInputAmountPerRun =
  baseInputAmount
```

说明：

- 建筑内置增产和增产模式只影响产物，不影响原料消耗。
- 若某个 MOD 有额外规则，需要在 `Catalog Spec` 中显式建模，不允许写死在前端。

### 4.3 物品净流量

```ts
netItemRate(itemId) =
  sum(x(option) * outputPerRun(itemId, option))
  - sum(x(option) * inputPerRun(itemId, option))
```

求解约束、目标产率和结果输出均以该语义为准。

### 4.4 建筑数量

建筑数量不是求解变量，而是结果派生值：

```ts
exactBuildingCount(option) =
  x(option) / singleBuildingRunsPerMin(option)

roundedUpBuildingCount(option) =
  ceil(exactBuildingCount(option))
```

### 4.5 功耗

```ts
activePowerMW(option) =
  exactBuildingCount(option)
  * building.workPowerMW
  * proliferatorPowerMultiplier

roundedPlacementPowerMW(option) =
  roundedUpBuildingCount(option)
  * building.workPowerMW
  * proliferatorPowerMultiplier
```

说明：

- `activePowerMW` 用于连续解语义和优化目标。
- `roundedPlacementPowerMW` 用于终端用户查看按建筑取整后的落地估算。

## 5. 领域对象定义

### 5.1 Item

```ts
type ItemSpec = {
  itemId: string;
  name: string;
  kind: 'raw' | 'intermediate' | 'product' | 'utility';
  icon?: string;
  tags?: string[];
};
```

定义：

- `raw` 仅表示该物品可以被视为原矿或外部输入候选。
- 是否真的按原矿输入，由 `SolveRequest` 决定，不由 `ItemSpec` 单独决定。

### 5.2 Recipe

```ts
type RecipeSpec = {
  recipeId: string;
  name: string;
  cycleTimeSec: number;
  inputs: Array<{ itemId: string; amount: number }>;
  outputs: Array<{ itemId: string; amount: number }>;
  allowedBuildingIds: string[];
  supportsProliferatorModes: Array<'none' | 'speed' | 'productivity'>;
  maxProliferatorLevel: number;
  tags?: string[];
};
```

定义：

- 多产物配方严格定义为 `outputs.length > 1`。
- `cycleTimeSec` 是原始配方属性，不直接作为求解变量。

### 5.3 Building

```ts
type BuildingSpec = {
  buildingId: string;
  name: string;
  category: string;
  speedMultiplier: number;
  workPowerMW: number;
  idlePowerMW?: number;
  supportsProliferator: boolean;
  intrinsicProductivityBonus: number;
  tags?: string[];
};
```

严格定义：

- `speedMultiplier` 只影响执行速率。
- `intrinsicProductivityBonus` 只影响产物数量。
- `workPowerMW` 是该建筑满负荷工作时的基准功耗。

### 5.4 Proliferator Level

```ts
type ProliferatorLevelSpec = {
  level: number;
  speedMultiplier: number;
  productivityMultiplier: number;
  powerMultiplier: number;
};
```

严格定义：

- `mode = none` 时，速度、增产、功耗倍率均按 `1` 处理。
- `mode = speed` 时，只应用 `speedMultiplier` 与 `powerMultiplier`。
- `mode = productivity` 时，只应用 `productivityMultiplier` 与 `powerMultiplier`。
- 增产剂倍率全部来自 `Catalog Spec`，不允许由前端硬编码。

备注：

- 本草案第一阶段仅把增产剂建模为“配方参数”，暂不把喷涂剂本身建模为物料输入。
- 若后续需要把喷涂剂消耗纳入物料平衡，应在 `Catalog Spec` 中显式扩展，而不是在展示层追加特殊逻辑。

## 6. Catalog Spec

```ts
type CatalogSpec = {
  version: string;
  items: ItemSpec[];
  recipes: RecipeSpec[];
  buildings: BuildingSpec[];
  proliferatorLevels: ProliferatorLevelSpec[];
  defaults?: {
    rawInputItemIds?: string[];
    disabledRecipeIds?: string[];
    disabledBuildingIds?: string[];
  };
};
```

说明：

- `data/Vanilla.json` 可作为 legacy 数据源。
- 项目需要提供一个 adapter，把现有 `Vanilla.json` 转换为 `CatalogSpec`。
- solver 只依赖 `CatalogSpec`，不直接依赖 legacy JSON 格式。

## 7. Solve Request Spec

```ts
type SolveRequest = {
  targets: Array<{
    itemId: string;
    ratePerMin: number;
  }>;
  objective: 'min_buildings' | 'min_power' | 'min_external_input';
  balancePolicy: 'allow_surplus' | 'force_balance';
  rawInputItemIds?: string[];
  disabledRecipeIds?: string[];
  disabledBuildingIds?: string[];
  forcedRecipeByItem?: Record<string, string>;
  preferredRecipeByItem?: Record<string, string>;
  forcedBuildingByRecipe?: Record<string, string>;
  preferredBuildingByRecipe?: Record<string, string>;
  forcedProliferatorLevelByRecipe?: Record<string, number>;
  preferredProliferatorLevelByRecipe?: Record<string, number>;
  forcedProliferatorModeByRecipe?: Record<string, 'none' | 'speed' | 'productivity'>;
  preferredProliferatorModeByRecipe?: Record<string, 'none' | 'speed' | 'productivity'>;
};
```

### 7.1 原矿输入

严格定义：

- `rawInputItemIds` 表示这些物品允许通过外部输入满足缺口。
- 被标记为原矿输入后，求解器不要求必须在内部继续生产该物品。
- 求解结果必须显式输出这部分外部输入速率。

### 7.2 禁用与强制

严格定义：

- `disabled*` 是硬禁用。
- `forced*` 是硬约束。
- `preferred*` 是软偏好，只能在不破坏主目标最优性的前提下用于 tie-break。

### 7.3 强制配平与允许冗余

`balancePolicy = allow_surplus`

- 非原矿中间物允许 `netRate >= 0`
- surplus 必须显式进入结果
- 同等主目标下，次级目标默认应尽量减少 surplus

`balancePolicy = force_balance`

- 非原矿、非目标物必须满足 `netRate = 0`
- 目标物必须满足 `netRate = requestedRatePerMin`
- 若无法闭合，则求解结果为 `infeasible`

## 8. Solver Internal Compiled Options

外部 API 不暴露此结构，但 solver 内部建议先把请求编译为离散方案：

```ts
type CompiledOption = {
  optionId: string;
  recipeId: string;
  buildingId: string;
  proliferatorLevel: number;
  proliferatorMode: 'none' | 'speed' | 'productivity';
  singleBuildingRunsPerMin: number;
  buildingCostPerRunPerMin: number;
  powerCostMWPerRunPerMin: number;
  inputPerRun: Record<string, number>;
  outputPerRun: Record<string, number>;
};
```

说明：

- 求解变量对应该 `CompiledOption` 的 `x(option)`。
- `buildingCostPerRunPerMin = 1 / singleBuildingRunsPerMin`。
- `powerCostMWPerRunPerMin = activePowerMW / runsPerMin`。

这使得以下目标都能保持线性：

- 最小建筑数
- 最小功耗
- 最小外部输入

## 9. Solve Result Spec

```ts
type SolveResult = {
  status: 'optimal' | 'infeasible' | 'invalid_input';
  diagnostics: {
    messages: string[];
    unmetPreferences: string[];
  };
  targets: Array<{
    itemId: string;
    requestedRatePerMin: number;
    actualRatePerMin: number;
  }>;
  recipePlans: Array<{
    recipeId: string;
    buildingId: string;
    proliferatorLevel: number;
    proliferatorMode: 'none' | 'speed' | 'productivity';
    runsPerMin: number;
    exactBuildingCount: number;
    roundedUpBuildingCount: number;
    activePowerMW: number;
    roundedPlacementPowerMW: number;
    inputs: Array<{ itemId: string; ratePerMin: number }>;
    outputs: Array<{ itemId: string; ratePerMin: number }>;
  }>;
  buildingSummary: Array<{
    buildingId: string;
    exactCount: number;
    roundedUpCount: number;
    activePowerMW: number;
    roundedPlacementPowerMW: number;
  }>;
  powerSummary: {
    activePowerMW: number;
    roundedPlacementPowerMW: number;
  };
  externalInputs: Array<{
    itemId: string;
    ratePerMin: number;
  }>;
  surplusOutputs: Array<{
    itemId: string;
    ratePerMin: number;
  }>;
  itemBalance: Array<{
    itemId: string;
    producedRatePerMin: number;
    consumedRatePerMin: number;
    netRatePerMin: number;
  }>;
};
```

### 9.1 输出要求

必须满足以下要求：

- 每个被使用的方案都要明确给出 `runsPerMin`
- 每个方案都要明确给出 `inputs` 与 `outputs` 的实际速率
- 每个方案都要明确给出使用建筑类型、建筑数量和功耗
- 结果必须明确区分：
  - `externalInputs`
  - `surplusOutputs`
  - `itemBalance`

### 9.2 建筑总览

`buildingSummary` 用于终端用户查看方案建筑概览。

要求：

- 既要给连续解的 `exactCount`
- 也要给落地视角的 `roundedUpCount`

### 9.3 耗电总览

`powerSummary` 用于终端用户查看总功耗。

要求：

- 同时给 `activePowerMW` 与 `roundedPlacementPowerMW`
- 前端不得自行通过建筑数量和倍率再次推导功耗

## 10. 渲染层约束

渲染层允许做的事情：

- 表格和卡片分组
- 排序、筛选、折叠
- 格式化数字和单位
- 根据 `SolveResult` 组织展示模型

渲染层禁止做的事情：

- 自己计算增产倍率
- 自己计算建筑需求
- 自己计算功耗
- 自己推导某配方的输入输出速率
- 自己根据“主产物”反推执行次数

若页面需要一个展示专用结构，应由 presentation 纯函数从 `SolveResult` 生成，并为其单独编写测试。

## 11. 校验与测试要求

必须覆盖以下测试层次：

1. `Catalog Spec` 校验
   校验 ID 唯一性、引用完整性、倍率合法性。
2. `Solve Request` 校验
   校验冲突约束、非法 ID、负速率、空目标。
3. 求解器功能测试
   覆盖单产物、多产物、闭环、强制配平、允许冗余、禁用项、偏好项。
4. 结果一致性测试
   验证 `recipePlans`、`buildingSummary`、`powerSummary`、`itemBalance` 的内部守恒。
5. Web / presentation 一致性测试
   验证浏览器展示结果与 `SolveResult` 严格一致。

强约束：

- 所有前端展示数字都必须能在纯 Node 测试中复现。
- 不允许存在“测试通过但浏览器上显示的是另一套业务算法”的情况。

## 12. 实施顺序

建议按以下顺序推进：

1. 冻结术语、单位和公式
2. 定义 `CatalogSpec`
3. 定义 `SolveRequest`
4. 定义 `SolveResult`
5. 编写 legacy adapter，把 `Vanilla.json` 转换为 `CatalogSpec`
6. 实现新的 solver core
7. 实现 presentation 纯函数
8. 最后接入 Web 界面

## 13. 当前已确认结论

以下结论已在讨论中确认：

- 配方周期只作为原始数据和展示参考存在
- 求解器内部统一使用 `/min` 语义
- 建筑数量不作为求解过程中的核心概念
- 建筑数量由“方案执行速率 / 单建筑执行速率”派生得到
- Web 前端不能包含任何自作主张的输入输出逻辑

