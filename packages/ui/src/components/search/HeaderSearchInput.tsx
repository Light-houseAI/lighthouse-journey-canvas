/**
 * HeaderSearchInput Component
 *
 * Search input for header without dropdown, navigates to search page on Enter
 * Modified version of SearchInput component for navigation instead of dropdown
 */

import React, { useState } from 'react';
import { useLocation } from 'wouter';

import { cn } from '@/lib/utils';

export interface HeaderSearchInputProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const HeaderSearchInput: React.FC<HeaderSearchInputProps> = ({
  placeholder = 'Search profiles...',
  disabled = false,
  className,
}) => {
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();

  // Handle Enter key press to navigate to search page
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && query.trim().length > 0) {
      event.preventDefault();
      const encodedQuery = encodeURIComponent(query.trim());

      
      // Force page refresh for proper search results loading
      const searchUrl = `/search?q=${encodedQuery}`;
      window.location.href = searchUrl;
    }
  };

  // Handle input change
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative">
        {/* Search icon */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Search input */}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2',
            'text-sm placeholder-gray-500',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            'transition-colors duration-200'
          )}
          aria-label="Search profiles"
        />

        {/* Enter hint */}
        {query.length > 0 && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-xs text-gray-400">Press Enter</span>
          </div>
        )}
      </div>
    </div>
  );
};