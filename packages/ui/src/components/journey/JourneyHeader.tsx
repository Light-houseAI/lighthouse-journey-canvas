import React, { useState } from 'react';
import { useLocation } from 'wouter';

import logoImage from '../../assets/images/logo.png';
import { MultiStepAddNodeModal } from '../modals/MultiStepAddNodeModal';
import { HeaderSearchInput } from '../search/HeaderSearchInput';
import { ShareModal } from '../share';
import { UserMenu } from '../ui/user-menu';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '@journey/components';

export const JourneyHeader: React.FC<{ viewingUsername?: string }> = ({
  viewingUsername,
}) => {
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const [, setLocation] = useLocation();
  const isViewingOtherUser = !!viewingUsername;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleLogoClick = () => {
    setLocation('/');
  };

  return (
    <div
      className={`${theme.backgroundGradient} relative z-10 border-b border-gray-200 px-6 py-4 shadow-[0px_1px_4px_0px_rgba(12,12,13,0.1),0px_1px_4px_0px_rgba(12,12,13,0.05)]`}
    >
      <div className="flex items-center justify-between gap-6">
        {/* Logo + Product Name */}
        <Button
          onClick={handleLogoClick}
          variant="ghost"
          className="flex flex-shrink-0 items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Go to home page"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[23px]">
            <img
              src={logoImage}
              alt="Lighthouse AI"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="text-xl font-semibold leading-[30px] tracking-[-0.05px] text-black">
            Lighthouse AI
          </div>
        </Button>

        {/* Search - Only show when not viewing other users */}
        {!isViewingOtherUser && (
          <div className="max-w-md flex-1">
            <HeaderSearchInput
              placeholder="Search profiles..."
              className="w-full"
            />
          </div>
        )}

        {/* Right Content - User Menu and Actions */}
        <div className="flex flex-shrink-0 items-center gap-4">
          {/* Viewing Badge */}
          {isViewingOtherUser && (
            <span className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs text-gray-800">
              Viewing: {viewingUsername}
            </span>
          )}


          {/* User Menu */}
          {user && <UserMenu />}
        </div>
      </div>

      {/* Share Modal - Render outside of the header but controlled by share store */}
      <ShareModal />

      {/* Add Node Modal */}
      {isAddModalOpen && (
        <MultiStepAddNodeModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            // Optionally refresh data here
          }}
          context={{
            insertionPoint: 'after',
            availableTypes: [
              'job',
              'project',
              'education',
              'event',
              'careerTransition',
              'action',
            ],
          }}
        />
      )}
    </div>
  );
};
