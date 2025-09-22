/**
 * SearchResultsPage Component
 *
 * Main search results page following user-timeline.tsx pattern
 * JourneyHeader + content area with two-column layout
 */

import { motion } from 'framer-motion';
import React, { useEffect } from 'react';

import { JourneyHeader } from '../components/journey/JourneyHeader';
import { useTheme } from '../contexts/ThemeContext';

import { useSearchPageQuery } from '../hooks/search/useSearchPageQuery';
import { useSearchResults } from '../hooks/search/useSearchResults';
import { LeftPanel } from '../components/search/page/LeftPanel';
import { SearchStates } from '../components/search/SearchStates';

export default function SearchResultsPage() {
  const { theme } = useTheme();
  const { query } = useSearchPageQuery();
  const { results, isLoading, error } = useSearchResults(query);
  const { selectedProfileId, setSelectedProfile, setCurrentQuery } = useSearchStore();

  // Update store with current query to trigger automatic selection clearing
  useEffect(() => {
    setCurrentQuery(query);
  }, [query, setCurrentQuery]);

  // Handle profile selection from left panel
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfile(profileId);
    // TODO: Scroll to result in right panel
  };

  // Handle result click to navigate to profile (no longer needed)
  const handleResultClick = (username?: string, id?: string) => {
    // Profile viewing now handled by ProfileView component
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`relative h-screen w-full overflow-hidden ${theme.backgroundGradient}`} role="main">
        <JourneyHeader viewingUsername={undefined} />
        <div className="flex items-center justify-center h-full" data-testid="search-loading">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Searching...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative h-screen w-full overflow-hidden ${theme.backgroundGradient}`}
      role="main"
    >
      {/* Header with search functionality */}
      <JourneyHeader viewingUsername={undefined} />

      {/* Main content area */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="h-full w-full pt-16" // pt-16 to account for fixed header
      >
        {/* Two-column layout container */}
        <div
          className="h-full grid grid-cols-1 md:grid-cols-[30%_70%] gap-0"
          data-testid="search-results-container"
        >
          {/* Left Panel - Profile List */}
          <LeftPanel
            results={results}
            selectedId={selectedProfileId}
            onProfileSelect={handleProfileSelect}
            className="hidden md:flex h-full"
          />

          {/* Right Content - Detailed Results */}
          <div className="flex flex-col h-full overflow-y-auto bg-white flex-1">
            {error ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <SearchStates
                  type="error"
                  message="Failed to load search results"
                  onRetry={() => window.location.reload()}
                />
              </div>
            ) : results.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <SearchStates
                  type="empty"
                  message={`No results found for "${query}"`}
                />
              </div>
            ) : selectedProfileId ? (
              // Show profile view when a profile is selected
              (() => {
                const selectedProfile = results.find(r => r.id === selectedProfileId);
                return selectedProfile ? (
                  <ProfileView
                    profile={selectedProfile}
                    className="flex-1"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Profile not found</h3>
                      <p className="text-gray-600">The selected profile could not be loaded.</p>
                    </div>
                  </div>
                );
              })()
            ) : (
              // Show instruction to select a profile
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {results.length} {results.length === 1 ? 'result' : 'results'} found for "{query}"
                  </h3>
                  <p className="text-gray-600">
                    Select a profile from the left panel to view details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
