import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export const JourneyHeader: React.FC<{ viewingUsername?: string }> = ({
  viewingUsername,
}) => {
  const { user, logout, isLoading } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
      // Auth store handles redirect automatically after logout
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isViewingOtherUser = !!viewingUsername;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute left-0 right-0 top-0 z-10 p-6"
    >
      <div className="glass rounded-2xl border border-purple-500/20 bg-slate-900/80 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl font-bold text-transparent">
              {isViewingOtherUser
                ? `${viewingUsername}'s Professional Journey`
                : 'Your Professional Journey'}
            </h1>
            <p className="text-purple-200">
              {isViewingOtherUser
                ? `Viewing ${viewingUsername}'s career timeline with permission-filtered content`
                : 'Interactive career path visualization powered by AI'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* User Info */}
            {user && (
              <div className="flex items-center gap-2 text-purple-200">
                <User className="h-4 w-4" />
                <span className="text-sm">{user.email}</span>
                {isViewingOtherUser && (
                  <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs">
                    Viewing: {viewingUsername}
                  </span>
                )}
              </div>
            )}

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="border-purple-500/30 bg-slate-800/50 text-purple-200 hover:bg-purple-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoading ? 'Signing out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
