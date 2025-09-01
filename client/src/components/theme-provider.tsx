import React, { useEffect, ReactNode } from 'react';

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      
      // Always apply light theme
      root.classList.remove('light-theme', 'gradient-theme', 'dark');
      root.classList.add('light-theme');
    }
  }, []);

  return <>{children}</>;
}

export const useTheme = () => {
  // Always return light theme
  return {
    theme: 'light' as const,
    setTheme: () => {
      // No-op since we only support light theme
    },
    toggleTheme: () => {
      // No-op since we only support light theme
    },
  };
};