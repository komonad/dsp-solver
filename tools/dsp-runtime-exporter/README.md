# DSP 运行时导出器

本子项目是一个精简的 BepInEx 插件，用于导出游戏运行时加载的物品和配方数据，输出格式与本仓库使用的数据集结构一致。

功能：

- 导出 `items` 和 `recipes`
- 导出物品图标（单独 PNG 文件）
- 读取 mod 加载后的最终运行时 `LDB` 状态
- 输出一个兼容 `src/catalog/spec.ts` 的 `*.json` 数据集文件
- 启动时自动导出 + 可选自动退出
- 离线图标 atlas 生成（PowerShell 脚本）
- 一键同步管线（`sync-dataset`）

## 为什么需要这个

静态解析器适用于原版数据，但无法看到 BepInEx mod 通过 LDBTool/CommonAPI 修改后的最终运行时 proto 状态。本导出器直接读取运行时数据。

## 构建前提

需要本地安装了戴森球计划，并且游戏目录中已安装 BepInEx。

推荐设置方式（类似 `MinimalDSPModTemplate` 的本地配置）：

- 复制 `Local.props.example` 为 `Local.props`
- 填入 `DSPManagedPath`
- 填入 `BepInExDllPath`
- 可选：填入 `ProfileRoot` 以使用 `DeployToProfile`

也可以通过命令行参数覆盖：

- `-p:DSPGameDir="C:\Games\Dyson Sphere Program"`

或者同时指定：

- `-p:DSPManagedPath="C:\Games\Dyson Sphere Program\DSPGAME_Data\Managed"`
- `-p:BepInExDllPath="C:\Games\Dyson Sphere Program\BepInEx\core\BepInEx.dll"`

## 构建

```powershell
dotnet restore tools\dsp-runtime-exporter\DspCalc.RuntimeExporter.csproj
dotnet build tools\dsp-runtime-exporter\DspCalc.RuntimeExporter.csproj -c Release
```

或使用辅助脚本：

```powershell
tools\dsp-runtime-exporter\scripts\build.cmd
```

## 安装

将编译产物复制到 BepInEx 的 plugins 目录：

```text
<游戏目录>\BepInEx\plugins\DspCalc.RuntimeExporter\DspCalc.RuntimeExporter.dll
```

或直接部署到配置的 profile：

```powershell
dotnet msbuild tools\dsp-runtime-exporter\DspCalc.RuntimeExporter.csproj /t:DeployToProfile /p:Configuration=Debug
```

## 打包 r2modman zip

可以生成 Thunderstore 格式的 zip，供 r2modman 从本地文件导入：

```powershell
dotnet msbuild tools\dsp-runtime-exporter\DspCalc.RuntimeExporter.csproj /t:Package /p:Configuration=Release
```

或：

```powershell
tools\dsp-runtime-exporter\scripts\package.cmd
```

输出位置：

```text
tools\dsp-runtime-exporter\dist\DspCalc.RuntimeExporter.zip
```

## 一键同步数据集

`sync-dataset` 脚本自动完成全部流程：构建 mod → 配置自动导出 → 通过 Steam 启动游戏 → 等待导出 → 构建 atlas → 部署到 `data/`。

```bash
npm run sync:dataset -- --profile orbitalring --name OrbitalRing
```

参数：

- `--profile <name>` — r2modman profile 名称（必须）
- `--name <name>` — 输出数据集名称，对应 `data/<name>.json` 和 `data/icons/<name>.{json,png}`（必须）
- `--skip-build` — 跳过 `dotnet build` 和 mod 部署
- `--skip-atlas` — 跳过 atlas 构建（仅复制数据集 JSON）
- `--timeout <seconds>` — 导出等待超时，默认 300

脚本流程：

