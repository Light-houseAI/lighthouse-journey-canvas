import { LoadingScreen, TooltipProvider } from '@journey/components';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Redirect, Route, Switch } from 'wouter';

import { AnalyticsProvider } from './components/AnalyticsProvider';
import { AuthenticatedApp } from './components/AuthenticatedApp';
import { GlobalErrorBoundary } from './components/errors/GlobalErrorBoundary';
import { KramaLandingPage } from './components/krama-landing';
import { Toaster } from './components/ui/toaster';
import { ThemeProvider } from './contexts/ThemeContext';
import { useDesktopSessionSync } from './hooks/useAuth';
import { queryClient } from './lib/queryClient';
import BlogPage from './pages/blog';
import PrivacyPolicy from './pages/privacy-policy';
import SignIn from './pages/signin';
import SignUp from './pages/signup';
import { refreshTokenIfNeeded } from './services/auth-api';
import { tokenManager } from './services/token-manager';
import { useAuthStore } from './stores/auth-store';

/**
 * RequireAuth - Redirects to /sign-in if not authenticated
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect to="/sign-in" />;
  }

  return <>{children}</>;
}

/**
 * RedirectIfAuthenticated - Redirects to /app/home if already logged in
 */
function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect to="/app/home" />;
  }

  return <>{children}</>;
}

/**
 * RootRedirect - Shows landing page or redirects based on auth state
 */
function RootRedirect() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect to="/app/home" />;
  }

  return <KramaLandingPage />;
}

/**
 * JoinPage - Extracts invite code from URL and renders SignUp
 */
function JoinPage() {
  const code = new URLSearchParams(window.location.search).get('code') || '';
  return <SignUp inviteCode={code} />;
}

/**
 * AppRoutes - Main routing component with auth logic
 */
function AppRoutes() {
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
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      if (!tokenManager.isAuthenticated()) {
        console.warn('Tokens missing from storage, logging out');
        setUser(null);
        return;
      }

      if (tokenManager.isRefreshTokenExpired()) {
        console.warn('Refresh token expired, logging out');
        setUser(null);
        return;
      }

      const exp = tokenManager.getAccessTokenExpiry();
      if (!exp) {
        console.warn('Cannot decode token expiry, logging out');
        setUser(null);
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const bufferSeconds = 30;
      const secondsUntilRefresh = exp - now - bufferSeconds;

      if (secondsUntilRefresh <= 0) {
        const refreshed = await refreshTokenIfNeeded();
        if (!refreshed) {
          console.error('Token refresh failed, logging out');
          setUser(null);
          return;
        }
        scheduleTokenRefresh();
        return;
      }

      const msUntilRefresh = secondsUntilRefresh * 1000;
      refreshTimer = setTimeout(async () => {
        const refreshed = await refreshTokenIfNeeded();
        if (refreshed) {
          scheduleTokenRefresh();
        } else {
          console.error('Scheduled token refresh failed, logging out');
          setUser(null);
        }
      }, msUntilRefresh);
    };

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

    scheduleTokenRefresh();
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

  return (
    <Switch>
      {/* Fully public routes */}
      <Route path="/privacy-policy" component={PrivacyPolicy} />

      {/* Public auth routes — redirect to /app/home if already authenticated */}
      <Route path="/sign-in">
        <RedirectIfAuthenticated>
          <SignIn />
        </RedirectIfAuthenticated>
      </Route>
      <Route path="/signin">
        <Redirect to="/sign-in" />
      </Route>

      <Route path="/sign-up">
        <RedirectIfAuthenticated>
          <SignUp />
        </RedirectIfAuthenticated>
      </Route>
      <Route path="/signup">
        <Redirect to="/sign-up" />
      </Route>

      <Route path="/join">
        <RedirectIfAuthenticated>
          <JoinPage />
        </RedirectIfAuthenticated>
      </Route>

      <Route path="/blog">
        <BlogPage />
      </Route>

      {/* Authenticated routes under /app */}
      <Route path="/app" nest>
        <RequireAuth>
          <AuthenticatedApp />
        </RequireAuth>
      </Route>

      {/* Catch-all: landing page or redirect to /app/home */}
      <Route>
        <RootRedirect />
      </Route>
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
              <AppRoutes />
            </TooltipProvider>
          </AnalyticsProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
