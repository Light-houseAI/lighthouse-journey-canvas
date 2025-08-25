import React, { useState } from 'react';
import { EdgeProps, getStraightPath, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import { Plus } from 'lucide-react';

/**
 * Enhanced straight timeline edge component for React Flow
 * Uses solid blue line for chronological connections between timeline nodes
 * Features interactive plus button for node addition
 */
export const StraightTimelineEdge: React.FC<EdgeProps> = ({
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
  console.log('StraightTimelineEdge rendering:', { id, sourceX, sourceY, targetX, targetY });

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
      {/* Main edge path using BaseEdge - with hover functionality */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#4f46e5', // Indigo-600
          strokeWidth: 3,
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
            zIndex: 1000, // Ensure it's above React Flow nodes
            // Debug border to visualize hover area (remove in production)
            // border: '1px dashed rgba(255, 0, 0, 0.3)',
          }}
          className="nodrag nopan"
          data-testid={`timeline-edge-${id}`}
          data-edge-type="straightTimeline"
          data-source={data?.parentNode?.id}
          data-target={data?.targetNode?.id}
          role="connector"
          aria-label={`Connection from ${data?.parentNode?.title || 'previous'} to ${data?.targetNode?.title || 'next'}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Plus button - appears on hover and not blurred */}
          {isHovered && !shouldHideForBlur() && (
            <button
              onClick={handlePlusButtonClick}
              data-testid={`edge-plus-button-${id}`}
              className="edge-plus-button w-6 h-6 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110"
              aria-label="Add node here"
              title="Add new milestone"
              style={{ 
                zIndex: 1001, // Ensure button is above everything
                position: 'relative'
              }}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default StraightTimelineEdge;