import type { ResolvedCatalogModel } from '../../../catalog';
import type {
  PresentationItemRate,
  PresentationModel,
  PresentationRecipePlan,
} from '../../../presentation';
import { buildRecipeFlowDisplay } from '../../shared/recipeDisplay';
import { getIconColor } from '../../shared/iconRegistry';
import type { Node, Edge } from '@xyflow/react';

export interface RecipeNodeData {
  [key: string]: unknown;
  buildingName: string;
  buildingIconKey?: string;
  buildingCount: number;
  exactBuildingCount: number;
  recipeName: string;
  atlasIds?: string[];
  inputItemIds: string[];
  outputItemIds: string[];
}

export interface ExternalNodeData {
  [key: string]: unknown;
  itemName: string;
  iconKey?: string;
  ratePerMin: number;
  kind: 'input' | 'output';
  atlasIds?: string[];
}

export interface ItemEdgeData {
  [key: string]: unknown;
  itemName: string;
  iconKey?: string;
  ratePerMin: number;
  width: number;
  color: string;
}

export type FlowGraphNode = Node<RecipeNodeData, 'recipe'> | Node<ExternalNodeData, 'external'>;
export type FlowGraphEdge = Edge<ItemEdgeData>;

const EPSILON = 1e-6;
const MIN_EDGE_WIDTH = 3;
const MAX_EDGE_WIDTH = 8;
const DEFAULT_EDGE_WIDTH = 4;

function hashString(str: string): number {
  let hash = 0;
  for (const ch of str) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function fallbackItemColor(itemName: string): string {
  const hue = hashString(itemName) % 360;
  return `hsl(${hue} 55% 48%)`;
}

export function resolveItemColor(iconKey: string | undefined, itemName: string, atlasIds?: string[]): string {
  return getIconColor(iconKey, atlasIds) ?? fallbackItemColor(itemName);
}

function computeEdgeWidth(rate: number, minRate: number, maxRate: number): number {
  if (maxRate - minRate < EPSILON) {
    return DEFAULT_EDGE_WIDTH;
  }

  return Math.min(MAX_EDGE_WIDTH, Math.max(MIN_EDGE_WIDTH, MIN_EDGE_WIDTH * Math.sqrt(rate / minRate)));
}

interface ProducerInfo {
  nodeId: string;
  outputRate: number;
}

interface RawEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  itemId: string;
  itemName: string;
  iconKey?: string;
  ratePerMin: number;
}