1. 构建导出器 mod 并部署到 profile
2. 在 mod 配置中启用 `AutoExportOnStartup` 和 `AutoQuitAfterExport`
3. 将 profile 的 BepInEx 复制到游戏目录
4. 通过 `steam://rungameid/1366540` 启动游戏
5. 轮询导出状态文件
6. 等待游戏自动退出（超时 30 秒后强制结束）
7. 清理游戏目录
8. 验证导出、构建 atlas、复制文件到 `data/`
9. 恢复原始 mod 配置

前提条件：`Local.props` 中需要有有效的 `DSPManagedPath` 和 `BepInExDllPath`。Steam 需要在运行状态。

## 手动使用

1. 启用目标 mod 后启动游戏
2. 等待到达主菜单或进入游戏场景
3. 按 `F8`

导出的数据集 JSON 文件写入：

```text
<游戏目录>\BepInEx\config\dspcalc-exporter\CurrentGame.json
```

快捷键和输出位置可通过生成的 BepInEx 配置文件修改。

## 验证导出结果

导出器在三个地方报告状态：

1. **BepInEx 日志** — 插件加载、运行时就绪、导出成功/失败、物品和配方数量
2. **游戏内提示** — 加载时、运行时数据就绪时、导出成功/失败时
3. **状态文件** — 写在数据集文件旁边：

```text
<输出目录>\CurrentGame.status.json
```

状态文件记录：`success`、`reason`、`itemCount`、`recipeCount`、`outputPath`、`timestampUtc`、`message`、失败时的 `exception`。

导出器还会写入元数据文件：

```text
<输出目录>\CurrentGame.metadata.json
```

元数据包括：`datasetName`、`datasetDescription`、`sourceProfile`、`modSummary`（自动生成的已加载 mod 列表）、`loadedMods`（完整 mod 列表含 `guid`/`name`/`version`）、`notes`、物品/配方/图标数量、导出时间等。

物品图标写入：

```text
<输出目录>\CurrentGame.icons\items\*.png
```

图标清单文件：

```text
<输出目录>\CurrentGame.icons.manifest.json
```

## 构建图标 atlas

导出图标后，可以构建 web atlas：

```powershell
tools\dsp-runtime-exporter\scripts\build-atlas.cmd "C:\Path\To\CurrentGame.json"
```

输出：

```text
<输出目录>\CurrentGame.items.atlas.png
<输出目录>\CurrentGame.items.atlas.json
```

默认行为：缺失图标视为 `warning`，损坏文件或无效输出视为 `error`。

如果需要缺失图标也报错：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\dsp-runtime-exporter\scripts\build-atlas.ps1 "C:\Path\To\CurrentGame.json" -StrictMissing
```

## 验证导出

```powershell
node tools\dsp-runtime-exporter\scripts\validate-export.mjs "C:\Path\To\CurrentGame.json"
```

严格模式（缺失覆盖也报错）：

```powershell
node tools\dsp-runtime-exporter\scripts\validate-export.mjs "C:\Path\To\CurrentGame.json" --strict-missing
```

## 验证 atlas

```powershell
node tools\dsp-runtime-exporter\scripts\validate-atlas.mjs "C:\Path\To\CurrentGame.json"
```

严格模式：

```powershell
node tools\dsp-runtime-exporter\scripts\validate-atlas.mjs "C:\Path\To\CurrentGame.json" --strict-missing
```

## 输出格式

导出的 JSON 使用当前标准的原始数据集结构：

- 顶层 `items` 和 `recipes`
- 物品字段：`ID`、`Type`、`Name`、`IconName` 等
- 配方字段：`Factories`、`Items`、`ItemCounts`、`Results`、`ResultCounts`、`TimeSpend`、`Proliferator` 等

可选字段仅在运行时可靠读取时才输出。

## 备注

- 导出器通过运行时反射访问 `LDB.items` 和 `LDB.recipes`
- 不依赖任何特定的外部数据提取 mod
- 先导出单独的物品 PNG 图标，atlas 由上述离线脚本生成
- 插件 GUID：`com.comonad.dspcalc.runtime-exporter`
