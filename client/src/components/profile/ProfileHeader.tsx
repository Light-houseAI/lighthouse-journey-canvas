import { Check, Copy, ExternalLink,Share2 } from 'lucide-react';
import React, { useState } from 'react';

import { toast } from '../../hooks/use-toast';
import type { ProfileHeaderProps } from '../../types/profile';
import { Button } from '../ui/button';

// ============================================================================
// PROFILE HEADER COMPONENT
// ============================================================================
// Displays profile name, share buttons, and copy URL functionality

export function ProfileHeader({ name, profileUrl, onShare, onCopy }: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      onCopy();
      
      toast({
        title: 'URL Copied',
        description: 'Profile URL has been copied to clipboard',
        duration: 2000,
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast({
        title: 'Copy Failed',
        description: 'Unable to copy URL to clipboard',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const handleShare = async () => {
    // Try Web Share API first (mobile/modern browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name}'s Profile`,
          text: `Check out ${name}'s professional journey`,
          url: profileUrl,
        });
        onShare();
        return;
      } catch (error) {
        // User cancelled or share failed, fall back to copy
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('Web Share API failed:', error);
        }
      }
    }

    // Fallback to copy URL
    await handleCopyUrl();
  };

  const handleExternalLink = () => {
    window.open(profileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-center justify-between p-6 bg-white border-b border-gray-200">
      {/* Profile Info */}
      <div className="flex items-center space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Professional Journey
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* External Link Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExternalLink}
          className="text-gray-600 hover:text-gray-900"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>

        {/* Copy URL Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyUrl}
          className="text-gray-600 hover:text-gray-900"
          title="Copy profile URL"
          disabled={copied}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="ml-2 text-sm">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </Button>

        {/* Share Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
          title="Share profile"
        >
          <Share2 className="h-4 w-4" />
          <span className="ml-2 text-sm">Share</span>
        </Button>
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