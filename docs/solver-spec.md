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
- 不把 `legacy` 代码作为新架构的一部分

## 2. 分层约束

系统分为四层：

1. `Raw Catalog File`
   采用 `Vanilla.json` 兼容格式保存 `items` 和 `recipes`。
2. `Catalog Rule Set`
   通过配套规则文件补充建筑、配方 modifier、增产剂等级等缺失语义。
3. `Solve Request / Solve Result`
   定义求解器输入、输出和约束语义。
4. `Presentation / Web`
   只做展示重排、排序、筛选、格式化，不做新的业务计算。

强约束：

- 所有页面展示数值必须能从 `SolveResult` 直接获得，或由 presentation 纯函数做无损重排后获得。
- presentation 层不得引入新的业务倍率、经验公式或硬编码常数。
- Web 前端不得单独定义“某建筑产率”“某增产等级倍率”“某配方额外产出”。
- `src/legacy` 仅作为参考材料存在，不应作为新架构的默认导出面或默认运行入口。

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
- 若某个 MOD 有额外规则，需要通过配套规则文件或框架通用规则建模，不允许写死在前端。

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

## 5. 内部解析后的领域对象

本节定义的是 solver 内部使用的 resolved model，不是磁盘上的原始 JSON 格式。

### 5.1 Resolved Item

```ts
type ResolvedItemSpec = {
  itemId: string;
  name: string;
  kind: 'raw' | 'intermediate' | 'product' | 'utility';
  icon?: string;
  tags?: string[];
  source: VanillaItemRecord;
};
```

说明：

- `kind` 是项目内部解析后的语义，不要求原始 `Vanilla.json` 直接提供。
- 是否真的按原矿输入，由 `SolveRequest` 决定，不由 `ResolvedItemSpec` 单独决定。

### 5.2 Resolved Recipe

```ts
type ResolvedRecipeSpec = {
  recipeId: string;
  name: string;
  cycleTimeSec: number;
  inputs: Array<{ itemId: string; amount: number }>;
  outputs: Array<{ itemId: string; amount: number }>;
  allowedBuildingIds: string[];
  modifierCode: number;
  modifierKind: 'none' | 'proliferator' | 'special';
  supportsProliferatorModes: Array<'none' | 'speed' | 'productivity'>;
  maxProliferatorLevel: number;
  isSynthetic: boolean;
  tags?: string[];
  source: VanillaRecipeRecord;
};
```

说明：

- 多产物配方严格定义为 `outputs.length > 1`。
- `cycleTimeSec` 从 `TimeSpend` 解析得出，但不直接作为求解变量。
- `allowedBuildingIds` 是该配方可用的具体建筑 ID 列表，这个列表本身就是权威约束，不应再退化成“按建筑类别自动放开”。
- 原始 `Proliferator` 字段先保留为 `modifierCode`，再通过运行时规则解析出 `modifierKind` 与允许的喷涂模式。
- 当前样本中的 `modifierCode = 4` 被视为特殊 modifier，而不是喷涂等级 4。

### 5.3 Resolved Building

```ts
type ResolvedBuildingSpec = {
  buildingId: string;
  name: string;
  category: string;
  speedMultiplier: number;
  workPowerMW: number;
  idlePowerMW?: number;
  intrinsicProductivityBonus: number;
  tags?: string[];
  source: {
    item: VanillaItemRecord;
    item: VanillaItemRecord;
    rule: CatalogBuildingRuleSpec;
  };
};
```

严格定义：

- `speedMultiplier` 只影响执行速率。
- `intrinsicProductivityBonus` 只影响产物数量。
- `workPowerMW` 是该建筑满负荷工作时的基准功耗。
- `category` 只用于展示、分组和偏好归类，不决定某个配方是否能使用该建筑；可用性始终由配方自己的 `allowedBuildingIds` 决定。

### 5.4 Resolved Proliferator Level

```ts
type ResolvedProliferatorLevelSpec = {
  level: number;
  itemId?: string;
  sprayCount?: number;
  speedMultiplier: number;
  productivityMultiplier: number;
  powerMultiplier: number;
  source: ProliferatorLevelConfigSpec;
};
```

严格定义：

