/**
 * ProfileSearch Component
 * 
 * Main search container that combines input, dropdown, and handles all interactions
 */

import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { SearchInput } from './SearchInput';
import { SearchDropdown } from './SearchDropdown';
import { useProfileSearch } from './hooks/useProfileSearch';
import { useSearchDropdown, useClickOutside } from './hooks/useSearchDropdown';
import { useSearchKeyboard } from './hooks/useSearchKeyboard';
import type { ProfileSearchProps, ProfileResult } from './types/search.types';

export const ProfileSearch: React.FC<ProfileSearchProps> = ({
  className,
  placeholder = "Search profiles...",
  maxResults = 3,
  disabled = false,
  onResultSelect
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Hooks
  const { search, results, isLoading, error, clear, query } = useProfileSearch();
  const { isOpen, open, close } = useSearchDropdown();

  // Handle result selection
  const handleResultSelect = (result: ProfileResult) => {
    // Custom callback if provided
    if (onResultSelect) {
      onResultSelect(result);
    }
    
    // Navigate to user timeline using location API
    window.location.href = `/timeline/${result.id}`;
    
    // Close dropdown and clear search
    close();
    clear();
  };

  // Keyboard navigation
  const { highlightedIndex, onKeyDown, resetHighlight } = useSearchKeyboard(
    results,
    handleResultSelect,
    close
  );

  // Click outside to close
  useClickOutside(containerRef, () => {
    close();
    resetHighlight();
  });

  // Handle input changes
  const handleInputChange = (value: string) => {
    search(value);
    
    if (value.trim().length > 0) {
      open();
    } else {
      close();
      resetHighlight();
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (query.trim().length > 0) {
      open();
    }
  };

  // Handle input blur
  const handleInputBlur = () => {
    // Don't close immediately on blur to allow for result clicks
    // The click outside handler will take care of closing
  };

  // Determine if dropdown should be visible  
  const shouldShowDropdown = isOpen && (
    isLoading || 
    (error !== null) || 
    results.length > 0 || 
    (query.trim().length > 0 && !isLoading)
  );

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full", className)}
      onKeyDown={onKeyDown}
    >
      <SearchInput
        value={query}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        disabled={disabled}
        isLoading={isLoading}
        className="w-full"
      />

      <SearchDropdown
        isOpen={shouldShowDropdown}
        results={results.slice(0, maxResults)}
        isLoading={isLoading}
        error={error}
        highlightedIndex={highlightedIndex}
        onResultSelect={handleResultSelect}
        onClose={close}
        className="w-full min-w-[400px]"
      />
    </div>
  );
};