import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import React from 'react';
import { EntityIcon } from '../../shared/EntityIcon';
import type { RecipeNodeData } from './buildFlowGraphData';

function formatBuildingCount(exact: number, rounded: number): string {
  if (Math.abs(exact - rounded) < 1e-9) {
    return `×${rounded}`;
  }
  return `×${exact.toFixed(2)}`;
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

function RecipeNodeImpl({ data }: NodeProps) {
  const { buildingName, buildingIconKey, buildingCount, exactBuildingCount, recipeName, atlasIds, inputItemIds, outputItemIds } =
    data as unknown as RecipeNodeData;

  return (
    <div style={{ width: 140, height: 64, position: 'relative' }}>
      {inputItemIds.length > 0
        ? inputItemIds.map((itemId, idx) => (
            <Handle
              key={`in-${itemId}`}
              id={`in-${itemId}`}
              type="target"
              position={Position.Left}
              style={{ ...hiddenHandle, top: `${((idx + 1) / (inputItemIds.length + 1)) * 100}%` }}
            />
          ))
        : <Handle type="target" position={Position.Left} style={hiddenHandle} />
      }
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(235,243,250,0.95))',
          border: '1px solid rgba(24, 88, 163, 0.22)',
          borderRadius: 12,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 8px rgba(24, 51, 89, 0.08)',
          boxSizing: 'border-box',
        }}
      >
        <EntityIcon
          label={buildingName}
          iconKey={buildingIconKey}
          atlasIds={atlasIds}
          size={28}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: '#183359',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {formatBuildingCount(exactBuildingCount, buildingCount)}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'rgba(24, 51, 89, 0.6)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 90,
            }}
          >
            {recipeName}
          </span>
        </div>
      </div>
      {/* Staggered output handles on the right */}
      {outputItemIds.length > 0
        ? outputItemIds.map((itemId, idx) => (
            <Handle
              key={`out-${itemId}`}
              id={`out-${itemId}`}
              type="source"
              position={Position.Right}
              style={{ ...hiddenHandle, top: `${((idx + 1) / (outputItemIds.length + 1)) * 100}%` }}
            />
          ))
        : <Handle type="source" position={Position.Right} style={hiddenHandle} />
      }
    </div>
  );
}

export const RecipeNode = React.memo(RecipeNodeImpl);
