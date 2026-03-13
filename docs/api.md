# API 参考

## 核心计算

### calculate(config, gameData)

执行完整的生产计算（使用 LP 求解器自动配平）。

```typescript
import { calculate } from 'dsp-mod-calculator';

const result = calculate({
  demands: [
    { itemId: '1303', rate: 60 }, // 处理器 60/分钟
  ],
  defaultProliferator: {
    level: 3,
    mode: 'speed',
    sprayCount: 12,
  },
}, gameData);
```

**参数：**
- `config.demands` - 需求列表
- `config.defaultProliferator` - 默认增产剂配置
- `config.treatAsRaw` - 标记为原矿的物品ID列表
- `config.existingSupplies` - 现有产线供给

**返回：**
- `totalBuildings` - 总建筑数
- `rawRequirements` - 原矿需求
- `recipeCounts` - 各配方执行次数
- `powerConsumption` - 功耗估算

### quickCalculate(itemId, rate, gameData)

快速计算单个物品的上游需求（不考虑配平）。

```typescript
import { quickCalculate } from 'dsp-mod-calculator';

const result = quickCalculate('1303', 60, gameData);
```

### solveMultiDemand(demands, gameData, options)

求解多需求的综合生产方案。

```typescript
import { solveMultiDemand } from 'dsp-mod-calculator';

const result = solveMultiDemand(
  [
    { itemId: '1303', rate: 60 },
    { itemId: '1305', rate: 30 },
  ],
  gameData,
  {
    globalProliferator: { level: 3, mode: 'speed' },
    noByproducts: false,
  }
);
```

## 线性规划求解

### buildMultiProductLPModel(itemId, rate, gameData, options)

为多产物配方构建 LP 模型。

```typescript
import { buildMultiProductLPModel } from 'dsp-mod-calculator';

const model = buildMultiProductLPModel('1120', 60, gameData, {
  objective: 'min-buildings',
  allowExternalInput: true,
});
```

### solveBalancing(itemId, rate, gameData, options)

求解多产物配方的配平方案。

```typescript
import { solveBalancing } from 'dsp-mod-calculator';

const recipeCounts = solveBalancing('1120', 60, gameData, {
  objective: 'min-waste',
});
// Map { '16' => 0.5, '58' => 0.25 }
```

**objective 选项：**
- `min-buildings` - 最小化建筑数量
- `min-waste` - 最小化副产物浪费
- `min-power` - 最小化功耗

### validateSolution(recipeCounts, gameData)

验证配平方案的可行性。

```typescript
import { validateSolution } from 'dsp-mod-calculator';

const validation = validateSolution(recipeCounts, gameData);
console.log(validation.valid);   // true/false
console.log(validation.reasons); // 如果不可行，显示原因
```

## 增产剂

### setCustomProliferatorParams(params)

设置自定义增产剂参数，适配模组。

```typescript
import { setCustomProliferatorParams } from 'dsp-mod-calculator';

setCustomProliferatorParams({
  0: { speedBonus: 0, productivityBonus: 0, powerBonus: 0, sprayCount: 0 },
  1: { speedBonus: 0.2, productivityBonus: 0.2, powerBonus: 0.3, sprayCount: 15 },
  2: { speedBonus: 0.3, productivityBonus: 0.3, powerBonus: 0.5, sprayCount: 15 },
  3: { speedBonus: 0.5, productivityBonus: 0.5, powerBonus: 0.7, sprayCount: 15 },
});
```

### resetProliferatorParams()

重置为默认参数。

```typescript
import { resetProliferatorParams } from 'dsp-mod-calculator';

resetProliferatorParams();
```

### calculateProliferatorEffect(config, baseOutput)

计算增产效果。

```typescript
import { calculateProliferatorEffect } from 'dsp-mod-calculator';

const effect = calculateProliferatorEffect(
  { level: 3, mode: 'productivity' },
  100
);
console.log(effect.output); // 125 (100 * 1.25)
```

## 建筑翻倍效果

### enableDoublingForBuilding(buildingId, multiplier, items?)

为建筑启用翻倍效果（模组特性）。

```typescript
import { enableDoublingForBuilding } from 'dsp-mod-calculator';

// 位面熔炉对铁块和磁铁产生2倍产出
enableDoublingForBuilding('2315', 2, ['1101', '1102']);
```

### setBuildingDoublingConfig(buildingId, config)

设置详细的翻倍配置。

```typescript
import { setBuildingDoublingConfig } from 'dsp-mod-calculator';

setBuildingDoublingConfig('2315', {
  multiplier: 2,
  applicableItems: ['1101', '1102'],
});
```

## 数据加载

### loadGameDataFromFile(path)

从文件加载游戏数据。

```typescript
import { loadGameDataFromFile } from 'dsp-mod-calculator';

const gameData = await loadGameDataFromFile('./data/Vanilla.json');
```

### loadGameDataFromJSON(json)

从 JSON 对象加载游戏数据。

```typescript
import { loadGameDataFromJSON } from 'dsp-mod-calculator';

const gameData = loadGameDataFromJSON(jsonObject);
```
