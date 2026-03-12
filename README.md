# DSP Mod Calculator - 戴森球计划模组量化计算器

专为戴森球计划模组设计的量化计算器，使用**线性规划（Linear Programming）**求解多产物配方配平问题，支持参数化增产效果和建筑翻倍特性。

## 主要特性

### 🔀 多产物配方配平（LP求解）
- **线性规划求解**：使用单纯形法自动计算最优配方比例
- **避免堵塞**：通过LP求解器找到消耗所有副产物的最优方案
- **灵活策略**：支持最小浪费、最小建筑数、最小功耗等优化目标

### ⚡ 参数化增产效果
- **自定义参数**：支持修改增产剂的速度/产出/功耗加成
- **模组兼容**：适配各种模组的增产系统
- **动态计算**：实时计算最优增产策略

### 🏭 建筑翻倍效果
- **模组支持**：支持建筑对特定产物的翻倍效果
- **灵活配置**：可针对建筑、配方、产物类型配置翻倍

## 核心算法：线性规划

对于多产物配方，计算器使用线性规划求解最优生产方案：

```
变量: x_i = 配方i的执行次数（每分钟）

目标: 最小化总建筑数量（或其他目标）
      min Σ(time_i × x_i)

约束: 
      1. 目标产物净产出 >= 需求
         Σ(output_ij × x_i) >= demand_j
      
      2. 非原矿物品净产出 >= 0（不能有缺口）
         Σ(output_ik × x_i) >= 0
      
      3. 所有变量非负
         x_i >= 0
```

### 示例：原油精炼配平

原油精炼配方：2原油 → 1精炼油 + 2氢气

如果需要只生产精炼油，LP求解器会自动：
1. 添加消耗氢气的配方（如液氢燃料棒）
2. 计算最优配方比例，使氢气刚好被完全消耗
3. 确保精炼油产出满足需求

## 安装

```bash
npm install dsp-mod-calculator
```

## 快速开始

```typescript
import { loadGameDataFromFile, calculate } from 'dsp-mod-calculator';

// 加载游戏数据
const gameData = await loadGameDataFromFile('./data/Vanilla.json');

// 计算处理器需求
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

console.log('建筑需求:', result.totalBuildings);
console.log('原矿需求:', result.rawRequirements);
```

## 多产物配方配平

### 使用LP求解器

```typescript
import { solveBalancing, buildMultiProductLPModel } from 'dsp-mod-calculator';

// 直接求解配平方案
const recipeCounts = solveBalancing(
  '1120',    // 精炼油
  60,        // 60/分钟
  gameData,
  {
    objective: 'min-buildings',  // 最小化建筑数量
    allowExternalInput: true,     // 允许原矿外部输入
  }
);

console.log(recipeCounts);
// Map {
//   '16' => 0.5,    // 等离子精炼配方
//   '58' => 0.25    // 液氢燃料棒配方（消耗多余氢气）
// }
```

### 验证方案可行性

```typescript
import { validateSolution } from 'dsp-mod-calculator';

const validation = validateSolution(recipeCounts, gameData);
console.log(validation.valid);   // true/false
console.log(validation.reasons); // 如果不可行，显示原因
```

## 自定义增产参数

支持自定义增产剂参数，适配模组：

```typescript
import { setCustomProliferatorParams } from 'dsp-mod-calculator';

// 设置自定义增产参数
setCustomProliferatorParams({
  0: { speedBonus: 0, productivityBonus: 0, powerBonus: 0, sprayCount: 0 },
  1: { speedBonus: 0.2, productivityBonus: 0.2, powerBonus: 0.3, sprayCount: 15 },
  2: { speedBonus: 0.3, productivityBonus: 0.3, powerBonus: 0.5, sprayCount: 15 },
  3: { speedBonus: 0.5, productivityBonus: 0.5, powerBonus: 0.7, sprayCount: 15 },
});
```

## 建筑翻倍效果

支持模组中的建筑翻倍特性：

```typescript
import { enableDoublingForBuilding } from 'dsp-mod-calculator';

// 位面熔炉对铁块和磁铁产生2倍产出
enableDoublingForBuilding('2315', 2, ['1101', '1102']);
```

## 数据结构

兼容 [github.com/DSPCalculator/dsp-calc](https://github.com/DSPCalculator/dsp-calc) 的数据格式：

```json
{
  "items": [
    { "ID": 1001, "Type": 1, "Name": "铁矿", "IconName": "iron-ore" }
  ],
  "recipes": [
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
  ]
}
```

## API 参考

### 核心计算

- `calculate(config, gameData)` - 执行完整计算（使用LP求解）
- `quickCalculate(itemId, rate, gameData)` - 快速计算单个物品
- `calculateUpstream(itemId, rate, gameData)` - 递归计算上游需求

### 线性规划求解

- `buildMultiProductLPModel(itemId, rate, gameData, options)` - 构建LP模型
- `solveLP(model)` - 求解LP模型
- `solveBalancing(itemId, rate, gameData, options)` - 求解配平方案
- `validateSolution(recipeCounts, gameData)` - 验证方案可行性

### 多产物配方

- `findMultiProductRecipes(gameData)` - 查找所有多产物配方
- `findSingleProductScheme(itemId, rate, gameData)` - 寻找单一产物方案
- `optimizeBalancing(demands, gameData)` - 优化配平方案
- `analyzeScheme(scheme, gameData)` - 分析配平方案

### 增产剂

- `calculateProliferatorEffect(config, baseOutput)` - 计算增产效果
- `setCustomProliferatorParams(params)` - 设置自定义参数
- `resetProliferatorParams()` - 重置为默认参数

### 翻倍效果

- `enableDoublingForBuilding(buildingId, multiplier, items?)` - 启用翻倍
- `setBuildingDoublingConfig(buildingId, config)` - 设置详细配置

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 测试
npm test
```

## License

MIT
