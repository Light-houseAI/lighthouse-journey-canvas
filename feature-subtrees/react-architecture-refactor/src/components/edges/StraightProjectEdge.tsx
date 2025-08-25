import React from 'react';
import { EdgeProps, getStraightPath } from '@xyflow/react';
import { PROJECT_EDGE_STYLE, createStyledPath } from './edgeUtils';

/**
 * Straight project edge component for React Flow
 * Uses dotted green line for connections between experience nodes and project nodes
 */
export const StraightProjectEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}) => {
  // Use React Flow's getStraightPath utility to calculate the path
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <g>
      {createStyledPath(edgePath, PROJECT_EDGE_STYLE, id)}
    </g>
  );
};

export default StraightProjectEdge;