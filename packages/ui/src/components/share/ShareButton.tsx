/**
 * ShareButton Component
 *
 * Button component that opens the share modal for sharing nodes
 */

import { Button, cn, HStack } from '@journey/components';
import { TimelineNode } from '@journey/schema';
import { Share2 } from 'lucide-react';
import React from 'react';

import { useAnalytics, AnalyticsEvents } from '../../hooks/useAnalytics';
import { useTimelineStore } from '../../hooks/useTimelineStore';
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
  className,
  showLabel = false,
}) => {
  const { track } = useAnalytics();
  const { openModal } = useShareStore();
  const { nodes: timelineNodesQuery } = useTimelineStore();
  const timelineNodes = timelineNodesQuery.data || [];

  // Use provided allNodes or fallback to timeline store nodes
  const allUserNodes = allNodes || timelineNodes;

  const handleClick = (e: React.MouseEvent) => {
    // Prevent any event bubbling that might interfere
    e.preventDefault();
    e.stopPropagation();

    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'share',
      button_location: 'share_button',
      nodes_count: nodes?.length || 0,
      share_type: nodes && nodes.length > 0 ? 'selected_nodes' : 'all_nodes',
    });

    try {
      if (nodes && nodes.length > 0) {
        // Specific nodes selected - pass their IDs to openModal
        openModal(nodes.map((n) => n.id));
      } else {
        // No specific nodes - default to share all (pass undefined to trigger shareAllNodes)
        openModal();
      }
    } catch (error) {
      console.error('Error opening share modal:', error);
    }
  };

  // Check if button should be disabled
  const isDisabled = !allUserNodes || allUserNodes.length === 0;

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant="outline"
      className={cn(
        // Base Figma styling
        'box-border cursor-pointer rounded-lg bg-white px-[18px] py-[10px] transition-colors',
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
      <HStack spacing={2} align="center" justify="center">
        <Share2 className="h-[18px] w-[18px] text-black" />
        {showLabel && (
          <span className="text-nowrap text-[14px] font-semibold leading-5 text-black">
            Share profile
          </span>
        )}
      </HStack>
    </Button>
  );
};
