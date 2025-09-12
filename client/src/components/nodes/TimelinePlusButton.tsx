import { NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import React, { useState } from 'react';

/**
 * Timeline Plus Button Node - Self-contained plus button for timeline interactions
 * Renders as a dotted circle with plus icon for adding new timeline items
 */
const TimelinePlusButton: React.FC<NodeProps> = ({ data }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onPlusButtonClick) {
      data.onPlusButtonClick(data);
    }
  };

  // Different styles based on the button type
  const getButtonStyle = () => {
    const baseStyle = {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: '2px dashed',
      backgroundColor: 'transparent',
      position: 'relative' as const,
      zIndex: 1000,
    };

    if (data?.type === 'leafNode') {
      // Vertical plus button below leaf nodes
      return {
        ...baseStyle,
        borderColor: isHovered ? '#22d3ee' : '#06b6d4',
        color: isHovered ? '#22d3ee' : '#06b6d4',
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      };
    } else {
      // Horizontal plus buttons at timeline start/end
      return {
        ...baseStyle,
        borderColor: isHovered ? '#22d3ee' : '#06b6d4',
        color: isHovered ? '#22d3ee' : '#06b6d4',
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      };
    }
  };

  // Add connecting dotted line based on button type
  const renderConnectingLine = () => {
    if (data?.type === 'timelineStart') {
      // Dotted line connecting to the right (to first node)
      return (
        <div
          style={{
            position: 'absolute',
            right: '-12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '2px',
            backgroundColor: isHovered ? '#4f46e5' : '#6366f1',
            opacity: 0.6,
            background: `repeating-linear-gradient(
              to right,
              ${isHovered ? '#22d3ee' : '#06b6d4'} 0,
              ${isHovered ? '#22d3ee' : '#06b6d4'} 4px,
              transparent 4px,
              transparent 8px
            )`,
          }}
        />
      );
    } else if (data?.type === 'timelineEnd') {
      // Dotted line connecting to the left (from last node)
      return (
        <div
          style={{
            position: 'absolute',
            left: '-12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '2px',
            opacity: 0.6,
            background: `repeating-linear-gradient(
              to right,
              ${isHovered ? '#22d3ee' : '#06b6d4'} 0,
              ${isHovered ? '#22d3ee' : '#06b6d4'} 4px,
              transparent 4px,
              transparent 8px
            )`,
          }}
        />
      );
    } else if (data?.type === 'leafNode') {
      // Dotted line connecting upward (to parent node)
      return (
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '2px',
            height: '20px',
            opacity: 0.6,
            background: `repeating-linear-gradient(
              to bottom,
              ${isHovered ? '#22d3ee' : '#06b6d4'} 0,
              ${isHovered ? '#22d3ee' : '#06b6d4'} 4px,
              transparent 4px,
              transparent 8px
            )`,
          }}
        />
      );
    }
    return null;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {renderConnectingLine()}
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={getButtonStyle()}
        data-testid={`timeline-plus-button-${data?.type}-${data?.parentNode?.id || data?.targetNode?.id}`}
        aria-label={`Add milestone ${data?.insertionPoint === 'before' ? 'before' : data?.insertionPoint === 'after' ? 'after' : 'as child of'} ${data?.parentNode?.title || data?.targetNode?.title || 'timeline'}`}
        title={`Add new milestone ${data?.insertionPoint === 'before' ? 'at start' : data?.insertionPoint === 'after' ? 'at end' : 'as child'} of timeline`}
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

export default TimelinePlusButton;