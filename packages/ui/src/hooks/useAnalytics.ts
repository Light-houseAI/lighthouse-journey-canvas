/**
 * Analytics Hook
 *
 * Provides a convenient React hook for tracking analytics events.
 * Wraps PostHog functionality with type-safe event tracking.
 */
import { useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';

import {
  trackEvent,
  trackPageView,
  identifyUser,
  resetUser,
  setUserProperties,
  isFeatureEnabled,
  getFeatureFlag,
  isPostHogReady,
} from '../lib/posthog';
import { useAuthStore } from '../stores/auth-store';

/**
 * Common analytics event names
 * Use these for consistency across the application
 */
export const AnalyticsEvents = {
  // Authentication events
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',

  // Onboarding events
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',

  // Navigation events
  PAGE_VIEWED: 'page_viewed',
  TAB_CHANGED: 'tab_changed',
  MODAL_OPENED: 'modal_opened',
  MODAL_CLOSED: 'modal_closed',

  // Timeline events
  TIMELINE_VIEWED: 'timeline_viewed',
  TIMELINE_NODE_CLICKED: 'timeline_node_clicked',
  TIMELINE_NODE_EXPANDED: 'timeline_node_expanded',
  TIMELINE_NODE_COLLAPSED: 'timeline_node_collapsed',

  // Career transition events
  CAREER_TRANSITION_CREATED: 'career_transition_created',
  CAREER_TRANSITION_UPDATED: 'career_transition_updated',
  CAREER_TRANSITION_VIEWED: 'career_transition_viewed',

  // Work track events
  WORK_TRACK_CREATED: 'work_track_created',
  WORK_TRACK_UPDATED: 'work_track_updated',
  WORK_TRACK_VIEWED: 'work_track_viewed',

  // Session events
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  SESSION_MESSAGE_SENT: 'session_message_sent',

  // Search events
  SEARCH_PERFORMED: 'search_performed',
  SEARCH_RESULT_CLICKED: 'search_result_clicked',

  // Settings events
  SETTINGS_UPDATED: 'settings_updated',
  PROFILE_UPDATED: 'profile_updated',

  // Feature usage
  FEATURE_USED: 'feature_used',
  AI_FEATURE_USED: 'ai_feature_used',

  // Error events
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',

  // Engagement events
  BUTTON_CLICKED: 'button_clicked',
  LINK_CLICKED: 'link_clicked',
  FORM_SUBMITTED: 'form_submitted',
  FORM_ABANDONED: 'form_abandoned',
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

/**
 * Hook for analytics tracking
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { track, trackPageView, isEnabled } = useAnalytics();
 *
 *   const handleClick = () => {
 *     track('button_clicked', { button_name: 'submit' });
 *   };
 *
 *   return <button onClick={handleClick}>Submit</button>;
 * }
 * ```
 */
export function useAnalytics() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuthStore();

  /**
   * Track a custom event
   */
  const track = useCallback(
    (
      eventName: AnalyticsEventName | string,
      properties?: Record<string, any>
    ) => {
      trackEvent(eventName, {
        ...properties,
        // Add common properties
        page_path: location,
        timestamp: new Date().toISOString(),
      });
    },
    [location]
  );

  /**
   * Track a page view
   */
  const trackPage = useCallback(
    (pageName?: string, properties?: Record<string, any>) => {
      trackPageView(window.location.href, {
        page_name: pageName,
        page_path: location,
        ...properties,
      });
    },
    [location]
  );

  /**
   * Track when user identifies (login/signup)
   */
  const identify = useCallback(() => {
    if (user && isAuthenticated) {
      identifyUser(user.id, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        createdAt: user.createdAt,
        has_completed_onboarding: user.hasCompletedOnboarding,
        interest: user.interest,
      });
    }
  }, [user, isAuthenticated]);

  /**
   * Reset identity on logout
   */
  const reset = useCallback(() => {
    resetUser();
  }, []);

  /**
   * Update user properties
   */
  const setProperties = useCallback((properties: Record<string, any>) => {
    setUserProperties(properties);
  }, []);

  /**
   * Check if a feature flag is enabled
   */
  const checkFeatureFlag = useCallback((flagKey: string): boolean => {
    return isFeatureEnabled(flagKey);
  }, []);

  /**
   * Get a feature flag value
   */
  const getFeatureFlagValue = useCallback(
    (flagKey: string): string | boolean | undefined => {
      return getFeatureFlag(flagKey);
    },
    []
  );

  return {
    track,
    trackPage,
    identify,
    reset,
    setProperties,
    checkFeatureFlag,
    getFeatureFlagValue,
    isEnabled: isPostHogReady(),
  };
}

/**
 * Hook for automatic page view tracking
 * Use this in your router or main layout component
 */
export function usePageTracking() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Track page view on location change
    trackPageView(window.location.href, {
      page_path: location,
      is_authenticated: isAuthenticated,
    });
  }, [location, isAuthenticated]);
}

/**
 * Hook for tracking user identity changes
 * Automatically identifies users when they log in
 */
export function useIdentityTracking() {
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (user && isAuthenticated) {
      identifyUser(user.id, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        createdAt: user.createdAt,
        has_completed_onboarding: user.hasCompletedOnboarding,
        interest: user.interest,
      });
    } else if (!isAuthenticated) {
      resetUser();
    }
  }, [user, isAuthenticated]);
}
