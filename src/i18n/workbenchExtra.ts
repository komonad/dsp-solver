import type { AppLocale } from './index';

export interface WorkbenchExtraBundle {
  itemSlice: {
    title: string;
    emptyTitle: string;
    emptyDescription: string;
    summaryTitle: string;
    producersTitle: string;
    consumersTitle: string;
    targetRateLabel: string;
    externalInputLabel: string;
    surplusLabel: string;
    forcedRecipeLabel: string;
    clearForcedRecipeButton: string;
    noForcedRecipe: string;
    noProducerPlans: string;
    noConsumerPlans: string;
    openInLedgerButton: string;
    closeButton: string;
  };
}

const zhCN: WorkbenchExtraBundle = {
  itemSlice: {
    title: '物品截面',
    emptyTitle: '选择一个物品',
    emptyDescription:
      '点击总表、方案摘要或配方明细中的物品，可以在这里查看它的局部截面，并直接调整原矿或允许配方。',
    summaryTitle: '流量摘要',
    producersTitle: '生产方案',
    consumersTitle: '消耗方案',
    targetRateLabel: '目标需求',
    externalInputLabel: '外部输入',
    surplusLabel: '冗余输出',
    forcedRecipeLabel: '允许配方',
    clearForcedRecipeButton: '清除允许配方',
    noForcedRecipe: '未设置',
    noProducerPlans: '当前没有生产该物品的已用方案。',
    noConsumerPlans: '当前没有消耗该物品的已用方案。',
    openInLedgerButton: '在总表中定位',
    closeButton: '关闭',
  },
};

export function getWorkbenchExtraBundle(locale: AppLocale): WorkbenchExtraBundle {
  if (locale === 'zh-CN') {
    return zhCN;
  }

  return zhCN;
}
