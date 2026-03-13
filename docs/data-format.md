# 数据格式

兼容 [DSPCalculator/dsp-calc](https://github.com/DSPCalculator/dsp-calc) 的数据格式。

## 文件结构

```json
{
  "items": [...],
  "recipes": [...]
}
```

## 物品 (Item)

```json
{
  "ID": 1001,
  "Type": 1,
  "Name": "铁矿",
  "IconName": "iron-ore"
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| ID | number | 物品唯一ID |
| Type | number | 物品类型（1=原矿，2=中间产物，3=成品，11=矩阵） |
| Name | string | 显示名称 |
| IconName | string | 图标名称 |

## 配方 (Recipe)

```json
{
  "ID": 1,
  "Type": 1,
  "Name": "铁块",
  "IconName": "iron-plate",
  "Items": [1001],
  "ItemCounts": [1],
  "Results": [1101],
  "ResultCounts": [1],
  "TimeSpend": 60,
  "Factories": [2302, 2315, 2319],
  "Proliferator": 3
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| ID | number | 配方唯一ID |
| Type | number | 配方类型 |
| Name | string | 配方名称 |
| IconName | string | 图标名称 |
| Items | number[] | 输入物品ID列表 |
| ItemCounts | number[] | 输入物品数量列表 |
| Results | number[] | 输出物品ID列表 |
| ResultCounts | number[] | 输出物品数量列表 |
| TimeSpend | number | 制作时间（单位：游戏帧，60帧=1秒） |
| Factories | number[] | 可用建筑ID列表 |
| Proliferator | number | 支持的最大增产剂等级（0-3） |

## 建筑

建筑定义在代码中硬编码（`src/data/loader.ts`），包含以下属性：

```typescript
{
  id: '2302',
  originalId: 2302,
  name: '电弧熔炉',
  category: 'smelter',  // 建筑类别
  speed: 1,             // 基础制作速度
  workPower: 0.36,      // 工作功耗（MW）
  idlePower: 0.012,     // 待机功耗（MW）
  hasProliferatorSlot: true  // 是否有增产剂槽位
}
```

**建筑类别：**

| 类别 | 说明 |
|------|------|
| smelter | 熔炉（电弧熔炉、位面熔炉、负熵熔炉） |
| assembler | 制造台 |
| refinery | 精炼厂 |
| chemical | 化工厂 |
| particle | 对撞机 |
| lab | 研究站 |
| extractor | 原油萃取站 |
| pump | 水泵 |
| mining | 采矿机 |

## 增产剂参数

默认增产剂参数（可通过 API 自定义）：

| 等级 | 速度加成 | 产出加成 | 功耗加成 | 喷涂次数 |
|------|----------|----------|----------|----------|
| Mk.I | 25% | 12.5% | 30% | 12 |
| Mk.II | 50% | 20% | 50% | 12 |
| Mk.III | 100% | 25% | 70% | 12 |

## 示例数据文件

`data/Vanilla.json` - 原版游戏数据
`data/Refinery.json` - 测试用的精炼厂数据

添加自定义数据文件到 `data/` 目录后，Web 界面会自动加载。
