import React from 'react';
import { EdgeProps, getStraightPath } from '@xyflow/react';
import { TIMELINE_EDGE_STYLE, createStyledPath } from './edgeUtils';

/**
 * Straight timeline edge component for React Flow
 * Uses solid blue line for chronological connections between timeline nodes
 */
export const StraightTimelineEdge: React.FC<EdgeProps> = ({
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
      {createStyledPath(edgePath, TIMELINE_EDGE_STYLE, id)}
    </g>
  );
};

export default StraightTimelineEdge;