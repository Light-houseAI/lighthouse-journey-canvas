import { LoadingScreen, TooltipProvider } from '@journey/components';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Route, Switch } from 'wouter';

import { AnalyticsProvider } from './components/AnalyticsProvider';
import { AuthenticatedApp } from './components/AuthenticatedApp';
import { GlobalErrorBoundary } from './components/errors/GlobalErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { UnauthenticatedApp } from './components/UnauthenticatedApp';
import { ThemeProvider } from './contexts/ThemeContext';
import { useDesktopSessionSync } from './hooks/useAuth';
import { queryClient } from './lib/queryClient';
import PrivacyPolicy from './pages/privacy-policy';
import { refreshTokenIfNeeded } from './services/auth-api';
import { tokenManager } from './services/token-manager';
import { useAuthStore } from './stores/auth-store';

function Router() {
  const { isAuthenticated } = useAuthStore();
  const { setUser } = useAuthStore();
  const { syncDesktopSession } = useDesktopSessionSync();
  const [isCheckingDesktopSync, setIsCheckingDesktopSync] = useState(true);

  // Handle desktop app session sync on initial load
  useEffect(() => {
    const checkDesktopSync = async () => {
      // Check if we have desktop tokens in URL
      const urlParams = new URLSearchParams(window.location.search);
      const hasDesktopTokens =
        urlParams.has('desktop_access_token') &&
        urlParams.has('desktop_refresh_token');

      if (hasDesktopTokens) {
        await syncDesktopSession();
      }
      setIsCheckingDesktopSync(false);
    };

    checkDesktopSync();
  }, [syncDesktopSession]);

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
        const refreshed = await refreshTokenIfNeeded();
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
        const refreshed = await refreshTokenIfNeeded();
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
        refreshTokenIfNeeded().then((refreshed) => {
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

  // Show loading screen while checking for desktop session sync
  if (isCheckingDesktopSync) {
    return <LoadingScreen />;
  }

  // Simple conditional render based on persisted auth state
  return isAuthenticated ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

/**
 * PublicRoutes - Routes accessible without authentication
 * These are rendered before auth check to ensure they work for everyone
 */
function PublicRoutes({ children }: { children: React.ReactNode }) {
  return (
    <Switch>
      {/* Public privacy policy page */}
      <Route path="/privacy-policy" component={PrivacyPolicy} />

      {/* All other routes go through normal auth flow */}
      <Route>{children}</Route>
    </Switch>
  );
}

function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AnalyticsProvider>
            <TooltipProvider>
              <Toaster />
              <PublicRoutes>
                <Router />
              </PublicRoutes>
            </TooltipProvider>
          </AnalyticsProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
