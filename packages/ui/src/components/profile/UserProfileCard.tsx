import { MoreVertical,Share2 } from 'lucide-react';
import React from 'react';

export interface User {
  name: string;
  avatar: string;
  description: string;
  title?: string;
}

export interface UserProfileCardProps {
  user: User;
  showShareButton?: boolean;
  showMoreOptions?: boolean;
  onShare?: () => void;
  onMoreOptions?: () => void;
}

export function UserProfileCard({
  user,
  showShareButton = true,
  showMoreOptions = true,
  onShare,
  onMoreOptions,
}: UserProfileCardProps) {
  const handleShareClick = () => {
    try {
      if (onShare) {
        onShare();
      }
    } catch (error) {
      console.error('Share callback failed:', error);
    }
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
    <div
      className="flex items-center gap-[24px] bg-white"
      data-testid="user-profile-card"
      role="article"
      aria-label="User profile information"
    >
      {/* Large Avatar */}
      <div
        className="size-[120px] rounded-[20px] bg-cover bg-center flex-shrink-0"
        style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
        data-testid="profile-avatar"
        role="img"
        aria-label={`${user.name} profile picture`}
      />

      {/* Name and Description */}
      <div className="flex-1 w-[800px]" data-testid="name-and-description">
        <h1 className="font-bold text-[36px] text-[#2e2e2e] leading-[44px] mb-[8px]">
          {user.name}
        </h1>

        {user.title && (
          <p className="font-medium text-[18px] text-[#4a4f4e] leading-[26px] mb-[12px]">
            {user.title}
          </p>
        )}

        <p className="font-normal text-[16px] leading-[24px] text-[#4a4f4e]">
          {user.description}
        </p>
      </div>

      {/* Action Buttons - Share button moved here per requirements */}
      <div className="flex items-center gap-[12px]" data-testid="profile-actions">
        {showShareButton && (
          <button
            onClick={handleShareClick}
            onKeyDown={(e) => handleKeyDown(e, handleShareClick)}
            className="flex items-center gap-[8px] px-[16px] py-[10px] bg-white shadow-[0px_2px_5px_0px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_0px_rgba(0,0,0,0.12)] rounded-[8px] hover:shadow-[0px_4px_8px_0px_rgba(103,110,118,0.12)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[#4a4f4e]/20"
            tabIndex={0}
            role="button"
            aria-label="Share profile"
          >
            <Share2
              className="size-[16px]"
              data-testid="share-icon"
            />
            <span className="font-medium text-[14px] text-[#2e2e2e]">
              Share profile
            </span>
          </button>
        )}

        {showMoreOptions && (
          <button
            onClick={handleMoreOptionsClick}
            onKeyDown={(e) => handleKeyDown(e, handleMoreOptionsClick)}
            className="flex items-center justify-center size-[40px] bg-white shadow-[0px_2px_5px_0px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_0px_rgba(0,0,0,0.12)] rounded-[8px] hover:shadow-[0px_4px_8px_0px_rgba(103,110,118,0.12)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[#4a4f4e]/20"
            data-testid="more-options-button"
            tabIndex={0}
            role="button"
            aria-label="More options"
          >
            <MoreVertical
              className="size-[16px]"
              data-testid="ellipsis-icon"
            />
          </button>
        )}
      </div>
    </div>
  );
}