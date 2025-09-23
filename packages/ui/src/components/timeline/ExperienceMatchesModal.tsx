/**
 * ExperienceMatchesModal Component (LIG-179)
 *
 * Modal overlay for displaying experience matches without changing URL
 * Uses Radix UI Dialog for proper accessibility and event handling
 */

import React, { useState } from 'react';
import type { GraphRAGSearchResponse } from '../search/types/search.types';
import { SearchResultsView } from '../search/SearchResultsView';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { cn } from '../../lib/utils';

interface ExperienceMatchesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data?: GraphRAGSearchResponse;
  query: string;
  className?: string;
}

export function ExperienceMatchesModal({
  isOpen,
  onOpenChange,
  data,
  query,
  className
}: ExperienceMatchesModalProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>();

  if (!data) {
    return null;
  }

  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[90vw] w-full max-h-[85vh] p-0 gap-0 flex flex-col",
          className
        )}
      >
        <DialogHeader className="px-6 py-4 border-b border-gray-200">
          <DialogTitle>Experience Matches</DialogTitle>
          <DialogDescription>
            {data.totalResults} {data.totalResults === 1 ? 'match' : 'matches'} found
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body - Search Results View */}
        <div className="overflow-auto">
          <SearchResultsView
            results={data.profiles}
            query={query}
            isLoading={false}
            error={null}
            initialSelectedId={selectedProfileId}
            onProfileSelect={handleProfileSelect}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
