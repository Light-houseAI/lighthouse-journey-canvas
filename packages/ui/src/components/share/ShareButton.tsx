/**
 * ShareButton Component
 *
 * Button component that opens the share modal for sharing nodes
 */

import { TimelineNode } from '@journey/schema';
import { Share2 } from 'lucide-react';
import React from 'react';

import { useTimelineStore } from '../../hooks/useTimelineStore';
import { cn } from '@journey/components';
import { useProfileViewStore } from '../../stores/profile-view-store';
import { useShareStore } from '../../stores/share-store';

interface ShareButtonProps {
  nodes?: TimelineNode[]; // Specific nodes to share, if any
  allNodes?: TimelineNode[]; // All available nodes for context (used in ProfileListView)
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  nodes,
  allNodes,
  variant = 'ghost',
  size = 'sm',
  className,
  showLabel = false,
}) => {
  const { openModal, openModalWithSelection } = useShareStore();
  const { nodes: timelineNodes } = useTimelineStore();
  const profileViewNodes = useProfileViewStore((state) => state.allNodes);

  // Use provided allNodes, ProfileViewStore nodes, or fallback to timeline store nodes
  const allUserNodes = allNodes || profileViewNodes || timelineNodes;

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
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        // Base Figma styling
        'bg-white box-border flex gap-2 items-center justify-center px-[18px] py-[10px] rounded-lg transition-colors cursor-pointer',
        // Figma shadow styling
        'shadow-[0px_2px_5px_0px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_0px_rgba(0,0,0,0.12)]',
        // Hover effects
        'hover:shadow-[0px_4px_8px_0px_rgba(103,110,118,0.12),0px_0px_0px_1px_rgba(103,110,118,0.20),0px_2px_2px_0px_rgba(0,0,0,0.16)]',
        // Disabled state
        isDisabled && 'cursor-not-allowed opacity-50',
        // Custom overrides
        className
      )}
      title={isDisabled ? 'No timeline data available to share' : 'Share'}
      style={{ pointerEvents: 'auto' }} // Force pointer events
    >
      <Share2 className="w-[18px] h-[18px] text-black" />
      {showLabel && (
        <span className="font-semibold text-[14px] leading-5 text-black text-nowrap">
          Share profile
        </span>
      )}
    </button>
  );
};
