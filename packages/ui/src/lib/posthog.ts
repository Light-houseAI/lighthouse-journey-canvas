/**
 * PostHog Analytics Configuration
 *
 * This module initializes and exports the PostHog client for analytics tracking.
 * PostHog is configured via environment variables:
 * - VITE_POSTHOG_KEY: Your PostHog project API key
 * - VITE_POSTHOG_HOST: PostHog host URL (defaults to https://us.i.posthog.com)
 *
 * Analytics is automatically disabled in development unless VITE_POSTHOG_KEY is set.
 */
import posthog from 'posthog-js';

// Environment configuration
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://us.i.posthog.com';
const IS_DEVELOPMENT = import.meta.env.DEV;

// Flag to track if PostHog is enabled (API key exists)
export const isPostHogEnabled = Boolean(POSTHOG_KEY);

// Track initialization state
let isInitialized = false;

/**
 * Check if PostHog is ready to track events
 */
export function isPostHogReady(): boolean {
  return isPostHogEnabled && isInitialized;
}

/**
 * Initialize PostHog client
 * Should be called once at app startup
 */
export function initPostHog(): void {
  if (isInitialized) {
    return; // Already initialized
  }

  if (!POSTHOG_KEY) {
    if (IS_DEVELOPMENT) {
      console.log('[Analytics] PostHog disabled - no API key configured');
    }
    return;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Capture page views automatically (we'll handle this with our router)
      capture_pageview: false,
      // Capture page leaves for session duration tracking
      capture_pageleave: true,
      // Respect Do Not Track browser setting
      respect_dnt: true,
      // Disable in development if needed (controlled by env var presence)
      loaded: (ph) => {
        // Enable debug mode in development
        if (IS_DEVELOPMENT) {
          ph.debug();
        }
      },
      // Session recording options (disabled by default, enable via PostHog dashboard)
      disable_session_recording: true,
      // Autocapture settings - captures clicks, inputs, etc.
      autocapture: true,
      // Enable feature flags
      bootstrap: {
        featureFlags: {},
      },
    });

    isInitialized = true;
    console.log('[Analytics] PostHog initialized');
  } catch (error) {
    console.error('[Analytics] Failed to initialize PostHog:', error);
  }
}

/**
 * Identify a user with PostHog
 * Call this when a user logs in or signs up
 */
export function identifyUser(
  userId: string | number,
  properties?: {
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    userName?: string | null;
    createdAt?: string | Date;
    [key: string]: any;
  }
): void {
  if (!isPostHogReady()) return;

  try {
    const distinctId = String(userId);
    const userProperties: Record<string, any> = {};

    if (properties) {
      if (properties.email) userProperties.email = properties.email;
      if (properties.firstName) userProperties.first_name = properties.firstName;
      if (properties.lastName) userProperties.last_name = properties.lastName;
      if (properties.userName) userProperties.username = properties.userName;
      if (properties.createdAt) {
        userProperties.created_at =
          properties.createdAt instanceof Date
            ? properties.createdAt.toISOString()
            : properties.createdAt;
      }

      // Pass through any additional properties
      Object.keys(properties).forEach((key) => {
        if (
          !['email', 'firstName', 'lastName', 'userName', 'createdAt'].includes(
            key
          )
        ) {
          userProperties[key] = properties[key];
        }
      });
    }

    posthog.identify(distinctId, userProperties);
  } catch (error) {
    console.error('[Analytics] Failed to identify user:', error);
  }
}

/**
 * Reset user identity (call on logout)
 */
export function resetUser(): void {
  if (!isPostHogReady()) return;

  try {
    posthog.reset();
  } catch (error) {
    console.error('[Analytics] Failed to reset user:', error);
  }
}

/**
 * Track a custom event
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!isPostHogReady()) return;

  try {
    posthog.capture(eventName, properties);
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error);
  }
}

/**
 * Track a page view
 */
export function trackPageView(
  path?: string,
  properties?: Record<string, any>
): void {
  if (!isPostHogReady()) return;

  try {
    posthog.capture('$pageview', {
      $current_url: path || window.location.href,
      ...properties,
    });
  } catch (error) {
    console.error('[Analytics] Failed to track page view:', error);
  }
}

/**
 * Set user properties without identifying
 * Useful for updating properties on an already-identified user
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (!isPostHogReady()) return;

  try {
    posthog.people.set(properties);
  } catch (error) {
    console.error('[Analytics] Failed to set user properties:', error);
  }
}

/**
 * Set user properties that should only be set once (e.g., signup date)
 */
export function setUserPropertiesOnce(properties: Record<string, any>): void {
  if (!isPostHogReady()) return;

  try {
    posthog.people.set_once(properties);
  } catch (error) {
    console.error('[Analytics] Failed to set user properties once:', error);
  }
}

/**
 * Register super properties that will be sent with every event
 */
export function registerSuperProperties(properties: Record<string, any>): void {
  if (!isPostHogReady()) return;

  try {
    posthog.register(properties);
  } catch (error) {
    console.error('[Analytics] Failed to register super properties:', error);
  }
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagKey: string): boolean {
  if (!isPostHogReady()) return false;

  try {
    return posthog.isFeatureEnabled(flagKey) ?? false;
  } catch (error) {
    console.error('[Analytics] Failed to check feature flag:', error);
    return false;
  }
}

/**
 * Get feature flag value (for multivariate flags)
 */
export function getFeatureFlag(flagKey: string): string | boolean | undefined {
  if (!isPostHogReady()) return undefined;

  try {
    return posthog.getFeatureFlag(flagKey);
  } catch (error) {
    console.error('[Analytics] Failed to get feature flag:', error);
    return undefined;
  }
}

/**
 * Opt user out of tracking
 */
export function optOut(): void {
  if (!isPostHogReady()) return;

  try {
    posthog.opt_out_capturing();
  } catch (error) {
    console.error('[Analytics] Failed to opt out:', error);
  }
}

/**
 * Opt user back into tracking
 */
export function optIn(): void {
  if (!isPostHogReady()) return;

  try {
    posthog.opt_in_capturing();
  } catch (error) {
    console.error('[Analytics] Failed to opt in:', error);
  }
}

/**
 * Check if user has opted out of tracking
 */
export function hasOptedOut(): boolean {
  if (!isPostHogReady()) return true;

  try {
    return posthog.has_opted_out_capturing();
  } catch (error) {
    console.error('[Analytics] Failed to check opt out status:', error);
    return true;
  }
}

// Export the PostHog instance for advanced usage
export { posthog };
