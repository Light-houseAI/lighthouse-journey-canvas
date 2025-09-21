import React from 'react';

import { useTheme } from '@/contexts/ThemeContext';

export const LoadingState: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className="h-full flex items-center justify-center pt-24">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2E2E2E] mx-auto"></div>
        <p className={theme.secondaryText}>Loading your professional journey...</p>
      </div>
    </div>
  );
};
