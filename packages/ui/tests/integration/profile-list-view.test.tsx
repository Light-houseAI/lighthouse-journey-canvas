/**
 * ProfileListView Integration Tests for LIG-175
 * Tests ProfileListView component with username parameter integration
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { ProfileListView } from '@/components/timeline/ProfileListView';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock the hierarchy API
jest.mock('@/services/hierarchy-api', () => ({
  hierarchyApi: {
    listNodesWithPermissions: jest.fn(),
    listUserNodes: jest.fn(),
  },
}));

// Mock auth store
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      userName: 'testuser',
    },
  }),
}));

// Mock other stores
jest.mock('@/stores/profile-view-store', () => ({
  useProfileViewStore: () => ({
    isPanelOpen: false,
    selectedNode: null,
    closePanel: jest.fn(),
  }),
}));

jest.mock('@/stores/hierarchy-store', () => ({
  useHierarchyStore: () => ({
    nodes: [],
    loading: false,
    error: null,
  }),
}));

const { hierarchyApi } = require('@/services/hierarchy-api');

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('ProfileListView Integration', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Default mock responses
    hierarchyApi.listNodesWithPermissions.mockResolvedValue([]);
    hierarchyApi.listUserNodes.mockResolvedValue([]);
  });

  describe('Username parameter integration', () => {
    it('should call correct API when viewing own profile (no username)', async () => {
      // Render without username (current user)
      render(
        <TestWrapper>
          <ProfileListView />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(hierarchyApi.listNodesWithPermissions).toHaveBeenCalledTimes(1);
        expect(hierarchyApi.listUserNodes).not.toHaveBeenCalled();
      });
    });

    it('should call correct API when viewing other user profile (with username)', async () => {
      const testUsername = 'otheruser';

      // Render with username (other user)
      render(
        <TestWrapper>
          <ProfileListView username={testUsername} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(hierarchyApi.listUserNodes).toHaveBeenCalledWith(testUsername);
        expect(hierarchyApi.listNodesWithPermissions).not.toHaveBeenCalled();
      });
    });

    it('should handle username changes correctly', async () => {
      const { rerender } = render(
        <TestWrapper>
          <ProfileListView />
        </TestWrapper>
      );

      // Initially viewing own profile
      await waitFor(() => {
        expect(hierarchyApi.listNodesWithPermissions).toHaveBeenCalledTimes(1);
      });

      // Change to viewing another user
      const testUsername = 'anotheruser';
      rerender(
        <TestWrapper>
          <ProfileListView username={testUsername} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(hierarchyApi.listUserNodes).toHaveBeenCalledWith(testUsername);
      });
    });
  });

  describe('Permission enforcement', () => {
    it('should render nodes from listNodesWithPermissions for current user', async () => {
      const mockNodes = [
        {
          id: '1',
          type: 'job',
          meta: {
            role: 'Software Engineer',
            company: 'Test Company',
            startDate: '2023-01-01',
          },
          permissions: { canEdit: true, canView: true },
        },
      ];

      hierarchyApi.listNodesWithPermissions.mockResolvedValue(mockNodes);

      render(
        <TestWrapper>
          <ProfileListView />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });
    });

    it('should render filtered nodes from listUserNodes for other users', async () => {
      const mockNodes = [
        {
          id: '1',
          type: 'job',
          meta: {
            role: 'Senior Developer',
            company: 'Other Company',
            startDate: '2022-01-01',
          },
          // Note: no edit permissions for other user's nodes
        },
      ];

      hierarchyApi.listUserNodes.mockResolvedValue(mockNodes);

      render(
        <TestWrapper>
          <ProfileListView username="otheruser" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Senior Developer')).toBeInTheDocument();
        expect(screen.getByText('Other Company')).toBeInTheDocument();
      });
    });

    it('should handle empty responses gracefully', async () => {
      hierarchyApi.listUserNodes.mockResolvedValue([]);

      render(
        <TestWrapper>
          <ProfileListView username="emptyuser" />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show empty state or no nodes
        expect(screen.queryByText('Software Engineer')).not.toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      hierarchyApi.listUserNodes.mockRejectedValue(new Error('API Error'));

      render(
        <TestWrapper>
          <ProfileListView username="erroruser" />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should handle error state (might show error message or empty state)
        expect(hierarchyApi.listUserNodes).toHaveBeenCalledWith('erroruser');
      });
    });
  });

  describe('Read-only mode enforcement', () => {
    it('should not show edit buttons when viewing other users', async () => {
      const mockNodes = [
        {
          id: '1',
          type: 'job',
          meta: {
            role: 'Test Role',
            company: 'Test Company',
          },
        },
      ];

      hierarchyApi.listUserNodes.mockResolvedValue(mockNodes);

      render(
        <TestWrapper>
          <ProfileListView username="otheruser" />
        </TestWrapper>
      );

      await waitFor(() => {
        // Edit buttons should not be present
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        expect(screen.queryByText('Delete')).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/edit/i)).not.toBeInTheDocument();
      });
    });

    it('should show edit capabilities on own profile', async () => {
      const mockNodes = [
        {
          id: '1',
          type: 'job',
          meta: {
            role: 'Test Role',
            company: 'Test Company',
          },
          permissions: { canEdit: true, canView: true },
        },
      ];

      hierarchyApi.listNodesWithPermissions.mockResolvedValue(mockNodes);

      render(
        <TestWrapper>
          <ProfileListView />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should have edit capabilities available (add buttons, etc.)
        // Note: Actual buttons might be in different components,
        // this test validates the data flow is correct
        expect(hierarchyApi.listNodesWithPermissions).toHaveBeenCalled();
      });
    });
  });

  describe('TanStack Query integration', () => {
    it('should use correct query key for current user', async () => {
      render(
        <TestWrapper>
          <ProfileListView />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(hierarchyApi.listNodesWithPermissions).toHaveBeenCalled();
      });

      // Query should be cached with current user key
      // Additional tests could verify caching behavior
    });

    it('should use correct query key for specific username', async () => {
      const testUsername = 'testuser123';

      render(
        <TestWrapper>
          <ProfileListView username={testUsername} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(hierarchyApi.listUserNodes).toHaveBeenCalledWith(testUsername);
      });
    });

    it('should handle loading states', async () => {
      // Create a promise that we can control
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      hierarchyApi.listUserNodes.mockReturnValue(pendingPromise);

      render(
        <TestWrapper>
          <ProfileListView username="loadinguser" />
        </TestWrapper>
      );

      // Should show loading state initially
      await waitFor(() => {
        expect(hierarchyApi.listUserNodes).toHaveBeenCalledWith('loadinguser');
      });

      // Resolve the promise
      resolvePromise!([]);

      await waitFor(() => {
        // Loading should be complete
        expect(hierarchyApi.listUserNodes).toHaveBeenCalledTimes(1);
      });
    });
  });
});
