/**
 * ViewMatchesButton Component (LIG-179)
 *
 * Button component that displays match count for current experience nodes
 * and shows matches in a modal overlay when clicked (no URL change).
 */

import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { TimelineNode } from '@journey/schema';
import { useExperienceMatches } from '../../hooks/search/useExperienceMatches';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
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
  const {
    data,
    isLoading,
    shouldShowButton,
    matchCount,
    searchQuery,
    isCurrentExperience
  } = useExperienceMatches(node);

  // Handle opening the modal
  const handleClick = (e: React.MouseEvent) => {
    // Prevent event from bubbling up to parent components (like node click handlers)
    e.stopPropagation();
    e.preventDefault();

    if (!searchQuery || !data) {
      console.warn('No search query or data available');
      return;
    }

    setIsModalOpen(true);
  };

  // Show loading state only for current experiences
  if (isCurrentExperience && isLoading) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className={cn('timeline-action-button', className)}
        data-testid="loading-spinner"
      >
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  // Don't render if button shouldn't be shown
  if (!shouldShowButton) {
    return null;
  }

  // Format button text based on match count
  const buttonText = matchCount === 1
    ? 'View 1 match'
    : `View ${matchCount} matches`;

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

/**
 * Wrapper component for integrating with timeline nodes
 * This can be used within NodeTypeRenderer or similar components
 */
export function ExperienceNodeWrapper({
  node,
  children
}: {
  node: TimelineNode;
  children: React.ReactNode;
}) {
  const isExperienceNode = node.type === 'job' || node.type === 'education';

  return (
    <>
      {children}
      {isExperienceNode && (
        <div className="mt-2 flex items-center gap-2">
          <ViewMatchesButton node={node} />
        </div>
      )}
    </>
  );
}

/**
 * Loading skeleton for the button
 * Can be used when the entire node is loading
 */
export function ViewMatchesButtonSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('h-8 w-32 bg-gray-200 rounded animate-pulse', className)} />
  );
}
