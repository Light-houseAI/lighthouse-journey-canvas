import React from 'react';
import { User, Settings, LogOut, Copy, Check } from 'lucide-react';
import { useLocation } from 'wouter';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

  const getInitials = (email: string, userName?: string) => {
    if (userName) {
      return userName.slice(0, 2).toUpperCase();
    }
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    return user.userName || user.email;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`flex items-center gap-2 h-auto p-2 hover:bg-purple-500/20 ${className}`}
        >
          <Avatar className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500">
            <AvatarFallback className="bg-transparent text-white text-sm font-semibold">
              {getInitials(user.email, user.userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left">
            <span className="text-purple-200 text-sm font-medium">
              {getDisplayName()}
            </span>
            {user.userName && (
              <span className="text-purple-300 text-xs">
                {user.email}
              </span>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        align="end"
        className="w-64 bg-slate-800/95 backdrop-blur-sm border-purple-500/30 text-white"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-white">
              {getDisplayName()}
            </p>
            <p className="text-xs leading-none text-purple-300">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-purple-500/30" />
        
        <DropdownMenuItem
          onClick={goToSettings}
          className="cursor-pointer focus:bg-purple-500/20 focus:text-white"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        
        {user.userName && (
          <DropdownMenuItem
            onClick={copyProfileLink}
            className="cursor-pointer focus:bg-purple-500/20 focus:text-white"
          >
            {copiedLink ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            <span>Copy Profile Link</span>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator className="bg-purple-500/30" />
        
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoading}
          className="cursor-pointer focus:bg-purple-500/20 focus:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoading ? 'Signing out...' : 'Logout'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}