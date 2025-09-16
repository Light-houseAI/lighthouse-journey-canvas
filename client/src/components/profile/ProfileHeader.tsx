import { TimelineNode } from '@shared/schema';
import React from 'react';

import { ShareButton } from '../share/ShareButton';

// ============================================================================
// USER PROFILE CARD COMPONENT (Updated for Figma Design)
// ============================================================================
// Large avatar (120px), H1 typography, share button moved here per LIG-169

export interface User {
  name: string;
  avatar: string;
  description: string;
  title?: string;
}

export interface UserProfileCardProps {
  user: User;
  profileUrl?: string;
  showShareButton?: boolean;
  showMoreOptions?: boolean;
  isCurrentUser?: boolean;
  onShare?: () => void;
  onMoreOptions?: () => void;
  onAddExperience?: () => void;
  allNodes?: TimelineNode[]; // For share functionality
}

export function ProfileHeader(props: UserProfileCardProps) {
  return <UserProfileCard {...props} />;
}

export function UserProfileCard({
  user,
  profileUrl,
  showShareButton = true,
  showMoreOptions = true,
  isCurrentUser = false,
  onShare,
  onMoreOptions,
  onAddExperience,
  allNodes,
}: UserProfileCardProps) {
  // Helper function to get user initials (matching UserMenu logic)
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const handleMoreOptionsClick = () => {
    try {
      if (onMoreOptions) {
        onMoreOptions();
      }
    } catch (error) {
      console.error('More options callback failed:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, callback?: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (callback) {
        callback();
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 lg:gap-8 p-4 sm:p-6 bg-white rounded-lg"
        data-testid="user-profile-card"
        role="article"
        aria-label="User profile information"
      >
        {/* Large Avatar - Responsive sizing with clamp() */}
        <div
          className="w-20 h-20 sm:w-24 sm:h-24 lg:w-[120px] lg:h-[120px] rounded-[20px] bg-cover bg-center flex-shrink-0 flex items-center justify-center"
          style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
          data-testid="profile-avatar"
          role="img"
          aria-label={`${user.name} profile picture`}
        >
          {!user.avatar && (
            <div className="size-full rounded-[20px] bg-gray-200 flex items-center justify-center text-lg sm:text-xl lg:text-[24px] font-medium text-gray-600">
              {getUserInitials(user.name)}
            </div>
          )}
        </div>

        {/* Name and Description - Responsive typography */}
        <div className="flex-1 min-w-0" data-testid="name-and-description">
          <h1 className="font-bold text-[clamp(1.5rem,4vw,2.25rem)] text-[#2e2e2e] leading-[1.2] mb-2 sm:mb-3">
            {user.name}
          </h1>

          {user.title && (
            <p className="font-medium text-[clamp(1rem,2.5vw,1.125rem)] text-[#4a4f4e] leading-[1.4] mb-3 sm:mb-4">
              {user.title}
            </p>
          )}

          {user.description && (
            <p className="font-normal text-[clamp(0.875rem,2vw,1rem)] leading-[1.5] text-[#4a4f4e] line-clamp-3 sm:line-clamp-none">
              {user.description}
            </p>
          )}
        </div>

        {/* Action Buttons - Responsive layout */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 lg:gap-4 w-full sm:w-auto" data-testid="profile-actions">
          {showShareButton && (
            <ShareButton
              allNodes={allNodes}
              showLabel={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROFILE HEADER SKELETON
// ============================================================================
// Loading state for profile header

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between p-6 bg-white border-b border-gray-200">
      {/* Profile Info Skeleton */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className="flex items-center space-x-2">
        <div className="h-9 w-9 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  );
}

// ============================================================================
// PROFILE HEADER ERROR
// ============================================================================
// Error state for profile header

interface ProfileHeaderErrorProps {
  error: string;
  onRetry?: () => void;
}

export function ProfileHeaderError({ error, onRetry }: ProfileHeaderErrorProps) {
  return (
    <div className="flex items-center justify-between p-6 bg-white border-b border-red-100">
      <div className="flex items-center space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-red-700">
            Profile Unavailable
          </h1>
          <p className="text-sm text-red-600 mt-1">
            {error}
          </p>
        </div>
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          Try Again
        </Button>
      )}
    </div>
  );
}
