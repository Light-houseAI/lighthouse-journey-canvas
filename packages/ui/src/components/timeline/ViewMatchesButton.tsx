/**
 * ViewMatchesButton Component (LIG-179)
 *
 * Button component that displays match count for current experience nodes
 * and shows matches in a modal overlay when clicked (no URL change).
 */

import type { TimelineNode } from '@journey/schema';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import { useExperienceMatches } from '../../hooks/search/useExperienceMatches';
import { cn } from '@journey/components';
import { Button } from '@journey/components';
import { ExperienceMatchesModal } from './ExperienceMatchesModal';

export interface ViewMatchesButtonProps {
  node: TimelineNode;
  className?: string;
}

/**
 * Button to view matches for current experience nodes
 */
export function ViewMatchesButton({ node, className }: ViewMatchesButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data, isLoading, shouldShowButton, matchCount, searchQuery } =
    useExperienceMatches(node);

  // Handle opening the modal
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!searchQuery || !data) {
      return;
    }

    setIsModalOpen(true);
  };

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className={cn('timeline-action-button', className)}
        data-testid="loading-spinner"
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Don't render if button shouldn't be shown
  if (!shouldShowButton) {
    return null;
  }

  // Format button text based on match count
  const buttonText =
    matchCount === 1 ? 'View 1 match' : `View ${matchCount} matches`;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={cn('timeline-action-button', className)}
        aria-label={buttonText}
      >
        {buttonText}
      </Button>

      {/* Experience Matches Modal */}
      <ExperienceMatchesModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        data={data}
        query={searchQuery || ''}
      />
    </>
  );
}
