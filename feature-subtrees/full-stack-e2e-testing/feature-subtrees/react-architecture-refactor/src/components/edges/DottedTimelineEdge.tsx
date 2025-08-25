import React, { useState } from 'react';
import { EdgeProps, getStraightPath, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import { Plus } from 'lucide-react';

/**
 * Dotted timeline edge component for timeline start/end plus buttons
 * Uses dotted lines with circular plus buttons that have dotted borders
 */
export const DottedTimelineEdge: React.FC<EdgeProps> = ({
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

  console.log('DottedTimelineEdge rendering:', { id, sourceX, sourceY, targetX, targetY, midX, midY, data });

  return (
    <>
      {/* Main edge path - MORE VISIBLE dotted style for debugging */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#ff0000', // RED for debugging
          strokeWidth: 4, // Thicker for debugging
          strokeDasharray: '8 8', // Bigger dots for debugging
          opacity: 1, // Full opacity for debugging
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
            width: '80px',
            height: '80px',
            minWidth: '80px',
            minHeight: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backgroundColor: 'rgba(255, 0, 0, 0.2)', // Debug background
          }}
          className="nodrag nopan"
          data-testid={`dotted-timeline-edge-${id}`}
          data-edge-type="dottedTimeline"
          data-source={data?.parentNode?.id || data?.targetNode?.id}
          data-target={data?.targetNode?.id || data?.parentNode?.id}
          role="connector"
          aria-label={`Add milestone ${data?.insertionPoint === 'before' ? 'before' : 'after'} ${data?.targetNode?.title || data?.parentNode?.title || 'timeline'}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Plus button - BIGGER and MORE VISIBLE for debugging */}
          <button
            onClick={handlePlusButtonClick}
            data-testid={`timeline-end-plus-button-${id}`}
            style={{ 
              width: '40px',
              height: '40px',
              backgroundColor: '#ff0000', // RED for debugging
              color: 'white',
              border: '3px solid #000000', // BLACK border for debugging
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold',
              cursor: 'pointer',
              zIndex: 1001,
              position: 'relative'
            }}
            aria-label={`Add milestone ${data?.insertionPoint === 'before' ? 'before' : 'after'} timeline`}
            title={`Add new milestone ${data?.insertionPoint === 'before' ? 'at start' : 'at end'} of timeline`}
          >
            +
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default DottedTimelineEdge;