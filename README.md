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
  },
}, gameData);

console.log('建筑需求:', result.totalBuildings);
console.log('原矿需求:', result.rawRequirements);
```

## 文档

- [📖 API 参考](docs/api.md) - 完整的 API 文档
- [🌐 Web 界面](docs/web.md) - 可视化界面使用指南
- [📊 数据格式](docs/data-format.md) - 游戏数据格式说明
- [🧮 线性规划算法](docs/lp-algorithm.md) - 求解原理详解

## Web 界面

提供基于浏览器的可视化界面，支持：

- 📋 多需求管理（同时计算多个产物）
- ⚡ 增产剂配置（全局覆盖 + 单配方自定义）
- 🏭 建筑选择（全局类别覆盖 + 单配方选择）
- 📊 实时结果显示（配方卡片、物料平衡、电力估算）

**使用方式：**

```bash
# 构建 Web 版本
npm run build:web

# 打开 dist-web/index.html
```

详细功能说明见 [Web 界面文档](docs/web.md)。

## 示例：多产物配方配平

原油精炼配方：`2原油 → 1精炼油 + 2氢气`

```typescript
import { solveBalancing } from 'dsp-mod-calculator';

// 求解 60 精炼油/分钟 的最优配平方案
const recipeCounts = solveBalancing(
  '1120',    // 精炼油物品ID
  60,        // 60/分钟
  gameData,
  { objective: 'min-buildings' }
);

console.log(recipeCounts);
// Map {
//   '16' => 0.5,    // 等离子精炼配方
//   '58' => 0.25    // 液氢燃料棒配方（消耗多余氢气）
// }
```

## 数据结构

兼容 [github.com/DSPCalculator/dsp-calc](https://github.com/DSPCalculator/dsp-calc) 的数据格式。

```json
{
  "items": [
    { "ID": 1001, "Type": 1, "Name": "铁矿", "IconName": "iron-ore" }
  ],
  "recipes": [
    {
      "ID": 1,
      "Name": "铁块",
      "Items": [1001],
      "ItemCounts": [1],
      "Results": [1101],
      "ResultCounts": [1],
      "TimeSpend": 60,
      "Factories": [2302, 2315, 2319],
      "Proliferator": 3
    }
  ]
}
```

详细说明见 [数据格式文档](docs/data-format.md)。

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm test

# 构建 Web 版本
npm run build:web
```

## License

MIT
