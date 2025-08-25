import React, { useState } from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { Plus } from 'lucide-react';

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
  const [isHovered, setIsHovered] = useState(false);

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

  // Calculate midpoint for plus button (on the L-shaped path)
  const midX = sourceX;
  const midY = (sourceY + targetY) / 2;

  const handlePlusButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onPlusButtonClick) {
      data.onPlusButtonClick({
        ...data,
        insertionPoint: 'branch', // Override for branch context
      });
    }
  };

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`timeline-edge-${id}`}
      data-edge-type="lBranch"
      data-source={data?.parentNode?.id}
      data-target={data?.targetNode?.id}
      role="connector"
      aria-label={`Branch connection from ${data?.parentNode?.title || 'parent'} to ${data?.targetNode?.title || 'project'}`}
    >
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
      
      {/* Plus button for adding projects - appears on hover */}
      {isHovered && (
        <foreignObject
          x={midX - 12}
          y={midY - 12}
          width={24}
          height={24}
          style={{ overflow: 'visible' }}
        >
          <button
            onClick={handlePlusButtonClick}
            data-testid={`branch-edge-plus-button-${id}`}
            className="edge-plus-button w-6 h-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110"
            aria-label="Add project here"
            title="Add new project"
          >
            <Plus className="w-3 h-3" />
          </button>
        </foreignObject>
      )}
    </g>
  );
};

export default LBranchEdge;