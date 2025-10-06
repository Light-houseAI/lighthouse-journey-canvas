/**
 * LeftPanel Component
 *
 * Container for profile list using scroll container patterns from timeline components
 * Displays list of search results with selection highlighting
 */

import React from 'react';

import { cn } from '@journey/components';

import { ProfileListItem } from './ProfileListItem';
import type { ProfileResult } from '../types/search.types';

export interface LeftPanelProps {
  results: ProfileResult[];
  selectedId?: string;
  onProfileSelect: (id: string) => void;
  className?: string;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  results,
  selectedId,
  onProfileSelect,
  className,
}) => {
  // Format count text
  const getCountText = () => {
    if (results.length === 0) return 'No profiles found';
    if (results.length === 1) return '1 profile found';
    return `${results.length} profiles found`;
  };

  // Empty state
  if (results.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col bg-white border-r border-gray-200',
          className
        )}
        data-testid="left-panel-container"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-900">Search Results</h2>
          <p className="text-xs text-gray-500">{getCountText()}</p>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No profiles found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search terms
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Results list
  return (
    <div
      className={cn(
        'flex flex-col bg-white border-r border-gray-200',
        className
      )}
      data-testid="left-panel-container"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">Search Results</h2>
        <p className="text-xs text-gray-500">{getCountText()}</p>
      </div>

      {/* Scrollable results list */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-400 hover:[&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="p-2 space-y-1.5">
          {results.map((profile) => (
            <ProfileListItem
              key={profile.id}
              profile={profile}
              isSelected={selectedId === profile.id}
              onClick={() => onProfileSelect(profile.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};