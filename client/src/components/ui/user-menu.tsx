import { Check,Copy, LogOut, Settings, User } from 'lucide-react';
import React from 'react';
import { useLocation } from 'wouter';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth-store';

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
        title: "Username required",
        description: "You need to set a username in settings before sharing your profile.",
        variant: "destructive",
      });
      return;
    }

    const shareUrl = `${window.location.origin}/${user.userName}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      
      toast({
        title: "Link copied",
        description: "Your profile sharing link has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const getInitials = () => {
    // First priority: firstName + lastName
    if (user.firstName && user.lastName) {
      return (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
    }
    
    // Second priority: firstName only
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    
    // Third priority: userName
    if (user.userName) {
      return user.userName.slice(0, 2).toUpperCase();
    }
    
    // Final fallback: email
    return user.email.split('@')[0].slice(0, 2).toUpperCase();
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
          className={`flex items-center gap-2 h-auto p-2 ${theme.hover} ${className}`}
        >
          <Avatar className={`h-8 w-8 ${theme.primaryBorder} border ${theme.cardBackground} ${theme.primaryText} text-sm font-semibold flex items-center justify-center`}>
            {getInitials()}
          </Avatar>
          <div className="flex flex-col items-start text-left">
            <span className={`${theme.primaryText} text-sm font-medium`}>
              {getDisplayName()}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        align="end"
        className={`w-64 ${theme.cardBackground} backdrop-blur-sm ${theme.primaryBorder} border ${theme.cardShadow}`}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className={`text-sm font-medium leading-none ${theme.primaryText}`}>
              {getDisplayName()}
            </p>
          </div>
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

