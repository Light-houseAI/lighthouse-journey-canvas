/**
 * @vitest-environment jsdom
 * NetworksAccessSection Tests
 * Testing the networks access management and integration with NetworkPermissionsView
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NetworksAccessSection } from './NetworksAccessSection';
import { useShareStore } from '@/stores/share-store';
import { getUserOrganizations } from '@/services/organization-api';
import { Organization } from '@journey/schema';

// Mock the hooks and API
vi.mock('@/stores/share-store');
vi.mock('@/services/organization-api', () => ({
  getUserOrganizations: vi.fn(),
}));

// Mock the NetworkPermissionsView component
vi.mock('./NetworkPermissionsView', () => ({
  NetworkPermissionsView: ({ organization, onBack, onSave }: any) => (
    <div data-testid="network-permissions-view">
      <h2>Network Permissions for {organization.name}</h2>
      <button onClick={onBack}>Back</button>
      <button
        onClick={() =>
          onSave({
            organizationId: organization.id,
            journeyScope: 'all',
            detailLevel: 'full',
          })
        }
      >
        Save
      </button>
    </div>
  ),
}));

// Mock the PublicAccessSection component
vi.mock('./PublicAccessSection', () => ({
  PublicAccessSection: () => (
    <div data-testid="public-access-section">
      <button data-testid="public-access-dropdown">No access</button>
    </div>
  ),
}));

const mockOrganizations: Organization[] = [
  {
    id: 1,
    name: 'Syracuse University',
    type: 'educational_institution',
    metadata: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    name: 'University of Maryland',
    type: 'educational_institution',
    metadata: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 3,
    name: 'PayPal',
    type: 'company',
    metadata: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

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

describe('NetworksAccessSection', () => {
  let mockShareStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for share store
    mockShareStore = {
      config: {
        selectedNodes: ['node-1', 'node-2'],
        shareAllNodes: false,
      },
      currentPermissions: {
        organizations: [],
        users: [],
        public: { enabled: false, nodes: [], accessLevel: 'overview' },
      },
      isLoadingPermissions: false,
      userNodes: [
        { id: 'node-1', title: 'Node 1' },
        { id: 'node-2', title: 'Node 2' },
      ],
      updateOrganizationPermissions: vi.fn(),
    };

    (useShareStore as Mock).mockReturnValue(mockShareStore);
    (getUserOrganizations as Mock).mockResolvedValue(mockOrganizations);
  });

  describe('Organization List Display', () => {
    it('should display all organizations with "No access" when no permissions exist', () => {
      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Check all organizations are displayed
      expect(screen.getByText('Syracuse University')).toBeInTheDocument();
      expect(screen.getByText('University of Maryland')).toBeInTheDocument();
      expect(screen.getByText('PayPal')).toBeInTheDocument();
      expect(screen.getByText('Public')).toBeInTheDocument();

      // Organizations should show "No access" buttons
      const noAccessElements = screen.getAllByText('No access');
      expect(noAccessElements).toHaveLength(3); // 3 orgs (public uses dropdown component)

      // Public should have the dropdown component
      expect(screen.getByTestId('public-access-section')).toBeInTheDocument();
    });

    it('should display correct access levels when permissions exist', () => {
      mockShareStore.currentPermissions = {
        organizations: [
          { id: 1, nodes: ['node-1'], accessLevel: 'overview' },
          { id: 2, nodes: ['node-1', 'node-2'], accessLevel: 'full' },
        ],
        users: [],
        public: { enabled: false, nodes: [], accessLevel: 'overview' },
      };

      (useShareStore as Mock).mockReturnValue(mockShareStore);

      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Syracuse should have Limited access (has some nodes)
      const limitedAccessElements = screen.getAllByText('Limited access');
      expect(limitedAccessElements).toHaveLength(1);

      // Maryland should have Full access
      expect(screen.getByText('Full access')).toBeInTheDocument();

      // PayPal should have No access
      const noAccessElements = screen.getAllByText('No access');
      expect(noAccessElements).toHaveLength(2); // PayPal + General public
    });
  });

  describe('Navigation to NetworkPermissionsView', () => {
    it('should navigate to NetworkPermissionsView when clicking on organization with "No access"', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Find Syracuse University row
      const syracuseRow = screen
        .getByText('Syracuse University')
        .closest('div[class*="flex items-center justify-between"]');

      // Click the arrow button for Syracuse
      const arrowButton = syracuseRow?.querySelector('button');
      expect(arrowButton).toBeInTheDocument();
      await user.click(arrowButton!);

      // Should show NetworkPermissionsView
      await waitFor(() => {
        expect(
          screen.getByTestId('network-permissions-view')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Network Permissions for Syracuse University')
        ).toBeInTheDocument();
      });
    });

    it('should not navigate when clicking on organization with existing access', async () => {
      const user = userEvent.setup();

      mockShareStore.currentPermissions = {
        organizations: [
          { id: 1, nodes: ['node-1', 'node-2'], accessLevel: 'full' },
        ],
        users: [],
        public: { enabled: false, nodes: [], accessLevel: 'overview' },
      };

      (useShareStore as Mock).mockReturnValue(mockShareStore);

      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Find Syracuse University row (has Full access)
      const syracuseRow = screen
        .getByText('Syracuse University')
        .closest('div[class*="flex items-center justify-between"]');
      const arrowButton = syracuseRow?.querySelector('button');
      await user.click(arrowButton!);

      // Should NOT show NetworkPermissionsView (because it has access already)
      expect(
        screen.queryByTestId('network-permissions-view')
      ).not.toBeInTheDocument();
    });
  });

  describe('Save and Back Navigation', () => {
    it('should handle Back button and return to organization list', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Navigate to permissions view
      const syracuseRow = screen
        .getByText('Syracuse University')
        .closest('div[class*="flex items-center justify-between"]');
      const arrowButton = syracuseRow?.querySelector('button');
      await user.click(arrowButton!);

      // Should show NetworkPermissionsView
      expect(
        screen.getByTestId('network-permissions-view')
      ).toBeInTheDocument();

      // Click Back button
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      // Should return to organization list
      await waitFor(() => {
        expect(
          screen.queryByTestId('network-permissions-view')
        ).not.toBeInTheDocument();
        expect(screen.getByText('Syracuse University')).toBeInTheDocument();
        expect(screen.getByText('University of Maryland')).toBeInTheDocument();
      });
    });

    it('should handle Save button and update permissions', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Navigate to permissions view
      const syracuseRow = screen
        .getByText('Syracuse University')
        .closest('div[class*="flex items-center justify-between"]');
      const arrowButton = syracuseRow?.querySelector('button');
      await user.click(arrowButton!);

      // Click Save button
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should log the save action (current implementation)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Saving permissions for organization:',
        {
          organizationId: 1,
          journeyScope: 'all',
          detailLevel: 'full',
        }
      );

      // Should return to organization list
      await waitFor(() => {
        expect(
          screen.queryByTestId('network-permissions-view')
        ).not.toBeInTheDocument();
        expect(screen.getByText('Syracuse University')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should update the organization list after saving permissions', async () => {
      const user = userEvent.setup();

      // Start with no permissions
      const initialStore = {
        ...mockShareStore,
        currentPermissions: {
          organizations: [],
          users: [],
          public: { enabled: false, nodes: [], accessLevel: 'overview' },
        },
      };

      (useShareStore as Mock).mockReturnValue(initialStore);

      const { rerender } = render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Initially organizations show "No access", public has dropdown
      expect(screen.getAllByText('No access')).toHaveLength(3);

      // Navigate to permissions view for Syracuse
      const syracuseRow = screen
        .getByText('Syracuse University')
        .closest('div[class*="flex items-center justify-between"]');
      const arrowButton = syracuseRow?.querySelector('button');
      await user.click(arrowButton!);

      // Save permissions
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Simulate the store update after save
      const updatedStore = {
        ...mockShareStore,
        currentPermissions: {
          organizations: [
            { id: 1, nodes: ['node-1', 'node-2'], accessLevel: 'full' },
          ],
          users: [],
          public: { enabled: false, nodes: [], accessLevel: 'overview' },
        },
      };

      (useShareStore as Mock).mockReturnValue(updatedStore);

      // Rerender to reflect store changes
      rerender(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Syracuse should now show "Full access"
      await waitFor(() => {
        expect(screen.getByText('Full access')).toBeInTheDocument();
        // Others still show "No access" (except public which uses dropdown)
        expect(screen.getAllByText('No access')).toHaveLength(2);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state when permissions are loading', () => {
      (useShareStore as Mock).mockReturnValue({
        ...mockShareStore,
        config: mockShareStore.config,
        isLoadingPermissions: true,
      });

      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Public Access Display', () => {
    it('should display Public with dropdown for access control', () => {
      mockShareStore.currentPermissions = {
        organizations: [],
        users: [],
        public: {
          enabled: true,
          nodes: ['node-1', 'node-2'],
          accessLevel: 'full',
        },
      };

      (useShareStore as Mock).mockReturnValue(mockShareStore);

      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      expect(screen.getByText('Public')).toBeInTheDocument();
      expect(
        screen.getByText('Anybody with an account or share link')
      ).toBeInTheDocument();

      // Public should have dropdown component
      expect(screen.getByTestId('public-access-section')).toBeInTheDocument();
      expect(screen.getByTestId('public-access-dropdown')).toBeInTheDocument();
    });

    it('should display Public dropdown even when no permissions exist', () => {
      mockShareStore.currentPermissions = {
        organizations: [],
        users: [],
        public: {
          enabled: false,
          nodes: [],
          accessLevel: 'overview',
        },
      };

      (useShareStore as Mock).mockReturnValue(mockShareStore);

      render(
        <TestWrapper>
          <NetworksAccessSection />
        </TestWrapper>
      );

      // Public should still have dropdown component
      expect(screen.getByTestId('public-access-section')).toBeInTheDocument();
      expect(screen.getByTestId('public-access-dropdown')).toBeInTheDocument();
    });
  });
});
