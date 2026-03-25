# 开发元指令

## 总则
1. `src/` 下的 TypeScript 与 Web 代码默认按跨平台维护；不要引入 PowerShell 专用命令、Windows 盘符路径或只在 Windows 能跑通的开发脚本。
2. `tools/dsp-runtime-exporter` 及其配套脚本属于游戏运行时导出工具，可以继续按 Windows 环境维护。
3. 与数据格式、求解器输入、求解器输出相关的权威说明优先写在对应 TypeScript 类型定义的文档注释里；`docs/dev` 只保留高层流程文档。

## 前端
1. 所有前端展示的求解结果数据都必须能独立测试；不要把业务计算塞进 React 渲染代码里。
2. 修改前端代码后必须执行：相关测试、`npm run typecheck`、`npx webpack --config webpack.config.js`、真实浏览器验证。
3. 浏览器验证至少要确认：页面加载正常、改动路径符合预期、控制台无错误。涉及右侧栏、抽屉、弹窗或内部滚动区域时，还要确认内部区域可滚动，且内部跳转不会带动页面主滚动。
4. 右侧栏、弹窗、抽屉等带内部滚动区域的布局，必须显式提供高度约束以及 `min-height: 0`。
5. 全局共享状态继续通过 `src/web/app/WorkbenchContext.tsx` 管理；不引入外部状态管理库。
6. 单个组件文件原则上不超过 400 行；超过时拆分组件或提取逻辑到 helper / hook。
7. 纯展示型 helper 放在 `src/web/app/workbenchHelpers.ts`，样式常量放在 `src/web/app/workbenchStyles.ts`，渲染开销大的列表项组件继续使用 `React.memo`。

## 文本与文件写入
1. 仓库文本文件统一保持 UTF-8；修改现有文件时不要改变 BOM、编码或换行风格。
2. 在 Windows / PowerShell 下不要用 `Set-Content`、`Out-File`、`>`、`>>` 这类可能隐式重编码的方式直接回写源码；优先使用 `apply_patch` 做最小修改。
3. 修改包含中文文案的 TypeScript、TSX、Markdown、JSON 文件后，要额外检查是否出现乱码、截断或异常替换字符。
