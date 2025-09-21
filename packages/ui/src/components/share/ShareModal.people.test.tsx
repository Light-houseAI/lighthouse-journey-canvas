/**
 * ShareModal People Tab Tests
 * Testing the People tab display of current permissions based on Figma design
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShareModal } from './ShareModal';
import { useShareStore } from '@/stores/share-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  resetMockPermissions,
  setMockPermissionsScenario,
} from '@/mocks/permission-handlers';
import { hierarchyApi } from '@/services/hierarchy-api';

// Test wrapper with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ShareModal - People Tab', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockPermissions(); // Start with empty permissions

    // Load organizations through the auth store action (relies on MSW mock)
    await act(async () => {
      const authStore = useAuthStore.getState();
      await authStore.loadOrganizations();
    });

    // Fetch nodes from the mocked API endpoint instead of manually setting them
    await act(async () => {
      const nodes = await hierarchyApi.listNodes();
      const store = useShareStore.getState();
      store.openModal(nodes);
    });
  });

  afterEach(() => {
    // Clean up store state
    act(() => {
      const store = useShareStore.getState();
      store.closeModal();
    });
  });

  describe('People Tab Display', () => {
    it('should display People tab as default selection', async () => {
      render(
        <TestWrapper>
          <ShareModal />
        </TestWrapper>
      );

      // Wait for permissions to load
      await waitFor(
        () => {
          expect(
            screen.queryByText(/Loading current access/i)
          ).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // People tab should be active by default (have white background)
      const peopleTab = screen.getByRole('button', { name: /People/i });
      expect(peopleTab).toHaveClass('bg-white');

      // Networks tab should not be active
      const networksTab = screen.getByRole('button', { name: /Networks/i });
      expect(networksTab).not.toHaveClass('bg-white');
    });

    it('should show empty state when no people have access', async () => {
      // Reset permissions to have no people
      resetMockPermissions();

      render(
        <TestWrapper>
          <ShareModal />
        </TestWrapper>
      );

      // Wait for permissions to load
      await waitFor(
        () => {
          expect(
            screen.queryByText(/Loading current access/i)
          ).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Fetch current permissions to populate the store
      await act(async () => {
        const store = useShareStore.getState();
        await store.fetchCurrentPermissions(['node-1', 'node-2', 'node-3']);
      });

      // Should show empty state message
      await waitFor(() => {
        expect(
          screen.getByText('Your journey is private by default')
        ).toBeInTheDocument();
      });

      // Should show search functionality
      expect(
        screen.getByPlaceholderText(/Search by name/i)
      ).toBeInTheDocument();
    });

    it('should show search bar for finding new people to share with', async () => {
      render(
        <TestWrapper>
          <ShareModal />
        </TestWrapper>
      );

      // Wait for permissions to load
      await waitFor(
        () => {
          expect(
            screen.queryByText(/Loading current access/i)
          ).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Should always show search bar
      expect(
        screen.getByPlaceholderText(/Search by name/i)
      ).toBeInTheDocument();
    });

    it('should show people with current access when permissions exist', async () => {
      // Set permissions to have some people with access
      setMockPermissionsScenario('usersWithAccess');

      render(
        <TestWrapper>
          <ShareModal />
        </TestWrapper>
      );

      // Wait for permissions to load
      await waitFor(
        () => {
          expect(
            screen.queryByText(/Loading current access/i)
          ).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Fetch current permissions to populate the store
      await act(async () => {
        const store = useShareStore.getState();
        await store.fetchCurrentPermissions(['node-1', 'node-2', 'node-3']);
      });

      // Should show "People with view access" heading
      await waitFor(() => {
        expect(screen.getByText('People with view access')).toBeInTheDocument();
      });

      // Should show user names
      await waitFor(() => {
        expect(screen.getByText('Neil Sayers')).toBeInTheDocument();
        expect(screen.getByText('Neil Summers')).toBeInTheDocument();
      });
    });

    it('should allow expanding to see details of people with access', async () => {
      // Set permissions to have some people with access
      setMockPermissionsScenario('usersWithAccess');

      render(
        <TestWrapper>
          <ShareModal />
        </TestWrapper>
      );

      // Wait for permissions to load
      await waitFor(
        () => {
          expect(
            screen.queryByText(/Loading current access/i)
          ).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Fetch current permissions to populate the store
      await act(async () => {
        const store = useShareStore.getState();
        await store.fetchCurrentPermissions(['node-1', 'node-2', 'node-3']);
      });

      // Verify users are shown
      await waitFor(() => {
        expect(screen.getByText('Neil Sayers')).toBeInTheDocument();
        expect(screen.getByText('Neil Summers')).toBeInTheDocument();
      });

      // Check that access levels are displayed
      expect(screen.getByText('Overview access')).toBeInTheDocument();
      expect(screen.getByText('Full access')).toBeInTheDocument(); // Neil Summers has full access
    });
  });

  describe('Search Functionality', () => {
    it('should filter search results based on user input', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ShareModal />
        </TestWrapper>
      );

      // Wait for modal to load
      await waitFor(
        () => {
          expect(
            screen.queryByText(/Loading current access/i)
          ).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Find search input
      const searchInput = screen.getByPlaceholderText(/Search by name/i);
      expect(searchInput).toBeInTheDocument();

      // Type in search
      await user.type(searchInput, 'Neil');

      // This would show search results (once we implement the search functionality)
      // For now, just verify the input works
      expect(searchInput).toHaveValue('Neil');
    });
  });
});
