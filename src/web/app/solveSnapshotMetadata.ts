import type { WorkbenchSnapshotSectionId } from '../workbench/snapshotSections';

export type SnapshotSectionId = WorkbenchSnapshotSectionId;

export const SNAPSHOT_SECTION_DESCRIPTION: Record<SnapshotSectionId, string> = {
  targets:
    '目标约束：每个条目定义一个物品的净输出速率下界，单位为个/分。求解器仅接受同时满足全部目标条目的可行方案。',
  allowedRecipes:
    '允许配方约束：对某个输出物品，仅允许列表中的配方承担该物品的供给。未列出的同类产出配方会从可行域中排除。',
  disabledRecipes:
    '禁用配方约束：列表中的配方会被全局移出可行域。求解器在任何生产链路中都不得实例化这些配方。',
  proliferatorPreferences:
    '增产偏好约束：定义全局或配方级的增产剂模式与等级请求。配方级条目优先于全局条目，并直接影响求解请求中的增产策略选择。',
  disabledBuildings:
    '禁用建筑约束：列表中的建筑会被全局移出候选建筑集合。求解器不得将任何配方分配到这些建筑上。',
  preferredBuildings:
    '偏好建筑约束：定义全局或配方级的建筑选择偏好。配方级条目优先于全局条目，并用于约束或引导对应配方的建筑分配。',
};

export type SnapshotMetricId = 'objective' | 'balance' | 'spray' | 'status';

export const SNAPSHOT_METRIC_DESCRIPTION: Record<SnapshotMetricId, string> = {
  objective:
    '目标函数：定义求解器在满足全部约束后所最小化的主目标，例如建筑数、功耗或外部输入。',
  balance:
    '配平策略：定义中间产物流的守恒约束形式。强制配平要求内部流量严格守恒；允许盈余则允许产生未被继续消费的剩余输出。',
  spray:
    '增产剂策略：定义全局增产模式与等级的默认请求。若存在配方级偏好或强制覆盖，则以更具体的条目为准。',
  status:
    '求解状态：描述当前请求是否找到可行最优解，以及该状态是否满足全部约束与目标函数要求。',
};
