import React from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/contexts/ThemeContext';
import { ShareButton, ShareModal } from '@/components/share';
import { UserMenu } from '@/components/ui/user-menu';
import logoImage from '@/assets/images/logo.png';

export const JourneyHeader: React.FC<{ viewingUsername?: string }> = ({
  viewingUsername,
}) => {
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const isViewingOtherUser = !!viewingUsername;

  return (
    <div className={`${theme.backgroundGradient} border-b border-gray-200 shadow-[0px_1px_4px_0px_rgba(12,12,13,0.1),0px_1px_4px_0px_rgba(12,12,13,0.05)] px-6 py-4 relative z-10`}>
      <div className="flex items-center justify-between">
        {/* Logo + Product Name */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[23px] flex items-center justify-center overflow-hidden">
            <img src={logoImage} alt="Lighthouse AI" className="w-full h-full object-contain" />
          </div>
          <div className="text-black text-xl font-semibold tracking-[-0.05px] leading-[30px]">
            Lighthouse AI
          </div>
        </div>

        {/* Right Content - User Menu and Actions */}
        <div className="flex items-center gap-4">
          {/* Viewing Badge */}
          {isViewingOtherUser && (
            <span className="rounded-full bg-gray-100 border border-gray-300 px-3 py-1 text-xs text-gray-800">
              Viewing: {viewingUsername}
            </span>
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
    </div>
  );
};
