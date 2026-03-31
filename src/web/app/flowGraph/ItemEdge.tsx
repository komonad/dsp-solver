import { getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import React, { useRef, useLayoutEffect, useState } from 'react';
import type { ItemEdgeData } from './buildFlowGraphData';

function formatRate(rate: number): string {
  if (rate >= 100) return Math.round(rate).toString();
  if (rate >= 10) return rate.toFixed(1);
  return rate.toFixed(2);
}

const LABEL_T = 0.3;
const CHEVRON_SPACING = 70;

interface ChevronPoint {
  x: number;
  y: number;
  angle: number;
}

function ItemEdgeImpl(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const { itemName, ratePerMin, width, color } = data as unknown as ItemEdgeData;
  const [hovered, setHovered] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const [labelPos, setLabelPos] = useState<{ x: number; y: number } | null>(null);
  const [chevrons, setChevrons] = useState<ChevronPoint[]>([]);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const totalLen = el.getTotalLength();

    // Label position
    const pt = el.getPointAtLength(totalLen * LABEL_T);
    setLabelPos({ x: pt.x, y: pt.y });

    // Chevron positions along the path
    const pts: ChevronPoint[] = [];
    const count = Math.floor(totalLen / CHEVRON_SPACING);
    if (count >= 1) {
      const step = totalLen / (count + 1);
      for (let i = 1; i <= count; i++) {
        const d = step * i;
        const p = el.getPointAtLength(d);
        const p2 = el.getPointAtLength(Math.min(d + 1, totalLen));
        const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * (180 / Math.PI);
        pts.push({ x: p.x, y: p.y, angle });
      }
    }
    setChevrons(pts);
  }, [edgePath]);

  const labelText = `${itemName} ${formatRate(ratePerMin)}/分`;
  const lx = labelPos?.x ?? sourceX;
  const ly = labelPos?.y ?? sourceY;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible wider path for easier hover targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(width + 8, 16)}
      />
      {/* Visible edge */}
      <path
        ref={pathRef}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="butt"
        strokeOpacity={hovered ? 0.85 : 0.55}
        style={{
          transition: 'stroke-opacity 150ms ease',
        }}
      />
      {/* Filled triangle direction indicators */}
      {chevrons.map((c, i) => {
        const h = width * 0.25 + 0.6;
        const d = h * 2.5;
        return (
          <polygon
            key={i}
            points={`${-d},${-h} 0,0 ${-d},${h}`}
            transform={`translate(${c.x}, ${c.y}) rotate(${c.angle})`}
            fill={color}
            stroke="none"
          />
        );
      })}
      {/* Always-visible label near source end */}
      <g transform={`translate(${lx}, ${ly})`}>
        <rect
          x={-(labelText.length * 3.5 + 8)}
          y={-11}
          width={labelText.length * 7 + 16}
          height={22}
          rx={5}
          fill={hovered ? 'rgba(24, 51, 89, 0.92)' : 'rgba(255, 255, 255, 0.92)'}
          stroke={hovered ? 'none' : color}
          strokeWidth={0.8}
          strokeOpacity={0.4}
        />
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fill={hovered ? '#fff' : '#183359'}
          fontSize={10}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
        >
          {labelText}
        </text>
      </g>
    </g>
  );
}

export const ItemEdge = React.memo(ItemEdgeImpl);
