import React, { useEffect } from 'react';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/auth-store';
import { UnauthenticatedApp } from '@/components/UnauthenticatedApp';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';
import { tokenManager } from '@/services/token-manager';

function Router() {
  const { isAuthenticated, setUser } = useAuthStore();

  // Check token validity on mount and periodically
  useEffect(() => {
    const checkAuthStatus = () => {
      if (isAuthenticated && !tokenManager.isAuthenticated()) {
        // Tokens are missing/expired but store thinks user is authenticated
        // Clear the auth state to redirect to sign-in
        setUser(null);
      }
    };

    // Check immediately
    checkAuthStatus();

    // Check every 30 seconds
    const interval = setInterval(checkAuthStatus, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, setUser]);

  // Simple conditional render based on persisted auth state
  return isAuthenticated ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