export function buildFlowGraphData(
  recipePlans: PresentationRecipePlan[],
  catalog: ResolvedCatalogModel | null,
  model: PresentationModel
): { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] } {
  if (recipePlans.length === 0) {
    return { nodes: [], edges: [] };
  }

  const atlasIds = model.catalogSummary.iconAtlasIds;
  const nodes: FlowGraphNode[] = [];
  const rawEdges: RawEdge[] = [];

  // Build recipe nodes with filtered inputs
  const recipeVisibleInputs: PresentationItemRate[][] = [];
  for (let i = 0; i < recipePlans.length; i++) {
    const plan = recipePlans[i];
    const flowDisplay = buildRecipeFlowDisplay(catalog, plan);
    recipeVisibleInputs.push(flowDisplay.visibleInputs);

    const inputItemIds = flowDisplay.visibleInputs
      .filter(inp => inp.ratePerMin > EPSILON)
      .map(inp => inp.itemId);
    const outputItemIds = plan.outputs
      .filter(out => out.ratePerMin > EPSILON)
      .map(out => out.itemId);

    nodes.push({
      id: `recipe-${i}`,
      type: 'recipe',
      position: { x: 0, y: 0 },
      data: {
        buildingName: plan.buildingName,
        buildingIconKey: plan.buildingIconKey,
        buildingCount: plan.roundedUpBuildingCount,
        exactBuildingCount: plan.exactBuildingCount,
        recipeName: plan.recipeName,
        atlasIds,
        inputItemIds,
        outputItemIds,
      },
    });
  }

  // Collect all produced items → producer nodes
  const producersByItem = new Map<string, ProducerInfo[]>();
  for (let i = 0; i < recipePlans.length; i++) {
    for (const output of recipePlans[i].outputs) {
      if (output.ratePerMin < EPSILON) continue;
      let producers = producersByItem.get(output.itemId);
      if (!producers) {
        producers = [];
        producersByItem.set(output.itemId, producers);
      }
      producers.push({ nodeId: `recipe-${i}`, outputRate: output.ratePerMin });
    }
  }

  // Determine which items are external inputs / target+surplus outputs
  const externalInputIds = new Set(model.externalInputs.map(e => e.itemId));
  const targetOutputIds = new Set(model.targets.map(t => t.itemId));
  const surplusOutputIds = new Set(model.surplusOutputs.map(s => s.itemId));
  const outputIds = new Set([...targetOutputIds, ...surplusOutputIds]);

  // Create external input nodes
  const createdExternalNodes = new Set<string>();
  for (const ext of model.externalInputs) {
    if (ext.ratePerMin < EPSILON) continue;
    const nodeId = `input-${ext.itemId}`;
    if (!createdExternalNodes.has(nodeId)) {
      createdExternalNodes.add(nodeId);
      nodes.push({
        id: nodeId,
        type: 'external',
        position: { x: 0, y: 0 },
        data: {
          itemName: ext.itemName,
          iconKey: ext.iconKey,
          ratePerMin: ext.ratePerMin,
          kind: 'input',
          atlasIds,
        },
      });
    }
  }

  // Create target/surplus output nodes
  const outputRateByItem = new Map<string, { itemName: string; iconKey?: string; ratePerMin: number }>();
  for (const t of model.targets) {
    const existing = outputRateByItem.get(t.itemId);
    outputRateByItem.set(t.itemId, {
      itemName: t.itemName,
      iconKey: t.iconKey,
      ratePerMin: (existing?.ratePerMin ?? 0) + t.actualRatePerMin,
    });
  }
  for (const s of model.surplusOutputs) {
    const existing = outputRateByItem.get(s.itemId);
    outputRateByItem.set(s.itemId, {
      itemName: existing?.itemName ?? s.itemName,
      iconKey: existing?.iconKey ?? s.iconKey,
      ratePerMin: (existing?.ratePerMin ?? 0) + s.ratePerMin,
    });
  }
  for (const [itemId, info] of outputRateByItem) {
    if (info.ratePerMin < EPSILON) continue;
    const nodeId = `output-${itemId}`;
    if (!createdExternalNodes.has(nodeId)) {
      createdExternalNodes.add(nodeId);
      nodes.push({
        id: nodeId,
        type: 'external',
        position: { x: 0, y: 0 },
        data: {
          itemName: info.itemName,
          iconKey: info.iconKey,
          ratePerMin: info.ratePerMin,
          kind: 'output',
          atlasIds,
        },
      });
    }
  }

  // Build edges: recipe inputs ← producers or external inputs
  for (let i = 0; i < recipePlans.length; i++) {
    const consumerNodeId = `recipe-${i}`;
    for (const input of recipeVisibleInputs[i]) {
      if (input.ratePerMin < EPSILON) continue;

      const producers = producersByItem.get(input.itemId);
      if (producers && producers.length > 0) {
        const totalProducerRate = producers.reduce((sum, p) => sum + p.outputRate, 0);
        for (const producer of producers) {
          const share = totalProducerRate > EPSILON ? producer.outputRate / totalProducerRate : 1 / producers.length;
          const edgeRate = input.ratePerMin * share;
          if (edgeRate < EPSILON) continue;
          rawEdges.push({
            id: `${producer.nodeId}->${consumerNodeId}::${input.itemId}`,
            source: producer.nodeId,
            target: consumerNodeId,
            sourceHandle: producer.nodeId.startsWith('recipe-') ? `out-${input.itemId}` : undefined,
            targetHandle: `in-${input.itemId}`,
            itemId: input.itemId,
            itemName: input.itemName,
            iconKey: input.iconKey,
            ratePerMin: edgeRate,
          });
        }
      }

      // External input edge
      if (externalInputIds.has(input.itemId)) {
        const extNodeId = `input-${input.itemId}`;
        if (createdExternalNodes.has(extNodeId)) {
          const consumers: { nodeId: string; rate: number }[] = [];
          for (let j = 0; j < recipePlans.length; j++) {
            const inputEntry = recipeVisibleInputs[j].find(inp => inp.itemId === input.itemId);
            if (inputEntry && inputEntry.ratePerMin > EPSILON) {
              consumers.push({ nodeId: `recipe-${j}`, rate: inputEntry.ratePerMin });
            }
          }
          const totalConsumerRate = consumers.reduce((sum, c) => sum + c.rate, 0);
          const extRate = model.externalInputs.find(e => e.itemId === input.itemId)?.ratePerMin ?? 0;
          if (extRate > EPSILON && totalConsumerRate > EPSILON) {
            const share = input.ratePerMin / totalConsumerRate;
            const edgeRate = extRate * share;
            if (edgeRate > EPSILON) {
              rawEdges.push({
                id: `${extNodeId}->${consumerNodeId}::${input.itemId}`,
                source: extNodeId,
                target: consumerNodeId,
                targetHandle: `in-${input.itemId}`,
                itemId: input.itemId,
                itemName: input.itemName,
                iconKey: input.iconKey,
                ratePerMin: edgeRate,
              });
            }
          }
        }
      }
    }
  }

  // Build edges: recipe outputs → target/surplus output nodes
  for (let i = 0; i < recipePlans.length; i++) {
    const producerNodeId = `recipe-${i}`;
    for (const output of recipePlans[i].outputs) {
      if (output.ratePerMin < EPSILON) continue;
      if (!outputIds.has(output.itemId)) continue;

      const outNodeId = `output-${output.itemId}`;
      if (!createdExternalNodes.has(outNodeId)) continue;

      const producers = producersByItem.get(output.itemId);
      const totalProducerRate = producers?.reduce((sum, p) => sum + p.outputRate, 0) ?? 0;
      const outputInfo = outputRateByItem.get(output.itemId);
      if (!outputInfo || outputInfo.ratePerMin < EPSILON || totalProducerRate < EPSILON) continue;

      const share = output.ratePerMin / totalProducerRate;
      const edgeRate = outputInfo.ratePerMin * share;
      if (edgeRate < EPSILON) continue;

      rawEdges.push({
        id: `${producerNodeId}->${outNodeId}::${output.itemId}`,
        source: producerNodeId,
        target: outNodeId,
        sourceHandle: `out-${output.itemId}`,
        itemId: output.itemId,
        itemName: output.itemName,
        iconKey: output.iconKey,
        ratePerMin: edgeRate,
      });
    }
  }

  // Deduplicate edges (same source→target for same item)
  const edgeMap = new Map<string, RawEdge>();
  for (const edge of rawEdges) {
    const key = `${edge.source}->${edge.target}::${edge.itemId}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.ratePerMin += edge.ratePerMin;
    } else {
      edgeMap.set(key, { ...edge, id: key });
    }
  }

  const dedupedEdges = Array.from(edgeMap.values());

  // Compute edge widths
  const rates = dedupedEdges.map(e => e.ratePerMin).filter(r => r > EPSILON);
  const minRate = rates.length > 0 ? Math.min(...rates) : 1;
  const maxRate = rates.length > 0 ? Math.max(...rates) : 1;

  const edges: FlowGraphEdge[] = dedupedEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: 'item',
    data: {
      itemName: e.itemName,
      iconKey: e.iconKey,
      ratePerMin: e.ratePerMin,
      width: computeEdgeWidth(e.ratePerMin, minRate, maxRate),
      color: resolveItemColor(e.iconKey, e.itemName, atlasIds),
    },
  }));

  return { nodes, edges };
}
