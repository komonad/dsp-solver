import { useEffect } from 'react';
import { useNodesInitialized, useReactFlow } from '@xyflow/react';
import type { FlowGraphNode } from './buildFlowGraphData';

export default function FitGraphOnLayout({ nodes }: { nodes: FlowGraphNode[] }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!initialized || nodes.length === 0) return;
    let frame = 0;
    const scheduleFit = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        void fitView({ padding: 0.15, duration: 150 });
      });
    };
    scheduleFit();
    window.addEventListener('resize', scheduleFit);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleFit);
    };
  }, [nodes, initialized, fitView]);

  return null;
}
