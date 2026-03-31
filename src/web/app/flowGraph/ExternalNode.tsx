import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import React from 'react';
import { EntityIcon } from '../../shared/EntityIcon';
import type { ExternalNodeData } from './buildFlowGraphData';

function formatRate(rate: number): string {
  if (rate >= 100) return Math.round(rate).toString();
  if (rate >= 10) return rate.toFixed(1);
  return rate.toFixed(2);
}

const hiddenHandle: React.CSSProperties = {
  opacity: 0,
  width: 0,
  height: 0,
  minWidth: 0,
  minHeight: 0,
  padding: 0,
  border: 'none',
};

function ExternalNodeImpl({ data }: NodeProps) {
  const { itemName, iconKey, ratePerMin, kind, atlasIds } = data as unknown as ExternalNodeData;
  const isInput = kind === 'input';

  return (
    <div style={{ width: 120, height: 48, position: 'relative' }}>
      {!isInput && (
        <Handle type="target" position={Position.Left} style={hiddenHandle} />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isInput
            ? 'rgba(255,255,255,0.92)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(232,245,233,0.95))',
          border: isInput
            ? '1px dashed rgba(24, 51, 89, 0.25)'
            : '1px solid rgba(46, 125, 50, 0.3)',
          borderRadius: 10,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 1px 4px rgba(24, 51, 89, 0.06)',
          boxSizing: 'border-box',
        }}
      >
        <EntityIcon
          label={itemName}
          iconKey={iconKey}
          atlasIds={atlasIds}
          size={22}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#183359',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 72,
            }}
          >
            {itemName}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(24, 51, 89, 0.55)' }}>
            {formatRate(ratePerMin)}/分
          </span>
        </div>
      </div>
      {isInput && (
        <Handle type="source" position={Position.Right} style={hiddenHandle} />
      )}
    </div>
  );
}

export const ExternalNode = React.memo(ExternalNodeImpl);
