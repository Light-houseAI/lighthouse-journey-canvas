/**
 * SearchDropdown Component
 * 
 * Container for search results with proper positioning and state handling
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { SearchResult } from './SearchResult';
import { SearchStates } from './SearchStates';
import type { SearchDropdownProps } from './types/search.types';

export const SearchDropdown: React.FC<SearchDropdownProps> = ({
  isOpen,
  results,
  isLoading,
  error,
  highlightedIndex,
  onResultSelect,
  onClose,
  className
}) => {
  const handleResultClick = (userId: string) => {
    const result = results.find(r => r.id === userId);
    if (result) {
      onResultSelect(result);
    }
  };

  const handleResultSelect = (userId: string) => {
    handleResultClick(userId);
  };

  const handleRetry = () => {
    // This will be handled by the parent component
    // The error state will trigger a retry when the user searches again
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ 
            duration: 0.2,
            ease: [0.16, 1, 0.3, 1] // Smooth easing
          }}
          className={cn(
            "absolute top-full left-0 right-0 z-50 mt-2",
            className
          )}
        >
          <Card className="border-gray-200 bg-white shadow-[0px_2px_5px_0px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_0px_rgba(0,0,0,0.12)]">
            <div 
              role="listbox"
              className="max-h-96 overflow-y-auto"
            >
              {/* Loading State */}
              {isLoading && (
                <SearchStates type="loading" />
              )}

              {/* Error State */}
              {error && !isLoading && (
                <SearchStates 
                  type="error" 
                  message={error.message}
                  onRetry={handleRetry}
                />
              )}

              {/* Empty State */}
              {!isLoading && !error && results.length === 0 && (
                <SearchStates type="empty" />
              )}

              {/* Results */}
              {!isLoading && !error && results.length > 0 && (
                <div className="divide-y divide-border">
                  {results.map((result, index) => (
                    <SearchResult
                      key={result.id}
                      result={result}
                      isHighlighted={index === highlightedIndex}
                      onSelect={handleResultSelect}
                      onClick={handleResultClick}
                      showInsights={true}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};