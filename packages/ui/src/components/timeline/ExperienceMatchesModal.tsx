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
} from '@journey/components';
import { cn } from '@journey/components';

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
          "max-w-[85vw] w-full h-[80vh] p-0 gap-0 flex flex-col",
          className
        )}
        aria-describedby='Experience matches modal showing search results'
      >
        <DialogHeader className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <DialogTitle className="text-base font-semibold">
            Experience Matches
          </DialogTitle>
        </DialogHeader>

        {/* Modal Body - Search Results View */}
        <div className="flex-1 overflow-hidden min-h-0">
          <SearchResultsView
            results={data.profiles}
            query={query}
            isLoading={false}
            error={null}
            initialSelectedId={selectedProfileId}
            onProfileSelect={handleProfileSelect}
            className="h-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
