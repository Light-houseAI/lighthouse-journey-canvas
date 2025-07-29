import React from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath } from '@xyflow/react';

const LBranchEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  // Create L-shaped path using getSmoothStepPath with step configuration
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0, // Square corners for L-shape
    centerX: sourceX, // Keep the path vertical first, then horizontal
    centerY: targetY, // This creates the L-shape
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: '#10b981', // Emerald color for branch connections
          strokeWidth: 2,
          strokeDasharray: '8,4', // Dotted pattern
          opacity: 0.8,
        }}
        markerEnd={markerEnd}
      />
    </>
  );
};

export default LBranchEdge;