- `mode = none` 时，速度、增产、功耗倍率均按 `1` 处理。
- `mode = speed` 时，只应用 `speedMultiplier` 与 `powerMultiplier`。
- `mode = productivity` 时，只应用 `productivityMultiplier` 与 `powerMultiplier`。
- `sprayCount` 用于把“输入物品总速度”换算成对应等级增产剂的额外消耗速度。
- `itemId` 用于标识该等级增产剂自身对应的物品。
- 增产剂倍率全部来自 `Catalog Rule Set`，不允许由前端硬编码。

备注：

- 增产剂消耗应作为配方变种带来的额外输入进入物料平衡，而不是留给前端或展示层补算。

## 6. Raw Catalog File 与 Catalog Rule Set

### 6.1 Raw Catalog File

原始 catalog 文件采用 `Vanilla.json` 兼容格式：

```ts
type VanillaDatasetSpec = {
  items: VanillaItemRecord[];
  recipes: VanillaRecipeRecord[];
};
```

详细字段说明见 [docs/data-format.md](D:/dsp-dev/dspcalc/docs/data-format.md)。

### 6.2 Catalog Rule Set

补充规则集定义如下：

```ts
type CatalogRuleSetSpec = {
  proliferatorLevels: ProliferatorLevelConfigSpec[];
  buildingRules: CatalogBuildingRuleSpec[];
  recipeModifierRules: RecipeModifierRuleSpec[];
  rawItemTypeIds?: number[];
  syntheticRecipeTypeIds?: number[];
  syntheticRecipeNamePrefixes?: string[];
  syntheticFactoryIds?: number[];
};
```

说明：

- `proliferatorLevels` 负责定义标准喷涂等级本身的倍率
- `buildingRules` 负责提供建筑类别、空转功耗、内置增产等和具体数据集耦合的附加语义
- `recipeModifierRules` 负责定义 `recipe.Proliferator` code 的业务语义
- `rawItemTypeIds`、`syntheticRecipeTypeIds`、`syntheticRecipeNamePrefixes`、`syntheticFactoryIds` 负责提供与数据集耦合的分类规则

### 6.3 Resolved Catalog Model

solver 不直接依赖原始 `VanillaDatasetSpec`，而依赖解析后的内部模型：

```ts
type ResolvedCatalogModel = {
  version: string;
  dataset: VanillaDatasetSpec;
  rules: CatalogRuleSetSpec;
  items: ResolvedItemSpec[];
  recipes: ResolvedRecipeSpec[];
  buildings: ResolvedBuildingSpec[];
  proliferatorLevels: ResolvedProliferatorLevelSpec[];
};
```

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

1. `VanillaDatasetSpec` 校验
   校验 ID 唯一性、字段完整性、数组长度一致性。
2. `CatalogRuleSetSpec` 校验
   校验等级、建筑规则、modifier 规则及分类规则的合法性。
3. `Solve Request` 校验
   校验冲突约束、非法 ID、负速率、空目标。
4. 求解器功能测试
   覆盖单产物、多产物、闭环、强制配平、允许冗余、禁用项、偏好项。
5. 结果一致性测试
   验证 `recipePlans`、`buildingSummary`、`powerSummary`、`itemBalance` 的内部守恒。
6. Web / presentation 一致性测试
   验证浏览器展示结果与 `SolveResult` 严格一致。

强约束：

- 所有前端展示数字都必须能在纯 Node 测试中复现。
- 不允许存在“测试通过但浏览器上显示的是另一套业务算法”的情况。

## 12. 实施顺序

建议按以下顺序推进：

1. 冻结术语、单位和公式
2. 冻结 `VanillaDatasetSpec`
3. 冻结 `CatalogRuleSetSpec`
4. 定义 `ResolvedCatalogModel`
5. 定义 `SolveRequest`
6. 定义 `SolveResult`
7. 实现解析与校验层
8. 实现新的 solver core
9. 实现 presentation 纯函数
10. 最后接入 Web 界面

## 13. 当前已确认结论

以下结论已在讨论中确认：

- 配方周期只作为原始数据和展示参考存在
- 求解器内部统一使用 `/min` 语义
- 建筑数量不作为求解过程中的核心概念
- 建筑数量由“方案执行速率 / 单建筑执行速率”派生得到
- Web 前端不能包含任何自作主张的输入输出逻辑
- 原始 catalog 文件优先沿用 `Vanilla.json` 兼容格式
- `legacy` 代码只保留为参考，不作为新架构的一部分
