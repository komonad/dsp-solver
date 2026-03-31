import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { IconButton, Tooltip, Typography } from '@mui/material';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
  applyNodeChanges,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toBlob, toPng } from 'html-to-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResolvedCatalogModel } from '../../../catalog';
import type { PresentationModel, PresentationRecipePlan } from '../../../presentation';
import { preloadIconColors } from '../../shared/iconRegistry';
import { buildFlowGraphData } from './buildFlowGraphData';
import type { FlowGraphNode } from './buildFlowGraphData';
import { ExternalNode } from './ExternalNode';
import { ItemEdge } from './ItemEdge';
import { RecipeNode } from './RecipeNode';
import { useFlowLayout } from './useFlowLayout';

const nodeTypes = {
  recipe: RecipeNode,
  external: ExternalNode,
};

const edgeTypes = {
  item: ItemEdge,
};

export interface FlowGraphPanelProps {
  recipePlans: PresentationRecipePlan[];
  catalog: ResolvedCatalogModel | null;
  model: PresentationModel;
  title: string;
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1300,
  display: 'flex',
  flexDirection: 'column',
  background: '#f4f6f8',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  borderBottom: '1px solid rgba(24, 51, 89, 0.1)',
  background: 'rgba(255, 255, 255, 0.95)',
  flexShrink: 0,
};

const SCREENSHOT_PIXEL_RATIO = 4;
const SCREENSHOT_PADDING = 60;

function ScreenshotButton() {
  const { getNodes } = useReactFlow();
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const handleScreenshot = useCallback(async () => {
    const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (!viewportEl) return;

    const nodes = getNodes();
    if (nodes.length === 0) return;

    setStatus('busy');
    try {
      const bounds = getNodesBounds(nodes);
      const width = bounds.width + SCREENSHOT_PADDING * 2;
      const height = bounds.height + SCREENSHOT_PADDING * 2;
      const viewport = getViewportForBounds(bounds, width, height, 0.1, 3, SCREENSHOT_PADDING);
      const renderOpts = {
        backgroundColor: '#f4f6f8',
        width,
        height,
        pixelRatio: SCREENSHOT_PIXEL_RATIO,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      };

      // Try clipboard first
      let copied = false;
      try {
        const blob = await toBlob(viewportEl, renderOpts);
        if (blob && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          copied = true;
        }
      } catch {
        // clipboard failed, fall through to download
      }

      if (!copied) {
        const dataUrl = await toPng(viewportEl, renderOpts);
        const link = document.createElement('a');
        link.download = '物品流图.png';
        link.href = dataUrl;
        link.click();
      }

      setStatus('done');
      setTimeout(() => setStatus('idle'), 1500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }, [getNodes]);

  const tooltipText = status === 'done' ? '已复制到剪贴板' : status === 'error' ? '截图失败' : '高清截图';
  const icon = status === 'done'
    ? <CheckIcon sx={{ fontSize: 18, color: '#2e7d32' }} />
    : <PhotoCameraOutlinedIcon sx={{ fontSize: 18 }} />;

  return (
    <Tooltip title={tooltipText}>
      <IconButton size="small" onClick={handleScreenshot} disabled={status === 'busy'} sx={{ width: 30, height: 30 }}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

function FlowGraphPanelImpl({ recipePlans, catalog, model, title, onClose }: FlowGraphPanelProps) {
  const atlasIds = model.catalogSummary.iconAtlasIds;
  const [colorsReady, setColorsReady] = useState(false);

  // Preload icon colors from atlas sprite sheets
  useEffect(() => {
    const iconKeys: Array<{ iconKey?: string }> = [];
    for (const plan of recipePlans) {
      for (const input of plan.inputs) {
        iconKeys.push({ iconKey: input.iconKey });
      }
      for (const output of plan.outputs) {
        iconKeys.push({ iconKey: output.iconKey });
      }
    }
    for (const ext of model.externalInputs) {
      iconKeys.push({ iconKey: ext.iconKey });
    }
    for (const t of model.targets) {
      iconKeys.push({ iconKey: t.iconKey });
    }
    for (const s of model.surplusOutputs) {
      iconKeys.push({ iconKey: s.iconKey });
    }

    preloadIconColors(iconKeys, atlasIds).then(() => {
      setColorsReady(true);
    });
  }, [recipePlans, model, atlasIds]);

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => (colorsReady ? buildFlowGraphData(recipePlans, catalog, model) : { nodes: [], edges: [] }),
    [recipePlans, catalog, model, colorsReady]
  );

  const { nodes: layoutNodes, edges, ready } = useFlowLayout(rawNodes, rawEdges);

  const [displayNodes, setDisplayNodes] = useState<FlowGraphNode[]>([]);
  useEffect(() => { setDisplayNodes(layoutNodes); }, [layoutNodes]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setDisplayNodes(nds => applyNodeChanges(changes, nds) as FlowGraphNode[]);
  }, []);

  return (
    <ReactFlowProvider>
    <div style={overlayStyle}>
      <div style={headerStyle}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 14 }}>
          {title}
        </Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {ready && displayNodes.length > 0 && <ScreenshotButton />}
          <IconButton size="small" onClick={onClose} sx={{ width: 30, height: 30 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {ready && displayNodes.length > 0 ? (
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={3}
            nodesDraggable={true}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Controls
              showInteractive={false}
              style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(24, 51, 89, 0.1)' }}
            />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="rgba(24, 51, 89, 0.08)" />
          </ReactFlow>
        ) : null}
      </div>
    </div>
    </ReactFlowProvider>
  );
}

export const FlowGraphPanel = React.memo(FlowGraphPanelImpl);
