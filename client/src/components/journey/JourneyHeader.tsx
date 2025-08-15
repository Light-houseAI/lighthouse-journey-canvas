import React from 'react';
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';
import { LogOut, User } from "lucide-react";
import { useAuthStore } from '@/stores/auth-store';

export const JourneyHeader: React.FC = () => {
  const { user, logout, isLoading } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
      // Auth store handles redirect automatically after logout
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-0 left-0 right-0 z-10 p-6"
    >
      <div className="glass rounded-2xl px-6 py-4 bg-slate-900/80 backdrop-blur-sm border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Your Professional Journey
            </h1>
            <p className="text-purple-200">
              Interactive career path visualization powered by AI
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* User Info */}
            {user && (
              <div className="flex items-center gap-2 text-purple-200">
                <User className="w-4 h-4" />
                <span className="text-sm">{user.email}</span>
              </div>
            )}
            
            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-purple-500/30 text-purple-200 hover:bg-purple-500/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isLoading ? 'Signing out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};