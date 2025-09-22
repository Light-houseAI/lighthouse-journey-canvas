/**
 * ExperienceMatchesPage Component
 *
 * Page for displaying experience matches using the common SearchResultsView
 * Reuses the same two-column layout as the search results page
 */

import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { useSearchParams } from 'wouter/use-search-params';

import { JourneyHeader } from '../components/journey/JourneyHeader';
import { useTheme } from '../contexts/ThemeContext';
import { SearchResultsView } from '../components/search/SearchResultsView';
import { useSearchStore } from '../stores/search-store';

export default function ExperienceMatchesPage() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const { preloadedMatchData } = useSearchStore();
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>();

  // Get the query from URL params or preloaded data
  const query = searchParams.q || preloadedMatchData?.query || '';

  // Use preloaded data if available
  const results = preloadedMatchData?.profiles || [];
  const isLoading = false; // Data is already preloaded
  const error = null;

  // Handle profile selection
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
  };

  // If no preloaded data, redirect to search
  if (!preloadedMatchData || results.length === 0) {
    return (
      <div className={`relative h-screen w-full overflow-hidden ${theme.backgroundGradient}`} role="main">
        <JourneyHeader viewingUsername={undefined} />
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No matches available</h3>
            <p className="text-gray-600">Please navigate from a timeline node with matches.</p>
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
        {/* Use common SearchResultsView component */}
        <SearchResultsView
          results={results}
          query={query}
          isLoading={isLoading}
          error={error}
          initialSelectedId={selectedProfileId}
          onProfileSelect={handleProfileSelect}
          className="h-full"
        />
      </motion.div>
    </div>
  );
}