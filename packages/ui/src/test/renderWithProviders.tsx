/**
 * renderWithProviders - Centralized test helper for component testing
 *
 * Provides a complete testing environment with all necessary providers:
 * - React Router (MemoryRouter)
 * - Zustand stores (auth, hierarchy, profile-view)
 * - MSW handlers
 * - React Query
 *
 * @example
 * ```typescript
 * // Simple usage
 * renderWithProviders(<Component />);
 *
 * // With auth state
 * renderWithProviders(<Component />, {
 *   authState: { user: mockUser, isAuthenticated: true }
 * });
 *
 * // With MSW handler override
 * renderWithProviders(<Component />, {
 *   handlers: [
 *     http.post('/api/endpoint', () => HttpResponse.json({ success: true }))
 *   ]
 * });
 *
 * // With initial route
 * const { router } = renderWithProviders(<Component />, {
 *   initialRoute: '/profile/123'
 * });
 * ```
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HttpHandler } from 'msw';
import React from 'react';
import { Router, BaseLocationHook } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';

import type { AuthState } from '../stores/auth-store';
import type { HierarchyState } from '../stores/hierarchy-store';
import { server } from '../mocks/server';
import { useAuthStore } from '../stores/auth-store';
import { useHierarchyStore } from '../stores/hierarchy-store';
import { useProfileReviewStore } from '../stores/profile-review-store';
import { useProfileViewStore } from '../stores/profile-view-store';

// Type for profile view store state - minimal definition
interface ProfileViewState {
  isPanelOpen: boolean;
  panelNodeId: string | null;
  panelMode: 'view' | 'edit';
  selectedNodeId: string | null;
  allNodes: Record<string, unknown>[] | null;
  expandedNodeIds: Set<string>;
}

// Type for profile review store state - minimal definition
interface ProfileReviewState {
  extractedProfile: unknown | null;
  username: string | null;
  selection: unknown | null;
  showSuccess: boolean;
  isLoading: boolean;
  error: string | null;
  selectedInterest: string | null;
  currentOnboardingStep: 1 | 2 | 3;
}

/**
 * Options for customizing the test environment
 */
export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial route for Wouter
   * @default '/'
   */
  initialRoute?: string;

  /**
   * Initial auth store state
   */
  authState?: Partial<AuthState>;

  /**
   * Initial hierarchy store state
   */
  hierarchyState?: Partial<HierarchyState>;

  /**
   * Initial profile view store state
   */
  profileViewState?: Partial<ProfileViewState>;

  /**
   * Initial profile review store state
   */
  profileReviewState?: Partial<ProfileReviewState>;

  /**
   * MSW request handlers to add or override for this test
   * These are reset after each test automatically
   */
  handlers?: HttpHandler[];

  /**
   * Custom QueryClient instance
   * Useful for testing loading states or specific query configurations
   */
  queryClient?: QueryClient;
}

/**
 * Creates a test QueryClient with optimized settings for tests
 * - No retries
 * - No refetching
 * - No caching between tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchInterval: false,
        staleTime: 0,
        gcTime: 0, // Previously cacheTime
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

/**
 * Main render helper that wraps components with all necessary providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const {
    initialRoute = '/',
    authState,
    hierarchyState,
    profileViewState,
    profileReviewState,
    handlers,
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  // Apply MSW handler overrides if provided
  if (handlers && handlers.length > 0) {
    server.use(...handlers);
  }

  // Initialize stores with test state
  if (authState) {
    useAuthStore.setState(authState);
  }

  if (hierarchyState) {
    useHierarchyStore.setState(hierarchyState);
  }

  if (profileViewState) {
    useProfileViewStore.setState(profileViewState);
  }

  if (profileReviewState) {
    useProfileReviewStore.setState(profileReviewState);
  }

  // Create user event instance with proper setup
  const user = userEvent.setup();

  // Create a memory location hook for testing
  const memLocation = memoryLocation({ path: initialRoute, record: true });

  // Router ref for programmatic navigation in tests
  const routerRef = {
    navigate: memLocation.navigate,
    get location() {
      // Get the current location from history (last item)
      const history = memLocation.history;
      return history[history.length - 1] || initialRoute;
    },
  };

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <QueryClientProvider client={queryClient}>
        <Router hook={memLocation.hook as BaseLocationHook}>
          {children}
        </Router>
      </QueryClientProvider>
    );
  };

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    user,
    router: routerRef,
    queryClient,
  };
}

/**
 * Utility to reset all stores to initial state
 * Useful for cleanup in tests that modify store state directly
 */
export function resetAllStores() {
  useAuthStore.setState({
    user: null,
    isLoading: false,
    error: null,
    isAuthenticated: false,
    organizations: [],
    isLoadingOrganizations: false,
  });

  useHierarchyStore.setState({
    nodes: [],
    tree: { nodes: [], edges: [] },
    loading: false,
    error: null,
    hasData: false,
    insights: {},
    insightLoading: {},
    selectedNodeId: null,
    focusedNodeId: null,
    layoutDirection: 'LR',
    expandedNodeIds: new Set<string>(),
    panelMode: 'view',
    showPanel: false,
  });

  useProfileViewStore.setState({
    isPanelOpen: false,
    panelNodeId: null,
    panelMode: 'view',
    selectedNodeId: null,
    allNodes: null,
    expandedNodeIds: new Set<string>(),
  });

  useProfileReviewStore.getState().reset();
}

// Re-export commonly used testing utilities for convenience
export { screen, waitFor, within, fireEvent } from '@testing-library/react';
export { http, HttpResponse } from 'msw';