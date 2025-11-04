import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApplicationStatus,
  EventType,
  OutreachMethod,
} from '../components/nodes/career-transition/wizard/steps/types';
import { ThemeProvider } from '../contexts/ThemeContext';
import { hierarchyApi } from '../services/hierarchy-api';
import CareerTransitionDetail from './career-transition-detail';

// Mock the hierarchy API
vi.mock('../services/hierarchy-api', () => ({
  hierarchyApi: {
    getNode: vi.fn(),
    listNodes: vi.fn(),
  },
}));

// Mock wouter
vi.mock('wouter', async () => {
  const actual = await vi.importActual('wouter');
  return {
    ...actual,
    useRoute: vi.fn(() => [true, { nodeId: 'test-node-123' }]),
  };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('CareerTransitionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(hierarchyApi.getNode).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(hierarchyApi.listNodes).mockImplementation(
      () => new Promise(() => {})
    );

    const { container } = render(<CareerTransitionDetail />, {
      wrapper: createWrapper(),
    });

    // Check for loading spinner
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should render career transition node title', async () => {
    const mockNode = {
      id: 'test-node-123',
      type: 'careerTransition',
      meta: {
        title: 'My Job Search Journey',
      },
    };

    vi.mocked(hierarchyApi.getNode).mockResolvedValue(mockNode as any);
    vi.mocked(hierarchyApi.listNodes).mockResolvedValue([]);

    render(<CareerTransitionDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('My Job Search Journey')).toBeInTheDocument();
    });
  });

  it('should show empty state when no interview chapters exist', async () => {
    const mockNode = {
      id: 'test-node-123',
      type: 'careerTransition',
      meta: { title: 'Job Search' },
    };

    vi.mocked(hierarchyApi.getNode).mockResolvedValue(mockNode as any);
    vi.mocked(hierarchyApi.listNodes).mockResolvedValue([]);

    render(<CareerTransitionDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText(/No interview chapters yet/i)
      ).toBeInTheDocument();
    });
  });

  it('should display only interview status applications as chapters', async () => {
    const mockNode = {
      id: 'test-node-123',
      type: 'careerTransition',
      meta: { title: 'Job Search' },
    };

    const mockApplications = [
      {
        id: 'app-1',
        parentId: 'test-node-123',
        type: 'event',
        meta: {
          eventType: EventType.JobApplication,
          company: 'Tech Corp',
          jobTitle: 'Software Engineer',
          applicationDate: '2025-10-01',
          applicationStatus: ApplicationStatus.Applied, // Not interview status - should not appear
          outreachMethod: OutreachMethod.CompanyWebsite,
          todos: [
            { id: '1', description: 'Follow up', status: 'pending' },
            {
              id: '2',
              description: 'Prepare for interview',
              status: 'in-progress',
            },
          ],
        },
      },
      {
        id: 'app-2',
        parentId: 'test-node-123',
        type: 'event',
        meta: {
          eventType: EventType.JobApplication,
          company: 'Startup Inc',
          jobTitle: 'Senior Developer',
          applicationDate: '2025-10-05',
          applicationStatus: ApplicationStatus.PhoneInterview, // Interview status - should appear
          outreachMethod: OutreachMethod.Referral,
          todos: [],
        },
      },
    ];

    vi.mocked(hierarchyApi.getNode).mockResolvedValue(mockNode as any);
    vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
      mockApplications as any
    );

    render(<CareerTransitionDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should show interview status application
      expect(screen.getByText('Startup Inc')).toBeInTheDocument();
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();

      // Should NOT show non-interview application
      expect(screen.queryByText('Tech Corp')).not.toBeInTheDocument();
    });
  });

  it('should render My tasks sidebar with todos grouped by application', async () => {
    const mockNode = {
      id: 'test-node-123',
      type: 'careerTransition',
      meta: { title: 'Job Search' },
    };

    const mockApplications = [
      {
        id: 'app-1',
        parentId: 'test-node-123',
        type: 'event',
        meta: {
          eventType: EventType.JobApplication,
          company: 'Tech Corp',
          jobTitle: 'Software Engineer',
          applicationDate: '2025-10-01',
          applicationStatus: ApplicationStatus.Applied,
          outreachMethod: OutreachMethod.CompanyWebsite,
          statusData: {
            [ApplicationStatus.Applied]: {
              todos: [
                { id: '1', description: 'Follow up', status: 'pending' },
                {
                  id: '2',
                  description: 'Prepare for interview',
                  status: 'in-progress',
                },
              ],
            },
          },
        },
      },
      {
        id: 'app-2',
        parentId: 'test-node-123',
        type: 'event',
        meta: {
          eventType: EventType.JobApplication,
          company: 'Startup Inc',
          jobTitle: 'Senior Developer',
          applicationDate: '2025-10-05',
          applicationStatus: ApplicationStatus.PhoneInterview,
          outreachMethod: OutreachMethod.Referral,
          statusData: {
            [ApplicationStatus.PhoneInterview]: {
              todos: [
                { id: '3', description: 'Send portfolio', status: 'pending' },
              ],
            },
          },
        },
      },
    ];

    vi.mocked(hierarchyApi.getNode).mockResolvedValue(mockNode as any);
    vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
      mockApplications as any
    );

    render(<CareerTransitionDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Check for sidebar heading
      expect(screen.getByText('My tasks')).toBeInTheDocument();

      // Check for application grouping (company names may appear in both chapters and tasks sections)
      expect(screen.getAllByText('Tech Corp').length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('Software Engineer').length
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Startup Inc').length).toBeGreaterThanOrEqual(
        1
      );
      expect(
        screen.getAllByText('Senior Developer').length
      ).toBeGreaterThanOrEqual(1);

      // Check for individual todos
      expect(screen.getByText('Follow up')).toBeInTheDocument();
      expect(screen.getByText('Prepare for interview')).toBeInTheDocument();
      expect(screen.getByText('Send portfolio')).toBeInTheDocument();
    });
  });

  it('should show empty tasks message when no tasks exist', async () => {
    const mockNode = {
      id: 'test-node-123',
      type: 'careerTransition',
      meta: { title: 'Job Search' },
    };

    const mockApplications = [
      {
        id: 'app-1',
        parentId: 'test-node-123',
        type: 'event',
        meta: {
          eventType: EventType.JobApplication,
          company: 'Tech Corp',
          jobTitle: 'Software Engineer',
          applicationDate: '2025-10-01',
          applicationStatus: ApplicationStatus.PhoneInterview, // Interview status
          outreachMethod: OutreachMethod.CompanyWebsite,
          statusData: {},
        },
      },
    ];

    vi.mocked(hierarchyApi.getNode).mockResolvedValue(mockNode as any);
    vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
      mockApplications as any
    );

    render(<CareerTransitionDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/No tasks yet/i)).toBeInTheDocument();
    });
  });

  it('should filter applications by parent node ID', async () => {
    const mockNode = {
      id: 'test-node-123',
      type: 'careerTransition',
      meta: { title: 'Job Search' },
    };

    const mockApplications = [
      {
        id: 'app-1',
        parentId: 'test-node-123', // Belongs to this career transition
        type: 'event',
        meta: {
          eventType: EventType.JobApplication,
          company: 'Tech Corp',
          jobTitle: 'Software Engineer',
          applicationDate: '2025-10-01',
          applicationStatus: ApplicationStatus.TechnicalInterview, // Interview status
          outreachMethod: OutreachMethod.CompanyWebsite,
          statusData: {},
        },
      },
      {
        id: 'app-2',
        parentId: 'other-node-456', // Belongs to different career transition
        type: 'event',
        meta: {
          eventType: EventType.JobApplication,
          company: 'Other Corp',
          jobTitle: 'Manager',
          applicationDate: '2025-10-05',
          applicationStatus: ApplicationStatus.PhoneInterview, // Interview status but wrong parent
          outreachMethod: OutreachMethod.Referral,
          statusData: {},
        },
      },
    ];

    vi.mocked(hierarchyApi.getNode).mockResolvedValue(mockNode as any);
    vi.mocked(hierarchyApi.listNodes).mockResolvedValue(
      mockApplications as any
    );

    render(<CareerTransitionDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should show the correct application
      expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      // Should NOT show the other application (wrong parent)
      expect(screen.queryByText('Other Corp')).not.toBeInTheDocument();
    });
  });
});
