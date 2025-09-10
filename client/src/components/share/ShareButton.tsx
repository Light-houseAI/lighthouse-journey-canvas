/**
 * ShareButton Component
 *
 * Button component that opens the share modal for sharing nodes
 */

import React from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShareStore } from '@/stores/share-store';
import { useTimelineStore } from '@/hooks/useTimelineStore';
import { TimelineNode } from '@shared/schema';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  nodes?: TimelineNode[]; // Specific nodes to share, if any
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  nodes,
  variant = 'ghost',
  size = 'sm',
  className,
  showLabel = false,
}) => {
  const { openModal, openModalWithSelection } = useShareStore();
  const { nodes: allUserNodes } = useTimelineStore();

  // Debug logging to identify the issue
  console.log('🔍 ShareButton Debug Info:', {
    nodes: nodes?.length || 0,
    allUserNodes: allUserNodes?.length || 0,
    hasOpenModal: typeof openModal === 'function',
    hasOpenModalWithSelection: typeof openModalWithSelection === 'function'
  });

  const handleClick = (e: React.MouseEvent) => {
    console.log('🔥 ShareButton clicked!', e);
    
    // Prevent any event bubbling that might interfere
    e.preventDefault();
    e.stopPropagation();

    try {
      if (nodes && nodes.length > 0) {
        console.log('📤 Opening modal with selection:', nodes.map(n => n.id));
        // Specific nodes selected - show them as pre-selected
        openModalWithSelection(allUserNodes, nodes.map(n => n.id));
      } else {
        console.log('📤 Opening modal with all nodes:', allUserNodes?.length || 0);
        // No specific nodes - default to share all
        openModal(allUserNodes);
      }
    } catch (error) {
      console.error('❌ Error in ShareButton handleClick:', error);
    }
  };

  // Check if button should be disabled
  const isDisabled = !allUserNodes || allUserNodes.length === 0;
  
  console.log('🔍 ShareButton render state:', {
    isDisabled,
    variant,
    size,
    className
  });

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={cn(
        'transition-colors cursor-pointer', // Ensure cursor shows as pointer
        'text-muted-foreground hover:text-foreground',
        'hover:bg-muted/50',
        isDisabled && 'cursor-not-allowed opacity-50',
        className
      )}
      title={isDisabled ? 'No timeline data available to share' : 'Share'}
      style={{ pointerEvents: 'auto' }} // Force pointer events
    >
      <Share2 className="h-4 w-4" />
      {showLabel && (
        <span className="ml-2">
          Share
        </span>
      )}
    </Button>
  );
};