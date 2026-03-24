import type { ProliferatorMode } from '../catalog';
import type { BalancePolicy, SolveObjective, SolveStatus } from '../solver';

export type AppLocale = 'zh-CN';
export type DatasetPresetId =
  | 'vanilla'
  | 'demo-smelting'
  | 'refinery-balance'
  | 'fullerene-loop'
  | 'orbitalring'
  | 'custom';
export type WorkbenchProliferatorPolicyLabel = 'auto' | 'none' | 'speed' | 'productivity';

export const DEFAULT_APP_LOCALE: AppLocale = 'zh-CN';

export interface DatasetPresetText {
  label: string;
  description: string;
}

export interface LocaleBundle {
  common: {
    auto: string;
    none: string;
    disabled: string;
    yes: string;
    no: string;
    custom: string;
    notSet: string;
    notSolvedYet: string;
    removeSuffix: string;
  };
  enums: {
    objective: Record<SolveObjective, string>;
    balancePolicy: Record<BalancePolicy, string>;
    solveStatus: Record<SolveStatus, string>;
    proliferatorMode: Record<ProliferatorMode, string>;
    workbenchProliferatorPolicy: Record<WorkbenchProliferatorPolicyLabel, string>;
  };
  datasetPresets: Record<DatasetPresetId, DatasetPresetText>;
  page: {
    eyebrow: string;
    title: string;
    description: string;
  };
  datasetSource: {
    title: string;
    datasetPathPlaceholder: string;
    defaultsPathPlaceholder: string;
    loadButton: string;
    loadingButton: string;
    autoCacheHint: string;
    clearCacheButton: string;
    loadErrorTitle: string;
    waitingTitle: string;
    waitingDescription: string;
    datasetPathRequired: string;
    loadFailedPrefix: string;
    editorTitle: string;
    editorApplyButton: string;
    editorResetButton: string;
    editorDatasetLabel: string;
    editorDefaultsLabel: string;
    editorHelp: string;
    editorApplyFailedPrefix: string;
    structuredEditorTitle: string;
    structuredEditorHelp: string;
    structuredEditorUnavailable: string;
    structuredEditorTabs: {
      items: string;
      recipes: string;
      buildingRules: string;
      defaults: string;
    };
    structuredEditorAddButton: string;
    structuredEditorRemoveButton: string;
  };
  solveRequest: {
    title: string;
    editTargetsHint: string;
    addTargetTitle: string;
    targetSearchLabel: string;
    targetSearchPlaceholder: string;
    targetPickerEmpty: string;
    selectedTargetLabel: string;
    addTarget: string;
    removeTarget: string;
    objectiveOptions: Record<SolveObjective, string>;
    balancePolicyOptions: Record<BalancePolicy, string>;
    proliferatorPolicyOptions: Record<WorkbenchProliferatorPolicyLabel, string>;
    autoPromoteUnavailableItemsLabel: string;
    rawOverridesLabel: string;
    markAsRaw: string;
    noRawOverrides: string;
    disabledRecipesLabel: string;
    disabledBuildingsLabel: string;
    disableButton: string;
    noDisabledRecipes: string;
    noDisabledBuildings: string;
    recipePreferencesLabel: string;
    addPreference: string;
    recipePreferencesHelp: string;
    noRecipePreferences: string;
    preferredBuildingLabel: string;
    preferredSprayModeLabel: string;
    preferredSprayLevelLabel: string;
    advancedOverridesLabel: string;
    advancedOverridesHelp: string;
    autoSolveHint: string;
    levelPrefix: string;
    validTargetRequired: string;
    invalidAllowedRecipeSelectionMessage: string;
  };
  summary: {
    catalogTitle: string;
    solveSnapshotTitle: string;
    datasetLabel: string;
    itemsLabel: string;
    recipesLabel: string;
    buildingsLabel: string;
    rawDefaultsLabel: string;
    targetableLabel: string;
    datasetPathLabel: string;
    defaultsPathLabel: string;
    objectiveLabel: string;
    balanceLabel: string;
    sprayLabel: string;
    solverVersionLabel: string;
    statusLabel: string;
    targetsLabel: string;
    rawOverridesLabel: string;
    forcedRecipesLabel: string;
    clearForcedRecipeButton: string;
    disabledRecipesLabel: string;
    disabledBuildingsLabel: string;
    advancedOverridesLabel: string;
    recipePreferencesLabel: string;
    loadDatasetToStart: string;
  };
  overview: {
    summaryTitle: string;
    targetsAndExternalInputsTitle: string;
    buildingsAndPowerTitle: string;
    surplusOutputsTitle: string;
    requestLabel: string;
    actualLabel: string;
    noExternalInputs: string;
    exactLabel: string;
    roundedLabel: string;
    powerLabel: string;
    activeLabel: string;
    roundedPlacementLabel: string;
  };
  recipePlans: {
    title: string;
    inputsLabel: string;
    outputsLabel: string;
    powerLabel: string;
    exactLabel: string;
    roundedLabel: string;
  };
  itemLedger: {
    title: string;
    netInputsTitle: string;
    netOutputsTitle: string;
    intermediatesTitle: string;
    rawBadge: string;
    targetBadge: string;
    surplusBadge: string;
    markRawButton: string;
    unmarkRawButton: string;
    jumpToTopButton: string;
    jumpToBottomButton: string;
    noItems: string;
  };
  diagnostics: {
    title: string;
    diagnosticsLabel: string;
    noDiagnostics: string;
    fallbackTitle: string;
    fallbackDescription: string;
    fallbackNetInputsLabel: string;
    fallbackSurplusLabel: string;
    fallbackApplyButton: string;
    itemBalanceLabel: string;
    producedLabel: string;
    consumedLabel: string;
    netLabel: string;
    solveRequestJson: string;
    solveResultJson: string;
  };
  ready: {
    title: string;
    description: string;
  };
  advancedOverrides: {
    invalidJsonPrefix: string;
    invalidJsonFallback: string;
    mustBeJsonObject: string;
    stringArray: (key: string) => string;
    stringRecord: (key: string) => string;
    numberRecord: (key: string) => string;
    modeRecord: (key: string) => string;
  };
}

