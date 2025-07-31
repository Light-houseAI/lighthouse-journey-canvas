import React from 'react';
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';
import { LogOut } from "lucide-react";
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';

export const JourneyHeader: React.FC = () => {
  const { logout } = useUICoordinatorStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
    window.location.href = "/signin";
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
          <div className="flex items-center gap-3">
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-purple-500/30 text-purple-200 hover:bg-purple-500/20 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};