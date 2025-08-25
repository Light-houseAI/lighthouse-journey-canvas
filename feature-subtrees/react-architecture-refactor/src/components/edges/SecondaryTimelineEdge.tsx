import React, { useState } from 'react';
import { EdgeProps, getStraightPath, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import { Plus } from 'lucide-react';

/**
 * Enhanced secondary timeline edge component
 * Used for connections between parent nodes and their expanded secondary timeline
 * Features:
 * - Dashed line style to differentiate from main timeline
 * - Subtle color (gray) to not compete with main timeline
 * - Interactive plus button for adding items to secondary timeline
 */
export const SecondaryTimelineEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Use React Flow's getStraightPath utility to calculate the path
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  // Calculate midpoint for plus button positioning
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const handlePlusButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onPlusButtonClick) {
      data.onPlusButtonClick(data);
    }
  };

  // Determine if this plus button should be hidden due to blur state
  const shouldHideForBlur = () => {
    const globalFocusedNodeId = data?.globalFocusedNodeId;
    
    // If no node is focused, show all plus buttons
    if (!globalFocusedNodeId) return false;
    
    // Check if either the source or target node is the focused node
    const sourceNodeId = data?.parentNode?.id;
    const targetNodeId = data?.targetNode?.id;
    if (sourceNodeId === globalFocusedNodeId || targetNodeId === globalFocusedNodeId) return false;
    
    // Hide plus button if there's a focused node and this edge isn't related to it
    return true;
  };

  return (
    <>
      {/* Main edge path - dashed style for secondary connections */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#64748b', // Slate-500 - more subtle than main timeline
          strokeWidth: 2,
          strokeDasharray: '8 4', // Dashed line pattern
          opacity: 0.7,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      
      {/* Interactive elements using EdgeLabelRenderer */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
            pointerEvents: 'all',
            width: '60px',
            height: '60px',
            minWidth: '60px',
            minHeight: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          className="nodrag nopan"
          data-testid={`secondary-edge-${id}`}
          data-edge-type="secondaryTimeline"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Plus button - appears on hover and not blurred */}
          {isHovered && !shouldHideForBlur() && (
            <button
              onClick={handlePlusButtonClick}
              data-testid={`secondary-edge-plus-button-${id}`}
              className="w-5 h-5 bg-slate-500 hover:bg-slate-600 text-white rounded-full flex items-center justify-center shadow-md transition-all duration-200 hover:scale-110 opacity-80 hover:opacity-100"
              aria-label="Add project here"
              title="Add new project"
              style={{ 
                zIndex: 1001,
                position: 'relative'
              }}
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default SecondaryTimelineEdge;