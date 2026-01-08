/**
 * Analytics Provider Component
 *
 * Wraps the application to provide analytics tracking functionality.
 * Handles:
 * - PostHog initialization on mount
 * - Automatic user identification on auth state changes
 * - Automatic page view tracking on route changes
 */
import React, { useEffect, useState } from 'react';

import { usePageTracking, useIdentityTracking } from '../hooks/useAnalytics';
import { initPostHog, isPostHogEnabled, isPostHogReady } from '../lib/posthog';

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

/**
 * Internal component that handles analytics tracking
 * Only rendered after PostHog is initialized
 */
function AnalyticsTracking() {
  // Track page views on route changes
  usePageTracking();

  // Track user identity changes (login/logout)
  useIdentityTracking();

  return null;
}

/**
 * Analytics Provider
 *
 * Wrap your app with this component to enable analytics tracking.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AnalyticsProvider>
 *       <Router />
 *     </AnalyticsProvider>
 *   );
 * }
 * ```
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [isReady, setIsReady] = useState(false);

  // Initialize PostHog once on mount
  useEffect(() => {
    if (isPostHogEnabled && !isPostHogReady()) {
      initPostHog();
    }
    // Set ready state after initialization attempt
    setIsReady(isPostHogReady());
  }, []);

  return (
    <>
      {/* Only render tracking component after PostHog is initialized */}
      {isReady && <AnalyticsTracking />}
      {children}
    </>
  );
}

export default AnalyticsProvider;
