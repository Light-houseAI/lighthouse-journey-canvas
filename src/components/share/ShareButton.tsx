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

  const handleClick = () => {
    if (nodes && nodes.length > 0) {
      // Specific nodes selected - show them as pre-selected
      openModalWithSelection(allUserNodes, nodes.map(n => n.id));
    } else {
      // No specific nodes - default to share all
      openModal(allUserNodes);
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={cn(
        'transition-colors',
        'text-muted-foreground hover:text-foreground',
        'hover:bg-muted/50',
        className
      )}
      title='Share'
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
