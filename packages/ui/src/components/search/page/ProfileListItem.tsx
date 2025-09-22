/**
 * ProfileListItem Component
 *
 * Simple profile card for left panel following existing card patterns
 * Simplified version of SearchResult component for list display
 */

import React from 'react';

import { cn } from '@/lib/utils';

import type { ProfileResult } from '../types/search.types';

export interface ProfileListItemProps {
  profile: ProfileResult;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

export const ProfileListItem: React.FC<ProfileListItemProps> = ({
  profile,
  isSelected,
  onClick,
  className,
}) => {
  // Generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  // Format role and company
  const formatRoleCompany = () => {
    if (profile.currentRole && profile.company) {
      return `${profile.currentRole} at ${profile.company}`;
    }
    if (profile.currentRole) {
      return profile.currentRole;
    }
    if (profile.company) {
      return profile.company;
    }
    return 'Professional';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full p-4 text-left border rounded-lg transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        isSelected
          ? 'bg-green-50 border-green-200 shadow-sm'
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300',
        className
      )}
      aria-label={`View details for ${profile.name}`}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar with initials */}
        <div
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded-full text-sm font-medium flex-shrink-0',
            isSelected
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          )}
          aria-hidden="true"
        >
          {getInitials(profile.name)}
        </div>

        {/* Profile info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {profile.name}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            {formatRoleCompany()}
          </p>

          {/* Location */}
          {profile.location && (
            <div className="flex items-center text-xs text-gray-500 mb-2">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {profile.location}
            </div>
          )}


        </div>
      </div>
    </button>
  );
};