const zhCN: LocaleBundle = {
  common: {
    auto: '自动',
    none: '无',
    disabled: '禁用',
    yes: '是',
    no: '否',
    custom: '自定义',
    notSet: '（未设置）',
    notSolvedYet: '尚未求解',
    removeSuffix: '移除',
  },
  enums: {
    objective: {
      min_buildings: '最少建筑',
      min_power: '最低功耗',
      min_external_input: '最少外部输入',
    },
    balancePolicy: {
      force_balance: '强制配平',
      allow_surplus: '允许冗余产物',
    },
    solveStatus: {
      optimal: '最优',
      infeasible: '无可行解',
      invalid_input: '输入无效',
    },
    proliferatorMode: {
      none: '无增产剂',
      speed: '加速',
      productivity: '增产',
    },
    workbenchProliferatorPolicy: {
      auto: '自动使用增产剂',
      none: '无增产剂',
      speed: '加速',
      productivity: '增产',
    },
  },
  datasetPresets: {
    vanilla: {
      label: '原版',
      description: '完整的原版兼容数据集，以及配套的默认配置。',
    },
    'demo-smelting': {
      label: '演示冶炼',
      description: '用于快速前端检查的最小双建筑冶炼数据集。',
    },
    'refinery-balance': {
      label: '炼油配平',
      description: '通过两条炼油配方闭合重油副产的轻油场景。',
    },
    'fullerene-loop': {
      label: '富勒烯回环',
      description: '富勒烯甲烷回环，以及富勒银/富勒醇出口循环场景。',
    },
    orbitalring: {
      label: '星环组合',
      description: '星环 0.9.39 + 更多巨构 + 深空来敌的运行时导出数据快照。',
    },
    custom: {
      label: '自定义路径',
      description: '加载当前 Web 根目录下任意可访问的数据集/默认配置 JSON。',
    },
  },
  page: {
    eyebrow: '求解工作台',
    title: '切换数据集、构造求解请求，并检查浏览器当前展示的精确数值。',
    description:
      '页面只负责加载数据集、构造求解请求、运行求解器，并渲染展示模型。React 内部不会重复计算隐藏的业务公式。',
  },
  datasetSource: {
    title: '数据集来源',
    datasetPathPlaceholder: './Vanilla.json',
    defaultsPathPlaceholder: './Vanilla.defaults.json',
    loadButton: '加载数据集',
    loadingButton: '加载中...',
    autoCacheHint: '当前工作台状态会自动缓存到浏览器。',
    clearCacheButton: '清除所有缓存并重置',
    loadErrorTitle: '数据集加载失败',
    waitingTitle: '等待加载数据集',
    waitingDescription: '先加载一个内置数据集，或者填写自定义数据集文件路径。',
    datasetPathRequired: '必须提供数据集路径。',
    loadFailedPrefix: '加载数据集失败：',
    editorTitle: '内置数据集编辑器',
    editorApplyButton: '应用为当前数据集',
    editorResetButton: '重置为已加载内容',
    editorDatasetLabel: '数据集 JSON',
    editorDefaultsLabel: '默认配置 JSON',
    editorHelp: '用于直接编辑 items / recipes / buildings 相关原始 JSON，并在浏览器内重新解析当前数据集。',
    editorApplyFailedPrefix: '应用编辑失败：',
    structuredEditorTitle: '结构化编辑器',
    structuredEditorHelp:
      '用于直接编辑物品、配方、建筑规则和默认配置。字段修改会同步回上面的 JSON 文本。',
    structuredEditorUnavailable: '当前 JSON 还无法解析，结构化编辑器暂不可用。',
    structuredEditorTabs: {
      items: '物品',
      recipes: '配方',
      buildingRules: '建筑规则',
      defaults: '默认配置',
    },
    structuredEditorAddButton: '新增',
    structuredEditorRemoveButton: '删除',
  },
  solveRequest: {
    title: '求解请求',
    editTargetsHint: '当前目标的需求速度请在右侧求解快照中修改。',
    addTargetTitle: '添加目标',
    targetSearchLabel: '搜索物品',
    targetSearchPlaceholder: '按 ID、名称筛选',
    targetPickerEmpty: '没有匹配的物品。',
    selectedTargetLabel: '已选物品',
    addTarget: '添加目标',
    removeTarget: '移除',
    objectiveOptions: {
      min_buildings: '最少建筑',
      min_power: '最低功耗',
      min_external_input: '最少外部输入',
    },
    balancePolicyOptions: {
      force_balance: '强制配平',
      allow_surplus: '允许冗余产物',
    },
    proliferatorPolicyOptions: {
      auto: '自动使用增产剂',
      none: '无增产剂',
      speed: '加速',
      productivity: '增产',
    },
    autoPromoteUnavailableItemsLabel: '不可生产物品自动视为原矿',
    rawOverridesLabel: '原矿输入',
    markAsRaw: '标记为原矿',
    noRawOverrides: '当前没有请求级原矿覆盖。',
    disabledRecipesLabel: '禁用配方',
    disabledBuildingsLabel: '禁用建筑',
    disableButton: '禁用',
    noDisabledRecipes: '当前没有禁用配方。',
    noDisabledBuildings: '当前没有禁用建筑。',
    recipePreferencesLabel: '配方偏好',
    addPreference: '添加偏好',
    recipePreferencesHelp: '这里是按配方的软偏好设置。强制项和低频字段仍然通过高级 JSON 面板输入。',
    noRecipePreferences: '当前没有配方级偏好。',
    preferredBuildingLabel: '优先建筑',
    preferredSprayModeLabel: '优先增产剂模式',
    preferredSprayLevelLabel: '优先增产剂等级',
    advancedOverridesLabel: '高级覆盖 JSON',
    advancedOverridesHelp:
      '用于填写偏好/强制建筑、配方、增产剂等高级请求字段。',
    autoSolveHint: '已改为自动求解。左侧任一会影响求解的输入变更后，右侧结果会立即更新。',
    levelPrefix: '等级',
    validTargetRequired: '至少需要一个有效目标。',
    invalidAllowedRecipeSelectionMessage: '该允许配方组合会导致当前方案无解，未应用。',
  },
  summary: {
    catalogTitle: '数据集概览',
    solveSnapshotTitle: '求解快照',
    datasetLabel: '数据集',
    itemsLabel: '物品',
    recipesLabel: '配方',
    buildingsLabel: '建筑',
    rawDefaultsLabel: '默认原矿',
    targetableLabel: '可作为目标',
    datasetPathLabel: '数据集文件',
    defaultsPathLabel: '默认配置',
    objectiveLabel: '目标函数',
    balanceLabel: '配平策略',
    sprayLabel: '增产剂',
    solverVersionLabel: '求解器',
    statusLabel: '求解状态',
    targetsLabel: '目标',
    rawOverridesLabel: '原矿覆盖',
    forcedRecipesLabel: '强制配方',
    clearForcedRecipeButton: '清除强制配方',
    disabledRecipesLabel: '禁用配方',
    disabledBuildingsLabel: '禁用建筑',
    advancedOverridesLabel: '高级覆盖',
    recipePreferencesLabel: '配方偏好',
    loadDatasetToStart: '先加载数据集，再开始构造求解请求。',
  },
  overview: {
    summaryTitle: '方案总览',
    targetsAndExternalInputsTitle: '目标与外部输入',
    buildingsAndPowerTitle: '建筑与功耗',
    surplusOutputsTitle: '冗余产物',
    requestLabel: '需求',
    actualLabel: '实际',
    noExternalInputs: '没有外部输入。',
    exactLabel: '精确',
    roundedLabel: '取整',
    powerLabel: '功耗',
    activeLabel: '工作功耗',
    roundedPlacementLabel: '按取整建筑计算',
  },
  recipePlans: {
    title: '配方方案',
    inputsLabel: '输入',
    outputsLabel: '输出',
    powerLabel: '功耗',
    exactLabel: '精确',
    roundedLabel: '取整',
  },
  itemLedger: {
    title: '全物品总表',
    netInputsTitle: '净输入',
    netOutputsTitle: '净输出',
    intermediatesTitle: '中间流转',
    rawBadge: '原矿',
    targetBadge: '目标',
    surplusBadge: '冗余',
    markRawButton: '标记为原矿',
    unmarkRawButton: '取消原矿',
    jumpToTopButton: '回到顶部',
    jumpToBottomButton: '滚动到底部',
    noItems: '当前分组没有物品。',
  },
  diagnostics: {
    title: '诊断与审计',
    diagnosticsLabel: '诊断信息',
    noDiagnostics: '没有诊断信息。',
    fallbackTitle: '强制配平无解，但允许冗余时存在可行方案',
    fallbackDescription: '下面这组结果来自 allow_surplus，可作为定位副产物或原矿设置的提示。',
    fallbackNetInputsLabel: 'Fallback 净输入',
    fallbackSurplusLabel: 'Fallback 冗余产物',
    fallbackApplyButton: '切换为允许冗余',
    itemBalanceLabel: '物品平衡',
    producedLabel: '生成',
    consumedLabel: '消耗',
    netLabel: '净值',
    solveRequestJson: '求解请求 JSON',
    solveResultJson: '求解结果 JSON',
  },
  ready: {
    title: '准备就绪',
    description: '数据集已加载。调整左侧请求后，页面会自动重新求解并更新结果。',
  },
  advancedOverrides: {
    invalidJsonPrefix: 'JSON 无效：',
    invalidJsonFallback: 'JSON 无效。',
    mustBeJsonObject: '高级覆盖必须是一个 JSON 对象。',
    stringArray: key => `${key} 在提供时必须是字符串数组。`,
    stringRecord: key => `${key} 在提供时必须是值为字符串的对象。`,
    numberRecord: key => `${key} 在提供时必须是值为有限数字的对象。`,
    modeRecord: key => `${key} 在提供时必须是值为 none、speed 或 productivity 的对象。`,
  },
};

