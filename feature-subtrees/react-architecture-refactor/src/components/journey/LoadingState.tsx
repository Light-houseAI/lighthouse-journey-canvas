import React from 'react';
import { JourneyHeader } from "./JourneyHeader";

export const LoadingState: React.FC = () => {
  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <JourneyHeader />
      
      <div className="h-full flex items-center justify-center pt-24">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
          <p className="text-purple-200">Loading your professional journey...</p>
        </div>
      </div>
    </div>
  );
};