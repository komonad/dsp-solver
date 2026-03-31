import { useEffect, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { FlowGraphNode, FlowGraphEdge } from './buildFlowGraphData';

const RECIPE_NODE_WIDTH = 140;
const RECIPE_NODE_HEIGHT = 64;
const EXTERNAL_NODE_WIDTH = 120;
const EXTERNAL_NODE_HEIGHT = 48;

const elk = new ELK();

function getNodeDimensions(node: FlowGraphNode): { width: number; height: number } {
  if (node.type === 'recipe') {
    return { width: RECIPE_NODE_WIDTH, height: RECIPE_NODE_HEIGHT };
  }
  return { width: EXTERNAL_NODE_WIDTH, height: EXTERNAL_NODE_HEIGHT };
}

export interface FlowLayoutResult {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
  ready: boolean;
}

export function useFlowLayout(
  nodes: FlowGraphNode[],
  edges: FlowGraphEdge[]
): FlowLayoutResult {
  const [result, setResult] = useState<FlowLayoutResult>({ nodes, edges, ready: false });

  useEffect(() => {
    if (nodes.length === 0) {
      setResult({ nodes: [], edges: [], ready: true });
      return;
    }

    let cancelled = false;

    const elkNodes = nodes.map(node => {
      const dims = getNodeDimensions(node);
      const layoutOptions: Record<string, string> = {};

      // Pin external input nodes to first layer, output nodes to last layer
      if (node.id.startsWith('input-')) {
        layoutOptions['org.eclipse.elk.layered.layering.layerConstraint'] = 'FIRST';
      } else if (node.id.startsWith('output-')) {
        layoutOptions['org.eclipse.elk.layered.layering.layerConstraint'] = 'LAST';
      }

      return {
        id: node.id,
        width: dims.width,
        height: dims.height,
        layoutOptions,
      };
    });

    const elkEdges = edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));

    elk
      .layout({
        id: 'root',
        layoutOptions: {
          'org.eclipse.elk.algorithm': 'org.eclipse.elk.layered',
          'org.eclipse.elk.direction': 'RIGHT',
          'org.eclipse.elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
          'org.eclipse.elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
          'org.eclipse.elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
          'org.eclipse.elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
          'org.eclipse.elk.spacing.nodeNode': '80',
          'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': '120',
          'org.eclipse.elk.layered.spacing.edgeNodeBetweenLayers': '40',
          'org.eclipse.elk.edgeRouting': 'SPLINES',
          'org.eclipse.elk.layered.mergeEdges': 'false',
          'org.eclipse.elk.layered.considerModelOrder.strategy': 'NONE',
        },
        children: elkNodes,
        edges: elkEdges,
      })
      .then(layoutGraph => {
        if (cancelled) return;

        const layoutNodeMap = new Map(
          (layoutGraph.children ?? []).map(child => [child.id, child])
        );

        const layoutNodes: FlowGraphNode[] = nodes.map(node => {
          const layoutChild = layoutNodeMap.get(node.id);
          return {
            ...node,
            position: {
              x: layoutChild?.x ?? 0,
              y: layoutChild?.y ?? 0,
            },
          };
        });

        setResult({ nodes: layoutNodes, edges, ready: true });
      })
      .catch(() => {
        if (cancelled) return;
        const layoutNodes: FlowGraphNode[] = nodes.map((node, i) => ({
          ...node,
          position: { x: (i % 4) * 200, y: Math.floor(i / 4) * 120 },
        }));
        setResult({ nodes: layoutNodes, edges, ready: true });
      });

    return () => {
      cancelled = true;
    };
  }, [nodes, edges]);

  return result;
}