export function getLocaleBundle(locale: AppLocale = DEFAULT_APP_LOCALE): LocaleBundle {
  if (locale === 'zh-CN') {
    return zhCN;
  }

  return zhCN;
}

export function getDatasetPresetText(
  presetId: DatasetPresetId,
  locale: AppLocale = DEFAULT_APP_LOCALE
): DatasetPresetText {
  return getLocaleBundle(locale).datasetPresets[presetId];
}

function formatDecimal(
  value: number,
  locale: AppLocale,
  minimumFractionDigits: number,
  maximumFractionDigits: number
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

export function formatRate(
  ratePerMin: number,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string {
  return `${formatDecimal(ratePerMin, locale, 2, 2)} / 分`;
}

export function formatPower(
  value: number,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string {
  return `${formatDecimal(value, locale, 2, 2)} MW`;
}

export function formatSolveObjective(
  objective: SolveObjective,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string {
  return getLocaleBundle(locale).enums.objective[objective];
}

export function formatBalancePolicy(
  policy: BalancePolicy,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string {
  return getLocaleBundle(locale).enums.balancePolicy[policy];
}

export function formatSolveStatus(
  status: SolveStatus | null | undefined,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string {
  if (!status) {
    return getLocaleBundle(locale).common.notSolvedYet;
  }

  return getLocaleBundle(locale).enums.solveStatus[status];
}

export function formatProliferatorMode(
  mode: ProliferatorMode,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string {
  return getLocaleBundle(locale).enums.proliferatorMode[mode];
}

export function formatWorkbenchProliferatorPolicy(
  policy: WorkbenchProliferatorPolicyLabel,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string {
  return getLocaleBundle(locale).enums.workbenchProliferatorPolicy[policy];
}

export function formatProliferatorLabel(
  proliferatorMode: ProliferatorMode,
  proliferatorLevel: number,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string {
  const bundle = getLocaleBundle(locale);

  if (proliferatorMode === 'none' || proliferatorLevel === 0) {
    return bundle.enums.proliferatorMode.none;
  }

  return `${bundle.enums.proliferatorMode[proliferatorMode]} ${bundle.solveRequest.levelPrefix} ${proliferatorLevel}`;
}

export function formatPreferredProliferatorLabel(
  proliferatorMode: ProliferatorMode | undefined,
  proliferatorLevel: number | undefined,
  locale: AppLocale = DEFAULT_APP_LOCALE
): string | undefined {
  const bundle = getLocaleBundle(locale);

  if (proliferatorMode === undefined && proliferatorLevel === undefined) {
    return undefined;
  }

  if (proliferatorMode === 'none') {
    return bundle.enums.proliferatorMode.none;
  }

  if (proliferatorMode !== undefined && proliferatorLevel !== undefined) {
    return `${bundle.enums.proliferatorMode[proliferatorMode]} ${bundle.solveRequest.levelPrefix} ${proliferatorLevel}`;
  }

  if (proliferatorMode !== undefined) {
    return `${bundle.enums.proliferatorMode[proliferatorMode]}（${bundle.common.auto}等级）`;
  }

  if (proliferatorLevel !== undefined) {
    return `${bundle.common.auto}模式 ${bundle.solveRequest.levelPrefix} ${proliferatorLevel}`;
  }

  return undefined;
}
