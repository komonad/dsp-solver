# 最小测试配置

这份配置不依赖 `Vanilla.json`，只服务于核心抽象讨论。

目标：

- 验证“配方可用建筑列表”是显式约束
- 验证“增产剂是配方变种带来的额外输入”
- 验证 `/min`、建筑数、功耗三套语义可以直接算清

## 最小 Catalog

对应文件：

- [MinimalVanilla.json](D:/dsp-dev/dspcalc/data/MinimalVanilla.json)
- [MinimalRules.json](D:/dsp-dev/dspcalc/data/MinimalRules.json)

完整流程：

1. 从 [MinimalVanilla.json](D:/dsp-dev/dspcalc/data/MinimalVanilla.json) 读取原始 `items / recipes`
2. 从 [MinimalRules.json](D:/dsp-dev/dspcalc/data/MinimalRules.json) 读取配套规则
3. 通过 catalog loader 进入 `ResolvedCatalogModel`
4. 再由 solver 继续展开成 `recipe × building × mode × level` 变种

其中第 1 步的原始文件结构和 [Vanilla.json](D:/dsp-dev/dspcalc/data/Vanilla.json) 一致，仍然是：

```json
{
  "items": [...],
  "recipes": [...]
}
```

```ts
type MinimalCatalogSpec = {
  items: Array<{
    itemId: string;
    name: string;
    kind: 'raw' | 'product' | 'utility';
  }>;
  buildings: Array<{
    buildingId: string;
    name: string;
    speedMultiplier: number;
    workPowerMW: number;
    intrinsicProductivityBonus?: number;
  }>;
  proliferatorLevels: Array<{
    level: number;
    itemId: string;
    sprayCount: number;
    speedMultiplier: number;
    productivityMultiplier: number;
    powerMultiplier: number;
  }>;
  recipes: Array<{
    recipeId: string;
    name: string;
    cycleTimeSec: number;
    inputs: Array<{ itemId: string; amount: number }>;
    outputs: Array<{ itemId: string; amount: number }>;
    allowedBuildingIds: string[];
    supportedProliferatorModes: Array<'none' | 'speed' | 'productivity'>;
    maxProliferatorLevel: number;
  }>;
};
```

## 最小样本

```ts
const minimalCatalog: MinimalCatalogSpec = {
  items: [
    { itemId: 'ore', name: '矿石', kind: 'raw' },
    { itemId: 'plate', name: '铁板', kind: 'product' },
    { itemId: 'spray_mk1', name: '增产剂 Mk.I', kind: 'utility' },
  ],
  buildings: [
    {
      buildingId: 'smelter',
      name: '测试熔炉',
      speedMultiplier: 1,
      workPowerMW: 1,
    },
  ],
  proliferatorLevels: [
    {
      level: 1,
      itemId: 'spray_mk1',
      sprayCount: 10,
      speedMultiplier: 2,
      productivityMultiplier: 2,
      powerMultiplier: 2,
    },
  ],
  recipes: [
    {
      recipeId: 'ore_to_plate',
      name: '矿石 -> 铁板',
      cycleTimeSec: 60,
      inputs: [{ itemId: 'ore', amount: 1 }],
      outputs: [{ itemId: 'plate', amount: 1 }],
      allowedBuildingIds: ['smelter'],
      supportedProliferatorModes: ['none', 'speed', 'productivity'],
      maxProliferatorLevel: 1,
    },
  ],
};
```

## 对应 JSON 文件

### MinimalVanilla.json

