import React, { useState } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  useReactFlow,
} from '@xyflow/react';

interface ButtonEdgeData {
  label?: string;
}

const ButtonEdge: React.FC<EdgeProps<ButtonEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  const edgeColor = style.stroke || '#555';
  const edgeWidth = style.strokeWidth || 2;

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: isHovered ? '#ff4d4f' : edgeColor,
          strokeWidth: isHovered ? edgeWidth + 1 : edgeWidth,
          cursor: 'pointer',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {isHovered && (
            <button
              onClick={onEdgeClick}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: 'none',
                background: '#ff4d4f',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.2s',
              }}
              title="删除连线"
            >
              ×
            </button>
          )}
          {data?.label && !isHovered && (
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid #d9d9d9',
                fontSize: 10,
              }}
            >
              {data.label}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default ButtonEdge;
