/**
 * UserProfileCard Component
 *
 * Reusable component for displaying user profile information with avatar.
 * Uses InitialsAvatar from @journey/components for consistent styling.
 * Used in search results, modals, and profile detail views.
 *
 * Layout behavior:
 * - Without title: Name centered vertically in avatar area
 * - With title: Name takes 60% top, title takes 40% bottom
 */

import { Button, InitialsAvatar } from '@journey/components';

/**
 * Convert string to Title Case
 * Example: "staff software engineer" -> "Staff Software Engineer"
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface UserProfileCardProps {
  name: string;
  currentRole?: string;
  company?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  avatarSize?: 'sm' | 'md' | 'lg' | 'xl';
  showTitle?: boolean;
  showViewProfile?: boolean;
  onViewProfile?: () => void;
  className?: string;
}

export function UserProfileCard({
  name,
  currentRole,
  company,
  size = 'md',
  avatarSize,
  showTitle = true,
  showViewProfile = false,
  onViewProfile,
  className = '',
}: UserProfileCardProps) {
  // Format title as "Role at Company" with proper capitalization
  // Check if currentRole already includes company (from API)
  const title = currentRole
    ? currentRole.includes(' at ')
      ? currentRole // Already formatted with company from API
          .split(' at ')
          .map((part, index) =>
            index === 0 ? toTitleCase(part.trim()) : toTitleCase(part.trim())
          )
          .join(' at ')
      : currentRole && company
        ? `${toTitleCase(currentRole)} at ${toTitleCase(company)}`
        : toTitleCase(currentRole)
    : company
      ? toTitleCase(company)
      : 'Professional';

  // Text size configurations for name and title
  const textSizeConfig = {
    sm: {
      nameSize: 'text-[13px]',
      titleSize: 'text-[11px]',
    },
    md: {
      nameSize: 'text-xl',
      titleSize: 'text-base',
    },
    lg: {
      nameSize: 'text-xl',
      titleSize: 'text-base',
    },
    xl: {
      nameSize: 'text-2xl',
      titleSize: 'text-lg',
    },
    '2xl': {
      nameSize: 'text-[28px]',
      titleSize: 'text-base',
    },
  };

  const textConfig = textSizeConfig[size];

  // Map our sizes to InitialsAvatar sizes
  const finalAvatarSize = avatarSize || (size === '2xl' ? 'xl' : size);

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="flex items-start gap-4">
        {/* Avatar using InitialsAvatar */}
        <InitialsAvatar
          name={name}
          size={finalAvatarSize}
          className={size === '2xl' ? 'h-[120px] w-[120px] text-4xl' : ''}
        />

        {/* Name and Title - Name left aligned, vertically centered */}
        {showTitle && (
          <div
            className="flex flex-col items-start justify-center"
            style={{
              height:
                size === '2xl'
                  ? '120px'
                  : size === 'xl'
                    ? '64px'
                    : size === 'lg'
                      ? '48px'
                      : size === 'md'
                        ? '40px'
                        : '32px',
            }}
          >
            <h3
              className={`${textConfig.nameSize} font-semibold leading-normal tracking-[-0.05px] text-[#2e2e2e]`}
            >
              {name}
            </h3>
            {title && (
              <p
                className={`${textConfig.titleSize} mt-1 leading-6 tracking-[-0.05px] text-[#2e2e2e]`}
              >
                {title}
              </p>
            )}
          </div>
        )}
      </div>

      {/* View Profile Button - vertically centered */}
      {showViewProfile && onViewProfile && (
        <Button
          variant="outline"
          onClick={onViewProfile}
          className="box-border flex-shrink-0 cursor-pointer rounded-lg bg-white px-[18px] py-[10px] shadow-[0px_2px_5px_0px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_0px_rgba(0,0,0,0.12)] transition-colors hover:shadow-[0px_4px_8px_0px_rgba(103,110,118,0.12),0px_0px_0px_1px_rgba(103,110,118,0.20),0px_2px_2px_0px_rgba(0,0,0,0.16)]"
        >
          <span className="text-nowrap text-[14px] font-semibold leading-5 text-black">
            View profile
          </span>
        </Button>
      )}
    </div>
  );
}
