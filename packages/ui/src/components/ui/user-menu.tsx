import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  VStack,
} from '@journey/components';
import { Check, ChevronDown, Copy, LogOut, Settings } from 'lucide-react';
import React from 'react';
import { useLocation } from 'wouter';

import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../hooks/use-toast';
import { useAuthStore } from '../../stores/auth-store';
import { UserAvatar } from '../user/UserAvatar';

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps) {
  const { user, logout, isLoading } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const { theme } = useTheme();

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const goToSettings = () => {
    setLocation('/settings');
  };

  const copyProfileLink = async () => {
    if (!user.userName) {
      toast({
        title: 'Username required',
        description:
          'You need to set a username in settings before sharing your profile.',
        variant: 'destructive',
      });
      return;
    }

    const shareUrl = `${window.location.origin}/profile/${user.userName}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);

      toast({
        title: 'Link copied',
        description: 'Your profile sharing link has been copied to clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy link to clipboard.',
        variant: 'destructive',
      });
      console.error('Failed to copy link:', error);
    }
  };

  const getDisplayName = () => {
    // First priority: firstName + lastName
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }

    // Second priority: firstName only
    if (user.firstName) {
      return user.firstName;
    }

    // Third priority: userName
    if (user.userName) {
      return user.userName;
    }

    // Final fallback: email
    return user.email;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`flex h-auto items-center gap-2 p-2 ${theme.hover} ${className}`}
        >
          <UserAvatar user={user} size="sm" showName={true} />
          <ChevronDown className="ml-1 h-4 w-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={`w-64 ${theme.cardBackground} backdrop-blur-sm ${theme.primaryBorder} border ${theme.cardShadow}`}
      >
        <DropdownMenuLabel className="font-normal">
          <VStack spacing={1}>
            <p
              className={`text-sm font-medium leading-none ${theme.primaryText}`}
            >
              {getDisplayName()}
            </p>
          </VStack>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className={theme.primaryBorder} />

        <DropdownMenuItem
          onClick={goToSettings}
          className={`cursor-pointer ${theme.hover} ${theme.primaryText}`}
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>

        {user.userName && (
          <DropdownMenuItem
            onClick={copyProfileLink}
            className={`cursor-pointer ${theme.hover} ${theme.primaryText}`}
          >
            {copiedLink ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            <span>Copy Profile Link</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className={theme.primaryBorder} />

        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoading}
          className={`cursor-pointer ${theme.hover} ${theme.primaryText} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoading ? 'Signing out...' : 'Logout'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
