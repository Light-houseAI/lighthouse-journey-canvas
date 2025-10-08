import { TooltipProvider } from '@journey/components';
import { QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';

import { AuthenticatedApp } from './components/AuthenticatedApp';
import { Toaster } from './components/ui/toaster';
import { UnauthenticatedApp } from './components/UnauthenticatedApp';
import { ThemeProvider } from './contexts/ThemeContext';
import { queryClient } from './lib/queryClient';
import { httpClient } from './services/http-client';
import { tokenManager } from './services/token-manager';
import { useAuthStore } from './stores/auth-store';

function Router() {
  const { isAuthenticated, setUser } = useAuthStore();

  // Proactive token refresh - scheduled based on token expiry
  useEffect(() => {
    if (!isAuthenticated) return;

    let refreshTimer: NodeJS.Timeout | null = null;

    const scheduleTokenRefresh = async () => {
      // Clear any existing timer
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      // Check tokens exist
      if (!tokenManager.isAuthenticated()) {
        console.warn('Tokens missing from storage, logging out');
        setUser(null);
        return;
      }

      // Check refresh token hasn't expired
      if (tokenManager.isRefreshTokenExpired()) {
        console.warn('Refresh token expired, logging out');
        setUser(null);
        return;
      }

      // Get access token expiry
      const exp = tokenManager.getAccessTokenExpiry();
      if (!exp) {
        console.warn('Cannot decode token expiry, logging out');
        setUser(null);
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const bufferSeconds = 30; // Refresh 30 seconds before expiry
      const secondsUntilRefresh = exp - now - bufferSeconds;

      // If token already expired or expiring soon, refresh immediately
      if (secondsUntilRefresh <= 0) {
        const refreshed = await httpClient.refreshTokenIfNeeded();
        if (!refreshed) {
          console.error('Token refresh failed, logging out');
          setUser(null);
          return;
        }
        // Schedule next refresh after successful refresh
        scheduleTokenRefresh();
        return;
      }

      // Schedule refresh before expiry
      const msUntilRefresh = secondsUntilRefresh * 1000;
      refreshTimer = setTimeout(async () => {
        const refreshed = await httpClient.refreshTokenIfNeeded();
        if (refreshed) {
          scheduleTokenRefresh(); // Reschedule based on new token
        } else {
          console.error('Scheduled token refresh failed, logging out');
          setUser(null);
        }
      }, msUntilRefresh);
    };

    // Handle tab visibility changes (wake from sleep)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        httpClient.refreshTokenIfNeeded().then((refreshed) => {
          if (refreshed) {
            scheduleTokenRefresh();
          } else {
            setUser(null);
          }
        });
      }
    };

    // Initial check and schedule
    scheduleTokenRefresh();

    // Listen for tab becoming visible
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
