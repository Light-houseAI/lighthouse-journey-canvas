import { InitialsAvatar } from '@journey/components';

export interface User {
  firstName?: string;
  lastName?: string;
  userName?: string;
  email?: string;
}

export interface UserAvatarProps {
  user: User;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  className?: string;
}

/**
 * Format name with proper capitalization
 */
function formatName(
  firstName?: string,
  lastName?: string,
  userName?: string,
  email?: string
): string {
  const capitalize = (str: string) => {
    if (!str || str.trim() === '') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  if (firstName && lastName) {
    const first = capitalize(firstName);
    const last = capitalize(lastName);
    if (first && last) return `${first} ${last}`;
  }
  if (userName) {
    const capitalized = capitalize(userName);
    if (capitalized) return capitalized;
  }
  return email || 'Unknown User';
}

/**
 * Get display name from user object
 */
function getDisplayName(user: User): string {
  return formatName(user.firstName, user.lastName, user.userName, user.email);
}

export function UserAvatar({
  user,
  src,
  size = 'sm',
  showName = true,
  className = '',
}: UserAvatarProps) {
  const displayName = getDisplayName(user);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <InitialsAvatar name={displayName} src={src} size={size} />
      {showName && (
        <span className="text-sm font-medium text-black">{displayName}</span>
      )}
    </div>
  );
}
