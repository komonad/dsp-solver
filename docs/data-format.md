# Vanilla 兼容数据格式

本文档描述当前建议采用的原始 catalog 文件格式。该格式直接从 [data/Vanilla.json](D:/dsp-dev/dspcalc/data/Vanilla.json) 的实际内容推导而来，并保持与外部来源兼容。

结论：

- 原始 catalog 文件优先采用 `Vanilla.json` 兼容格式
- 原始 catalog 文件只负责描述 `items` 与 `recipes`
- 原始 catalog 文件只负责描述 `items` 与 `recipes`
- 缺失的建筑、配方 modifier、增产剂等级等语义通过独立规则文件提供
- 解析层不再内置任何 `Vanilla` 专属 hard code

## 顶层结构

`Vanilla.json` 当前顶层只有两个字段：

```json
{
  "items": [...],
  "recipes": [...]
}
```

项目内建议把这个结构记为：

```ts
type VanillaDatasetSpec = {
  items: VanillaItemRecord[];
  recipes: VanillaRecipeRecord[];
};
```

## Item 结构

从 `Vanilla.json` 推导出的 item 结构如下：

```json
{
  "ID": 1001,
  "Type": 1,
  "Name": "铁矿",
  "IconName": "iron-ore",
  "GridIndex": 1
}
```

对应 TypeScript 结构：

```ts
type VanillaItemRecord = {
  ID: number;
  Type: number;
  Name: string;
  IconName: string;
  GridIndex?: number;
  WorkEnergyPerTick?: number;
  Speed?: number;
  Space?: number;
  MultipleOutput?: number;
};
```

字段定义：

- `ID`: 物品唯一 ID
- `Type`: 物品类型编号，保留原始外部语义，不在原始文件阶段强行改成项目自定义枚举
- `Name`: 显示名称
- `IconName`: 图标名
- `GridIndex`: 可选排序或布局信息
- `WorkEnergyPerTick`: 可选。部分建筑物品会直接携带工作能耗原始值
- `Speed`: 可选。部分建筑物品会直接携带建筑速度倍率
- `Space`: 可选。建筑占地等展示信息
- `MultipleOutput`: 可选。当前样本中只在特殊伪建筑项上出现

约束：

- `ID` 必须唯一
- `Name` 必须非空
- `IconName` 允许为空字符串，但字段本身应存在

## Recipe 结构

从 `Vanilla.json` 推导出的 recipe 结构如下：

```json
{
  "ID": 1,
  "Type": 1,
  "Factories": [2302, 2315, 2319],
  "Name": "铁块",
  "Items": [1001],
  "ItemCounts": [1],
  "Results": [1101],
  "ResultCounts": [1],
  "TimeSpend": 60,
  "Proliferator": 3,
  "IconName": "iron-plate"
}
```

对应 TypeScript 结构：

```ts
type VanillaRecipeRecord = {
  ID: number;
  Type: number;
  Factories: number[];
  Name: string;
  Items: number[];
  ItemCounts: number[];
  Results: number[];
  ResultCounts: number[];
  TimeSpend: number;
  Proliferator: number;
  IconName: string;
};
```

字段定义：

- `ID`: 配方唯一 ID
- `Type`: 配方类型编号，保留原始外部语义
- `Factories`: 可使用的建筑 ID 列表
- `Name`: 配方名称
- `Items`: 输入物品 ID 列表
- `ItemCounts`: 输入物品数量列表
- `Results`: 输出物品 ID 列表
- `ResultCounts`: 输出物品数量列表
- `TimeSpend`: 配方周期的原始数值
- `Proliferator`: 原始配方 modifier code，不应直接等同于“增产剂等级”
- `IconName`: 图标名

约束：

- `ID` 必须唯一
- `Items.length` 必须等于 `ItemCounts.length`
- `Results.length` 必须等于 `ResultCounts.length`
- `TimeSpend` 必须大于 0
- 多产物配方通过 `Results.length > 1` 判断

当前基于 `Vanilla.json` 的推断语义：

- `Proliferator = 0`: 不支持标准喷涂
- `Proliferator = 1`: 支持标准喷涂，但仅支持加速模式
- `Proliferator = 3`: 支持标准喷涂，支持加速与增产模式
- `Proliferator = 4`: 特殊 modifier code，当前样本用于射线接收站带透镜配方，不应误解成喷涂等级 4
- 对标准喷涂规则而言，效果是否生效由配方本身决定，并要求所有输入都已按对应等级完成喷涂；这不是生产建筑提供的能力

## 已从 Vanilla.json 观察到的事实

当前仓库里的 `Vanilla.json` 满足这些观察结果：

- 顶层字段只有 `items` 和 `recipes`
- `items` 数量为 174
- `recipes` 数量为 238
- item 字段集合稳定为：
  - `ID`
  - `Type`
  - `Name`
  - `IconName`
  - `GridIndex`
- recipe 字段集合稳定为：
  - `ID`
  - `Type`
  - `Factories`
  - `Name`
  - `Items`
  - `ItemCounts`
  - `Results`
  - `ResultCounts`
  - `TimeSpend`
  - `Proliferator`
  - `IconName`

另外还观察到：

- 存在 `Type = -1` 的合成/特殊配方
- 存在 `Factories = [0]`、`[1]` 或包含 `1` 的特殊配方
- `Proliferator` 在当前样本中不止出现 `0-3`，还出现了 `4`

因此，项目内部不要把这些字段先验地写死为“只可能是某几个值”，应该保留外部兼容性，并把真正的业务约束放到补充规则层或求解层校验里。

## Catalog Rule Set

由于 `Vanilla.json` 本身并不完整表达求解所需的全部语义，项目需要配套规则文件。

推荐结构：

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

其中：

- `proliferatorLevels` 负责定义标准喷涂等级本身的喷涂物品、喷涂次数、速度倍率、增产倍率、功耗倍率
- `buildingRules` 负责补充建筑类别、空转功耗、内置增产、必要时的速度/功耗覆盖
- `recipeModifierRules` 负责解释原始 `Proliferator` code 到运行时语义的映射
- `rawItemTypeIds`、`syntheticRecipeTypeIds`、`syntheticRecipeNamePrefixes`、`syntheticFactoryIds` 负责提供和具体数据集耦合的分类规则

## 项目内推荐的数据流

推荐数据流：

1. 读取 `VanillaDatasetSpec`
2. 读取 `CatalogRuleSetSpec`
3. 组合成 solver 内部使用的 `ResolvedCatalogModel`
4. 由 solver 生成 `SolveResult`
5. 由 presentation/web 只消费 `SolveResult`

这样做的好处：

- 原始文件格式与外部项目兼容
- 项目内部运行时规则可以独立演进
- 不会把“外部数据长什么样”和“内部求解怎么跑”混成一层

## 当前建议

当前建议已经明确为：

- 原始 catalog 文件优先沿用 `Vanilla.json` 兼容格式
- 不再额外发明一套新的原始 JSON 结构替代它
- 项目内部若需要更多字段，应通过补充规则集或解析后的 `ResolvedCatalogModel` 承载
