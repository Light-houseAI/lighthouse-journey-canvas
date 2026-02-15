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
import { useAnalytics, AnalyticsEvents } from '../../hooks/useAnalytics';
import { useCurrentUser, useLogout } from '../../hooks/useAuth';
import { UserAvatar } from '../user/UserAvatar';

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps) {
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { track } = useAnalytics();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const { theme } = useTheme();

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    track(AnalyticsEvents.BUTTON_CLICKED, { button_name: 'logout', button_location: 'user_menu' });
    try {
      await logoutMutation.mutateAsync();
      track(AnalyticsEvents.USER_SIGNED_OUT);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const goToSettings = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, { button_name: 'settings', button_location: 'user_menu' });
    setLocation('/settings');
  };

  const copyProfileLink = async () => {
    track(AnalyticsEvents.BUTTON_CLICKED, { button_name: 'copy_profile_link', button_location: 'user_menu' });
    if (!user.userName) {
      toast({
        title: 'Username required',
        description:
          'You need to set a username in settings before sharing your profile.',
        variant: 'destructive',
      });
      return;
    }

    const shareUrl = `${window.location.origin}/app/profile/${user.userName}`;

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
          <UserAvatar
            user={{
              firstName: user.firstName ?? undefined,
              lastName: user.lastName ?? undefined,
              userName: user.userName ?? undefined,
              email: user.email,
            }}
            size="sm"
            showName={true}
          />
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
          disabled={logoutMutation.isPending}
          className={`cursor-pointer ${theme.hover} ${theme.primaryText} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{logoutMutation.isPending ? 'Signing out...' : 'Logout'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
