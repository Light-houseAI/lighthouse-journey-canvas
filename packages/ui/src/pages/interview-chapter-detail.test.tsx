import { SubjectType } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationStatus } from '../components/nodes/career-transition/wizard/steps/types';
import { ThemeProvider } from '../contexts/ThemeContext';
import * as interviewChapterHooks from '../hooks/use-interview-chapter';
import InterviewChapterDetail from './interview-chapter-detail';

// Mock the interview chapter hooks
vi.mock('../hooks/use-interview-chapter', () => ({
  useAllNodes: vi.fn(),
  useApplicationNode: vi.fn(),
}));

// Mock wouter
vi.mock('wouter', () => ({
  useRoute: vi.fn(() => [true, { applicationId: 'app-123' }]),
  useLocation: vi.fn(() => ['/interview-chapter/app-123', vi.fn()]),
}));

// Mock auth store
vi.mock('../stores/auth-store', () => {
  const mockUseAuthStore = vi.fn(() => ({
    user: { id: 'user-123', name: 'John Doe', email: 'john@example.com' },
  }));
  mockUseAuthStore.subscribe = vi.fn();
  mockUseAuthStore.getState = vi.fn(() => ({
    user: { id: 'user-123', name: 'John Doe', email: 'john@example.com' },
  }));
  return {
    useAuthStore: mockUseAuthStore,
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

// Helper to setup mock hooks with default values
const setupMockHooks = (overrides?: {
  application?: any;
  isLoading?: boolean;
  allNodes?: any[];
}) => {
  const defaultApplication = overrides?.application
    ? {
        ...overrides.application,
        owner: overrides.application.owner ?? {
          id: 123,
          userName: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        permissions: overrides.application.permissions ?? null,
      }
    : undefined;

  vi.mocked(interviewChapterHooks.useAllNodes).mockReturnValue({
    data: overrides?.allNodes ?? [],
  } as any);
  vi.mocked(interviewChapterHooks.useApplicationNode).mockReturnValue({
    data: defaultApplication,
    isLoading: overrides?.isLoading ?? false,
  } as any);
};

describe('InterviewChapterDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(interviewChapterHooks.useAllNodes).mockReturnValue({
      data: [],
    } as any);
    vi.mocked(interviewChapterHooks.useApplicationNode).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    const { container } = render(<InterviewChapterDetail />, {
      wrapper: createWrapper(),
    });

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should render chapter header with company name', async () => {
    const mockApplication = {
      id: 'app-123',
      type: 'event',
      userId: 'user-123',
      owner: {
        id: 123,
        userName: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      },
      meta: {
        company: 'Google',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.RecruiterScreen,
        applicationDate: '2025-10-01',
        todos: [],
      },
    };

    setupMockHooks({ application: mockApplication });

    render(<InterviewChapterDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Google Interviews')).toBeInTheDocument();
      // Owner avatar should be present with name
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should show last updated date', async () => {
    const mockApplication = {
      id: 'app-123',
      type: 'event',
      userId: 'user-123',
      meta: {
        company: 'Google',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.RecruiterScreen,
        applicationDate: '2025-10-01',
        todos: [],
      },
    };

    setupMockHooks({ application: mockApplication });

    render(<InterviewChapterDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText(/Last Updated October 2025/i)
      ).toBeInTheDocument();
    });
  });

  it('should show visibility info when shared', async () => {
    const mockApplication = {
      id: 'app-123',
      type: 'event',
      userId: 'user-123',
      permissions: [
        { subjectType: SubjectType.Organization, subjectId: 1 },
        { subjectType: SubjectType.Organization, subjectId: 2 },
        { subjectType: SubjectType.User, subjectId: 3 },
      ],
      meta: {
        company: 'Google',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.RecruiterScreen,
        applicationDate: '2025-10-01',
        todos: [],
      },
    };

    setupMockHooks({ application: mockApplication });

    render(<InterviewChapterDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText('Shared with 2 networks and 1 individual')
      ).toBeInTheDocument();
    });
  });

  it('should not show visibility info when private', async () => {
    const mockApplication = {
      id: 'app-123',
      type: 'event',
      userId: 'user-123',
      permissions: [],
      meta: {
        company: 'Google',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.RecruiterScreen,
        applicationDate: '2025-10-01',
        todos: [],
      },
    };

    setupMockHooks({ application: mockApplication });

    render(<InterviewChapterDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/Shared with/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Public')).not.toBeInTheDocument();
    });
  });

  it('should render editable TodoList for owner', async () => {
    const mockApplication = {
      id: 'app-123',
      type: 'event',
      userId: 'user-123',
      meta: {
        company: 'Google',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.RecruiterScreen,
        applicationDate: '2025-10-01',
        todos: [
          { id: '1', description: 'Research company', status: 'pending' },
          { id: '2', description: 'Prepare for call', status: 'completed' },
        ],
      },
    };

    setupMockHooks({ application: mockApplication });

    render(<InterviewChapterDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Recruiter Screen')).toBeInTheDocument();
      expect(screen.getByText('Research company')).toBeInTheDocument();
      expect(screen.getByText('Prepare for call')).toBeInTheDocument();
      // Should have Add button (editable)
      expect(screen.getByText('Add')).toBeInTheDocument();
    });
  });

  it('should render read-only todos for non-owner', async () => {
    const mockApplication = {
      id: 'app-123',
      type: 'event',
      userId: 'other-user',
      meta: {
        company: 'Google',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.RecruiterScreen,
        applicationDate: '2025-10-01',
        todos: [
          { id: '1', description: 'Research company', status: 'pending' },
          { id: '2', description: 'Prepare for call', status: 'completed' },
        ],
      },
    };

    setupMockHooks({ application: mockApplication });

    render(<InterviewChapterDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Recruiter Screen')).toBeInTheDocument();
      expect(screen.getByText('Research company')).toBeInTheDocument();
      expect(screen.getByText('Prepare for call')).toBeInTheDocument();
      // Should NOT have Add button (read-only)
      expect(screen.queryByText('Add')).not.toBeInTheDocument();
    });
  });

  it('should display interview context if available', async () => {
    const mockApplication = {
      id: 'app-123',
      type: 'event',
      userId: 'user-123',
      meta: {
        company: 'Google',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.RecruiterScreen,
        applicationDate: '2025-10-01',
        interviewContext:
          'This is a 30-minute introductory call with the recruiter.',
        todos: [],
      },
    };

    setupMockHooks({ application: mockApplication });

    render(<InterviewChapterDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText(
          'This is a 30-minute introductory call with the recruiter.'
        )
      ).toBeInTheDocument();
    });
  });

  it('should show correct status label', async () => {
    const mockApplication = {
      id: 'app-123',
      type: 'event',
      userId: 'user-123',
      meta: {
        company: 'Google',
        jobTitle: 'Software Engineer',
        applicationStatus: ApplicationStatus.TechnicalInterview,
        applicationDate: '2025-10-01',
        todos: [
          { id: '1', description: 'Review algorithms', status: 'pending' },
        ],
      },
    };

    setupMockHooks({ application: mockApplication });

    render(<InterviewChapterDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Technical Interview')).toBeInTheDocument();
    });
  });
});