```json
{
  "items": [
    { "ID": 1001, "Type": 1, "Name": "矿石", "IconName": "ore", "GridIndex": 1 },
    { "ID": 1101, "Type": 2, "Name": "铁板", "IconName": "plate", "GridIndex": 2 },
    { "ID": 1141, "Type": 5, "Name": "增产剂 Mk.I", "IconName": "spray-mk1", "GridIndex": 3 },
    {
      "ID": 5001,
      "Type": 6,
      "Name": "测试熔炉",
      "IconName": "test-smelter",
      "GridIndex": 4,
      "Speed": 1,
      "WorkEnergyPerTick": 16666.666666666668,
      "Space": 1
    }
  ],
  "recipes": [
    {
      "ID": 1,
      "Type": 1,
      "Factories": [5001],
      "Name": "矿石 -> 铁板",
      "Items": [1001],
      "ItemCounts": [1],
      "Results": [1101],
      "ResultCounts": [1],
      "TimeSpend": 3600,
      "Proliferator": 3,
      "IconName": "plate"
    }
  ]
}
```

### MinimalRules.json

```json
{
  "proliferatorLevels": [
    {
      "Level": 1,
      "ItemID": 1141,
      "SprayCount": 10,
      "SpeedMultiplier": 2,
      "ProductivityMultiplier": 2,
      "PowerMultiplier": 2
    }
  ],
  "buildingRules": [
    {
      "ID": 5001,
      "Category": "smelter"
    }
  ],
  "recipeModifierRules": [
    {
      "Code": 0,
      "Kind": "none",
      "SupportedModes": ["none"],
      "MaxLevel": 0
    },
    {
      "Code": 3,
      "Kind": "proliferator",
      "SupportedModes": ["none", "speed", "productivity"],
      "MaxLevel": 1
    }
  ],
  "rawItemTypeIds": [1]
}
```

## 最小 Solve Request

```ts
const minimalSolveRequest = {
  targets: [{ itemId: 'plate', ratePerMin: 60 }],
  objective: 'min_external_input',
  balancePolicy: 'force_balance',
  rawInputItemIds: ['ore', 'spray_mk1'],
};
```

## 这个样本应该展开出的 3 个配方变种

配方 `ore_to_plate` 在建筑 `smelter` 上，应该至少展开出：

1. `none`
2. `speed@1`
3. `productivity@1`

## 这 3 个变种的期望系数

基础条件：

- `baseRunsPerMin = 60 / 60 = 1`
- 单建筑基础执行速率 = `1 runs/min`
- 单次执行输入总和 = `1`
- 因此任何启用 1 级喷涂的变种，其额外增产剂输入都应为
  `1 / 10 = 0.1 spray_mk1 / run`

### 1. `none`

- `singleBuildingRunsPerMin = 1`
- `inputPerRun = { ore: 1 }`
- `outputPerRun = { plate: 1 }`
- `powerCostMWPerRunPerMin = 1 / 1 = 1`

### 2. `speed@1`

- `singleBuildingRunsPerMin = 1 * 2 = 2`
- `inputPerRun = { ore: 1, spray_mk1: 0.1 }`
- `outputPerRun = { plate: 1 }`
- `powerCostMWPerRunPerMin = (1 * 2) / 2 = 1`

### 3. `productivity@1`

- `singleBuildingRunsPerMin = 1`
- `inputPerRun = { ore: 1, spray_mk1: 0.1 }`
- `outputPerRun = { plate: 2 }`
- `powerCostMWPerRunPerMin = (1 * 2) / 1 = 2`

## 用 60 plate/min 验证结果

### `none`

- `runsPerMin = 60`
- `buildingCount = 60 / 1 = 60`
- `ore = 60`
- `spray_mk1 = 0`
- `power = 60`

### `speed@1`

- `runsPerMin = 60`
- `buildingCount = 60 / 2 = 30`
- `ore = 60`
- `spray_mk1 = 60 * 0.1 = 6`
- `power = 60 * 1 = 60`

### `productivity@1`

- `runsPerMin = 60 / 2 = 30`
- `buildingCount = 30 / 1 = 30`
- `ore = 30`
- `spray_mk1 = 30 * 0.1 = 3`
- `power = 30 * 2 = 60`

## 这份最小配置的作用

- 它不追求还原 DSP 真实数值，只追求最小、自洽、可手算
- 它不绑定 Vanilla 的任何建筑或配方 ID
- 它足够验证 solver 的核心变种展开逻辑
