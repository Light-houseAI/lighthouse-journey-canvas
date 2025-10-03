import { Avatar, AvatarFallback, AvatarImage } from '../base/avatar';
import { cn } from '../lib/utils';

export interface InitialsAvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  colorSeed?: string;
  className?: string;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);

  if (parts.length >= 2) {
    // First + Last name
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // Single name - take first 2 chars
  return name.slice(0, 2).toUpperCase();
}

function getColorFromSeed(seed: string): string {
  // Generate consistent color based on seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];

  return colors[Math.abs(hash) % colors.length];
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export function InitialsAvatar({
  name,
  src,
  size = 'md',
  colorSeed,
  className,
}: InitialsAvatarProps) {
  const initials = getInitials(name);
  const bgColor = getColorFromSeed(colorSeed || name);

  return (
    <Avatar className={cn(sizeMap[size], className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback className={cn(bgColor, 'text-white')}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
