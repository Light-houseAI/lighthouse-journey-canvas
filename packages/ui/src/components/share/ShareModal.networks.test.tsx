/**
 * ShareModal Networks Tab Tests
 * Testing the Networks tab display of current permissions based on Figma design
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShareModal } from './ShareModal';
import { useShareStore } from '../../stores/share-store';
import { useAuthStore } from '../../stores/auth-store';
import {
  resetMockPermissions,
  setMockPermissionsScenario,
} from '../../mocks/permission-handlers';
import { hierarchyApi } from '../../services/hierarchy-api';

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

describe('ShareModal - Networks Tab', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockPermissions(); // Start with empty permissions to match Figma

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

  describe('Networks Tab Display', () => {
    it('should display Networks tab with proper styling when selected', async () => {
      const user = userEvent.setup();

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

      // Click on Networks tab
      const networksTab = screen.getByRole('button', { name: /Networks/i });
      await user.click(networksTab);

      // Networks tab should be active (have white background)
      expect(networksTab).toHaveClass('bg-white');

      // People tab should not be active
      const peopleTab = screen.getByRole('button', { name: /People/i });
      expect(peopleTab).not.toHaveClass('bg-white');
    });

    // TODO: Re-enable once we implement organization access functionality
    // it('should show list of organizations with access', async () => {
    //   const user = userEvent.setup();

    //   render(
    //     <TestWrapper>
    //       <ShareModal />
    //     </TestWrapper>
    //   );

    //   // Wait for permissions to load
    //   await waitFor(() => {
    //     expect(screen.queryByText(/Loading current access/i)).not.toBeInTheDocument();
    //   }, { timeout: 5000 });

    //   // Switch to Networks tab
    //   const networksTab = screen.getByRole('button', { name: /Networks/i });
    //   await user.click(networksTab);

    //   // Should show count of networks
    //   await waitFor(() => {
    //     expect(screen.getByText('3 networks have access')).toBeInTheDocument();
    //   });

    //   // Click Show details
    //   const showDetailsButton = screen.getByRole('button', { name: /Show details/i });
    //   await user.click(showDetailsButton);

    //   // Check all organizations are displayed
    //   await waitFor(() => {
    //     expect(screen.getByText('Syracuse University')).toBeInTheDocument();
    //     expect(screen.getByText('University of Maryland')).toBeInTheDocument();
    //     expect(screen.getByText('PayPal')).toBeInTheDocument();
    //   });
    // });

    // TODO: Re-enable once organization details are implemented
    // it('should show organization types and member counts', async () => {
    //   const user = userEvent.setup();

    //   render(
    //     <TestWrapper>
    //       <ShareModal />
    //     </TestWrapper>
    //   );

    //   // Wait and switch to Networks tab
    //   await waitFor(() => {
    //     expect(screen.queryByText(/Loading current access/i)).not.toBeInTheDocument();
    //   }, { timeout: 5000 });

    //   const networksTab = screen.getByRole('button', { name: /Networks/i });
    //   await user.click(networksTab);

    //   // Expand details
    //   const showDetailsButton = screen.getByRole('button', { name: /Show details/i });
    //   await user.click(showDetailsButton);

    //   // Check organization types are displayed
    //   await waitFor(() => {
    //     // Organizations should show their type (School, Company, etc)
    //     const syracuseSection = screen.getByText('Syracuse University').closest('[data-testid]');
    //     expect(within(syracuseSection!).getByText(/school/i)).toBeInTheDocument();

    //     const marylandSection = screen.getByText('University of Maryland').closest('[data-testid]');
    //     expect(within(marylandSection!).getByText(/school/i)).toBeInTheDocument();

    //     const paypalSection = screen.getByText('PayPal').closest('[data-testid]');
    //     expect(within(paypalSection!).getByText(/company/i)).toBeInTheDocument();
    //   });
    // });

    // TODO: Re-enable once access level display is implemented
    // it('should show correct access levels for each organization', async () => {
    //   const user = userEvent.setup();

    //   render(
    //     <TestWrapper>
    //       <ShareModal />
    //     </TestWrapper>
    //   );

    //   // Wait and switch to Networks tab
    //   await waitFor(() => {
    //     expect(screen.queryByText(/Loading current access/i)).not.toBeInTheDocument();
    //   }, { timeout: 5000 });

    //   const networksTab = screen.getByRole('button', { name: /Networks/i });
    //   await user.click(networksTab);

    //   // Expand details
    //   const showDetailsButton = screen.getByRole('button', { name: /Show details/i });
    //   await user.click(showDetailsButton);

    //   await waitFor(() => {
    //     // Syracuse should have Overview access
    //     const syracuseSection = screen.getByText('Syracuse University').closest('[data-testid]');
    //     expect(within(syracuseSection!).getByText('Overview')).toBeInTheDocument();

    //     // Maryland should have Full Access
    //     const marylandSection = screen.getByText('University of Maryland').closest('[data-testid]');
    //     expect(within(marylandSection!).getByText('Full Access')).toBeInTheDocument();

    //     // PayPal should have Overview access
    //     const paypalSection = screen.getByText('PayPal').closest('[data-testid]');
    //     expect(within(paypalSection!).getByText('Overview')).toBeInTheDocument();
    //   });
    // });

    // TODO: Re-enable once node access display is implemented
    // it('should show which nodes each organization has access to', async () => {
    //   const user = userEvent.setup();

    //   render(
    //     <TestWrapper>
    //       <ShareModal />
    //     </TestWrapper>
    //   );

    //   // Wait and switch to Networks tab
    //   await waitFor(() => {
    //     expect(screen.queryByText(/Loading current access/i)).not.toBeInTheDocument();
    //   }, { timeout: 5000 });

    //   const networksTab = screen.getByRole('button', { name: /Networks/i });
    //   await user.click(networksTab);

    //   // Expand details
    //   const showDetailsButton = screen.getByRole('button', { name: /Show details/i });
    //   await user.click(showDetailsButton);

    //   await waitFor(() => {
    //     // Syracuse should show it has access to education node
    //     const syracuseSection = screen.getByText('Syracuse University').closest('[data-testid]');
    //     expect(within(syracuseSection!).getByText(/education/i)).toBeInTheDocument();

    //     // PayPal should show it has access to job node
    //     const paypalSection = screen.getByText('PayPal').closest('[data-testid]');
    //     expect(within(paypalSection!).getByText(/job/i)).toBeInTheDocument();
    //   });
    // });

    it('should show all organizations with "No access" when no policies exist', async () => {
      // Reset permissions to have no organizations
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

      // Switch to Networks tab
      const networksTab = screen.getByRole('button', { name: /Networks/i });
      await userEvent.click(networksTab);

      // Should show all organizations from Figma design with "No access"
      await waitFor(() => {
        expect(screen.getByText('Syracuse University')).toBeInTheDocument();
        expect(screen.getByText('University of Maryland')).toBeInTheDocument();
        expect(screen.getByText('PayPal')).toBeInTheDocument();
        expect(screen.getByText('General public')).toBeInTheDocument();
      });

      // All should show "No access"
      const noAccessElements = screen.getAllByText('No access');
      expect(noAccessElements).toHaveLength(4); // 3 orgs + 1 public
    });

    it('should show organizations with access when policies exist', async () => {
      // Set permissions to the allOrganizations scenario
      setMockPermissionsScenario('allOrganizations');

      render(
        <TestWrapper>
          <ShareModal />
        </TestWrapper>
      );

      // Wait for permissions to load and fetch them
      await waitFor(
        () => {
          expect(
            screen.queryByText(/Loading current access/i)
          ).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Fetch current permissions for all nodes
      await act(async () => {
        const store = useShareStore.getState();
        await store.fetchCurrentPermissions(['node-1', 'node-2', 'node-3']);
      });

      // Switch to Networks tab
      const networksTab = screen.getByRole('button', { name: /Networks/i });
      await userEvent.click(networksTab);

      // Debug: log what's actually rendered
      const allTexts = screen
        .getAllByText(/access/i)
        .map((el) => el.textContent);
      console.log('All access texts found:', allTexts);

      // Should show all organizations (they should always be visible)
      await waitFor(() => {
        expect(screen.getByText('Syracuse University')).toBeInTheDocument();
        expect(screen.getByText('University of Maryland')).toBeInTheDocument();
        expect(screen.getByText('PayPal')).toBeInTheDocument();
        expect(screen.getByText('General public')).toBeInTheDocument();
      });

      // Should have multiple Limited accesses (Syracuse and PayPal)
      const limitedElements = screen.getAllByText('Limited access');
      expect(limitedElements).toHaveLength(2);

      // University of Maryland should show Full access
      expect(screen.getByText('Full access')).toBeInTheDocument();

      // General public should show No access
      expect(screen.getByText('No access')).toBeInTheDocument();
    });

    // TODO: Re-enable once editing access functionality is implemented
    // it('should allow editing access level for organizations', async () => {
    //   const user = userEvent.setup();

    //   render(
    //     <TestWrapper>
    //       <ShareModal />
    //     </TestWrapper>
    //   );

    //   // Wait and switch to Networks tab
    //   await waitFor(() => {
    //     expect(screen.queryByText(/Loading current access/i)).not.toBeInTheDocument();
    //   }, { timeout: 5000 });

    //   const networksTab = screen.getByRole('button', { name: /Networks/i });
    //   await user.click(networksTab);

    //   // Expand details
    //   const showDetailsButton = screen.getByRole('button', { name: /Show details/i });
    //   await user.click(showDetailsButton);

    //   // Find Syracuse's more options menu
    //   await waitFor(() => {
    //     expect(screen.getByText('Syracuse University')).toBeInTheDocument();
    //   });

    //   const syracuseSection = screen.getByText('Syracuse University').closest('[data-testid]');
    //   const moreButton = within(syracuseSection!).getAllByRole('button')[0]; // First button should be more options
    //   await user.click(moreButton);

    //   // Click Change access
    //   const changeAccessOption = screen.getByRole('menuitem', { name: /Change access/i });
    //   await user.click(changeAccessOption);

    //   // Should show access level selector
    //   const fullAccessOption = screen.getByRole('option', { name: /Full Access/i });
    //   expect(fullAccessOption).toBeInTheDocument();
    // });

    // TODO: Re-enable once removing access functionality is implemented
    // it('should allow removing organization access', async () => {
    //   const user = userEvent.setup();

    //   render(
    //     <TestWrapper>
    //       <ShareModal />
    //     </TestWrapper>
    //   );

    //   // Wait and switch to Networks tab
    //   await waitFor(() => {
    //     expect(screen.queryByText(/Loading current access/i)).not.toBeInTheDocument();
    //   }, { timeout: 5000 });

    //   const networksTab = screen.getByRole('button', { name: /Networks/i });
    //   await user.click(networksTab);

    //   // Expand details
    //   const showDetailsButton = screen.getByRole('button', { name: /Show details/i });
    //   await user.click(showDetailsButton);

    //   // Wait for organizations to appear
    //   await waitFor(() => {
    //     expect(screen.getByText('Syracuse University')).toBeInTheDocument();
    //   });

    //   // Initially should have 3 networks
    //   expect(screen.getByText('3 networks have access')).toBeInTheDocument();

    //   // Find and click more options for Syracuse
    //   const syracuseSection = screen.getByText('Syracuse University').closest('[data-testid]');
    //   const moreButton = within(syracuseSection!).getAllByRole('button')[0];
    //   await user.click(moreButton);

    //   // Click Remove access
    //   const removeOption = screen.getByRole('menuitem', { name: /Remove access/i });
    //   await user.click(removeOption);

    //   // Syracuse should be removed
    //   await waitFor(() => {
    //     expect(screen.queryByText('Syracuse University')).not.toBeInTheDocument();
    //     // Should now show 2 networks
    //     expect(screen.getByText('2 networks have access')).toBeInTheDocument();
    //   });
    // });
  });
});
