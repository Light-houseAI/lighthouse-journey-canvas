import { NodeProps } from '@xyflow/react';
import React from 'react';

/**
 * Invisible helper node for positioning timeline end plus buttons
 * This node is completely invisible and only exists to anchor edge connections
 */
const HelperNode: React.FC<NodeProps> = () => {
  return (
    <div 
      style={{ 
        width: 1, 
        height: 1, 
        opacity: 0, 
        pointerEvents: 'none' 
      }}
    />
  );
};

export default HelperNode;