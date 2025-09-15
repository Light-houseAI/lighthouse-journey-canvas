import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

import logoImage from '@/assets/images/logo.png';
import { ProfileSearch } from '@/components/search';
import { ShareButton, ShareModal } from '@/components/share';
import { UserMenu } from '@/components/ui/user-menu';
import { Button } from '@/components/ui/button';
import { MultiStepAddNodeModal } from '@/components/modals/MultiStepAddNodeModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/auth-store';

export const JourneyHeader: React.FC<{ viewingUsername?: string }> = ({
  viewingUsername,
}) => {
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const isViewingOtherUser = !!viewingUsername;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div
      className={`${theme.backgroundGradient} relative z-10 border-b border-gray-200 px-6 py-4 shadow-[0px_1px_4px_0px_rgba(12,12,13,0.1),0px_1px_4px_0px_rgba(12,12,13,0.05)]`}
    >
      <div className="flex items-center justify-between gap-6">
        {/* Logo + Product Name */}
        <div className="flex flex-shrink-0 items-center gap-2">
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
        </div>

        {/* Search - Only show when not viewing other users */}
        {!isViewingOtherUser && (
          <div className="max-w-md flex-1">
            <ProfileSearch
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

          {/* Add Node Button - Only show for own timeline */}
          {!isViewingOtherUser && (
            <Button
              onClick={() => setIsAddModalOpen(true)}
              variant="outline"
              size="sm"
              className={`${theme.primaryBorder} border ${theme.secondaryText} hover:${theme.cardBackground} flex items-center gap-2`}
            >
              <Plus className="h-4 w-4" />
              Add Experience
            </Button>
          )}

          {/* Share Button - Only show for own timeline */}
          {!isViewingOtherUser && (
            <ShareButton
              variant="outline"
              size="sm"
              showLabel={true}
              className={`${theme.primaryBorder} border ${theme.secondaryText} hover:${theme.cardBackground}`}
            />
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
            availableTypes: ['job', 'project', 'education', 'event', 'careerTransition', 'action']
          }}
        />
      )}
    </div>
  );
};
