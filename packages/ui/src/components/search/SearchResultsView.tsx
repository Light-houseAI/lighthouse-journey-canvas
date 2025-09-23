/**
 * SearchResultsView Component
 *
 * Common view component for displaying search results
 * Used by both search page and experience matches display
 * Provides two-column layout with left panel for profile list and right panel for details
 */

import React, { useState, useEffect } from 'react';
import type { ProfileResult } from './types/search.types';
import { LeftPanel } from './page/LeftPanel';
import { ProfileView } from './page/ProfileView';
import { SearchStates } from './SearchStates';

interface SearchResultsViewProps {
  results: ProfileResult[];
  query: string;
  isLoading?: boolean;
  error?: Error | null;
  initialSelectedId?: string;
  onProfileSelect?: (profileId: string) => void;
  className?: string;
}

export function SearchResultsView({
  results,
  query,
  isLoading = false,
  error = null,
  initialSelectedId,
  onProfileSelect,
  className = ''
}: SearchResultsViewProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(initialSelectedId);

  // Update selected profile when initialSelectedId changes
  useEffect(() => {
    setSelectedProfileId(initialSelectedId);
  }, [initialSelectedId]);

  // Handle profile selection
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    onProfileSelect?.(profileId);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full min-h-[400px] ${className}`} data-testid="search-loading">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">Searching...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full min-h-[400px] p-4 ${className}`}>
        <SearchStates
          type="error"
          message="Failed to load search results"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // Render empty state
  if (results.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full min-h-[400px] p-4 ${className}`}>
        <SearchStates
          type="empty"
          message={`No results found for "${query}"`}
        />
      </div>
    );
  }

  // Get selected profile
  const selectedProfile = selectedProfileId
    ? results.find(r => r.id === selectedProfileId)
    : undefined;

  return (
    <div
      className={`h-full min-h-[400px] grid grid-cols-1 md:grid-cols-[350px_1fr] gap-0 border border-gray-200 rounded-lg overflow-hidden shadow-sm ${className}`}
      data-testid="search-results-view"
    >
      {/* Left Panel - Profile List */}
      <LeftPanel
        results={results}
        selectedId={selectedProfileId}
        onProfileSelect={handleProfileSelect}
        className="hidden md:flex h-full border-r border-gray-200"
      />

      {/* Right Content - Detailed Results */}
      <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
        {selectedProfile ? (
          <ProfileView
            profile={selectedProfile}
            className="h-full"
          />
        ) : (
          // Show instruction to select a profile
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center max-w-sm">
              <div className="mx-auto h-16 w-16 text-gray-300 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">
                {results.length} {results.length === 1 ? 'result' : 'results'} found
              </h3>
              <p className="text-sm text-gray-500">
                Select a profile from the left panel to view details
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}