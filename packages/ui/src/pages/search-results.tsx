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
import { SearchResultsView } from '../components/search/SearchResultsView';
import { useSearchStore } from '../stores/search-store';

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
  };

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
