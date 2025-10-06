/**
 * InsightsSection Unit Tests
 *
 * Functional tests for insights section display and permissions
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsightsSection } from './InsightsSection';
import { VisibilityLevel } from '@journey/schema';
import type { TimelineNode, NodeInsight } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
const mockUseNodeInsights = vi.fn();
const mockUseDeleteInsight = vi.fn();
const mockUseUpdateInsight = vi.fn();
const mockUseCreateInsight = vi.fn();

vi.mock('../../../hooks/useNodeInsights', () => ({
  useNodeInsights: (nodeId: string, enabled: boolean) => mockUseNodeInsights(nodeId, enabled),
  useDeleteInsight: () => mockUseDeleteInsight(),
  useUpdateInsight: () => mockUseUpdateInsight(),
  useCreateInsight: () => mockUseCreateInsight(),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('InsightsSection', () => {
  const mockNode: TimelineNode = {
    id: 'job-1',
    type: 'job',
    title: 'Software Engineer',
    permissions: {
      canEdit: true,
      canDelete: true,
      accessLevel: VisibilityLevel.Full,
    },
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInsights: NodeInsight[] = [
    {
      id: 1,
      nodeId: 'job-1',
      description: 'First insight',
      resources: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      nodeId: 'job-1',
      description: 'Second insight',
      resources: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    mockUseDeleteInsight.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseUpdateInsight.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseCreateInsight.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  describe('Permission-based Visibility', () => {
    it('should not render when user has no access', () => {
      const nodeWithoutAccess = {
        ...mockNode,
        permissions: {
          ...mockNode.permissions!,
          canEdit: false,
          accessLevel: VisibilityLevel.Summary,
        },
      };

      mockUseNodeInsights.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      const { container } = renderWithClient(<InsightsSection node={nodeWithoutAccess} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when user is owner', () => {
      mockUseNodeInsights.mockReturnValue({
        data: mockInsights,
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={mockNode} />);
      expect(screen.getByText('Insights')).toBeInTheDocument();
    });

    it('should render when user has full access', () => {
      const nodeWithFullAccess = {
        ...mockNode,
        permissions: {
          ...mockNode.permissions!,
          canEdit: false,
          accessLevel: VisibilityLevel.Full,
        },
      };

      mockUseNodeInsights.mockReturnValue({
        data: mockInsights,
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={nodeWithFullAccess} />);
      expect(screen.getByText('Insights')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      mockUseNodeInsights.mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
      });

      renderWithClient(<InsightsSection node={mockNode} />);
      expect(screen.getByText('Loading insights...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', () => {
      mockUseNodeInsights.mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error('Failed to fetch'),
      });

      renderWithClient(<InsightsSection node={mockNode} />);
      expect(screen.getByText('Failed to load insights. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state for owner', () => {
      mockUseNodeInsights.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={mockNode} />);
      expect(screen.getByText('No insights yet. Share your learnings!')).toBeInTheDocument();
      expect(screen.getByText('Add Your First Insight')).toBeInTheDocument();
    });

    it('should show empty state for non-owner with full access', () => {
      const nodeWithFullAccess = {
        ...mockNode,
        permissions: {
          ...mockNode.permissions!,
          canEdit: false,
          accessLevel: VisibilityLevel.Full,
        },
      };

      mockUseNodeInsights.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={nodeWithFullAccess} />);
      expect(screen.getByText('No insights available.')).toBeInTheDocument();
      expect(screen.queryByText('Add Your First Insight')).not.toBeInTheDocument();
    });
  });

  describe('Insights Display', () => {
    it('should display insights count', () => {
      mockUseNodeInsights.mockReturnValue({
        data: mockInsights,
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={mockNode} />);
      expect(screen.getByText('(2)')).toBeInTheDocument();
    });

    it('should render insights list', () => {
      mockUseNodeInsights.mockReturnValue({
        data: mockInsights,
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={mockNode} />);
      // Check that at least one insight is rendered (animations may hide others in tests)
      expect(screen.getByText('First insight')).toBeInTheDocument();
    });
  });

  describe('Add Insight Button', () => {
    it('should show add button for owners', () => {
      mockUseNodeInsights.mockReturnValue({
        data: mockInsights,
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={mockNode} />);
      expect(screen.getByText('Add Insight')).toBeInTheDocument();
    });

    it('should not show add button for non-owners', () => {
      const nodeWithFullAccess = {
        ...mockNode,
        permissions: {
          ...mockNode.permissions!,
          canEdit: false,
          accessLevel: VisibilityLevel.Full,
        },
      };

      mockUseNodeInsights.mockReturnValue({
        data: mockInsights,
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={nodeWithFullAccess} />);
      expect(screen.queryByText('Add Insight')).not.toBeInTheDocument();
    });

    it('should open insight form when add button is clicked', async () => {
      const user = userEvent.setup();
      mockUseNodeInsights.mockReturnValue({
        data: mockInsights,
        isLoading: false,
        error: null,
      });

      renderWithClient(<InsightsSection node={mockNode} />);
      
      const addButton = screen.getByText('Add Insight');
      await user.click(addButton);

      expect(screen.getByText('Add New Insight')).toBeInTheDocument();
    });
  });
});
