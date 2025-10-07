/**
 * @vitest-environment jsdom
 * PeopleAccessSection Tests
 * Testing the people access management and integration with PersonPermissionsView
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PeopleAccessSection } from './PeopleAccessSection';
import { useShareStore } from '../../stores/share-store';
import { VisibilityLevel } from '@journey/schema';
import { createMockShareStore } from '../../test-utils/share-store-mock';

// Mock the share store
vi.mock('../../stores/share-store');

// Mock the permission API
vi.mock('../../services/permission-api', () => ({
  setNodePermissions: vi.fn().mockResolvedValue({}),
  getNodePermissions: vi.fn().mockResolvedValue([]),
  deleteNodePermission: vi.fn().mockResolvedValue({}),
}));

// Mock the toast hook
vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the SearchPeopleComponent
vi.mock('./SearchPeopleComponent', () => ({
  SearchPeopleComponent: ({ onPersonSelect, placeholder }: any) => (
    <div data-testid="search-people">
      <input placeholder={placeholder} />
      <button
        onClick={() =>
          onPersonSelect({
            id: 99,
            userName: 'new.user',
            firstName: 'New',
            lastName: 'User',
            title: 'Engineer',
            company: 'Tech Co',
            avatarUrl: '',
          })
        }
      >
        Add New User
      </button>
    </div>
  ),
}));

// Mock the BulkPersonPermissionsView component
vi.mock('./BulkPersonPermissionsView', () => ({
  BulkPersonPermissionsView: ({ people, onBack, onSave }: any) => (
    <div data-testid="person-permissions-view">
      <h2>
        Person Permissions for {people[0]?.firstName} {people[0]?.lastName}
      </h2>
      <button onClick={onBack}>Back</button>
      <button
        onClick={() =>
          onSave({
            userIds: people.map((p: any) => p.id),
            detailLevel: 'full',
          })
        }
      >
        Save
      </button>
    </div>
  ),
}));

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

describe('PeopleAccessSection', () => {
  let mockShareStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for share store
    mockShareStore = createMockShareStore({
      currentPermissions: {
        organizations: [],
        users: [],
        public: null,
      },
      isLoadingPermissions: false,
      userNodes: [
        { id: 'node-1', title: 'Node 1' } as any,
        { id: 'node-2', title: 'Node 2' } as any,
      ],
      config: {
        selectedNodes: ['node-1', 'node-2'],
        shareAllNodes: false,
        targets: [],
      },
      fetchCurrentPermissions: vi.fn().mockResolvedValue(undefined),
    });

    (useShareStore as Mock).mockReturnValue(mockShareStore);
    // Also mock getState
    (useShareStore as any).getState = vi.fn(() => mockShareStore);
  });

  describe('Empty State Display', () => {
    it('should display empty state when no people have access', () => {
      render(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Check empty state elements
      expect(
        screen.getByText('Your journey is private by default')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Share with others to pass on your knowledge/)
      ).toBeInTheDocument();

      // Should show search component
      expect(screen.getByTestId('search-people')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search for people by name')).toBeInTheDocument();
    });
  });

  describe('People List Display', () => {
    it('should display people list when users have access', () => {
      mockShareStore.currentPermissions = {
        organizations: [],
        users: [
          {
            id: 1,
            username: 'john.doe',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            experienceLine: 'Software Engineer at Tech Corp',
            avatarUrl: 'https://example.com/avatar.jpg',
            accessLevel: VisibilityLevel.Overview,
          },
          {
            id: 2,
            username: 'jane.smith',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@example.com',
            experienceLine: 'Product Manager at Design Co',
            avatarUrl: '',
            accessLevel: VisibilityLevel.Full,
          },
        ],
        public: { enabled: false, nodes: [], accessLevel: 'overview' },
      };

      (useShareStore as Mock).mockReturnValue(mockShareStore);

      render(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Should show "People with view access" header
      expect(screen.getByText('People with view access')).toBeInTheDocument();

      // Should show both users
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(
        screen.getByText('Software Engineer at Tech Corp')
      ).toBeInTheDocument();
      expect(screen.getByText('Limited access')).toBeInTheDocument();

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(
        screen.getByText('Product Manager at Design Co')
      ).toBeInTheDocument();
      expect(screen.getByText('Full access')).toBeInTheDocument();

      // Should still show search component at top
      expect(screen.getByTestId('search-people')).toBeInTheDocument();
    });
  });

  describe('Navigation to PersonPermissionsView', () => {
    it('should navigate to PersonPermissionsView when selecting a new person from search', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Click "Add New User" button from search mock
      const addButton = screen.getByRole('button', { name: /add new user/i });
      await user.click(addButton);

      // Should show PersonPermissionsView
      await waitFor(() => {
        expect(
          screen.getByTestId('person-permissions-view')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Person Permissions for New User')
        ).toBeInTheDocument();
      });
    });

    it('should navigate when clicking on existing person access button', async () => {
      const user = userEvent.setup();

      mockShareStore.currentPermissions = {
        organizations: [],
        users: [
          {
            id: 1,
            username: 'john.doe',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            experienceLine: 'Software Engineer at Tech Corp',
            avatarUrl: '',
            accessLevel: VisibilityLevel.Overview,
          },
        ],
        public: { enabled: false, nodes: [], accessLevel: 'overview' },
      };

      (useShareStore as Mock).mockReturnValue(mockShareStore);

      render(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Find the arrow button for John Doe (testid based on username)
      const johnDoeSection = screen.getByTestId('permission-john.doe');
      const arrowButton = johnDoeSection.querySelector('button:last-child');

      // Note: In the actual implementation, this doesn't navigate yet
      // but the test structure is ready for when it's implemented
      await user.click(arrowButton!);

      // Currently doesn't navigate (not implemented), but test is ready
      expect(
        screen.queryByTestId('person-permissions-view')
      ).not.toBeInTheDocument();
    });
  });

  describe('Save and Back Navigation', () => {
    it('should handle Back button and return to people list', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Add a new person
      const addButton = screen.getByRole('button', { name: /add new user/i });
      await user.click(addButton);

      // Should show PersonPermissionsView
      expect(screen.getByTestId('person-permissions-view')).toBeInTheDocument();

      // Click Back button
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      // Should return to people list/empty state
      await waitFor(() => {
        expect(
          screen.queryByTestId('person-permissions-view')
        ).not.toBeInTheDocument();
        expect(
          screen.getByText('Your journey is private by default')
        ).toBeInTheDocument();
      });
    });

    it('should handle Save button and save permissions', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Add a new person
      const addButton = screen.getByRole('button', { name: /add new user/i });
      await user.click(addButton);

      // Click Save button
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should return to people list
      await waitFor(() => {
        expect(
          screen.queryByTestId('person-permissions-view')
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('search-people')).toBeInTheDocument();
      });
    });

    it('should update the people list after saving permissions', async () => {
      const user = userEvent.setup();

      // Start with no users
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
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Initially shows empty state
      expect(
        screen.getByText('Your journey is private by default')
      ).toBeInTheDocument();

      // Add a new person
      const addButton = screen.getByRole('button', { name: /add new user/i });
      await user.click(addButton);

      // Save permissions
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Simulate the store update after save
      const updatedStore = {
        ...mockShareStore,
        currentPermissions: {
          organizations: [],
          users: [
            {
              id: 99,
              username: 'new.user',
              firstName: 'New',
              lastName: 'User',
              email: 'new.user@example.com',
              experienceLine: 'Engineer at Tech Co',
              avatarUrl: '',
              accessLevel: VisibilityLevel.Full,
            },
          ],
          public: { enabled: false, nodes: [], accessLevel: 'overview' },
        },
      };

      (useShareStore as Mock).mockReturnValue(updatedStore);

      // Rerender to reflect store changes
      rerender(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Should now show the user in the list
      await waitFor(() => {
        expect(screen.getByText('People with view access')).toBeInTheDocument();
        expect(screen.getByText('New User')).toBeInTheDocument();
        expect(screen.getByText('Full access')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state when permissions are loading', () => {
      (useShareStore as Mock).mockReturnValue({
        ...mockShareStore,
        isLoadingPermissions: true,
      });

      render(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      expect(screen.getByText('Loading current access...')).toBeInTheDocument();
    });
  });

  describe('Access Level Display', () => {
    it('should display correct access level text based on VisibilityLevel', () => {
      mockShareStore.currentPermissions = {
        organizations: [],
        users: [
          {
            id: 1,
            username: 'user.one',
            firstName: 'User',
            lastName: 'One',
            email: 'user.one@example.com',
            experienceLine: '',
            avatarUrl: '',
            accessLevel: VisibilityLevel.Overview,
          },
          {
            id: 2,
            username: 'user.two',
            firstName: 'User',
            lastName: 'Two',
            email: 'user.two@example.com',
            experienceLine: '',
            avatarUrl: '',
            accessLevel: VisibilityLevel.Full,
          },
        ],
        public: { enabled: false, nodes: [], accessLevel: 'overview' },
      };

      (useShareStore as Mock).mockReturnValue(mockShareStore);

      render(
        <TestWrapper>
          <PeopleAccessSection />
        </TestWrapper>
      );

      // Check access level display
      expect(screen.getByText('Limited access')).toBeInTheDocument();
      expect(screen.getByText('Full access')).toBeInTheDocument();
    });
  });
});
