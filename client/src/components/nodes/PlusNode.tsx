import React, { useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export interface PlusNodeData {
  type: 'timelineStart' | 'timelineEnd' | 'leafNode';
  insertionPoint: 'before' | 'after' | 'child';
  parentNode?: {
    id: string;
    title: string;
    type: string;
  };
  targetNode?: {
    id: string;
    title: string;
    type: string;
  };
  onPlusButtonClick?: (data: any) => void;
}

/**
 * Dedicated Plus Node component for timeline interactions
 * Renders as a proper React Flow node with timeline-integrated styling
 */
const PlusNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const [isHovered, setIsHovered] = useState(false);
  const plusData = data as PlusNodeData;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('PlusNode clicked!', plusData);
    if (plusData?.onPlusButtonClick) {
      plusData.onPlusButtonClick(plusData);
    }
  };

  // Get styling based on plus button type
  const getNodeStyling = () => {
    const baseStyles = {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: '2px dashed',
      backgroundColor: 'transparent',
      position: 'relative' as const,
    };

    if (plusData?.type === 'leafNode') {
      // Vertical plus button below leaf nodes - purple theme
      return {
        ...baseStyles,
        borderColor: isHovered ? '#8b5cf6' : '#a855f7',
        color: isHovered ? '#8b5cf6' : '#a855f7',
        boxShadow: isHovered 
          ? '0 8px 25px rgba(168, 85, 247, 0.3)' 
          : '0 4px 15px rgba(168, 85, 247, 0.2)',
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      };
    } else {
      // Horizontal plus buttons at timeline start/end - indigo theme
      return {
        ...baseStyles,
        borderColor: isHovered ? '#4f46e5' : '#6366f1',
        color: isHovered ? '#4f46e5' : '#6366f1',
        boxShadow: isHovered 
          ? '0 8px 25px rgba(99, 102, 241, 0.3)' 
          : '0 4px 15px rgba(99, 102, 241, 0.2)',
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      };
    }
  };

  // Add connecting dotted line based on button type
  const renderConnectingLine = () => {
    const lineStyle = {
      position: 'absolute' as const,
      opacity: isHovered ? 0.8 : 0.6,
      transition: 'opacity 0.2s ease',
    };

    if (plusData?.type === 'timelineStart') {
      // Dotted line connecting to the right (to first node)
      return (
        <div
          style={{
            ...lineStyle,
            right: '-24px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '24px',
            height: '2px',
            background: `repeating-linear-gradient(
              to right,
              ${isHovered ? '#4f46e5' : '#6366f1'} 0,
              ${isHovered ? '#4f46e5' : '#6366f1'} 4px,
              transparent 4px,
              transparent 8px
            )`,
          }}
        />
      );
    } else if (plusData?.type === 'timelineEnd') {
      // Dotted line connecting to the left (from last node)
      return (
        <div
          style={{
            ...lineStyle,
            left: '-24px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '24px',
            height: '2px',
            background: `repeating-linear-gradient(
              to right,
              ${isHovered ? '#4f46e5' : '#6366f1'} 0,
              ${isHovered ? '#4f46e5' : '#6366f1'} 4px,
              transparent 4px,
              transparent 8px
            )`,
          }}
        />
      );
    } else if (plusData?.type === 'leafNode') {
      // Dotted line connecting upward (to parent node)
      return (
        <div
          style={{
            ...lineStyle,
            top: '-24px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '2px',
            height: '24px',
            background: `repeating-linear-gradient(
              to bottom,
              ${isHovered ? '#8b5cf6' : '#a855f7'} 0,
              ${isHovered ? '#8b5cf6' : '#a855f7'} 4px,
              transparent 4px,
              transparent 8px
            )`,
          }}
        />
      );
    }
    return null;
  };

  // Get appropriate aria label
  const getAriaLabel = () => {
    const action = plusData?.insertionPoint === 'before' ? 'before' : 
                  plusData?.insertionPoint === 'after' ? 'after' : 'as child of';
    const target = plusData?.parentNode?.title || plusData?.targetNode?.title || 'timeline';
    return `Add milestone ${action} ${target}`;
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, type: "spring" }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {renderConnectingLine()}
      
      <motion.button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={getNodeStyling()}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        data-testid={`plus-node-${plusData?.type}-${plusData?.parentNode?.id || plusData?.targetNode?.id}`}
        aria-label={getAriaLabel()}
        title={`Add new milestone ${plusData?.insertionPoint === 'before' ? 'at start' : 
               plusData?.insertionPoint === 'after' ? 'at end' : 'as child'} of timeline`}
      >
        <Plus size={20} strokeWidth={2.5} />
      </motion.button>

      {/* Glow effect on hover */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            right: '-4px',
            bottom: '-4px',
            borderRadius: '50%',
            background: plusData?.type === 'leafNode' 
              ? 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      )}
    </motion.div>
  );
};

export default PlusNode;