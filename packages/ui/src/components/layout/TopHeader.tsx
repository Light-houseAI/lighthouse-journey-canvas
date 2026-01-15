import { Button } from '@journey/components';
import { Bell } from 'lucide-react';
import React from 'react';

import { useCurrentUser } from '../../hooks/useAuth';
import { UserAvatar } from '../user/UserAvatar';
import { UserMenu } from '../ui/user-menu';

interface TopHeaderProps {
  viewingUsername?: string;
}

export function TopHeader({ viewingUsername }: TopHeaderProps) {
  const { data: user } = useCurrentUser();
  const isViewingOtherUser = !!viewingUsername;

  return (
    <div
      className="flex h-[60px] items-center justify-end border-b bg-white px-4"
      style={{
        borderColor: '#EAECF0',
      }}
    >
      {/* Viewing Badge */}
      {isViewingOtherUser && (
        <span className="mr-4 rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs text-gray-800">
          Viewing: {viewingUsername}
        </span>
      )}

      {/* Right side icons */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <Button
          variant="ghost"
          className="relative flex h-10 w-10 items-center justify-center rounded-full p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {/* Notification dot - uncomment when needed */}
          {/* <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" /> */}
        </Button>

        {/* User menu with avatar */}
        {user && <UserMenu />}
      </div>
    </div>
  );
}
