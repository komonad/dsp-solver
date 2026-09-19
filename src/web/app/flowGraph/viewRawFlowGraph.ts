import { getLocaleBundle, type AppLocale } from '../../../i18n';
import type { PresentationItemRate, PresentationModel, PresentationRecipePlan } from '../../../presentation';
import { formatCompactItemRateLabel, isPowerItem } from '../workbenchHelpers';
import type { FlowGraphEdge, FlowGraphNode } from './buildFlowGraphData';

/** Adds separate view-supply nodes so actual external inputs retain their solved quantities. */
export function addViewRawFlowInputs(
  graph: { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] },
  plans: PresentationRecipePlan[],
  model: PresentationModel,
  itemIds: ReadonlySet<string>,
  locale: AppLocale,
  powerItemId?: string | null,
): { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] } {
  if (itemIds.size === 0) return graph;
  const inputs = new Map<string, PresentationItemRate>();
  const edges = [...graph.edges];
  function addInput(input: PresentationItemRate, target: string, targetHandle?: string) {
    if (!itemIds.has(input.itemId) || input.ratePerMin < 1e-6 || isPowerItem(input.itemId, powerItemId)) return;
    const existing = inputs.get(input.itemId);
    inputs.set(input.itemId, { ...input, ratePerMin: (existing?.ratePerMin ?? 0) + input.ratePerMin });
    const source = `view-input-${input.itemId}`;
    edges.push({
      id: `${source}->${target}::${input.itemId}`,
      source, target, targetHandle, type: 'item',
      data: {
        ...input,
        rateLabel: formatCompactItemRateLabel(input.itemId, input.ratePerMin, locale, powerItemId),
        width: 4,
        color: graph.edges.find(edge => edge.data?.itemId === input.itemId)?.data?.color ?? '#a56718',
        viewRawInput: true,
      },
    });
  }
  plans.forEach((plan, index) => {
    const rates = new Map<string, PresentationItemRate>();
    plan.inputs.forEach(input => {
      const existing = rates.get(input.itemId);
      rates.set(input.itemId, { ...input, ratePerMin: (existing?.ratePerMin ?? 0) + input.ratePerMin });
    });
    rates.forEach(input => addInput(input, `recipe-${index}`, `in-${input.itemId}`));
  });
  model.targets.forEach(target => addInput({ ...target, ratePerMin: target.actualRatePerMin }, `output-${target.itemId}`));
  const nodes: FlowGraphNode[] = [...graph.nodes];
  inputs.forEach(input => nodes.push({
    id: `view-input-${input.itemId}`, type: 'external', position: { x: 0, y: 0 },
    data: {
      ...input, kind: 'input', atlasIds: model.catalogSummary.iconAtlasIds,
      rateLabel: formatCompactItemRateLabel(input.itemId, input.ratePerMin, locale, powerItemId),
      viewRawInput: true,
      boundaryLabel: getLocaleBundle(locale).focusFilter.viewRawBadge,
    },
  }));
  return { nodes, edges };
}
